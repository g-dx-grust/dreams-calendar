import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildAuthorizeUrl,
  LARK_OAUTH_NEXT_COOKIE,
  LARK_OAUTH_STATE_COOKIE,
  LARK_OAUTH_STATE_MAX_AGE,
  larkConfig,
} from "@/lib/lark/config";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;

  if (!larkConfig.appId || !larkConfig.appSecret) {
    const target = new URL("/login", origin);
    target.searchParams.set("error", "missing_lark_config");
    return NextResponse.redirect(target);
  }

  const state = randomBytes(16).toString("hex");
  const nextPath = sanitizeNextPath(new URL(request.url).searchParams.get("next"));
  const response = NextResponse.redirect(buildAuthorizeUrl(state, origin));
  response.cookies.set(LARK_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: LARK_OAUTH_STATE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set(LARK_OAUTH_NEXT_COOKIE, nextPath, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: LARK_OAUTH_STATE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/calendar";
  if (value.startsWith("/api/auth/")) return "/calendar";
  return value;
}
