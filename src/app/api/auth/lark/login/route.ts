import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const source = new URL(request.url);
  const target = new URL("/api/auth/lark/start", source.origin);
  const next = source.searchParams.get("next");
  if (next) target.searchParams.set("next", next);
  return NextResponse.redirect(target);
}
