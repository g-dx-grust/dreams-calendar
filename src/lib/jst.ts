const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

type JstParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function getJstParts(date: Date): JstParts {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

export function parseJstDate(date: string): Date | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!matched) return null;
  const [, y, m, d] = matched;
  const parsed = new Date(
    Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0) - JST_OFFSET_MS,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseJstDateTime(date: string, time: string): Date | null {
  const dateMatched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatched = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatched || !timeMatched) return null;
  const [, y, m, d] = dateMatched;
  const [, hh, mm] = timeMatched;
  const parsed = new Date(
    Date.UTC(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      0,
      0,
    ) - JST_OFFSET_MS,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseJstDateTimeLocal(value: string): Date | null {
  const [date, timeWithSeconds] = value.split("T");
  const time = timeWithSeconds?.slice(0, 5);
  if (!date || !time) return null;
  return parseJstDateTime(date, time);
}

export function toJstOffsetDateTime(date: string, time: string) {
  if (!parseJstDateTime(date, time)) return null;
  return `${date}T${time}:00+09:00`;
}

export function toJstOffsetDateTimeLocal(value: string) {
  const [date, timeWithSeconds] = value.split("T");
  const time = timeWithSeconds?.slice(0, 5);
  if (!date || !time) return null;
  return toJstOffsetDateTime(date, time);
}

export function formatJstDate(date: Date) {
  const p = getJstParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function formatJstTime(date: Date) {
  const p = getJstParts(date);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

export function formatJstDateTimeLocal(date?: Date) {
  return date ? `${formatJstDate(date)}T${formatJstTime(date)}` : "";
}

export function formatJstDateJa(date: Date) {
  const p = getJstParts(date);
  return `${p.year}年${p.month}月${p.day}日`;
}

export function formatJstYearMonth(date: Date) {
  const p = getJstParts(date);
  return `${p.year}年${p.month}月`;
}

export function formatJstDateLabel(date: Date) {
  const p = getJstParts(date);
  return `${p.year}年${p.month}月${p.day}日(${WEEKDAYS[p.weekday]})`;
}

export function formatJstMonthDayLabel(date: Date) {
  const p = getJstParts(date);
  return `${p.month}月${p.day}日(${WEEKDAYS[p.weekday]})`;
}

export function formatJstShortDateTime(date: Date) {
  const p = getJstParts(date);
  return `${p.month}/${p.day}(${WEEKDAYS[p.weekday]}) ${pad2(p.hour)}:${pad2(p.minute)}`;
}

export function formatJstSlashDate(date: Date) {
  const p = getJstParts(date);
  return `${p.year}/${pad2(p.month)}/${pad2(p.day)}(${WEEKDAYS[p.weekday]})`;
}

export function formatJstSlashDateTime(date: Date) {
  return `${formatJstSlashDate(date)} ${formatJstTime(date)}`;
}

export function jstWeekday(date: Date) {
  return WEEKDAYS[getJstParts(date).weekday];
}

export function isSameJstDay(a: Date, b: Date) {
  return formatJstDate(a) === formatJstDate(b);
}

export function startOfJstDay(value: Date | string) {
  const date = typeof value === "string" ? parseJstDate(value) : value;
  if (!date) return null;
  return parseJstDate(formatJstDate(date));
}

export function addJstDays(date: Date, days: number) {
  const p = getJstParts(date);
  return new Date(
    Date.UTC(p.year, p.month - 1, p.day + days, p.hour, p.minute, p.second, 0) -
      JST_OFFSET_MS,
  );
}

export function addJstMonths(date: Date, months: number) {
  const p = getJstParts(date);
  return new Date(
    Date.UTC(p.year, p.month - 1 + months, p.day, p.hour, p.minute, p.second, 0) -
      JST_OFFSET_MS,
  );
}

export function startOfJstWeek(date: Date) {
  const p = getJstParts(date);
  return parseJstDate(
    formatJstDate(
      new Date(
        Date.UTC(p.year, p.month - 1, p.day - p.weekday, 0, 0, 0, 0) -
          JST_OFFSET_MS,
      ),
    ),
  )!;
}

export function startOfJstMonth(date: Date) {
  const p = getJstParts(date);
  return new Date(Date.UTC(p.year, p.month - 1, 1, 0, 0, 0, 0) - JST_OFFSET_MS);
}

export function endExclusiveOfJstMonth(date: Date) {
  const p = getJstParts(date);
  return new Date(Date.UTC(p.year, p.month, 1, 0, 0, 0, 0) - JST_OFFSET_MS);
}

export function dateAtJstTime(date: Date, hour: number, minute: number) {
  const p = getJstParts(date);
  return new Date(
    Date.UTC(p.year, p.month - 1, p.day, hour, minute, 0, 0) - JST_OFFSET_MS,
  );
}
