-- =====================================================
-- 20260626103000_lark_oauth_sessions.sql
-- Luxates型Lark OAuthセッション / プロフィール補助テーブル
-- see: docs/06_luxates_lark_calendar_transfer_instructions.md §4 Phase 2
-- =====================================================

CREATE TABLE IF NOT EXISTS public.calendar_user_profiles (
  user_id          UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  lark_open_id     TEXT UNIQUE,
  lark_union_id    TEXT,
  lark_user_id     TEXT,
  lark_calendar_id TEXT,
  avatar_url       TEXT,
  last_login_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_user_profiles_lark_user_id
  ON public.calendar_user_profiles (lark_user_id)
  WHERE lark_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.calendar_user_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash            TEXT NOT NULL UNIQUE,
  lark_access_token     TEXT,
  lark_refresh_token    TEXT,
  lark_token_expires_at TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ NOT NULL,
  revoked_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_user_sessions_user_id
  ON public.calendar_user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_user_sessions_expires_at
  ON public.calendar_user_sessions (expires_at);

CREATE OR REPLACE FUNCTION public.tg_calendar_lark_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calendar_user_profiles_set_updated_at
  ON public.calendar_user_profiles;
CREATE TRIGGER calendar_user_profiles_set_updated_at
  BEFORE UPDATE ON public.calendar_user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_calendar_lark_set_updated_at();

DROP TRIGGER IF EXISTS calendar_user_sessions_set_updated_at
  ON public.calendar_user_sessions;
CREATE TRIGGER calendar_user_sessions_set_updated_at
  BEFORE UPDATE ON public.calendar_user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_calendar_lark_set_updated_at();

ALTER TABLE public.calendar_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_user_profiles_select_self_or_admin
  ON public.calendar_user_profiles;
CREATE POLICY calendar_user_profiles_select_self_or_admin
  ON public.calendar_user_profiles
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS calendar_user_profiles_update_self_or_admin
  ON public.calendar_user_profiles;
CREATE POLICY calendar_user_profiles_update_self_or_admin
  ON public.calendar_user_profiles
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

DROP POLICY IF EXISTS calendar_user_sessions_select_self_or_admin
  ON public.calendar_user_sessions;
CREATE POLICY calendar_user_sessions_select_self_or_admin
  ON public.calendar_user_sessions
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
  );
