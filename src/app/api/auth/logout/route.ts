import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await clearSession();
  // 303 で GET にしてログインへ戻す
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
