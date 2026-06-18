import { formatISO } from "date-fns";
import { larkConfig } from "./config";
import {
  createScheduleAsync,
  getScheduleAsync,
  listSchedulesAsync,
  listScheduleTypesAsync,
  listUsersAsync,
  updateScheduleAsync,
} from "@/lib/schedule-store";
import type { Schedule, ScheduleStatus } from "@/components/calendar/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
type SyncResult =
  | { ok: true; scheduleId: string; larkEventId: string }
  | { ok: false; scheduleId: string; skipped?: boolean; error: string };

type TokenCacheEntry = {
  token: string;
  expiresAt: number;
};

type LarkTokenResponse = {
  code: number;
  msg?: string;
  app_access_token?: string;
  tenant_access_token?: string;
  expire?: number;
};

type LarkCalendarEventResponse = {
  code: number;
  msg?: string;
  data?: {
    event?: {
      event_id?: string;
    };
    event_id?: string;
  };
};

type LarkCalendarEventListResponse = {
  code: number;
  msg?: string;
  data?: {
    items?: LarkCalendarEvent[];
    has_more?: boolean;
    page_token?: string;
  };
};

type LarkCalendarEvent = {
  event_id?: string;
  summary?: string;
  description?: string;
  start_time?: LarkCalendarEventTime;
  end_time?: LarkCalendarEventTime;
  location?: { name?: string };
  status?: string;
};

type LarkCalendarEventTime = {
  timestamp?: string;
  date?: string;
  timezone?: string;
};

type LarkCalendarEventBody = {
  summary: string;
  description?: string;
  start_time: { timestamp: string; timezone: "Asia/Tokyo" };
  end_time: { timestamp: string; timezone: "Asia/Tokyo" };
  location?: { name: string };
  visibility: "default";
  free_busy_status: "busy";
};

type PullResult = {
  ok: true;
  at: string;
  pulled: number;
  created: number;
  updated: number;
  skipped: number;
  results: Array<{
    ok: boolean;
    larkEventId: string;
    scheduleId?: string;
    action?: "created" | "updated" | "skipped";
    error?: string;
  }>;
};

declare global {
  var __gdxLarkCalendarAppToken: TokenCacheEntry | undefined;
  var __gdxLarkCalendarTenantToken: TokenCacheEntry | undefined;
}

function isConfigured() {
  return Boolean(
    larkConfig.appId && larkConfig.appSecret && larkConfig.calendarId,
  );
}

function getCachedToken(kind: "app" | "tenant") {
  const cached =
    kind === "app"
      ? globalThis.__gdxLarkCalendarAppToken
      : globalThis.__gdxLarkCalendarTenantToken;
  if (!cached) return null;
  return cached.expiresAt - 60_000 > Date.now() ? cached.token : null;
}

function setCachedToken(kind: "app" | "tenant", token: string, expire = 7200) {
  const entry = {
    token,
    expiresAt: Date.now() + expire * 1000,
  };
  if (kind === "app") {
    globalThis.__gdxLarkCalendarAppToken = entry;
  } else {
    globalThis.__gdxLarkCalendarTenantToken = entry;
  }
}

