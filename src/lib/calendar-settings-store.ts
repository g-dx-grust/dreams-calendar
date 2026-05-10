/*
 * カレンダー表示設定 ストア（プロセス内 in-memory）
 * see: ../../CLAUDE.md §D（DB 接続前の暫定実装）
 *
 * - startHour: 表示開始時刻（0–23）
 * - endHour: 表示終了時刻（1–24）
 * - 制約: endHour > startHour
 */

export type CalendarSettings = {
  startHour: number;
  endHour: number;
};

const DEFAULT_SETTINGS: CalendarSettings = {
  startHour: 8,
  endHour: 18,
};

declare global {
  // eslint-disable-next-line no-var
  var __gdxCalendarSettings: CalendarSettings | undefined;
}

function getStore(): CalendarSettings {
  if (!globalThis.__gdxCalendarSettings) {
    globalThis.__gdxCalendarSettings = { ...DEFAULT_SETTINGS };
  }
  return globalThis.__gdxCalendarSettings;
}

export function getCalendarSettings(): CalendarSettings {
  return { ...getStore() };
}

export function updateCalendarSettings(
  patch: Partial<CalendarSettings>,
): CalendarSettings {
  const current = getStore();
  if (patch.startHour !== undefined) current.startHour = patch.startHour;
  if (patch.endHour !== undefined) current.endHour = patch.endHour;
  return { ...current };
}
