type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

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

type LarkApiResponse<T> = {
  code: number;
  msg?: string;
  data?: T;
};

declare global {
  var __gdxLarkAppToken: TokenCacheEntry | undefined;
  var __gdxLarkTenantToken: TokenCacheEntry | undefined;
}

const DEFAULT_OPEN_API_BASE_URL = "https://open.larksuite.com";
const TOKEN_EXPIRY_SKEW_MS = 60_000;

export class LarkApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "LarkApiError";
    this.status = status;
    this.code = code;
  }
}

export function getLarkOpenApiBaseUrl() {
  const raw =
    process.env.LARK_OPEN_API_BASE_URL?.trim() ||
    process.env.LARK_OPEN_API_BASE?.trim() ||
    process.env.LARK_BASE_URL?.trim() ||
    DEFAULT_OPEN_API_BASE_URL;
  return raw.replace(/\/open-apis\/?$/, "").replace(/\/+$/, "");
}

export function getLarkOpenApisBaseUrl() {
  return `${getLarkOpenApiBaseUrl()}/open-apis`;
}

export async function getLarkAppAccessToken(): Promise<Result<string>> {
  const cached = readCachedToken("app");
  if (cached) return { ok: true, data: cached };

  const token = await requestLarkToken("app");
  if (!token.ok) return token;
  writeCachedToken("app", token.data.token, token.data.expire);
  return { ok: true, data: token.data.token };
}

export async function getLarkTenantAccessToken(): Promise<Result<string>> {
  const cached = readCachedToken("tenant");
  if (cached) return { ok: true, data: cached };

  const token = await requestLarkToken("tenant");
  if (!token.ok) return token;
  writeCachedToken("tenant", token.data.token, token.data.expire);
  return { ok: true, data: token.data.token };
}

export async function postLarkApiWithAppToken<T>(
  path: string,
  body: unknown,
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  const token = await getLarkAppAccessToken();
  if (!token.ok) {
    throw new LarkApiError(token.status, "lark_app_token_error", token.error);
  }
  return requestLarkApi<T>("POST", token.data, path, body, params);
}

export async function postLarkApiWithTenantToken<T>(
  path: string,
  body: unknown,
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  const token = await getLarkTenantAccessToken();
  if (!token.ok) {
    throw new LarkApiError(token.status, "lark_tenant_token_error", token.error);
  }
  return requestLarkApi<T>("POST", token.data, path, body, params);
}

export async function getLarkApiWithTenantToken<T>(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  const token = await getLarkTenantAccessToken();
  if (!token.ok) {
    throw new LarkApiError(token.status, "lark_tenant_token_error", token.error);
  }
  return requestLarkApi<T>("GET", token.data, path, undefined, params);
}

export async function postLarkApiWithUserAccessToken<T>(
  userAccessToken: string,
  path: string,
  body: unknown = {},
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  const token = userAccessToken.trim();
  if (!token) {
    throw new LarkApiError(
      401,
      "lark_user_token_missing",
      "Larkで再ログインしてください",
    );
  }
  return requestLarkApi<T>("POST", token, path, body, params);
}

export function toLarkApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof LarkApiError) {
    return error;
  }
  return new LarkApiError(502, "lark_api_unavailable", fallbackMessage);
}

function readCachedToken(kind: "app" | "tenant") {
  const cached =
    kind === "app" ? globalThis.__gdxLarkAppToken : globalThis.__gdxLarkTenantToken;
  if (!cached) return null;
  return cached.expiresAt - TOKEN_EXPIRY_SKEW_MS > Date.now() ? cached.token : null;
}

function writeCachedToken(kind: "app" | "tenant", token: string, expire = 7200) {
  const entry: TokenCacheEntry = {
    token,
    expiresAt: Date.now() + Math.max(expire - 60, 60) * 1000,
  };
  if (kind === "app") {
    globalThis.__gdxLarkAppToken = entry;
  } else {
    globalThis.__gdxLarkTenantToken = entry;
  }
}

async function requestLarkToken(
  kind: "app" | "tenant",
): Promise<Result<{ token: string; expire?: number }>> {
  const appId = process.env.LARK_APP_ID?.trim();
  const appSecret = process.env.LARK_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return { ok: false, status: 503, error: "Lark認証情報が未設定です" };
  }

  const path =
    kind === "app"
      ? "/auth/v3/app_access_token/internal"
      : "/auth/v3/tenant_access_token/internal";
  const response = await fetch(`${getLarkOpenApisBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    cache: "no-store",
  }).catch(() => null);

  if (!response) {
    return { ok: false, status: 502, error: "Lark認証APIに接続できません" };
  }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status === 401 || response.status === 403 ? 403 : 502,
      error: "Lark認証APIがエラーを返しました",
    };
  }

  const json = (await response.json().catch(() => null)) as LarkTokenResponse | null;
  const token =
    kind === "app" ? json?.app_access_token : json?.tenant_access_token;
  if (!json || json.code !== 0 || !token) {
    return {
      ok: false,
      status: isLarkPermissionError(json?.code) ? 403 : 502,
      error: json?.msg ?? "Larkトークンの取得に失敗しました",
    };
  }

  return { ok: true, data: { token, expire: json.expire } };
}

async function requestLarkApi<T>(
  method: "POST" | "GET",
  token: string,
  path: string,
  body: unknown,
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  const url = new URL(`${getLarkOpenApisBaseUrl()}${normalizePath(path)}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  }).catch(() => null);

  if (!response) {
    throw new LarkApiError(
      502,
      "lark_api_request_failed",
      "Lark APIに接続できません",
    );
  }

  const json = (await response.json().catch(() => null)) as LarkApiResponse<T> | null;
  if (!json) {
    throw new LarkApiError(
      502,
      "lark_api_invalid_response",
      "Lark APIの応答を読み取れません",
    );
  }
  if (json.code !== 0) {
    throw new LarkApiError(
      isLarkPermissionError(json.code) ? 403 : 502,
      "lark_api_error",
      json.msg ?? "Lark APIがエラーを返しました",
    );
  }
  if (!response.ok) {
    throw new LarkApiError(
      response.status === 401 || response.status === 403 ? 403 : 502,
      "lark_api_http_error",
      "Lark APIがエラーを返しました",
    );
  }
  return json.data as T;
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function isLarkPermissionError(code: number | undefined) {
  return code === 40004 || code === 41050 || code === 99991663;
}
