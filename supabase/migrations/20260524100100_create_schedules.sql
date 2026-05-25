-- =====================================================
-- 20260524100100_create_schedules.sql
-- 予定テーブル本体
-- see: docs/02_database_schema.md §1
-- 共有 Supabase（kanri-system と同一）に追加するため
-- users / cases への外部キーは実テーブル参照を有効化。
-- =====================================================

CREATE TABLE IF NOT EXISTS public.schedules (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title             VARCHAR(200) NOT NULL,
  start_at          TIMESTAMPTZ  NOT NULL,
  end_at            TIMESTAMPTZ  NOT NULL,
  is_all_day        BOOLEAN      NOT NULL DEFAULT FALSE,
  user_id           UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  co_user_ids       UUID[]       NOT NULL DEFAULT '{}',
  case_id           INTEGER      REFERENCES public.cases(id) ON DELETE SET NULL,
  case_number       VARCHAR(50),
  schedule_type_id  UUID         REFERENCES public.schedule_types(id) ON DELETE SET NULL,
  work_category_id  UUID,
  location          VARCHAR(200),
  memo              TEXT,
  status            VARCHAR(30)  NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'done', 'carried_over', 'cancelled')),
  actual_start_at   TIMESTAMPTZ,
  actual_end_at     TIMESTAMPTZ,
  actual_minutes    INTEGER,
  created_by        UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by        UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT schedules_time_order CHECK (end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_schedules_start_at  ON public.schedules (start_at);
CREATE INDEX IF NOT EXISTS idx_schedules_user_id   ON public.schedules (user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_case_id   ON public.schedules (case_id);
CREATE INDEX IF NOT EXISTS idx_schedules_co_users  ON public.schedules USING GIN (co_user_ids);

-- updated_at 自動更新トリガ
CREATE OR REPLACE FUNCTION public.tg_schedules_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schedules_set_updated_at ON public.schedules;
CREATE TRIGGER schedules_set_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_schedules_set_updated_at();

-- RLS：認証済アクティブユーザーは全件参照可（カレンダー共有用途）
-- 書き込みは本人 or 同行者 or 管理者のみ
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY schedules_select_authenticated
  ON public.schedules
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

CREATE POLICY schedules_insert_self_or_admin
  ON public.schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR user_id = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY schedules_update_owner_or_admin
  ON public.schedules
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR auth.uid() = ANY (co_user_ids)
  )
  WITH CHECK (
    public.is_admin()
    OR user_id = auth.uid()
    OR auth.uid() = ANY (co_user_ids)
  );

CREATE POLICY schedules_delete_owner_or_admin
  ON public.schedules
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
  );
