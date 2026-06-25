# 06. Luxates型Larkカレンダー連携 実装指示書

- 作成日: 2026-06-26
- 対象: カレンダー｜dreaMs
- 参照元: `/Users/shojiyuya/Desktop/仕事/グラスト/案件/G-DX/Luxates/新カレンダー案件`
- 目的: Luxatesで実装済みのLark連携設計を、カレンダー｜dreaMsへ安全に移植する。

---

## 0. この指示書の使い方

このファイルは、別チャットのCodexへそのまま渡して実装するための指示書です。

最初に必ず以下を読んでください。

1. `AGENTS.md`
2. `docs/01_implementation_guide.md`
3. `docs/02_database_schema.md`
4. `docs/03_api_integration.md`
5. 本ファイル

Luxates側は以下を重点的に参照してください。

- `docs/lark_custom_calendar_requirements.md`
- `docs/lark_calendar_implementation_workplan.md`
- `docs/lark_calendar_implementation_status.md`
- `docs/lark_oauth_login.md`
- `docs/lark_directory_sync.md`
- `.env.example`
- `src/server/lark/client.ts`
- `src/server/lark/oauth.ts`
- `src/server/lark/calendar.ts`
- `src/server/auth/session.ts`
- `src/server/auth/current-user.ts`
- `src/server/notifications/lark-bot.ts`
- `src/server/notifications/event-notifications.ts`
- `src/app/api/calendar/meeting-url/lark/route.ts`
- `src/lib/permissions/permissions.ts`
- `src/server/calendar/events.ts`
- `tests/auth/session.test.ts`
- `tests/calendar/backend-contract.test.ts`
- `tests/visibility/external-visibility.test.ts`

---

## 1. 移植の基本方針

Luxates実装の本質は「DBを正とする業務カレンダー」です。Larkカレンダーを正本にしないでください。

G-DX側では以下の境界を守ります。

- 予定・作業時間・日報・案件連動はG-DXのDBを正とする。
- LarkはOAuth、ユーザー情報取得、会議URL発行、通知、必要な範囲のカレンダー同期に限定する。
- LuxatesはPrisma実装だが、G-DXにはPrismaを追加しない。既存のSupabaseクライアント、Server Actions、Route Handlersに合わせる。
- 共有テーブルである`users`、`cases`は再定義しない。G-DX固有のLark情報が必要な場合は、本システム固有テーブルをmigrationで追加する。
- App ID/Secret以外のLark ID、カレンダーID、チャットID、Base IDなどはハードコードしない。
- 予定の当初時間`start_at`/`end_at`と、作業時間（実施時間）`actual_*`は必ず分けて保持する。
- UI文言に「実績」は使わず、「作業時間（実施時間）」を使う。

---

## 2. Luxates側で確認した重要パターン

### 2.1 トークン境界

LuxatesはLarkトークンを以下の3種類に分けています。

- App token: OAuthコード交換、refresh token更新など。
- Tenant token: 組織情報同期、Bot/IM通知など。
- User access token: 本人の主カレンダー取得、本人カレンダー上での会議URL作成など。

G-DXでもこの分離を守ってください。特に、本人のLarkカレンダーに会議URLを作る処理をtenant tokenで代替しないでください。

### 2.2 OAuthとセッション

Luxatesでは以下の安全要件を満たしています。

- OAuth開始時にstate Cookieを発行する。
- callbackでstateを照合し、不一致ならログイン失敗にする。
- セッションCookieには生トークンを入れず、DBにはハッシュ化したセッショントークンを保存する。
- Lark user access token、refresh token、expires_atをセッション側に保存し、期限切れ前にrefreshする。
- callback時に`avatar_url`をキャッシュし、可能なら主カレンダーIDも同期する。

G-DXの現在実装は署名付きCookieにLarkユーザー情報を保持しています。会議URL発行でuser access tokenが必要になるため、次工程ではLuxates方式に寄せて、本システム固有のセッションテーブルへ移してください。

### 2.3 会議URL発行

Luxatesでは`src/server/lark/calendar.ts`で以下を行っています。

- user access tokenで本人の主カレンダーIDを取得する。
- `POST /calendar/v4/calendars/{calendar_id}/events`に`vchat`を付けてLark会議URLを作成する。
- 戻り値から`meeting_url`、`event_id`、`app_link`を受け取る。
- 担当者本人でない場合は、本人トークンなしで勝手に本人カレンダーへ作らない。

