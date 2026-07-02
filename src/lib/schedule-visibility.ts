/*
 * 予定の公開範囲（公開 / 非公開）の判定とマスキング
 * see: docs/02_database_schema.md schedules.visibility
 *
 * Larkカレンダー踏襲：非公開の予定は担当者本人以外には
 * 「予定あり」（時間帯のみ）として表示する。
 * マスキングはサーバー側で行い、詳細情報をブラウザへ送らない。
 */

import type { Schedule } from "@/components/calendar/types";

export const MASKED_SCHEDULE_TITLE = "予定あり";

export function canViewScheduleDetails(
  schedule: Schedule,
  viewerUserId: string | null,
): boolean {
  if (schedule.visibility !== "private") return true;
  return viewerUserId !== null && schedule.userIds.includes(viewerUserId);
}

export function maskPrivateSchedule(
  schedule: Schedule,
  viewerUserId: string | null,
): Schedule {
  if (canViewScheduleDetails(schedule, viewerUserId)) return schedule;
  return {
    id: schedule.id,
    userIds: schedule.userIds,
    title: MASKED_SCHEDULE_TITLE,
    typeId: "",
    startAt: schedule.startAt,
    endAt: schedule.endAt,
    isAllDay: schedule.isAllDay,
    status: schedule.status,
    visibility: "private",
    isMasked: true,
    syncSource: schedule.syncSource,
    syncStatus: schedule.syncStatus,
  };
}

export function maskPrivateSchedules(
  schedules: Schedule[],
  viewerUserId: string | null,
): Schedule[] {
  return schedules.map((schedule) =>
    maskPrivateSchedule(schedule, viewerUserId),
  );
}
