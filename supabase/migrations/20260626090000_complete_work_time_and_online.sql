-- =====================================================
-- 20260626090000_complete_work_time_and_online.sql
-- 完了時の作業時間確定、日報確認導線、オンライン予定URL
-- see: docs/01_implementation_guide.md §1 / §2
-- =====================================================

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_memo TEXT,
  ADD COLUMN IF NOT EXISTS online_meeting_url TEXT,
  ADD COLUMN IF NOT EXISTS lark_event_id VARCHAR(200),
  ADD COLUMN IF NOT EXISTS sync_source VARCHAR(20) NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_schedules_deleted_at
  ON public.schedules (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_lark_event_id
  ON public.schedules (lark_event_id)
  WHERE lark_event_id IS NOT NULL;

ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS lark_notified_at TIMESTAMPTZ;

INSERT INTO public.schedule_types (name, color, sort_order, is_active)
SELECT 'オンライン', '#3370FF', 13, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.schedule_types WHERE name = 'オンライン'
);

CREATE TABLE IF NOT EXISTS public.project_schedule_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      INTEGER     REFERENCES public.cases(id) ON DELETE CASCADE,
  schedule_id  UUID        REFERENCES public.schedules(id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  work_date    DATE        NOT NULL,
  minutes      INTEGER     NOT NULL CHECK (minutes > 0),
  memo         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_schedule_logs_case_id
  ON public.project_schedule_logs (case_id);
CREATE INDEX IF NOT EXISTS idx_project_schedule_logs_schedule_id
  ON public.project_schedule_logs (schedule_id);
CREATE INDEX IF NOT EXISTS idx_project_schedule_logs_work_date
  ON public.project_schedule_logs (work_date);

CREATE OR REPLACE FUNCTION public.tg_project_schedule_logs_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_schedule_logs_set_updated_at
  ON public.project_schedule_logs;
CREATE TRIGGER project_schedule_logs_set_updated_at
  BEFORE UPDATE ON public.project_schedule_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_project_schedule_logs_set_updated_at();

ALTER TABLE public.project_schedule_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_schedule_logs_select_authenticated
  ON public.project_schedule_logs;
CREATE POLICY project_schedule_logs_select_authenticated
  ON public.project_schedule_logs
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

DROP POLICY IF EXISTS project_schedule_logs_insert_owner_or_admin
  ON public.project_schedule_logs;
CREATE POLICY project_schedule_logs_insert_owner_or_admin
  ON public.project_schedule_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS project_schedule_logs_update_owner_or_admin
  ON public.project_schedule_logs;
CREATE POLICY project_schedule_logs_update_owner_or_admin
  ON public.project_schedule_logs
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

DROP POLICY IF EXISTS project_schedule_logs_delete_owner_or_admin
  ON public.project_schedule_logs;
CREATE POLICY project_schedule_logs_delete_owner_or_admin
  ON public.project_schedule_logs
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
  );
