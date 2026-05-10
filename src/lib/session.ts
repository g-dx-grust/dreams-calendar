/*
 * セッション Cookie 管理（雛形）
 *
 * 暫定実装：HttpOnly Cookie に Lark のユーザー情報を JSON で保存する最小構成。
 * 本実装では SESSION_SECRET で署名 or JWE 暗号化に置き換える前提。
 */
import { cookies } from "next/headers";
import type { LarkUserInfo } from "./lark/client";

const COOKIE_NAME = "gdx_session";
const MAX_AGE = 60 * 60 * 12; // 12時間

export type SessionUser = {
  larkOpenId: string;
  larkUnionId: string;
  name: string;
  email?: string;
  avatarUrl: string | null;
};

export async function setSession(user: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function userInfoToSession(
  user: LarkUserInfo,
  avatarUrl: string | null,
): SessionUser {
  return {
    larkOpenId: user.open_id,
    larkUnionId: user.union_id,
    name: user.name,
    email: user.email,
    avatarUrl,
  };
}
