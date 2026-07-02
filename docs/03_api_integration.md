# 03. 案件管理システム（kanri-system）との連携仕様

本ドキュメントは、カレンダーシステムと既存の案件管理システム（`kanri-system`）をどのように連携させるかを定義します。

## 1. 連携アーキテクチャ

**推奨方式:** 同一Supabaseプロジェクト + 別リポジトリ（APIルート連携）

カレンダーシステムを `kanri-system` と同じ Supabase プロジェクトに接続します。これにより、DBレベルでの直接参照（外部キー制約、RLSの共有）が可能になります。ただし、ソースコードは別リポジトリ（または別のNext.jsアプリケーション）として独立させ、必要な機能はAPI経由で呼び出す疎結合な設計とします。

## 2. 予定登録時の案件検索（サジェスト機能）

予定登録フォームで案件番号・案件名・顧客名を入力した際、`kanri-system` の案件データを検索してサジェスト表示します。顧客名は案件関係者スナップショット（`case_persons.snapshot_name`）を検索対象に含めます。

### 実装手順

1. **APIルートの作成（kanri-system側）**
   `kanri-system` に、カレンダーから呼び出せる検索用APIエンドポイントを作成します。
   （既存の Server Action `listCases()` をラップする形になります）

   ```typescript
   // kanri-system: src/app/api/cases/search/route.ts
   import { NextResponse } from "next/server";
   import { listCases } from "@/server/cases";

   export async function GET(request: Request) {
     const { searchParams } = new URL(request.url);
     const q = searchParams.get("q") || "";
     
     // listCases() を呼び出して結果を返す
     const result = await listCases({ q, perPage: 10 });
     
     if (!result.ok) {
       return NextResponse.json({ error: result.error }, { status: 500 });
     }
     return NextResponse.json(result.data);
   }
   ```

2. **フロントエンドでの呼び出し（カレンダー側）**
   カレンダーの予定登録フォームから上記APIを呼び出します。カレンダー側は同一Supabaseプロジェクトを共有しているため、`cases` / `case_persons` を直接検索できる場合は共有DBを優先し、外部APIはフォールバックとして使います。

   ```typescript
   // カレンダー側: 案件検索のフェッチ関数例
   async function searchCases(query: string) {
     const res = await fetch(`${process.env.NEXT_PUBLIC_KANRI_SYSTEM_URL}/api/cases/search?q=${query}`);
     if (!res.ok) throw new Error("案件の検索に失敗しました");
     return res.json();
   }
   ```

3. **データの保存**
   ユーザーが案件を選択したら、`cases.id` を `case_id` として、`cases.case_number` を `case_number` として `schedules` テーブルに保存します。

## 3. 案件詳細へのリンク

予定詳細画面に「案件詳細を開く」リンクを設置します。

```tsx
// カレンダー側: 予定詳細コンポーネント内
<Link href={`${process.env.NEXT_PUBLIC_KANRI_SYSTEM_URL}/cases/${schedule.case_id}`}>
  案件詳細を開く ({schedule.case_number})
</Link>
```

## 4. 作業時間（実施時間）の連携

予定を「完了」ステータスに変更した際、確定された作業時間（実施時間）を案件ごとの稼働時間として集計します。

当初予定の `start_at` / `end_at` は上書きしません。完了時に `actual_start_at` / `actual_end_at` / `actual_minutes` / `actual_memo` を保存し、「予定 13:30〜17:00／作業時間（実施時間）13:30〜17:30」のように両方を残します。

### 実装手順

1. カレンダー上の「完了」から作業終了時刻を確認・修正する。
2. `actual_minutes` を算出し、`actual_memo` と合わせて保存する。
3. `project_schedule_logs` テーブルにレコードを INSERT または UPDATE する。
4. `kanri-system` 側で、この `project_schedule_logs` を集計して案件の採算管理に利用する。

## 5. Lark OAuth・会議URL連携

LarkはG-DX予定の正本ではなく、OAuthログイン、ユーザー情報取得、会議URL発行、通知に限定して利用します。

### 5.1 OAuthログイン

- `/api/auth/lark/start` で state Cookie と next Cookie を発行し、Lark認可画面へリダイレクトします。
- `/api/auth/lark/callback` で state を照合し、`authen/v1/access_token` と `authen/v1/user_info` を使ってユーザーを確認します。
- 既存 `users` はメールまたは `calendar_user_profiles.lark_open_id` で突合します。未登録ユーザーは自動作成しません。
- セッションCookieにはランダムトークンのみを保存し、`calendar_user_sessions.token_hash` にハッシュを保存します。

### 5.2 会議URL発行

オンライン予定では次のAPIを使って、Lark会議URLを発行します。

```http
POST /api/calendar/meeting-url/lark
```

```json
{
  "title": "オンライン予定",
  "startAt": "2026-06-26T13:30:00.000+09:00",
  "endAt": "2026-06-26T14:30:00.000+09:00",
  "mainAssigneeId": "user-id"
}
```

レスポンスの `larkEventId` は `schedules.lark_event_id` に保存し、Larkイベントの二重作成を避けます。担当者本人の user access token がない場合は再ログインを求めます。

### 5.3 カレンダー同期

`/api/lark/calendar/sync` のpush/bothや個別flushは、本番環境では `LARK_SYNC_SECRET` を必須にします。ログインユーザー本人のpull同期はセッションで許可します。開発環境のみ、secret未設定でもローカル確認を許可します。
LarkのカレンダーIDは環境変数で固定せず、ログイン済みユーザーの user access token で主カレンダーIDを取得し、`calendar_user_profiles.lark_calendar_id` にキャッシュします。Lark予定を取り込むpull同期では対象ユーザーを `userId` で指定し、未指定時はログイン中ユーザー本人を対象にします。

### 5.4 Lark IM 通知

- 予定の招待・変更通知は、対象メンバーの `lark_open_id` 宛にダイレクトメッセージで送信します（`/im/v1/messages`、tenant token使用）。
- 日報提出通知は、管理画面「通知設定」で設定したグループチャット（`chat_id`）宛に送信します。チャット未設定または「管理者へのDMも送る」がオンの場合は、管理者ロールの各ユーザーへDMを送ります。
- 通知の送信はServer Actionの応答をブロックしないよう `after()` で非同期実行します。
- 送信結果は `calendar_notification_logs` に記録し、失敗分は 5分→15分→60分 の指数バックオフで再送します。再送のトリガーは `POST /api/notifications/retry`（`NOTIFICATION_CRON_SECRET` または管理者セッション）と管理画面「通知ログ」の再送ボタンです。
- 必要なLarkアプリ権限：`im:message:send_as_bot`（送信）、`im:chat:readonly`（通知設定画面のチャット一覧ピッカー。未付与の場合は手入力にフォールバック）。
- グループ通知を送るには、対象チャットに本システムのボット（アプリ）を追加しておく必要があります（管理画面に注意書きを表示）。
