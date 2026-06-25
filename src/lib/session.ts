/*
 * アプリセッション管理
 *
 * Lark OAuthの本番セッションはCookieにランダムトークンのみを入れ、
 * DBにはSHA-256ハッシュとLark user tokenを保存する。
 * setSession はプレビュー用の署名付き暫定セッション互換として残す。
 */
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./auth-constants";
import { fetchUserInfo, pickAvatar, refreshUserAccessToken } from "./lark/client";
import type { LarkUserInfo } from "./lark/client";
import { getSupabaseAdmin } from "./supabase/server";

const LEGACY_MAX_AGE = 60 * 60 * 12;
const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;
const REFRESH_SKEW_MS = 60_000;

export type SessionUser = {
  userId?: string;
  larkOpenId: string;
  larkUnionId: string;
  larkUserId?: string | null;
  name: string;
  email?: string;
  avatarUrl: string | null;
  role?: string | null;
  isPreview?: boolean;
};

type DbUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  is_active: boolean;
};

type CalendarUserProfileRow = {
  user_id: string;
  lark_open_id: string | null;
  lark_union_id: string | null;
  lark_user_id: string | null;
  lark_calendar_id: string | null;
  avatar_url: string | null;
};

type CalendarUserSessionRow = {
  id: string;
  user_id: string;
  lark_access_token: string | null;
  lark_refresh_token: string | null;
  lark_token_expires_at: string | null;
  expires_at: string;
  revoked_at: string | null;
};

type AuthenticatedCalendarUser = {
  id: string;
  email: string;
  name: string;
  role: string | null;
};

type CreateDatabaseSessionInput = {
  userId: string;
  userInfo: LarkUserInfo;
  larkAccessToken: string;
  larkRefreshToken?: string;
  larkExpiresIn?: number;
};

type ResolveLarkUserResult =
  | { ok: true; user: AuthenticatedCalendarUser; avatarUrl: string | null }
  | { ok: false; error: string };

