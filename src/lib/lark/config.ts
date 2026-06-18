/*
 * Lark OAuth 設定
 * see: ../../G-DX_Lark_Integration_Rules.md §2
 *
 * 環境変数のみ：App ID/Secret に限定。Base ID・Table ID 等は DB 管理（ハードコード禁止）
 */
export const larkConfig = {
  appId: process.env.LARK_APP_ID ?? "",
  appSecret: process.env.LARK_APP_SECRET ?? "",
  openApiBase:
    process.env.LARK_OPEN_API_BASE ?? "https://open.larksuite.com/open-apis",
  calendarId: process.env.LARK_CALENDAR_ID ?? "",
  syncSecret: process.env.LARK_SYNC_SECRET ?? "",
  syncDefaultUserId: process.env.LARK_SYNC_DEFAULT_USER_ID ?? "",
  redirectUri:
    process.env.NEXT_PUBLIC_LARK_REDIRECT_URI ??
    "http://localhost:3000/api/auth/lark/callback",
};

export const LARK_OAUTH_STATE_COOKIE = "lark_oauth_state";
export const LARK_OAUTH_STATE_MAX_AGE = 600;

export function buildAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    app_id: larkConfig.appId,
    redirect_uri: larkConfig.redirectUri,
    response_type: "code",
    state,
  });
  return `${larkConfig.openApiBase}/authen/v1/authorize?${params.toString()}`;
}
