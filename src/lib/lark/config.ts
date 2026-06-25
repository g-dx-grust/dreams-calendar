/*
 * Lark OAuth 設定
 * see: ../../G-DX_Lark_Integration_Rules.md §2
 *
 * 環境変数のみ：App ID/Secret に限定。Base ID・Table ID 等は DB 管理（ハードコード禁止）
 */
import { getLarkOpenApiBaseUrl, getLarkOpenApisBaseUrl } from "./provider-client";

const DEFAULT_AUTHORIZE_BASE_URL = "https://accounts.larksuite.com";
const DEFAULT_CALLBACK_PATH = "/api/auth/lark/callback";

export const larkConfig = {
  appId: process.env.LARK_APP_ID ?? "",
  appSecret: process.env.LARK_APP_SECRET ?? "",
  openApiBaseUrl: getLarkOpenApiBaseUrl(),
  openApiBase: getLarkOpenApisBaseUrl(),
  authorizeBaseUrl:
    process.env.LARK_OAUTH_AUTHORIZE_BASE_URL ?? DEFAULT_AUTHORIZE_BASE_URL,
  calendarId: process.env.LARK_CALENDAR_ID ?? "",
  syncSecret: process.env.LARK_SYNC_SECRET ?? "",
  syncDefaultUserId: process.env.LARK_SYNC_DEFAULT_USER_ID ?? "",
  redirectUri:
    process.env.LARK_OAUTH_REDIRECT_URI ??
    process.env.NEXT_PUBLIC_LARK_REDIRECT_URI ??
    "",
  scopes: process.env.LARK_OAUTH_SCOPES ?? "",
};

export const LARK_OAUTH_STATE_COOKIE = "lark_oauth_state";
export const LARK_OAUTH_NEXT_COOKIE = "lark_oauth_next";
export const LARK_OAUTH_STATE_MAX_AGE = 600;

export function getLarkOAuthRedirectUri(origin: string) {
  return larkConfig.redirectUri || new URL(DEFAULT_CALLBACK_PATH, origin).toString();
}

export function buildAuthorizeUrl(state: string, origin: string) {
  const params = new URLSearchParams({
    client_id: larkConfig.appId,
    redirect_uri: getLarkOAuthRedirectUri(origin),
    response_type: "code",
    state,
  });
  if (larkConfig.scopes.trim()) {
    params.set("scope", larkConfig.scopes.trim());
  }
  return `${larkConfig.authorizeBaseUrl.replace(/\/+$/, "")}/open-apis/authen/v1/authorize?${params.toString()}`;
}
