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
import { syncProjectScheduleLogs } from "@/lib/project-schedule-log-store";
import {
  listUsers as listUsersFromMaster,
  listUsersAsync as listUsersFromMasterAsync,
} from "@/lib/user-store";
import {
  listScheduleTypes as listTypesFromMaster,
  listScheduleTypesAsync as listTypesFromMasterAsync,
} from "@/lib/schedule-type-store";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  CalendarSyncSource,
  CalendarSyncStatus,
  CalendarUser,
  Schedule,
  ScheduleStatus,
  ScheduleType,
} from "@/components/calendar/types";

type SerializedSchedule = Omit<
  Schedule,
  "startAt" | "endAt" | "actualStartAt" | "actualEndAt" | "lastSyncedAt"
> & {
  startAt: string;
  endAt: string;
  actualStartAt?: string;
  actualEndAt?: string;
  lastSyncedAt?: string;
};

type ScheduleRow = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  user_id: string | null;
  co_user_ids: string[] | null;
  case_id: number | null;
  case_number: string | null;
  schedule_type_id: string | null;
  location: string | null;
  memo: string | null;
  status: ScheduleStatus;
  actual_start_at: string | null;
  actual_end_at: string | null;
  actual_minutes: number | null;
  actual_memo?: string | null;
  online_meeting_url?: string | null;
  lark_event_id: string | null;
  sync_source: CalendarSyncSource;
  sync_status: CalendarSyncStatus;
  sync_error: string | null;
  last_synced_at: string | null;
  cases?: { case_name: string | null } | { case_name: string | null }[] | null;
};

const SCHEDULE_BASE_SELECT =
  "id,title,start_at,end_at,user_id,co_user_ids,case_id,case_number,schedule_type_id,location,memo,status,actual_start_at,actual_end_at,actual_minutes,lark_event_id,sync_source,sync_status,sync_error,last_synced_at,cases(case_name)";
const SCHEDULE_SELECT =
  "id,title,start_at,end_at,user_id,co_user_ids,case_id,case_number,schedule_type_id,location,memo,status,actual_start_at,actual_end_at,actual_minutes,actual_memo,online_meeting_url,lark_event_id,sync_source,sync_status,sync_error,last_synced_at,cases(case_name)";

export class ScheduleStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleStoreError";
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __gdxScheduleStore: SerializedSchedule[] | undefined;
}

function init(): SerializedSchedule[] {
  return MOCK_SCHEDULES.map((s) => ({
    ...s,
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
    actualStartAt: s.actualStartAt?.toISOString(),
    actualEndAt: s.actualEndAt?.toISOString(),
    lastSyncedAt: s.lastSyncedAt?.toISOString(),
  }));
}

function getStore(): SerializedSchedule[] {
  if (!globalThis.__gdxScheduleStore) {
    globalThis.__gdxScheduleStore = init();
    globalThis.__gdxScheduleStore.map(hydrate).forEach(syncProjectScheduleLogs);
  }
  return globalThis.__gdxScheduleStore;
}

function hydrate(s: SerializedSchedule): Schedule {
  return {
    ...s,
    syncSource: s.syncSource ?? "app",
    syncStatus: s.syncStatus ?? "pending",
    startAt: new Date(s.startAt),
    endAt: new Date(s.endAt),
    actualStartAt: s.actualStartAt ? new Date(s.actualStartAt) : undefined,
    actualEndAt: s.actualEndAt ? new Date(s.actualEndAt) : undefined,
    lastSyncedAt: s.lastSyncedAt ? new Date(s.lastSyncedAt) : undefined,
  };
}

function firstCaseName(
  relation:
    | { case_name: string | null }
    | { case_name: string | null }[]
    | null
    | undefined,
) {
  if (!relation) return undefined;
  const row = Array.isArray(relation) ? relation[0] : relation;
  return row?.case_name ?? undefined;
}

function isUndefinedColumnError(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42703" ||
    missingOptionalScheduleColumns(error?.message).length > 0
  );
}

function missingOptionalScheduleColumns(message?: string) {
  if (!message) return [];
  return (["actual_memo", "online_meeting_url"] as const).filter((column) =>
    message.includes(column),
  );
}

function stripMissingOptionalPayload(
  payload: Record<string, unknown>,
  error: { code?: string; message?: string } | null,
) {
  const missing = missingOptionalScheduleColumns(error?.message);
  if (missing.length === 0) return payload;

  const next = { ...payload };
  for (const column of missing) {
    if (next[column] != null) {
      throw new ScheduleStoreError(
        "予定の保存に必要なDBカラムが未適用です。Supabaseマイグレーションを反映してから再度お試しください。",
      );
    }
    delete next[column];
  }
  return next;
}

function toStoreError(error: { message?: string } | null, fallback: string) {
  return new ScheduleStoreError(error?.message || fallback);
}

