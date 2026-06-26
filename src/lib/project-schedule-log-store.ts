import { differenceInMinutes } from "date-fns";
import type { ProjectScheduleLog, Schedule } from "@/components/calendar/types";
import { formatJstDate } from "@/lib/jst";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type SerializedProjectScheduleLog = Omit<
  ProjectScheduleLog,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

type ProjectScheduleLogRow = {
  id: string;
  case_id: number;
  schedule_id: string;
  user_id: string | null;
  work_date: string;
  minutes: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

declare global {
  var __gdxProjectScheduleLogStore:
    | SerializedProjectScheduleLog[]
    | undefined;
}

function getStore(): SerializedProjectScheduleLog[] {
  if (!globalThis.__gdxProjectScheduleLogStore) {
    globalThis.__gdxProjectScheduleLogStore = [];
  }
  return globalThis.__gdxProjectScheduleLogStore;
}

function hydrate(log: SerializedProjectScheduleLog): ProjectScheduleLog {
  return {
    ...log,
    createdAt: new Date(log.createdAt),
    updatedAt: new Date(log.updatedAt),
  };
}

function hydrateRow(row: ProjectScheduleLogRow): ProjectScheduleLog {
  return {
    id: row.id,
    caseId: row.case_id,
    scheduleId: row.schedule_id,
    userId: row.user_id ?? "",
    workDate: row.work_date,
    minutes: row.minutes,
    memo: row.memo ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function resolveActualMinutes(schedule: Schedule): number | null {
  if (schedule.actualMinutes && schedule.actualMinutes > 0) {
    return schedule.actualMinutes;
  }
  if (schedule.actualStartAt && schedule.actualEndAt) {
    const minutes = differenceInMinutes(
      schedule.actualEndAt,
      schedule.actualStartAt,
    );
    return minutes > 0 ? minutes : null;
  }
  return null;
}

export function syncProjectScheduleLogs(schedule: Schedule): ProjectScheduleLog[] {
  deleteProjectScheduleLogs(schedule.id);

  if (schedule.status !== "done" || !schedule.caseId) return [];

  const minutes = resolveActualMinutes(schedule);
  if (!minutes) return [];

  const now = new Date().toISOString();
  const workDate = formatJstDate(schedule.actualStartAt ?? schedule.startAt);
  const created = schedule.userIds.map<SerializedProjectScheduleLog>((userId) => ({
    id: `${schedule.id}:${userId}`,
    caseId: schedule.caseId!,
    scheduleId: schedule.id,
    userId,
    workDate,
    minutes,
    memo: schedule.actualMemo ?? schedule.memo,
    createdAt: now,
    updatedAt: now,
  }));

  getStore().push(...created);
  return created.map(hydrate);
}

function buildRows(schedule: Schedule) {
  if (schedule.status !== "done" || !schedule.caseId) return [];

  const minutes = resolveActualMinutes(schedule);
  if (!minutes) return [];

  const workDate = formatJstDate(schedule.actualStartAt ?? schedule.startAt);
  return schedule.userIds.map((userId) => ({
    case_id: schedule.caseId!,
    schedule_id: schedule.id,
    user_id: userId,
    work_date: workDate,
    minutes,
    memo: schedule.actualMemo ?? schedule.memo ?? null,
  }));
}

export async function syncProjectScheduleLogsAsync(
  schedule: Schedule,
): Promise<ProjectScheduleLog[]> {
  const db = getSupabaseAdmin();
  if (!db) return syncProjectScheduleLogs(schedule);

  const rows = buildRows(schedule);
  const deleted = await db
    .from("project_schedule_logs")
    .delete()
    .eq("schedule_id", schedule.id);

  if (deleted.error) return syncProjectScheduleLogs(schedule);
  if (rows.length === 0) return [];

  const { data, error } = await db
    .from("project_schedule_logs")
    .insert(rows)
    .select(
      "id,case_id,schedule_id,user_id,work_date,minutes,memo,created_at,updated_at",
    );

  if (error || !data) return syncProjectScheduleLogs(schedule);
  return (data as ProjectScheduleLogRow[]).map(hydrateRow);
}

export function deleteProjectScheduleLogs(scheduleId: string): void {
  const store = getStore();
  const remaining = store.filter((log) => log.scheduleId !== scheduleId);
  store.length = 0;
  store.push(...remaining);
}

export async function deleteProjectScheduleLogsAsync(
  scheduleId: string,
): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) {
    deleteProjectScheduleLogs(scheduleId);
    return;
  }

  const { error } = await db
    .from("project_schedule_logs")
    .delete()
    .eq("schedule_id", scheduleId);
  if (error) deleteProjectScheduleLogs(scheduleId);
}

export function listProjectScheduleLogsByCase(
  caseId: number,
): ProjectScheduleLog[] {
  return getStore()
    .filter((log) => log.caseId === caseId)
    .map(hydrate)
    .sort((a, b) => {
      if (a.workDate === b.workDate) return a.scheduleId.localeCompare(b.scheduleId);
      return a.workDate.localeCompare(b.workDate);
    });
}

export async function listProjectScheduleLogsByCaseAsync(
  caseId: number,
): Promise<ProjectScheduleLog[]> {
  const db = getSupabaseAdmin();
  if (!db) return listProjectScheduleLogsByCase(caseId);

  const { data, error } = await db
    .from("project_schedule_logs")
    .select(
      "id,case_id,schedule_id,user_id,work_date,minutes,memo,created_at,updated_at",
    )
    .eq("case_id", caseId)
    .order("work_date", { ascending: true })
    .order("schedule_id", { ascending: true });

  if (error || !data) return listProjectScheduleLogsByCase(caseId);
  return (data as ProjectScheduleLogRow[]).map(hydrateRow);
}
