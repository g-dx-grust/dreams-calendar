import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { buildAuthorizeUrl, larkConfig } from "@/lib/lark/config";

export const dynamic = "force-dynamic";

// state Cookie の発行は Route Handler で行う（Server Component の描画中は
// Cookie を変更できないため）。state を発行して Lark の認可画面へリダイレクトする。
export async function GET(request: Request) {
  if (!larkConfig.appId || !larkConfig.appSecret) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("lark_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.redirect(buildAuthorizeUrl(state));
}
