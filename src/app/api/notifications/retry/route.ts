/*
 * 失敗したLark通知の再送エンドポイント
 * see: ../../../../../G-DX_Lark_Integration_Rules.md §4.2（リトライ機構）
 *
 * - Vercel Cron 等から NOTIFICATION_CRON_SECRET 付きで定期実行する想定
 * - 管理者セッションでも実行可能（管理画面の再送ボタンはServer Action経由）
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { retryDueNotificationsAsync } from "@/lib/notification-log-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function secureEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function hasValidCronSecret(request: Request): boolean {
  const configured = process.env.NOTIFICATION_CRON_SECRET?.trim();
  if (!configured || configured.length < 16) return false;

  const headerSecret = request.headers.get("x-cron-secret");
  const bearerSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return [headerSecret, bearerSecret].some(
    (candidate) => candidate != null && secureEquals(candidate, configured),
  );
}

export async function POST(request: Request) {
  if (!hasValidCronSecret(request)) {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "認証が必要です。" },
        { status: 401 },
      );
    }
  }

  const result = await retryDueNotificationsAsync();
  return NextResponse.json(result);
}