async function getLarkAppAccessToken(): Promise<Result<string>> {
  const cached = getCachedToken("app");
  if (cached) return { ok: true, data: cached };
  if (!larkConfig.appId || !larkConfig.appSecret) {
    return { ok: false, error: "Lark認証情報が未設定です" };
  }

  const response = await fetch(
    `${larkConfig.openApiBase}/auth/v3/app_access_token/internal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: larkConfig.appId,
        app_secret: larkConfig.appSecret,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, error: `app_access_token: HTTP ${response.status}` };
  }
  const json = (await response.json()) as LarkTokenResponse;
  if (json.code !== 0 || !json.app_access_token) {
    return { ok: false, error: json.msg ?? "app_access_token failed" };
  }
  setCachedToken("app", json.app_access_token, json.expire);
  return { ok: true, data: json.app_access_token };
}

export async function getLarkTenantAccessToken(): Promise<Result<string>> {
  const cached = getCachedToken("tenant");
  if (cached) return { ok: true, data: cached };
  if (!larkConfig.appId || !larkConfig.appSecret) {
    return { ok: false, error: "Lark認証情報が未設定です" };
  }

  const response = await fetch(
    `${larkConfig.openApiBase}/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: larkConfig.appId,
        app_secret: larkConfig.appSecret,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, error: `tenant_access_token: HTTP ${response.status}` };
  }
  const json = (await response.json()) as LarkTokenResponse;
  if (json.code !== 0 || !json.tenant_access_token) {
    return { ok: false, error: json.msg ?? "tenant_access_token failed" };
  }
  setCachedToken("tenant", json.tenant_access_token, json.expire);
  return { ok: true, data: json.tenant_access_token };
}

function toLarkEventBody(schedule: Schedule): LarkCalendarEventBody {
  const description = [
    schedule.caseNumber ? `案件番号：${schedule.caseNumber}` : null,
    schedule.caseName ? `案件名：${schedule.caseName}` : null,
    schedule.memo ? `メモ：${schedule.memo}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const body: LarkCalendarEventBody = {
    summary: schedule.title,
    start_time: {
      timestamp: String(Math.floor(schedule.startAt.getTime() / 1000)),
      timezone: "Asia/Tokyo",
    },
    end_time: {
      timestamp: String(Math.floor(schedule.endAt.getTime() / 1000)),
      timezone: "Asia/Tokyo",
    },
    visibility: "default",
    free_busy_status: "busy",
  };
  if (description) body.description = description;
  if (schedule.location) body.location = { name: schedule.location };
  return body;
}

function readEventId(json: LarkCalendarEventResponse) {
  return json.data?.event?.event_id ?? json.data?.event_id ?? "";
}

function readLarkTime(value: LarkCalendarEventTime | undefined) {
  if (!value) return null;
  if (value.timestamp) {
    const seconds = Number(value.timestamp);
    if (Number.isFinite(seconds)) return new Date(seconds * 1000);
  }
  if (value.date) {
    const parsed = new Date(`${value.date}T00:00:00+09:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function extractDescriptionField(description: string | undefined, label: string) {
  if (!description) return undefined;
  const line = description
    .split(/\r?\n/)
    .find((item) => item.startsWith(`${label}：`));
  return line?.slice(label.length + 1).trim() || undefined;
}

function normalizeLarkStatus(status: string | undefined): ScheduleStatus {
  return status === "cancelled" ? "cancelled" : "planned";
}

async function listLarkEvents(
  token: string,
  startAt: Date,
  endAt: Date,
  limit: number,
): Promise<Result<LarkCalendarEvent[]>> {
  const encodedCalendarId = encodeURIComponent(larkConfig.calendarId);
  const items: LarkCalendarEvent[] = [];
  let pageToken = "";

  while (items.length < limit) {
    const url = new URL(
      `${larkConfig.openApiBase}/calendar/v4/calendars/${encodedCalendarId}/events`,
    );
    url.searchParams.set(
      "start_time",
      String(Math.floor(startAt.getTime() / 1000)),
    );
    url.searchParams.set("end_time", String(Math.floor(endAt.getTime() / 1000)));
    url.searchParams.set("page_size", String(Math.min(100, limit - items.length)));
    if (pageToken) url.searchParams.set("page_token", pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, error: `calendar event list: HTTP ${response.status}` };
    }
    const json = (await response.json()) as LarkCalendarEventListResponse;
    if (json.code !== 0) {
      return { ok: false, error: json.msg ?? "calendar event list failed" };
    }

    items.push(...(json.data?.items ?? []));
    if (!json.data?.has_more || !json.data.page_token) break;
    pageToken = json.data.page_token;
  }

  return { ok: true, data: items };
}

async function requestCalendarEvent(
  method: "POST" | "PATCH" | "DELETE",
  token: string,
  schedule: Schedule,
): Promise<Result<string>> {
  const encodedCalendarId = encodeURIComponent(larkConfig.calendarId);
  const encodedEventId = schedule.larkEventId
    ? encodeURIComponent(schedule.larkEventId)
    : "";
  const eventPath =
    method === "POST"
      ? `/calendar/v4/calendars/${encodedCalendarId}/events`
      : `/calendar/v4/calendars/${encodedCalendarId}/events/${encodedEventId}`;
  const url = new URL(`${larkConfig.openApiBase}${eventPath}`);
  url.searchParams.set("need_notification", "false");

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: method === "DELETE" ? undefined : JSON.stringify(toLarkEventBody(schedule)),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, error: `calendar event: HTTP ${response.status}` };
  }
  const json = (await response.json()) as LarkCalendarEventResponse;
  if (json.code !== 0) {
    return { ok: false, error: json.msg ?? "calendar event failed" };
  }
  return { ok: true, data: readEventId(json) || schedule.larkEventId || "" };
}

