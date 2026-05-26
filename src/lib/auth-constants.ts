/*
 * 認証まわりの共有定数。
 * middleware（edge 実行・next/headers 不可）と server 側の両方から import するため、
 * next/headers や node:crypto に依存しない値だけをここに置く。
 */
export const SESSION_COOKIE = "gdx_session";
