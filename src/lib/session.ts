/*
 * セッション Cookie 管理
 *
 * HttpOnly Cookie に Lark のユーザー情報を保存する。改ざん防止のため
 * SESSION_SECRET による HMAC-SHA256 署名を付与し、読み取り時に検証する。
 * （暗号化＝中身も秘匿したい場合は将来 JWE 等へ置き換える）
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./auth-constants";
import type { LarkUserInfo } from "./lark/client";

const MAX_AGE = 60 * 60 * 12; // 12時間

export type SessionUser = {
  larkOpenId: string;
  larkUnionId: string;
  name: string;
  email?: string;
  avatarUrl: string | null;
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET が未設定または短すぎます（16文字以上）。.env.local を確認してください。",
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function encode(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): SessionUser | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionUser;
}

export async function setSession(user: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encode(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return decode(raw);
  } catch {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
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
