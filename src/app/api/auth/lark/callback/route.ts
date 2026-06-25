import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, fetchUserInfo } from "@/lib/lark/client";
import {
  LARK_OAUTH_NEXT_COOKIE,
  LARK_OAUTH_STATE_COOKIE,
} from "@/lib/lark/config";
import {
  createDatabaseSession,
  resolveAuthenticatedLarkUser,
} from "@/lib/session";
import { setCurrentUserId } from "@/lib/self";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(LARK_OAUTH_STATE_COOKIE)?.value;
  const nextPath = sanitizeNextPath(
    cookieStore.get(LARK_OAUTH_NEXT_COOKIE)?.value ?? null,
  );
  cookieStore.delete(LARK_OAUTH_STATE_COOKIE);
  cookieStore.delete(LARK_OAUTH_NEXT_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithError(url.origin, "invalid_state");
  }

  const tokenResult = await exchangeCode(code);
  if (!tokenResult.ok) return redirectWithError(url.origin, "lark_token_failed");

  const userResult = await fetchUserInfo(tokenResult.data.access_token);
  if (!userResult.ok) return redirectWithError(url.origin, "lark_user_failed");

  const resolved = await resolveAuthenticatedLarkUser(userResult.data);
  if (!resolved.ok) return redirectWithError(url.origin, "user_not_allowed");

  try {
    await createDatabaseSession({
      userId: resolved.user.id,
      userInfo: userResult.data,
      larkAccessToken: tokenResult.data.access_token,
      larkRefreshToken: tokenResult.data.refresh_token,
      larkExpiresIn: tokenResult.data.expires_in,
    });
    await setCurrentUserId(resolved.user.id);
  } catch {
    return redirectWithError(url.origin, "session_failed");
  }

  return NextResponse.redirect(new URL(nextPath, url.origin));
}

function redirectWithError(origin: string, message: string) {
  const target = new URL("/login", origin);
  target.searchParams.set("error", message);
  return NextResponse.redirect(target);
}

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/calendar";
  if (value.startsWith("/api/auth/")) return "/calendar";
  return value;
}
