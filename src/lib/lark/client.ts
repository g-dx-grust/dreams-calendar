import { larkConfig } from "./config";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type LarkUserInfo = {
  open_id: string;
  union_id: string;
  user_id?: string;
  name: string;
  en_name?: string;
  email?: string;
  avatar_url?: string;
  avatar_thumb?: string;
  avatar_middle?: string;
  avatar_big?: string;
  tenant_key?: string;
};

type AppAccessToken = { app_access_token: string; expire: number };
type UserAccessToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: "Bearer";
};

async function getAppAccessToken(): Promise<Result<string>> {
  const res = await fetch(
    `${larkConfig.openApiBase}/auth/v3/app_access_token/internal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: larkConfig.appId,
        app_secret: larkConfig.appSecret,
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, error: `app_access_token: ${res.status}` };
  const json = (await res.json()) as { code: number; msg: string } & AppAccessToken;
  if (json.code !== 0) return { ok: false, error: json.msg };
  return { ok: true, data: json.app_access_token };
}

export async function exchangeCode(
  code: string,
): Promise<Result<UserAccessToken>> {
  const tokenResult = await getAppAccessToken();
  if (!tokenResult.ok) return tokenResult;

  const res = await fetch(`${larkConfig.openApiBase}/authen/v1/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenResult.data}`,
    },
    body: JSON.stringify({ grant_type: "authorization_code", code }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: `access_token: ${res.status}` };
  const json = (await res.json()) as { code: number; msg: string; data?: UserAccessToken };
  if (json.code !== 0 || !json.data) return { ok: false, error: json.msg };
  return { ok: true, data: json.data };
}

export async function fetchUserInfo(
  userAccessToken: string,
): Promise<Result<LarkUserInfo>> {
  const res = await fetch(`${larkConfig.openApiBase}/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${userAccessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: `user_info: ${res.status}` };
  const json = (await res.json()) as { code: number; msg: string; data?: LarkUserInfo };
  if (json.code !== 0 || !json.data) return { ok: false, error: json.msg };
  return { ok: true, data: json.data };
}

export function pickAvatar(user: LarkUserInfo): string | null {
  return (
    user.avatar_big ||
    user.avatar_middle ||
    user.avatar_thumb ||
    user.avatar_url ||
    null
  );
}
