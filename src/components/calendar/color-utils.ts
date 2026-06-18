const TOKEN_BACKGROUND = {
  danger: "var(--color-danger)",
  main: "var(--color-primary)",
  "text-grey": "var(--color-text-mid)",
  "chart-1": "var(--color-primary)",
  "chart-2": "var(--color-success)",
  "chart-3": "var(--color-primary-hover)",
  "chart-4": "var(--color-text-weak)",
  "chart-5": "var(--color-primary-soft)",
  "chart-6": "var(--color-warning)",
  "chart-7": "var(--color-primary-active)",
  "chart-8": "var(--color-border-strong)",
  "chart-9": "var(--color-border)",
  "chart-10": "var(--color-background)",
  neutral: "var(--color-text-strong)",
} as const;

export type ScheduleTypeColorToken = keyof typeof TOKEN_BACKGROUND;

export const SCHEDULE_TYPE_COLOR_OPTIONS: {
  value: ScheduleTypeColorToken;
  label: string;
}[] = [
  { value: "main", label: "メイン" },
  { value: "danger", label: "重要" },
  { value: "text-grey", label: "標準" },
  { value: "chart-1", label: "青" },
  { value: "chart-2", label: "完了" },
  { value: "chart-3", label: "青補助" },
  { value: "chart-4", label: "弱グレー" },
  { value: "chart-5", label: "淡青" },
  { value: "chart-6", label: "注意" },
  { value: "chart-7", label: "濃青" },
  { value: "chart-8", label: "境界強" },
  { value: "chart-9", label: "境界" },
  { value: "chart-10", label: "背景" },
  { value: "neutral", label: "黒" },
];

const LIGHT_TOKENS = new Set(["chart-5", "chart-8", "chart-9", "chart-10"]);

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function isLightHex(value: string) {
  if (!isHexColor(value)) return false;
  const c = value.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 186;
}

export function isScheduleTypeColorToken(
  value: string,
): value is ScheduleTypeColorToken {
  return Object.prototype.hasOwnProperty.call(TOKEN_BACKGROUND, value);
}

export function normalizeScheduleTypeColor(
  value: string | null | undefined,
): ScheduleTypeColorToken {
  if (value && isScheduleTypeColorToken(value)) return value;
  return "main";
}

export function scheduleTypeBackground(color: string) {
  if (isHexColor(color)) return color;
  if (isScheduleTypeColorToken(color)) return TOKEN_BACKGROUND[color];
  return "var(--color-text-mid)";
}

export function scheduleTypeForeground(color: string) {
  if (isLightHex(color) || LIGHT_TOKENS.has(color)) {
    return "var(--color-text-strong)";
  }
  return "var(--color-surface)";
}
