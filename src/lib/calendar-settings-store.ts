/*
 * カレンダー設定ストア（calendar_settings テーブルで永続化）
 * see: ../../G-DX_Lark_Integration_Rules.md §3（連携設定のDB管理・ハードコード禁止）
 *
 * - display_hours: 日表示カレンダーの時間軸範囲（startHour/endHour）
 * - daily_report_notification: 日報通知の送付先（グループチャットID・管理者DM可否）
 * - DB未接続（プレビュー環境）ではプロセス内メモリにフォールバックする
 */

import { getSupabaseAdmin } from "@/lib/supabase/server";

export type CalendarSettings = {
  startHour: number;
  endHour: number;
};

export type NotificationSettings = {
  dailyReportChatId: string | null;
  dailyReportChatName: string | null;
  dailyReportDmAdmins: boolean;
};

const DISPLAY_HOURS_KEY = "display_hours";
const DAILY_REPORT_NOTIFICATION_KEY = "daily_report_notification";

const DEFAULT_SETTINGS: CalendarSettings = {
  startHour: 8,
  endHour: 18,
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailyReportChatId: null,
  dailyReportChatName: null,
  dailyReportDmAdmins: true,
};

declare global {
  var __gdxCalendarSettings: CalendarSettings | undefined;
  var __gdxNotificationSettings: NotificationSettings | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readSetting(key: string): Promise<unknown | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("calendar_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    console.warn("[calendar-settings] read failed", { key, error: error.message });
    return null;
  }
  return data?.value ?? null;
}

async function writeSetting(
  key: string,
  value: unknown,
  updatedBy?: string | null,
): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { error } = await db.from("calendar_settings").upsert(
    {
      key,
      value,
      updated_by: updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) {
    console.warn("[calendar-settings] write failed", { key, error: error.message });
    return false;
  }
  return true;
}

function parseCalendarSettings(value: unknown): CalendarSettings | null {
  if (!isRecord(value)) return null;
  const startHour = Number(value.startHour);
  const endHour = Number(value.endHour);
  if (
    !Number.isInteger(startHour) ||
    !Number.isInteger(endHour) ||
    startHour < 0 ||
    startHour > 23 ||
    endHour < 1 ||
    endHour > 24 ||
    endHour <= startHour
  ) {
    return null;
  }
  return { startHour, endHour };
}

export async function getCalendarSettingsAsync(): Promise<CalendarSettings> {
  const stored = parseCalendarSettings(await readSetting(DISPLAY_HOURS_KEY));
  if (stored) return stored;
  return { ...(globalThis.__gdxCalendarSettings ?? DEFAULT_SETTINGS) };
}

export async function updateCalendarSettingsAsync(
  patch: CalendarSettings,
  updatedBy?: string | null,
): Promise<CalendarSettings> {
  const persisted = await writeSetting(DISPLAY_HOURS_KEY, patch, updatedBy);
  if (!persisted) {
    globalThis.__gdxCalendarSettings = { ...patch };
  }
  return { ...patch };
}

function parseNotificationSettings(value: unknown): NotificationSettings | null {
  if (!isRecord(value)) return null;
  const chatId =
    typeof value.dailyReportChatId === "string" && value.dailyReportChatId.trim()
      ? value.dailyReportChatId.trim()
      : null;
  const chatName =
    typeof value.dailyReportChatName === "string" && value.dailyReportChatName.trim()
      ? value.dailyReportChatName.trim()
      : null;
  return {
    dailyReportChatId: chatId,
    dailyReportChatName: chatName,
    dailyReportDmAdmins: value.dailyReportDmAdmins !== false,
  };
}

export async function getNotificationSettingsAsync(): Promise<NotificationSettings> {
  const stored = parseNotificationSettings(
    await readSetting(DAILY_REPORT_NOTIFICATION_KEY),
  );
  if (stored) return stored;
  return {
    ...(globalThis.__gdxNotificationSettings ?? DEFAULT_NOTIFICATION_SETTINGS),
  };
}

export async function updateNotificationSettingsAsync(
  patch: NotificationSettings,
  updatedBy?: string | null,
): Promise<NotificationSettings> {
  const persisted = await writeSetting(DAILY_REPORT_NOTIFICATION_KEY, patch, updatedBy);
  if (!persisted) {
    globalThis.__gdxNotificationSettings = { ...patch };
  }
  return { ...patch };
}