function hydrateRow(row: ScheduleRow): Schedule {
  const userIds = dedupeUserIds([
    ...(row.user_id ? [row.user_id] : []),
    ...(row.co_user_ids ?? []),
  ]);
  return {
    id: row.id,
    title: row.title,
    userIds,
    typeId: row.schedule_type_id ?? "",
    caseId: row.case_id ?? undefined,
    caseNumber: row.case_number ?? undefined,
    caseName: firstCaseName(row.cases),
    location: row.location ?? undefined,
    memo: row.memo ?? undefined,
    status: row.status,
    isAllDay: false,
    actualStartAt: row.actual_start_at
      ? new Date(row.actual_start_at)
      : undefined,
    actualEndAt: row.actual_end_at ? new Date(row.actual_end_at) : undefined,
    actualMinutes: row.actual_minutes ?? undefined,
    actualMemo: row.actual_memo ?? undefined,
    onlineMeetingUrl: row.online_meeting_url ?? undefined,
    larkEventId: row.lark_event_id ?? undefined,
    syncSource: row.sync_source ?? "app",
    syncStatus: row.sync_status ?? "pending",
    syncError: row.sync_error ?? undefined,
    lastSyncedAt: row.last_synced_at
      ? new Date(row.last_synced_at)
      : undefined,
    startAt: new Date(row.start_at),
    endAt: new Date(row.end_at),
  };
}

export function listSchedules(): Schedule[] {
  return getStore().map(hydrate);
}

export async function listSchedulesAsync(): Promise<Schedule[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const result = await db
    .from("schedules")
    .select(SCHEDULE_SELECT)
    .is("deleted_at", null)
    .order("start_at", { ascending: true });
  let data: unknown = result.data;
  let error = result.error;

  if (isUndefinedColumnError(error)) {
    const retry = await db
      .from("schedules")
      .select(SCHEDULE_BASE_SELECT)
      .is("deleted_at", null)
      .order("start_at", { ascending: true });
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) return [];
  return (data as ScheduleRow[]).map(hydrateRow);
}

/*
 * 社員ごとの関連予定数を軽量カラムのみで集計する（社員マスタ画面用）。
 */
