-- =====================================================
-- 20260524100000_create_schedule_types.sql
-- 予定種別マスタテーブル
-- see: docs/02_database_schema.md §2
-- =====================================================

CREATE TABLE IF NOT EXISTS public.schedule_types (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(50)  NOT NULL,
  color       VARCHAR(20)  NOT NULL,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_types_sort_order
  ON public.schedule_types (sort_order)
  WHERE is_active = TRUE;

-- 初期データ（dreaMs カラートークン準拠／docs/02 §初期データ）
INSERT INTO public.schedule_types (name, color, sort_order) VALUES
  ('重要',   '#F54A45',  1),
  ('現場',   '#3370FF',  2),
  ('社内',   '#646A73',  3),
  ('社外',   '#34C724',  4),
  ('役所',   '#FF8800',  5),
  ('測量',   '#8F959E',  6),
  ('登記',   '#C5C8CE',  7),
  ('申請',   '#DEE0E3',  8),
  ('来客',   '#4E83FF',  9),
  ('移動',   '#1F2329', 10),
  ('休み',   '#F5F6F7', 11),
  ('その他', '#FFFFFF', 12)
ON CONFLICT DO NOTHING;

-- RLS：マスタなので全認証ユーザーが参照可、書き込みは admin のみ
ALTER TABLE public.schedule_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY schedule_types_select_authenticated
  ON public.schedule_types
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

CREATE POLICY schedule_types_admin_write
  ON public.schedule_types
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
