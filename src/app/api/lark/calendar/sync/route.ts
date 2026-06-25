import { NextResponse } from "next/server";
import {
  flushLarkScheduleSync,
  flushPendingLarkScheduleSync,
  pullLarkEventsToSchedules,
} from "@/lib/lark/calendar-sync";
import { larkConfig } from "@/lib/lark/config";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type SyncRequest = {
  direction?: "push" | "pull" | "both";
  scheduleId?: string;
  userId?: string;
  startAt?: string;
  endAt?: string;
  limit?: number;
};

type AuthContext =
  | { ok: true; isSecret: boolean; userId: string | null }
  | { ok: false };

async function authorize(
  request: Request,
  requestedUserId: string | undefined,
): Promise<AuthContext> {
  const secretMatches = Boolean(
    larkConfig.syncSecret &&
      request.headers.get("x-lark-sync-secret") === larkConfig.syncSecret,
  );
  if (secretMatches || (!larkConfig.syncSecret && process.env.NODE_ENV !== "production")) {
    return { ok: true, isSecret: true, userId: requestedUserId ?? null };
  }

  const session = await getSession();
  if (!session?.userId) return { ok: false };
  if (requestedUserId && requestedUserId !== session.userId && session.role !== "admin") {
    return { ok: false };
  }
  return {
    ok: true,
    isSecret: false,
    userId: requestedUserId ?? session.userId,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SyncRequest;
  const auth = await authorize(request, body.userId);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: "同期権限がありません" },
      { status: 403 },
    );
  }

  const direction = body.direction ?? "push";
  const limit =
    typeof body.limit === "number" && Number.isInteger(body.limit)
      ? Math.min(Math.max(body.limit, 1), 100)
      : 20;

  if (body.scheduleId) {
    if (!auth.isSecret) {
      return NextResponse.json(
        { ok: false, error: "予定のpush同期には同期キーが必要です" },
        { status: 403 },
      );
    }
    const result = await flushLarkScheduleSync(body.scheduleId);
    return NextResponse.json({ ok: result.ok, result });
  }

  if (direction === "pull" || direction === "both") {
    if (direction === "both" && !auth.isSecret) {
      return NextResponse.json(
        { ok: false, error: "pushを含む同期には同期キーが必要です" },
        { status: 403 },
      );
    }
    const userId = body.userId ?? auth.userId;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "同期対象ユーザーを指定してください" },
        { status: 400 },
      );
    }
    const startAt = body.startAt ? new Date(body.startAt) : undefined;
    const endAt = body.endAt ? new Date(body.endAt) : undefined;
    if (
      (startAt && Number.isNaN(startAt.getTime())) ||
      (endAt && Number.isNaN(endAt.getTime()))
    ) {
      return NextResponse.json(
        { ok: false, error: "同期期間が不正です" },
        { status: 400 },
      );
    }
    const pulled = await pullLarkEventsToSchedules({
      userId,
      startAt,
      endAt,
      limit,
    });
    if (!pulled.ok) {
      return NextResponse.json({ ok: false, error: pulled.error }, { status: 400 });
    }
    if (direction === "pull") {
      return NextResponse.json({ ok: true, direction, pull: pulled });
    }

    const pushed = await flushPendingLarkScheduleSync(limit);
    return NextResponse.json({ ok: true, direction, pull: pulled, push: pushed });
  }

  if (!auth.isSecret) {
    return NextResponse.json(
      { ok: false, error: "push同期には同期キーが必要です" },
      { status: 403 },
    );
  }
  const pushed = await flushPendingLarkScheduleSync(limit);
  return NextResponse.json({ ok: true, direction, push: pushed });
}