G-DXのオンライン予定は現状、フォーム側で暫定URLを生成しています。これを本番連携に置き換えるのが主タスクです。

### 2.4 通知

Luxatesは通知失敗で予定保存を巻き戻しません。

- 予定作成・更新・キャンセルはDBトランザクション内で保存、履歴作成。
- Lark通知はトランザクション外で送る。
- 通知失敗はログに残し、予定保存自体は成功扱いにする。
- ユーザー、部署、全員参加を展開して通知先を作る。
- 辞退済み参加者は通知対象から外す。

G-DXの日報通知、予定招待通知、予定移動通知もこの設計に合わせてください。

### 2.5 権限

Luxatesは権限キー方式です。G-DXではまず`users.role = 'admin'`を使っていますが、少なくとも以下はサーバー側で保証してください。

- 本人は自分の日報のみ表示。
- 管理者は全員の日報を閲覧・コメント可能。
- 同期・通知・会議URL発行APIは、画面で隠すだけでなくサーバー側で拒否する。
- `/api/lark/calendar/sync`は本番で秘密鍵なしに実行できない状態にする。

---

## 3. 現在のG-DX側の状態

すでに入っているもの:

- 予定カード/ポップオーバーからの「完了」導線。
- 完了時に作業終了時刻と作業メモを確認して確定する導線。
- 当初予定時間と作業時間（実施時間）の分離保存。
- 日報への完了済み予定の自動表示。
- 作業時間（実施時間）の青/赤テキスト表示。
- 日報提出時のLark通知カードと日報への深いリンク。
- オンライン予定種別と暫定会議URL生成。
- ログインユーザーの主カレンダーIDを自動取得・キャッシュするLarkカレンダー同期の土台。

次にやること:

- Luxates型のLark provider clientへ整理する。
- OAuthセッションをDB保存型へ移す。
- user access tokenを使ったLark会議URL発行APIを追加する。
- オンライン予定フォームを暫定URL生成からサーバー発行へ切り替える。
- 予定移動時の参加者通知を強化する。
- 本番向けに同期APIと通知APIの権限、秘密鍵、ログを締める。

---

## 4. 実装フェーズ

### Phase 1. Lark provider clientを整理する

目的:

既存の`src/lib/lark/client.ts`、`src/lib/lark/notify.ts`、`src/lib/lark/calendar-sync.ts`に散っているトークン取得処理を整理し、Luxatesと同じ責務分離にする。

実装すること:

1. `src/lib/lark/provider-client.ts`を追加、または既存ファイルを整理する。
2. 以下の関数を用意する。
   - `getLarkOpenApiBaseUrl()`
   - `getLarkAppAccessToken()`
   - `getLarkTenantAccessToken()`
   - `postLarkApiWithAppToken()`
   - `postLarkApiWithTenantToken()`
   - `postLarkApiWithUserAccessToken()`
3. トークンは有効期限より60秒以上早く失効扱いにする。
4. `LARK_OPEN_API_BASE`と`LARK_OPEN_API_BASE_URL`の扱いを統一する。
5. Lark APIエラーは権限エラーを403、通信・一時エラーを502相当に分ける。
6. App Secret、access token、refresh token、顧客情報、作業メモをログに出さない。

触ってよい主な範囲:

- `src/lib/lark/client.ts`
- `src/lib/lark/config.ts`
- `src/lib/lark/notify.ts`
- `src/lib/lark/calendar-sync.ts`
- `src/lib/lark/provider-client.ts`

完了条件:

- トークン取得処理の重複が減っている。
- 既存の招待通知、日報通知、カレンダー同期が新しいclient経由で動く。
- `npm run lint`、`npm run build`が通る。

### Phase 2. OAuthセッションをDB保存型にする

目的:

Lark会議URL発行に必要なuser access tokenを、安全に保存・更新できるようにする。

DB migration案:

