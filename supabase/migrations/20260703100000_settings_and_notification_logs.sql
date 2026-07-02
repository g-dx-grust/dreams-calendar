-- ================================================================
-- カレンダー設定・Lark通知ログの永続化
-- see: docs/02_database_schema.md / ../G-DX_Lark_Integration_Rules.md §3, §4.2
--
-- - calendar_settings: 管理画面で変更する設定（表示時間帯・通知先チャットID等）
--   をDBで管理する（ハードコード禁止ルール準拠）
-- - calendar_notification_logs: Lark通知の送信履歴と失敗時のリトライ管理
--   （指数バックオフ 5分→15分→60分）
-- ================================================================

CREATE TABLE IF NOT EXISTS calendar_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE calendar_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_settings_select ON calendar_settings;
CREATE POLICY calendar_settings_select ON calendar_settings
    FOR SELECT TO authenticated
    USING (true);

CREATE TABLE IF NOT EXISTS calendar_notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind VARCHAR(40) NOT NULL,
    receive_id TEXT,
    receive_id_type VARCHAR(20) NOT NULL DEFAULT 'open_id',
    recipient_name TEXT,
    subject TEXT NOT NULL,
    msg_type VARCHAR(20) NOT NULL DEFAULT 'text',
    content TEXT,
    related_id TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_notification_logs_created
    ON calendar_notification_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calendar_notification_logs_retry
    ON calendar_notification_logs (next_retry_at)
    WHERE status = 'failed' AND next_retry_at IS NOT NULL;

ALTER TABLE calendar_notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_notification_logs_admin_select ON calendar_notification_logs;
CREATE POLICY calendar_notification_logs_admin_select ON calendar_notification_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() AND u.role = 'admin' AND u.is_active
        )
    );
