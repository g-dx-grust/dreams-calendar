// 予定種別カラーの 12 色パレット
// see: ../../G-DX_Future_Design_Rules.md / docs/02_database_schema.md
export const SCHEDULE_TYPE_PALETTE = [
  "#F54A45", // 赤
  "#FF8800", // オレンジ
  "#FFC107", // 黄
  "#34C724", // 緑
  "#00C4CC", // シアン
  "#3370FF", // 青（Lark Primary）
  "#4E83FF", // 水色
  "#8B5CF6", // 紫
  "#EC4899", // ピンク
  "#8F959E", // 薄灰
  "#646A73", // 灰
  "#1F2329", // 黒
] as const;

export type ScheduleTypeColor = (typeof SCHEDULE_TYPE_PALETTE)[number];

export function isPaletteColor(value: string): value is ScheduleTypeColor {
  return (SCHEDULE_TYPE_PALETTE as readonly string[]).includes(value);
}
