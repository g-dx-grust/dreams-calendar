# 02. データベース設計

本ドキュメントは、カレンダーシステムで追加するデータベースのテーブル定義を記述します。
既存の案件管理システム（`kanri-system`）と同じ Supabase プロジェクトを共有することを前提としています。

## テーブル定義

### 1. 予定テーブル (`schedules`)

カレンダーの予定を管理するメインテーブルです。

```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT FALSE,  -- 終日予定フラグ（true 時は start_at = 開始日 00:00、end_at = 終了日 23:59）
  user_id UUID REFERENCES users(id),          -- 担当者
  co_user_ids UUID[] DEFAULT '{}',            -- 同行者（配列）
  case_id INTEGER REFERENCES cases(id),       -- 案件管理システム(kanri-system)との連携
  case_number VARCHAR(50),                    -- cases.case_number のコピー（非正規化）
  schedule_type_id UUID REFERENCES schedule_types(id),
  work_category_id UUID,
  location VARCHAR(200),
  memo TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'done', 'carried_over', 'cancelled')),
  actual_start_at TIMESTAMPTZ,
  actual_end_at TIMESTAMPTZ,
  actual_minutes INTEGER,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_schedules_start_at ON schedules(start_at);
CREATE INDEX idx_schedules_user_id ON schedules(user_id);
CREATE INDEX idx_schedules_case_id ON schedules(case_id);
```

### 2. 予定種別テーブル (`schedule_types`)

予定の色分けやカテゴリを管理するテーブルです。

```sql
CREATE TABLE schedule_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  color VARCHAR(20) NOT NULL,  -- 例: '#3370FF'
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);
```

### 3. 日報テーブル (`daily_reports`)

日ビューの「日報」ボタンから提出される本文を保存するテーブルです。社員 × 日付の単位で 1 件のみ。

```sql
CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  report_date DATE NOT NULL,
  body TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, report_date)
);

CREATE INDEX idx_daily_reports_report_date ON daily_reports(report_date);
CREATE INDEX idx_daily_reports_user_id ON daily_reports(user_id);
```

提出時は Lark IM で確認通知を送信します（送信先チャットの DB 管理は次フェーズ。現状は本人 Lark への DM）。

### 4. プロジェクト稼働時間ログ (`project_schedule_logs`) ※Phase 2以降

案件ごとの実働時間を集計するための中間テーブルです。

```sql
CREATE TABLE project_schedule_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id INTEGER REFERENCES cases(id),
  schedule_id UUID REFERENCES schedules(id),
  user_id UUID REFERENCES users(id),
  work_category_id UUID,
  work_date DATE NOT NULL,
  minutes INTEGER NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 初期データ

マイグレーション時に以下の予定種別データを投入します。

```sql
INSERT INTO schedule_types (name, color, sort_order) VALUES
  ('重要',     '#F54A45', 1),  -- Danger (dreaMsルール準拠)
  ('現場',     '#3370FF', 2),  -- Primary
  ('社内',     '#646A73', 3),  -- Text 中
  ('社外',     '#34C724', 4),  -- Success
  ('役所',     '#FF8800', 5),  -- Warning
  ('測量',     '#8F959E', 6),  -- Text 弱
  ('登記',     '#C5C8CE', 7),
  ('申請',     '#DEE0E3', 8),
  ('来客',     '#4E83FF', 9),  -- Primary hover
  ('移動',     '#1F2329', 10), -- Text 強
  ('休み',     '#F5F6F7', 11), -- Background
  ('その他',   '#FFFFFF', 12); -- Surface
```
※色は `dreaMs` デザインシステムのカラートークンに準拠して割り当てています。管理画面から変更可能にする想定です。