export async function syncScheduleToLark(schedule: Schedule): Promise<SyncResult> {
  if (schedule.syncSource === "lark") {
    return {
      ok: false,
      scheduleId: schedule.id,
      skipped: true,
      error: "Lark起点の予定は再同期をスキップしました",
    };
  }
  if (!isConfigured()) {
    return {
      ok: false,
      scheduleId: schedule.id,
      skipped: true,
      error: "Larkカレンダー同期設定が未設定です",
    };
  }

  const token = await getLarkAppAccessToken();
  if (!token.ok) {
    return { ok: false, scheduleId: schedule.id, error: token.error };
  }

  const result = await requestCalendarEvent(
    schedule.larkEventId ? "PATCH" : "POST",
    token.data,
    schedule,
  );
  if (!result.ok) {
    return { ok: false, scheduleId: schedule.id, error: result.error };
  }
  return {
    ok: true,
    scheduleId: schedule.id,
    larkEventId: result.data,
  };
}

export async function deleteScheduleFromLark(
  schedule: Schedule,
): Promise<SyncResult> {
  if (!schedule.larkEventId) {
    return {
      ok: false,
      scheduleId: schedule.id,
      skipped: true,
      error: "Lark予定IDがないため削除同期をスキップしました",
    };
  }
  if (!isConfigured()) {
    return {
      ok: false,
      scheduleId: schedule.id,
      skipped: true,
      error: "Larkカレンダー同期設定が未設定です",
    };
  }

  const token = await getLarkAppAccessToken();
  if (!token.ok) {
    return { ok: false, scheduleId: schedule.id, error: token.error };
  }
  const result = await requestCalendarEvent("DELETE", token.data, schedule);
  if (!result.ok) {
    return { ok: false, scheduleId: schedule.id, error: result.error };
  }
  return { ok: true, scheduleId: schedule.id, larkEventId: schedule.larkEventId };
}

export async function flushLarkScheduleSync(scheduleId: string) {
  const schedule = await getScheduleAsync(scheduleId);
  if (!schedule) {
    return { ok: false as const, scheduleId, error: "予定が見つかりませんでした" };
  }
  const result = await syncScheduleToLark(schedule);
  if (result.ok) {
    await updateScheduleAsync(schedule.id, {
      larkEventId: result.larkEventId,
      syncStatus: "synced",
      lastSyncedAt: new Date(),
      syncError: null,
    });
  } else if (!result.skipped) {
    await updateScheduleAsync(schedule.id, {
      syncStatus: "failed",
      syncError: result.error,
    });
  }
  return result;
}

export async function flushPendingLarkScheduleSync(limit = 20) {
  const pending = (await listSchedulesAsync())
    .filter((schedule) => schedule.syncStatus === "pending")
    .slice(0, limit);
  const results = [];
  for (const schedule of pending) {
    results.push(await flushLarkScheduleSync(schedule.id));
  }
  return {
    at: formatISO(new Date()),
    count: results.length,
    results,
  };
}

