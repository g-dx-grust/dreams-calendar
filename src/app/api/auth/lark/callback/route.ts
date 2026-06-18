import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, fetchUserInfo, pickAvatar } from "@/lib/lark/client";
import { LARK_OAUTH_STATE_COOKIE } from "@/lib/lark/config";
import { setSession, userInfoToSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(LARK_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(LARK_OAUTH_STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithError(url.origin, "invalid_state");
  }

  const tokenResult = await exchangeCode(code);
  if (!tokenResult.ok) return redirectWithError(url.origin, tokenResult.error);

  const userResult = await fetchUserInfo(tokenResult.data.access_token);
  if (!userResult.ok) return redirectWithError(url.origin, userResult.error);

  const avatar = pickAvatar(userResult.data);
  await setSession(userInfoToSession(userResult.data, avatar));

  // B-2/③ で対応：Lark email を kanri の users と突合し「自分」を確定。
  // avatar_url・larkOpenId は共有 users ではなく本システム固有テーブル
  // （user_profiles 想定）にキャッシュする（CLAUDE.md §D：共有 users は参照のみ）。
  return NextResponse.redirect(`${url.origin}/calendar`);
}

function redirectWithError(origin: string, message: string) {
  const target = new URL("/login", origin);
  target.searchParams.set("error", message);
  return NextResponse.redirect(target);
}