export async function countSchedulesByUserAsync(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const db = getSupabaseAdmin();
  if (!db) return counts;

  const { data, error } = await db
    .from("schedules")
    .select("user_id, co_user_ids")
    .is("deleted_at", null);
  if (error || !data) return counts;

  for (const row of data as Array<{ user_id: string | null; co_user_ids: string[] | null }>) {
    const ids = new Set<string>();
    if (row.user_id) ids.add(row.user_id);
    for (const id of row.co_user_ids ?? []) ids.add(id);
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/*
 * 表示期間に重なる予定だけをDB側で絞り込んで取得する。
 * カレンダー画面は全件取得ではなくこちらを使う（データ増加時の速度対策）。
 */
export async function listSchedulesInRangeAsync(
  start: Date,
  endExclusive: Date,
): Promise<Schedule[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const result = await db
    .from("schedules")
    .select(SCHEDULE_SELECT)
    .is("deleted_at", null)
    .lt("start_at", endExclusive.toISOString())
    .gt("end_at", start.toISOString())
    .order("start_at", { ascending: true });
  let data: unknown = result.data;
  let error = result.error;

  if (isUndefinedColumnError(error)) {
    const retry = await db
      .from("schedules")
      .select(SCHEDULE_BASE_SELECT)
      .is("deleted_at", null)
      .lt("start_at", endExclusive.toISOString())
      .gt("end_at", start.toISOString())
      .order("start_at", { ascending: true });
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) return [];
  return (data as ScheduleRow[]).map(hydrateRow);
}

export function getSchedule(id: string): Schedule | null {
  const found = getStore().find((s) => s.id === id);
  return found ? hydrate(found) : null;
}

export async function getScheduleAsync(id: string): Promise<Schedule | null> {
  const db = getSupabaseAdmin();
  if (!db) return getSchedule(id);

  const result = await db
    .from("schedules")
    .select(SCHEDULE_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  let data: unknown = result.data;
  let error = result.error;

  if (isUndefinedColumnError(error)) {
    const retry = await db
      .from("schedules")
      .select(SCHEDULE_BASE_SELECT)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) return getSchedule(id);
  return hydrateRow(data as ScheduleRow);
}

export function listUsers(): CalendarUser[] {
  return listUsersFromMaster();
}

export async function listUsersAsync(): Promise<CalendarUser[]> {
  return listUsersFromMasterAsync();
}

export function listScheduleTypes(): ScheduleType[] {
  return listTypesFromMaster();
}

export async function listScheduleTypesAsync(): Promise<ScheduleType[]> {
  return listTypesFromMasterAsync();
}

export type ScheduleInput = {
  title: string;
  userIds: string[]; // 担当者（複数可）
  startAt: Date;
  endAt: Date;
  isAllDay?: boolean;
  actualStartAt?: Date | null;
  actualEndAt?: Date | null;
  actualMinutes?: number | null;
  actualMemo?: string | null;
  onlineMeetingUrl?: string | null;
  typeId: string;
  caseId?: number;
  caseNumber?: string;
  caseName?: string;
  location?: string;
  memo?: string;
  status?: ScheduleStatus;
  larkEventId?: string | null;
  syncSource?: CalendarSyncSource;
  syncStatus?: CalendarSyncStatus;
  lastSyncedAt?: Date | null;
  syncError?: string | null;
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
    caseId: input.caseId,
    caseNumber: input.caseNumber,
    caseName: input.caseName,
    location: input.location,
    memo: input.memo,
    status: input.status ?? "planned",
    larkEventId: input.larkEventId ?? undefined,
    syncSource: input.syncSource ?? "app",
    syncStatus: input.syncStatus ?? "pending",
    lastSyncedAt: input.lastSyncedAt?.toISOString(),
    syncError: input.syncError ?? undefined,
    isAllDay: input.isAllDay ?? false,
    actualStartAt: input.actualStartAt?.toISOString(),
    actualEndAt: input.actualEndAt?.toISOString(),
    actualMinutes: input.actualMinutes ?? undefined,
    actualMemo: input.actualMemo ?? undefined,
    onlineMeetingUrl: input.onlineMeetingUrl ?? undefined,
    startAt: input.startAt.toISOString(),
    endAt: input.endAt.toISOString(),
  };
  getStore().push(created);
  return hydrate(created);
}

function buildSchedulePayload(input: ScheduleInput) {
  const userIds = dedupeUserIds(input.userIds);
  return {
    title: input.title,
    user_id: userIds[0] ?? null,
    co_user_ids: userIds.slice(1),
    schedule_type_id: input.typeId || null,
    case_id: input.caseId ?? null,
    case_number: input.caseNumber ?? null,
    location: input.location ?? null,
    memo: input.memo ?? null,
    status: input.status ?? "planned",
    actual_start_at: input.actualStartAt?.toISOString() ?? null,
    actual_end_at: input.actualEndAt?.toISOString() ?? null,
    actual_minutes: input.actualMinutes ?? null,
    actual_memo: input.actualMemo ?? null,
    online_meeting_url: input.onlineMeetingUrl ?? null,
    lark_event_id: input.larkEventId ?? null,
    sync_source: input.syncSource ?? "app",
    sync_status: input.syncStatus ?? "pending",
    sync_error: input.syncError ?? null,
    last_synced_at: input.lastSyncedAt?.toISOString() ?? null,
    start_at: input.startAt.toISOString(),
    end_at: input.endAt.toISOString(),
  };
}

export async function createScheduleAsync(
  input: ScheduleInput,
): Promise<Schedule> {
  const db = getSupabaseAdmin();
  if (!db) return createSchedule(input);

  let payload: Record<string, unknown> = buildSchedulePayload(input);
  let data: unknown = null;
  let error: { code?: string; message?: string } | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await db
      .from("schedules")
      .insert(payload)
      .select(attempt === 0 ? SCHEDULE_SELECT : SCHEDULE_BASE_SELECT)
      .single();
    data = result.data;
    error = result.error;

    if (!isUndefinedColumnError(error)) break;
    payload = stripMissingOptionalPayload(payload, error);
  }

  if (error || !data) {
    throw toStoreError(error, "予定の登録に失敗しました");
  }
  return hydrateRow(data as ScheduleRow);
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
    ...(patch.caseId !== undefined ? { caseId: patch.caseId || undefined } : {}),
    ...(patch.caseNumber !== undefined
      ? { caseNumber: patch.caseNumber || undefined }
      : {}),
    ...(patch.caseName !== undefined
      ? { caseName: patch.caseName || undefined }
      : {}),
    ...(patch.location !== undefined
      ? { location: patch.location || undefined }
      : {}),
    ...(patch.memo !== undefined
      ? { memo: patch.memo || undefined }
      : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.larkEventId !== undefined
      ? { larkEventId: patch.larkEventId || undefined }
      : {}),
    ...(patch.syncSource !== undefined ? { syncSource: patch.syncSource } : {}),
    ...(patch.syncStatus !== undefined ? { syncStatus: patch.syncStatus } : {}),
    ...(patch.lastSyncedAt !== undefined
      ? { lastSyncedAt: patch.lastSyncedAt?.toISOString() }
      : {}),
    ...(patch.syncError !== undefined
      ? { syncError: patch.syncError || undefined }
      : {}),
    ...(patch.isAllDay !== undefined ? { isAllDay: patch.isAllDay } : {}),
    ...(patch.actualStartAt !== undefined
      ? { actualStartAt: patch.actualStartAt?.toISOString() }
      : {}),
    ...(patch.actualEndAt !== undefined
      ? { actualEndAt: patch.actualEndAt?.toISOString() }
      : {}),
    ...(patch.actualMinutes !== undefined
      ? { actualMinutes: patch.actualMinutes || undefined }
      : {}),
    ...(patch.actualMemo !== undefined
      ? { actualMemo: patch.actualMemo || undefined }
      : {}),
    ...(patch.onlineMeetingUrl !== undefined
      ? { onlineMeetingUrl: patch.onlineMeetingUrl || undefined }
      : {}),
    ...(patch.startAt ? { startAt: patch.startAt.toISOString() } : {}),
    ...(patch.endAt ? { endAt: patch.endAt.toISOString() } : {}),
  };
  store[index] = next;
  return hydrate(next);
}