function defaultPullStart() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

function defaultPullEnd() {
  const end = defaultPullStart();
  end.setDate(end.getDate() + 30);
  return end;
}

async function resolveImportedUserIds(existing?: Schedule) {
  if (existing?.userIds.length) return existing.userIds;
  const users = await listUsersAsync();
  const defaultUser =
    users.find((user) => user.id === larkConfig.syncDefaultUserId) ?? users[0];
  return defaultUser ? [defaultUser.id] : [];
}

async function resolveImportedTypeId(existing?: Schedule) {
  if (existing?.typeId) return existing.typeId;
  const types = await listScheduleTypesAsync();
  return types[0]?.id ?? "";
}

async function upsertScheduleFromLarkEvent(
  event: LarkCalendarEvent,
  existingSchedules: Schedule[],
) {
  const larkEventId = event.event_id ?? "";
  if (!larkEventId) {
    return {
      ok: false,
      larkEventId: "",
      action: "skipped" as const,
      error: "Lark予定IDがありません",
    };
  }

  const startAt = readLarkTime(event.start_time);
  const endAt = readLarkTime(event.end_time);
  if (!startAt || !endAt || startAt >= endAt) {
    return {
      ok: false,
      larkEventId,
      action: "skipped" as const,
      error: "Lark予定の日時が不正です",
    };
  }

  const existing = existingSchedules.find(
    (schedule) => schedule.larkEventId === larkEventId,
  );
  const title = event.summary?.trim() || "Lark予定";
  const caseNumber = extractDescriptionField(event.description, "案件番号");
  const caseName = extractDescriptionField(event.description, "案件名");
  const now = new Date();
  const base = {
    title,
    userIds: await resolveImportedUserIds(existing),
    typeId: await resolveImportedTypeId(existing),
    caseNumber,
    caseName,
    location: event.location?.name || undefined,
    memo: event.description || undefined,
    status: normalizeLarkStatus(event.status),
    larkEventId,
    syncSource: "lark" as const,
    syncStatus: "synced" as const,
    lastSyncedAt: now,
    syncError: null,
    startAt,
    endAt,
  };

  if (existing) {
    const updated = await updateScheduleAsync(existing.id, base);
    return updated
      ? {
          ok: true,
          larkEventId,
          scheduleId: updated.id,
          action: "updated" as const,
        }
      : {
          ok: false,
          larkEventId,
          action: "skipped" as const,
          error: "予定を更新できませんでした",
        };
  }

  const created = await createScheduleAsync({
    ...base,
    isAllDay: Boolean(event.start_time?.date && event.end_time?.date),
  });
  return {
    ok: true,
    larkEventId,
    scheduleId: created.id,
    action: "created" as const,
  };
}

export async function pullLarkEventsToSchedules({
  startAt = defaultPullStart(),
  endAt = defaultPullEnd(),
  limit = 100,
}: {
  startAt?: Date;
  endAt?: Date;
  limit?: number;
} = {}): Promise<PullResult | { ok: false; error: string }> {
  if (!isConfigured()) {
    return { ok: false, error: "Larkカレンダー同期設定が未設定です" };
  }
  if (startAt >= endAt) {
    return { ok: false, error: "同期期間が不正です" };
  }

  const token = await getLarkAppAccessToken();
  if (!token.ok) return { ok: false, error: token.error };

  const listed = await listLarkEvents(token.data, startAt, endAt, limit);
  if (!listed.ok) return { ok: false, error: listed.error };

  const existingSchedules = await listSchedulesAsync();
  const results = [];
  for (const event of listed.data) {
    results.push(await upsertScheduleFromLarkEvent(event, existingSchedules));
  }

  return {
    ok: true,
    at: formatISO(new Date()),
    pulled: listed.data.length,
    created: results.filter((result) => result.action === "created").length,
    updated: results.filter((result) => result.action === "updated").length,
    skipped: results.filter((result) => !result.ok).length,
    results,
  };
}
