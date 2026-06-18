import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildAuthorizeUrl,
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
  const response = NextResponse.redirect(buildAuthorizeUrl(state));
  response.cookies.set(LARK_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: LARK_OAUTH_STATE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
