-- =====================================================
-- 20260524100200_create_daily_reports.sql
-- 日報テーブル
-- see: docs/02_database_schema.md §3
-- =====================================================

CREATE TABLE IF NOT EXISTS public.daily_reports (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  report_date   DATE         NOT NULL,
  body          TEXT         NOT NULL,
  submitted_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_report_date ON public.daily_reports (report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_id     ON public.daily_reports (user_id);

-- updated_at 自動更新トリガ
CREATE OR REPLACE FUNCTION public.tg_daily_reports_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS daily_reports_set_updated_at ON public.daily_reports;
CREATE TRIGGER daily_reports_set_updated_at
  BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_daily_reports_set_updated_at();

-- RLS：日報は本人＋管理者のみ参照可、書き込みも本人 or 管理者のみ
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_reports_select_own_or_admin
  ON public.daily_reports
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
  );

CREATE POLICY daily_reports_insert_self
  ON public.daily_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR user_id = auth.uid()
  );

CREATE POLICY daily_reports_update_own_or_admin
  ON public.daily_reports
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
  )
  WITH CHECK (
    public.is_admin()
    OR user_id = auth.uid()
  );

CREATE POLICY daily_reports_delete_own_or_admin
  ON public.daily_reports
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
  );
