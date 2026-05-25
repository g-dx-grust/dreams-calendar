-- =====================================================
-- 20260524100300_extend_audit_logs.sql
-- 共有 audit_logs テーブルに UUID PK 用カラムを追加。
-- 既存の entity_id (integer) は kanri-system が使用継続。
-- スケジュール系（UUID PK）の監査は entity_id_uuid に記録する。
-- see: CLAUDE.md §D「監査ログは kanri-system の既存テーブルに相乗り」
-- =====================================================

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS entity_id_uuid UUID;

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id_uuid
  ON public.audit_logs (entity_id_uuid)
  WHERE entity_id_uuid IS NOT NULL;

COMMENT ON COLUMN public.audit_logs.entity_id_uuid IS
  'UUID 主キーを持つテーブル（schedules / schedule_types / daily_reports 等）の監査記録用。整数 PK は entity_id を使う。';
