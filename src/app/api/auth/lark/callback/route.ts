import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, fetchUserInfo, pickAvatar } from "@/lib/lark/client";
import { setSession, userInfoToSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("lark_oauth_state")?.value;
  cookieStore.delete("lark_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithError(url.origin, "invalid_state");
  }

  const tokenResult = await exchangeCode(code);
  if (!tokenResult.ok) return redirectWithError(url.origin, tokenResult.error);

  const userResult = await fetchUserInfo(tokenResult.data.access_token);
  if (!userResult.ok) return redirectWithError(url.origin, userResult.error);

  const avatar = pickAvatar(userResult.data);
  await setSession(userInfoToSession(userResult.data, avatar));

  // TODO(DB確定後): users テーブルに upsert（avatar_url・display_name をキャッシュ）
  return NextResponse.redirect(`${url.origin}/calendar`);
}

function redirectWithError(origin: string, message: string) {
  const target = new URL("/login", origin);
  target.searchParams.set("error", message);
  return NextResponse.redirect(target);
}
