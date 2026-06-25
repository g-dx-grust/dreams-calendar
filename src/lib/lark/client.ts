import {
  getLarkAppAccessToken,
  postLarkApiWithAppToken,
} from "./provider-client";
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

type UserAccessToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: "Bearer";
};

type RefreshAccessToken = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  token_type?: "Bearer";
};

export async function exchangeCode(
  code: string,
): Promise<Result<UserAccessToken>> {
  if (!larkConfig.appId || !larkConfig.appSecret) {
    return { ok: false, error: "Lark認証情報が未設定です" };
  }
  try {
    const data = await postLarkApiWithAppToken<UserAccessToken>(
      "/authen/v1/access_token",
      { grant_type: "authorization_code", code },
    );
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Larkアクセストークンの取得に失敗しました",
    };
  }
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

export async function refreshUserAccessToken(
  refreshToken: string,
): Promise<Result<RefreshAccessToken>> {
  const appToken = await getLarkAppAccessToken();
  if (!appToken.ok) return { ok: false, error: appToken.error };

  const res = await fetch(`${larkConfig.openApiBase}/authen/v1/refresh_access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appToken.data}`,
    },
    body: JSON.stringify({ grant_type: "refresh_token", refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: `refresh_access_token: ${res.status}` };
  const json = (await res.json()) as {
    code: number;
    msg: string;
    data?: RefreshAccessToken;
  };
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
