-- ================================================================
-- 予定の公開範囲（公開 / 非公開）
-- see: docs/02_database_schema.md §schedules.visibility
--
-- Larkカレンダーの予定公開範囲を踏襲する。
-- 非公開の予定は担当者本人以外には「予定あり」（時間帯のみ）表示となる。
-- ================================================================

ALTER TABLE schedules
    ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'public';

ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_visibility_check;
ALTER TABLE schedules
    ADD CONSTRAINT schedules_visibility_check
    CHECK (visibility IN ('public', 'private'));
