import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth-constants";
import { setCurrentUserId } from "@/lib/self";
import { setSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await setSession({
      larkOpenId: "preview",
      larkUnionId: "preview",
      name: "プレビュー",
      avatarUrl: null,
    });
  } catch {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, "preview", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    });
  }
  await setCurrentUserId("u1");

  return NextResponse.redirect(new URL("/calendar", request.url));
}