function buildSchedulePatch(patch: Partial<ScheduleInput>) {
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.userIds !== undefined) {
    const userIds = dedupeUserIds(patch.userIds);
    payload.user_id = userIds[0] ?? null;
    payload.co_user_ids = userIds.slice(1);
  }
  if (patch.typeId !== undefined) payload.schedule_type_id = patch.typeId || null;
  if (patch.caseId !== undefined) payload.case_id = patch.caseId || null;
  if (patch.caseNumber !== undefined) {
    payload.case_number = patch.caseNumber || null;
  }
  if (patch.location !== undefined) payload.location = patch.location || null;
  if (patch.memo !== undefined) payload.memo = patch.memo || null;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.actualStartAt !== undefined) {
    payload.actual_start_at = patch.actualStartAt?.toISOString() ?? null;
  }
  if (patch.actualEndAt !== undefined) {
    payload.actual_end_at = patch.actualEndAt?.toISOString() ?? null;
  }
  if (patch.actualMinutes !== undefined) {
    payload.actual_minutes = patch.actualMinutes ?? null;
  }
  if (patch.actualMemo !== undefined) {
    payload.actual_memo = patch.actualMemo || null;
  }
  if (patch.onlineMeetingUrl !== undefined) {
    payload.online_meeting_url = patch.onlineMeetingUrl || null;
  }
  if (patch.larkEventId !== undefined) {
    payload.lark_event_id = patch.larkEventId || null;
  }
  if (patch.syncSource !== undefined) payload.sync_source = patch.syncSource;
  if (patch.syncStatus !== undefined) payload.sync_status = patch.syncStatus;
  if (patch.syncError !== undefined) payload.sync_error = patch.syncError || null;
  if (patch.lastSyncedAt !== undefined) {
    payload.last_synced_at = patch.lastSyncedAt?.toISOString() ?? null;
  }
  if (patch.startAt !== undefined) payload.start_at = patch.startAt.toISOString();
  if (patch.endAt !== undefined) payload.end_at = patch.endAt.toISOString();
  return payload;
}

export async function updateScheduleAsync(
  id: string,
  patch: Partial<ScheduleInput>,
): Promise<Schedule | null> {
  const db = getSupabaseAdmin();
  if (!db) return updateSchedule(id, patch);

  let payload = buildSchedulePatch(patch);
  let data: unknown = null;
  let error: { code?: string; message?: string } | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await db
      .from("schedules")
      .update(payload)
      .eq("id", id)
      .is("deleted_at", null)
      .select(attempt === 0 ? SCHEDULE_SELECT : SCHEDULE_BASE_SELECT)
      .maybeSingle();
    data = result.data;
    error = result.error;

    if (!isUndefinedColumnError(error)) break;
    payload = stripMissingOptionalPayload(payload, error);
  }

  if (error) {
    throw toStoreError(error, "予定の更新に失敗しました");
  }
  return data ? hydrateRow(data as ScheduleRow) : null;
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

export async function moveScheduleRowAsync(
  id: string,
  fromUserId: string,
  toUserId: string,
): Promise<Schedule | null> {
  const current = await getScheduleAsync(id);
  if (!current) return null;
  const idx = current.userIds.indexOf(fromUserId);
  const next =
    idx === -1
      ? [...current.userIds, toUserId]
      : current.userIds.map((u, i) => (i === idx ? toUserId : u));
  return updateScheduleAsync(id, { userIds: next });
}

export function deleteSchedule(id: string): boolean {
  const store = getStore();
  const index = store.findIndex((s) => s.id === id);
  if (index === -1) return false;
  store.splice(index, 1);
  return true;
}

export async function deleteScheduleAsync(id: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return deleteSchedule(id);

  const { error } = await db
    .from("schedules")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) return deleteSchedule(id);
  return true;
}