type SessionRecord = {
  session: CalendarUserSessionRow;
  user: DbUserRow;
  profile: CalendarUserProfileRow | null;
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

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getSessionMaxAgeSeconds() {
  const raw = process.env.AUTH_SESSION_MAX_AGE_SECONDS?.trim();
  const value = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isSafeInteger(value) && value > 0
    ? value
    : DEFAULT_SESSION_MAX_AGE_SECONDS;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function encodeLegacy(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeLegacy(token: string): SessionUser | null {
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
  cookieStore.set(SESSION_COOKIE, encodeLegacy(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LEGACY_MAX_AGE,
  });
}

export async function createDatabaseSession(input: CreateDatabaseSessionInput) {
  const db = getSupabaseAdmin();
  if (!db) {
    throw new Error("Supabaseの管理キーが未設定のため、Larkセッションを保存できません");
  }

  const token = createSessionToken();
  const maxAge = getSessionMaxAgeSeconds();
  const expiresAt = new Date(Date.now() + maxAge * 1000);
  const larkTokenExpiresAt = getLarkTokenExpiresAt(input.larkExpiresIn);

  const { error } = await db.from("calendar_user_sessions").insert({
    user_id: input.userId,
    token_hash: hashSessionToken(token),
    lark_access_token: input.larkAccessToken,
    lark_refresh_token: input.larkRefreshToken ?? null,
    lark_token_expires_at: larkTokenExpiresAt?.toISOString() ?? null,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    throw new Error("Larkセッションの保存に失敗しました");
  }

  await db
    .from("calendar_user_sessions")
    .delete()
    .eq("user_id", input.userId)
    .lt("expires_at", new Date().toISOString());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = await getSessionCookieValue();
  if (!token) return null;
  if (token === "preview") return previewSession();
  if (isLegacyToken(token)) {
    try {
      return decodeLegacy(token);
    } catch {
      return null;
    }
  }

  const record = await getSessionRecord(token, true);
  return record ? sessionUserFromRecord(record) : null;
}

export async function getSessionLarkUserAccessToken(): Promise<string | null> {
  const token = await getSessionCookieValue();
  if (!token || token === "preview" || isLegacyToken(token)) return null;

  const record = await getSessionRecord(token, true);
  if (!record?.session.lark_access_token) return null;
  if (record.session.lark_token_expires_at) {
    const expiresAt = new Date(record.session.lark_token_expires_at).getTime();
    if (expiresAt <= Date.now() + REFRESH_SKEW_MS) return null;
  }
  return record.session.lark_access_token;
}

export async function clearSession() {
  const token = await getSessionCookieValue();
  if (token && token !== "preview" && !isLegacyToken(token)) {
    const db = getSupabaseAdmin();
    if (db) {
      await db
        .from("calendar_user_sessions")
        .update({
          revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("token_hash", hashSessionToken(token))
        .is("revoked_at", null);
    }
  }
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
    larkUserId: user.user_id ?? null,
    name: user.name,
    email: user.email,
    avatarUrl,
  };
}

export async function resolveAuthenticatedLarkUser(
  userInfo: LarkUserInfo,
): Promise<ResolveLarkUserResult> {
  const db = getSupabaseAdmin();
  if (!db) {
    return { ok: false, error: "Supabaseの管理キーが未設定です" };
  }

  const byProfile = await findActiveUserByProfileOpenId(userInfo.open_id);
  const byUserOpenId = byProfile ?? (await findActiveUserByUsersOpenId(userInfo.open_id));
  const byEmail =
    byUserOpenId ??
    (userInfo.email ? await findActiveUserByEmail(userInfo.email) : null);
  const user = byEmail;
  if (!user) {
    return {
      ok: false,
      error: "登録済みのG-DXユーザーが見つかりませんでした",
    };
  }
  if (!user.is_active) {
    return { ok: false, error: "このユーザーは無効化されています" };
  }

  const avatarUrl = pickAvatar(userInfo);
  const { error } = await db.from("calendar_user_profiles").upsert(
    {
      user_id: user.id,
      lark_open_id: userInfo.open_id,
      lark_union_id: userInfo.union_id,
      lark_user_id: userInfo.user_id ?? null,
      avatar_url: avatarUrl,
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    return { ok: false, error: "Larkユーザープロフィールの保存に失敗しました" };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.full_name || user.email,
      role: user.role,
    },
    avatarUrl,
  };
}

export async function fetchCurrentLarkUserInfo() {
  const accessToken = await getSessionLarkUserAccessToken();
  if (!accessToken) return null;
  const result = await fetchUserInfo(accessToken);
  return result.ok ? result.data : null;
}

async function getSessionCookieValue() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

function isLegacyToken(token: string) {
  return token.includes(".");
}

async function getSessionRecord(
  token: string,
  refreshIfNeeded: boolean,
): Promise<SessionRecord | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data: sessionData, error: sessionError } = await db
    .from("calendar_user_sessions")
    .select(
      "id,user_id,lark_access_token,lark_refresh_token,lark_token_expires_at,expires_at,revoked_at",
    )
    .eq("token_hash", hashSessionToken(token))
    .maybeSingle();

  if (sessionError || !sessionData) return null;
  const session = sessionData as CalendarUserSessionRow;
  if (session.revoked_at || new Date(session.expires_at) <= new Date()) return null;

  const { data: userData, error: userError } = await db
    .from("users")
    .select("id,email,full_name,role,is_active")
    .eq("id", session.user_id)
    .maybeSingle();

  if (userError || !userData) return null;
  const user = userData as DbUserRow;
  if (!user.is_active) return null;

  const { data: profileData } = await db
    .from("calendar_user_profiles")
    .select("user_id,lark_open_id,lark_union_id,lark_user_id,lark_calendar_id,avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = (profileData as CalendarUserProfileRow | null) ?? null;
  const nextSession =
    refreshIfNeeded && shouldRefreshLarkToken(session)
      ? await refreshSessionLarkToken(session)
      : session;

  return { session: nextSession, user, profile };
}

function sessionUserFromRecord(record: SessionRecord): SessionUser {
  return {
    userId: record.user.id,
    larkOpenId: record.profile?.lark_open_id ?? "",
    larkUnionId: record.profile?.lark_union_id ?? "",
    larkUserId: record.profile?.lark_user_id ?? null,
    name: record.user.full_name || record.user.email,
    email: record.user.email,
    avatarUrl: record.profile?.avatar_url ?? null,
    role: record.user.role,
  };
}

async function refreshSessionLarkToken(
  session: CalendarUserSessionRow,
): Promise<CalendarUserSessionRow> {
  if (!session.lark_refresh_token) return session;
  const refreshed = await refreshUserAccessToken(session.lark_refresh_token);
  if (!refreshed.ok) return session;

  const larkTokenExpiresAt = getLarkTokenExpiresAt(refreshed.data.expires_in);
  const patch = {
    lark_access_token: refreshed.data.access_token,
    lark_refresh_token: refreshed.data.refresh_token ?? session.lark_refresh_token,
    lark_token_expires_at: larkTokenExpiresAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  };
  const db = getSupabaseAdmin();
  if (db) {
    await db.from("calendar_user_sessions").update(patch).eq("id", session.id);
  }

  return {
    ...session,
    lark_access_token: patch.lark_access_token,
    lark_refresh_token: patch.lark_refresh_token,
    lark_token_expires_at: patch.lark_token_expires_at,
  };
}

function shouldRefreshLarkToken(session: CalendarUserSessionRow) {
  if (!session.lark_access_token || !session.lark_token_expires_at) return false;
  return new Date(session.lark_token_expires_at).getTime() <= Date.now() + REFRESH_SKEW_MS;
}

function getLarkTokenExpiresAt(expiresIn: number | null | undefined) {
  if (!expiresIn || !Number.isFinite(expiresIn) || expiresIn <= 0) return null;
  return new Date(Date.now() + Math.max(expiresIn - 60, 60) * 1000);
}

async function findActiveUserByProfileOpenId(openId: string) {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data: profile } = await db
    .from("calendar_user_profiles")
    .select("user_id")
    .eq("lark_open_id", openId)
    .maybeSingle();

  const userId = (profile as { user_id?: string } | null)?.user_id;
  return userId ? findActiveUserById(userId) : null;
}

async function findActiveUserByUsersOpenId(openId: string) {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("users")
    .select("id,email,full_name,role,is_active,lark_open_id")
    .eq("lark_open_id", openId)
    .maybeSingle();

  if (error || !data) return null;
  return data as DbUserRow;
}

async function findActiveUserByEmail(email: string) {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("users")
    .select("id,email,full_name,role,is_active")
    .ilike("email", email.trim())
    .maybeSingle();

  if (error || !data) return null;
  return data as DbUserRow;
}

async function findActiveUserById(userId: string) {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("users")
    .select("id,email,full_name,role,is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as DbUserRow;
}

function previewSession(): SessionUser {
  return {
    userId: "u1",
    larkOpenId: "preview",
    larkUnionId: "preview",
    name: "プレビュー",
    avatarUrl: null,
    isPreview: true,
  };
}
