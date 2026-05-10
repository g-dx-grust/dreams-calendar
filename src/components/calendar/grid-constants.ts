/*
 * 日ビューと日報パネルで共有するグリッド定数。
 * "use client" ファイル（day-view.tsx）から server component に直接エクスポート
 * すると client reference 化されて数値として取得できないため、
 * 純粋な ts ファイルに分離している。
 */

export const HOUR_WIDTH_PX = 96; // 1 時間 = 96px
export const USER_COL_PX = 119;
export const REPORT_COL_PX = 80;
