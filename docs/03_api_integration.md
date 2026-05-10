# 03. 案件管理システム（kanri-system）との連携仕様

本ドキュメントは、カレンダーシステムと既存の案件管理システム（`kanri-system`）をどのように連携させるかを定義します。

## 1. 連携アーキテクチャ

**推奨方式:** 同一Supabaseプロジェクト + 別リポジトリ（APIルート連携）

カレンダーシステムを `kanri-system` と同じ Supabase プロジェクトに接続します。これにより、DBレベルでの直接参照（外部キー制約、RLSの共有）が可能になります。ただし、ソースコードは別リポジトリ（または別のNext.jsアプリケーション）として独立させ、必要な機能はAPI経由で呼び出す疎結合な設計とします。

## 2. 予定登録時の案件検索（サジェスト機能）

予定登録フォームで案件番号や案件名を入力した際、`kanri-system` の案件データを検索してサジェスト表示します。

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
   カレンダーの予定登録フォームから上記APIを呼び出します。

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

## 4. 実働時間の連携（Phase 2以降）

予定を「完了」ステータスに変更した際、入力された実働時間（`actual_minutes`）を案件ごとの稼働時間として集計します。

### 実装手順

1. 予定のステータス更新時に、`actual_minutes` が入力されているか確認する。
2. 入力されている場合、`project_schedule_logs` テーブルにレコードを INSERT または UPDATE する。
3. `kanri-system` 側で、この `project_schedule_logs` を集計して案件の採算管理に利用する。
