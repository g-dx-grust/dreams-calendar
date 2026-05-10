/*
 * 予定ストア（プロセス内 in-memory）
 * see: ../../CLAUDE.md §D
 *
 * Why: Supabase 共有/別プロジェクト未確定のため、DB 接続を一時的にメモリ実装で代替。
 *      Server Actions と revalidatePath だけで一貫した UX を確認できるようにする。
 *      プロダクションでは Supabase クライアントへ差し替える。
 */

import { randomUUID } from "node:crypto";
import { MOCK_SCHEDULES } from "@/components/calendar/mock-data";
import { listUsers as listUsersFromMaster } from "@/lib/user-store";
import { listScheduleTypes as listTypesFromMaster } from "@/lib/schedule-type-store";
import type {
  CalendarUser,
  Schedule,
  ScheduleStatus,
  ScheduleType,
} from "@/components/calendar/types";

type SerializedSchedule = Omit<Schedule, "startAt" | "endAt"> & {
  startAt: string;
  endAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __gdxScheduleStore: SerializedSchedule[] | undefined;
}

function init(): SerializedSchedule[] {
  return MOCK_SCHEDULES.map((s) => ({
    ...s,
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
  }));
}

function getStore(): SerializedSchedule[] {
  if (!globalThis.__gdxScheduleStore) {
    globalThis.__gdxScheduleStore = init();
  }
  return globalThis.__gdxScheduleStore;
}

function hydrate(s: SerializedSchedule): Schedule {
  return { ...s, startAt: new Date(s.startAt), endAt: new Date(s.endAt) };
}

export function listSchedules(): Schedule[] {
  return getStore().map(hydrate);
}

export function getSchedule(id: string): Schedule | null {
  const found = getStore().find((s) => s.id === id);
  return found ? hydrate(found) : null;
}

export function listUsers(): CalendarUser[] {
  return listUsersFromMaster();
}

export function listScheduleTypes(): ScheduleType[] {
  return listTypesFromMaster();
}

export type ScheduleInput = {
  title: string;
  userIds: string[]; // 担当者（複数可）
  startAt: Date;
  endAt: Date;
  isAllDay?: boolean;
  typeId: string;
  caseNumber?: string;
  location?: string;
  memo?: string;
  status?: ScheduleStatus;
};

function dedupeUserIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function createSchedule(input: ScheduleInput): Schedule {
  const created: SerializedSchedule = {
    id: randomUUID(),
    title: input.title,
    userIds: dedupeUserIds(input.userIds),
    typeId: input.typeId,
    caseNumber: input.caseNumber,
    location: input.location,
    memo: input.memo,
    status: input.status ?? "planned",
    isAllDay: input.isAllDay ?? false,
    startAt: input.startAt.toISOString(),
    endAt: input.endAt.toISOString(),
  };
  getStore().push(created);
  return hydrate(created);
}

export function updateSchedule(
  id: string,
  patch: Partial<ScheduleInput>,
): Schedule | null {
  const store = getStore();
  const index = store.findIndex((s) => s.id === id);
  if (index === -1) return null;
  const current = store[index]!;
  const next: SerializedSchedule = {
    ...current,
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.userIds !== undefined
      ? { userIds: dedupeUserIds(patch.userIds) }
      : {}),
    ...(patch.typeId !== undefined ? { typeId: patch.typeId } : {}),
    ...(patch.caseNumber !== undefined
      ? { caseNumber: patch.caseNumber || undefined }
      : {}),
    ...(patch.location !== undefined
      ? { location: patch.location || undefined }
      : {}),
    ...(patch.memo !== undefined
      ? { memo: patch.memo || undefined }
      : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.isAllDay !== undefined ? { isAllDay: patch.isAllDay } : {}),
    ...(patch.startAt ? { startAt: patch.startAt.toISOString() } : {}),
    ...(patch.endAt ? { endAt: patch.endAt.toISOString() } : {}),
  };
  store[index] = next;
  return hydrate(next);
}

/** D&D 用：行 fromUserId からドラッグして toUserId にドロップ → userIds の置換 */
export function moveScheduleRow(
  id: string,
  fromUserId: string,
  toUserId: string,
): Schedule | null {
  const current = getSchedule(id);
  if (!current) return null;
  const idx = current.userIds.indexOf(fromUserId);
  const next =
    idx === -1
      ? [...current.userIds, toUserId]
      : current.userIds.map((u, i) => (i === idx ? toUserId : u));
  return updateSchedule(id, { userIds: next });
}

export function deleteSchedule(id: string): boolean {
  const store = getStore();
  const index = store.findIndex((s) => s.id === id);
  if (index === -1) return false;
  store.splice(index, 1);
  return true;
}