```sql
CREATE TABLE IF NOT EXISTS public.calendar_user_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  lark_open_id TEXT UNIQUE,
  lark_union_id TEXT,
  lark_user_id TEXT,
  lark_calendar_id TEXT,
  avatar_url TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.calendar_user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  lark_access_token TEXT,
  lark_refresh_token TEXT,
  lark_token_expires_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

注意:

- 共有`users`テーブルにG-DX側から新規カラムを追加しない。
- すでにkanri側の`users`に`lark_open_id`等がある場合は参照してよいが、G-DX固有のキャッシュは`calendar_user_profiles`へ寄せる。
- セッションCookieにはランダムトークンのみを入れる。DBには`sha256`等でハッシュ化した値を保存する。
- `next`パラメータは必ずアプリ内パスだけ許可する。

実装すること:

1. OAuth startでstate Cookieとnext Cookieを発行する。
2. callbackでstateを検証する。
3. `authen/v1/access_token`でcodeを交換する。
4. `authen/v1/user_info`でopen_id、union_id、氏名、メール、avatarを取得する。
5. 既存ユーザーをメールまたは既存profileのopen_idで解決する。
6. 無効ユーザーまたは未登録ユーザーはログイン拒否する。
7. profileへLark ID、avatar、last_login_atを保存する。
8. user access token、refresh token、expires_atを`calendar_user_sessions`へ保存する。
9. セッション取得時に期限切れ前ならrefresh tokenで更新する。
10. ログアウトでセッションをrevokedにする。

参考:

- Luxates: `src/server/lark/oauth.ts`
- Luxates: `src/server/auth/session.ts`
- Luxates: `src/app/api/auth/lark/start/route.ts`
- Luxates: `src/app/api/auth/lark/callback/route.ts`

完了条件:

- state不一致でログインできない。
- 未登録ユーザーはログインできない。
- セッションCookieの値だけではLarkトークンが復元できない。
- user access tokenが期限切れ前に更新される。
- avatarが画面で使える形でキャッシュされる。

### Phase 3. Lark会議URL発行APIを追加する

目的:

オンライン予定選択時、暫定URLではなくLark会議URLを自動発行する。

API案:

```http
POST /api/calendar/meeting-url/lark
```

Request:

```json
{
  "title": "オンライン予定",
  "startAt": "2026-06-26T13:30:00.000+09:00",
  "endAt": "2026-06-26T14:30:00.000+09:00",
  "mainAssigneeId": "user-id"
}
```

Response:

```json
{
  "data": {
    "meetingUrl": "https://...",
    "larkEventId": "event-id",
    "appLink": "https://..."
  }
}
```

実装すること:

1. zodで`title`、`startAt`、`endAt`、`mainAssigneeId`を検証する。
2. 現在ユーザーに予定作成権限があることをサーバー側で確認する。
3. 現在ユーザー本人が担当者の場合、セッションのuser access tokenを使う。
4. profileに`lark_calendar_id`がなければ、user access tokenで主カレンダーIDを取得して保存する。
5. `POST /calendar/v4/calendars/{calendar_id}/events`へ`vchat`付きで作成する。
6. `meeting_url`を`online_meeting_url`として予定に保存できるようにする。
7. `larkEventId`をどのカラムに保持するかを明確にする。

`larkEventId`の注意:

- 現在の`schedules.lark_event_id`はLarkカレンダー同期にも使われる。
- 会議URL発行でLark予定を作る場合、後続の同期が別イベントを二重作成しないようにする。
- 推奨は「オンライン予定のLarkイベントを、その予定の`schedules.lark_event_id`として扱う」こと。
- 別イベントとして管理したい場合は、migrationで`online_meeting_event_id`等を追加し、二重同期しない条件を実装する。

触ってよい主な範囲:

- `src/app/api/calendar/meeting-url/lark/route.ts`
- `src/lib/lark/calendar-meeting.ts`
- `src/components/calendar/schedule-form.tsx`
- `src/app/calendar/actions.ts`
- `src/lib/schedule-store.ts`
- `supabase/migrations/**`

完了条件:

- オンライン予定を選ぶと、サーバー経由でLark会議URLを発行できる。
- Lark未設定時は分かるエラーを返し、UIが壊れない。
- 本人トークンがない場合は「Larkで再ログインしてください」と表示できる。
- 他人の本人カレンダーへ勝手に会議を作らない。
- 予定詳細と日表示・今日画面で会議URLが表示される。

### Phase 4. 日報提出通知を本番向けに固める

目的:

日報提出後、社長または管理者が通知ボタンから該当日報へ直接遷移できる状態を安定させる。

現状:

- `sendDailyReportSubmitted`でinteractive card送信とtext fallbackがある。
- URLは`/calendar?view=day&date=YYYY-MM-DD#daily-report-USER_ID`形式。
- 管理者宛が見つからない場合に本人へフォールバックしている。

追加で実装・確認すること:

1. 管理者判定は`users.role = 'admin'`または既存の`isAdmin`を使う。
2. 管理者のLark open_id解決を`calendar_user_profiles`または既存user情報と統一する。
3. Lark通知が成功した場合のみ`daily_reports.lark_notified_at`を更新する。
4. 失敗した場合は通知ログに理由を残す。
5. 通知カードのボタン文言は「日報を確認する」にする。
6. 通知URLのoriginは`headers()`、環境変数、または本番URL設定から安定取得する。

完了条件:

- 本人アカウントでは自分の日報のみ表示される。
- 管理者では全員の日報とコメント欄が表示される。
- Lark通知ボタンから該当日・該当ユーザーの日報へ移動できる。
- 通知失敗で日報提出自体は失敗しない。

### Phase 5. 予定移動・参加確認通知を強化する

目的:

ユーザー要件の「予定作成者が動かすと参加者全員の予定も移動し、参加予定者へLark通知、参加/保留/不参加を選択」を実現する土台を作る。

現状:

- `moveScheduleAction`は時刻・担当者変更を保存する。
- 新規担当者が増えた場合のみ招待通知する。
- 参加/保留/不参加の状態管理はまだ薄い。

DB案:

既存の`schedules.user_id`/`co_user_ids`は維持しつつ、参加回答を別テーブルにする。

```sql
CREATE TABLE IF NOT EXISTS public.schedule_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'tentative', 'declined')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (schedule_id, user_id)
);
```

実装すること:

1. 予定作成・更新時に`userIds`から`schedule_participants`を同期する。
2. 予定作成者または管理者が時刻を変更した場合、対象参加者全員へLark通知する。
3. 通知文に変更前後の日時を含める。
4. 通知から開けるURLを含める。
5. 参加者本人が`参加`、`保留`、`不参加`を選べるAction/APIを追加する。
6. `参加`で予定色を通常表示、`不参加`で斜線表示できるよう、UIへstatusを渡す。
7. 通知失敗は予定保存を巻き戻さない。

参考:

- Luxates: `src/server/notifications/event-notifications.ts`
- Luxates: `src/server/calendar/events.ts`の`updateMyEventParticipantStatus`

完了条件:

- 予定移動時に既存参加者にも通知が届く。
- 新規参加者への招待通知と、時刻変更通知が区別される。
- 参加者は参加/保留/不参加を保存できる。
- 不参加者は通知・重複判定・表示で区別できる。

### Phase 6. Larkカレンダー同期を運用向けに締める

目的:

ログインユーザーの主カレンダーIDを使う同期の土台を、事故が起きにくい運用にする。

実装すること:

1. `/api/lark/calendar/sync`のpush/bothや個別flushは本番で`LARK_SYNC_SECRET`必須にする。
2. ログインユーザー本人のpull同期はセッションで許可し、`LARK_SYNC_SECRET`未設定時に全通しする挙動は開発環境だけに限定する。
3. LarkカレンダーIDは環境変数で固定せず、対象ユーザーのuser access tokenから主カレンダーIDを取得・キャッシュする。
4. push/pull/bothの実行結果を必要に応じてDBログへ残す。
5. Lark起点の予定をG-DXへ取り込む場合も、G-DXの予定が正本であることを壊さない。
6. `sync_source = 'lark'`の予定をアプリから再同期する条件を明確にする。
6. 削除は原則論理削除とし、Lark側削除との同期方針をドキュメント化する。

注意:

- 今回の主目的は日報通知、会議URL、参加者通知です。双方向同期を広げすぎないでください。
- Larkカレンダーを完全な正本にする改修は、この指示書の対象外です。

完了条件:

- 本番で秘密鍵なしに同期APIを実行できない。
- 同期失敗時に`schedules.sync_status`と`sync_error`で理由を追える。
- オンライン会議URL用のLark eventと、通常同期用のLark eventが二重作成されない。

### Phase 7. Lark組織情報同期は必要最小限にする

目的:

ユーザーのLark open_id、avatar、主カレンダーIDを安定取得する。

実装方針:

- G-DXはkanri-systemとSupabaseを共有しているため、`users`正本を壊さない。
- Lark連携に必要な補助情報は`calendar_user_profiles`へ保存する。
- Luxatesの`directory-sync.ts`は参考にするが、そのままユーザー・部署を作り直さない。
- 必要ならdry-runとapplyを分ける。
- `--deactivate-missing`相当は明示操作時のみ許可する。

完了条件:

- open_id未登録のユーザーをメールで突合できる。
- Larkから返らないユーザーを勝手に無効化しない。
- 同期結果に秘密情報や個人情報の過剰ログが出ない。

---

## 5. 環境変数

`.env.example`とVercel環境変数に、必要なものだけ追加・整理してください。

候補:

```bash
LARK_APP_ID=""
LARK_APP_SECRET=""
LARK_OPEN_API_BASE_URL="https://open.larksuite.com"
LARK_OAUTH_REDIRECT_URI="https://<YOUR_DOMAIN>/api/auth/lark/callback"
LARK_OAUTH_AUTHORIZE_BASE_URL="https://accounts.larksuite.com"
LARK_OAUTH_SCOPES="calendar:calendar:readonly"
AUTH_SESSION_MAX_AGE_SECONDS="86400"
AUTH_REQUIRE_LARK_SESSION="true"
LARK_SYNC_SECRET=""
NOTIFICATION_CRON_SECRET=""
NEXT_PUBLIC_APP_URL="https://<YOUR_DOMAIN>"
```

既存の`LARK_OPEN_API_BASE`、`NEXT_PUBLIC_LARK_REDIRECT_URI`と重複する場合は、互換を残しつつどちらを正にするか決めてください。

---

## 6. テスト観点

最低限追加するテスト:

- OAuth state不一致でログイン失敗。
- セッショントークンはハッシュ保存され、生値をDBに保存しない。
- user access token期限切れ前にrefreshされる。
- 未登録または無効ユーザーはログインできない。
- Lark会議URLAPIは、終了時刻が開始時刻以前なら400。
- 本人トークンなしで会議URL発行すると再ログイン要求になる。
- 他人のLark主カレンダーへ勝手に会議URLを作らない。
- 日報提出通知は管理者宛を優先し、URLに該当日報アンカーが入る。
- 非管理者は他人の日報を見られない。
- 予定移動通知は既存参加者にも送られる。
- `/api/lark/calendar/sync`は本番想定でsecretなしを拒否する。

実行コマンド:

```bash
npm run lint
npm run build
```

テストコマンドが整備されている場合は、あわせて実行してください。

ブラウザ確認:

- `/calendar`でオンライン予定を作成し、会議URLが表示される。
- 完了導線がワンクリック完了になっていない。
- 日報提出後、管理者表示で該当日報が確認できる。
- 予定移動時、UIが崩れず通知ログに対象者が残る。
- PC幅とスマホ幅の両方で、ボタンやフォームが重ならない。

---

## 7. やらないこと

- Prismaを追加しない。
- LuxatesのDB schemaをそのままコピーしない。
- 共有`users`、`cases`テーブルをG-DX側migrationで再定義しない。
- LarkのApp ID/Secret以外のIDをコードに直書きしない。
- 会議URL発行のために、他人のユーザートークンがあるかのように処理しない。
- 通知失敗で予定保存や日報提出を巻き戻さない。
- UI文言に「実績」を戻さない。
- 「完了」ボタンをワンクリック完了にしない。
- LarkカレンダーをG-DX予定の完全な正本にしない。
- 大きなUIリデザインをしない。

---

## 8. 受け入れ条件

以下を満たしたら完了です。

- Lark OAuthでログインし、G-DXユーザーへ安全に紐づく。
- Lark user access tokenがDBセッションで安全に保存・更新される。
- オンライン予定でLark会議URLが発行され、予定詳細に表示される。
- 会議URL発行時にLarkイベントが二重作成されない。
- 日報提出通知が管理者へ届き、ボタンから該当日報へ直接遷移できる。
- 本人アカウントは自分の日報のみ、管理者は全員の日報を閲覧・コメントできる。
- 予定移動時に参加者へLark通知される。
- 参加/保留/不参加の回答状態を保存できる。
- 本番で同期APIを秘密鍵なしに実行できない。
- `npm run lint`と`npm run build`が通る。
- ブラウザで主要導線を確認済み。
