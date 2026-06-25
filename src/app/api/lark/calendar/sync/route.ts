import { NextResponse } from "next/server";
import {
  flushLarkScheduleSync,
  flushPendingLarkScheduleSync,
  pullLarkEventsToSchedules,
} from "@/lib/lark/calendar-sync";
import { larkConfig } from "@/lib/lark/config";

export const dynamic = "force-dynamic";

type SyncRequest = {
  direction?: "push" | "pull" | "both";
  scheduleId?: string;
  startAt?: string;
  endAt?: string;
  limit?: number;
};

function isAuthorized(request: Request) {
  if (!larkConfig.syncSecret) return process.env.NODE_ENV !== "production";
  return request.headers.get("x-lark-sync-secret") === larkConfig.syncSecret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "同期権限がありません" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as SyncRequest;
  const direction = body.direction ?? "push";
  const limit =
    typeof body.limit === "number" && Number.isInteger(body.limit)
      ? Math.min(Math.max(body.limit, 1), 100)
      : 20;

  if (body.scheduleId) {
    const result = await flushLarkScheduleSync(body.scheduleId);
    return NextResponse.json({ ok: result.ok, result });
  }

  if (direction === "pull" || direction === "both") {
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
    const pulled = await pullLarkEventsToSchedules({ startAt, endAt, limit });
    if (!pulled.ok) {
      return NextResponse.json({ ok: false, error: pulled.error }, { status: 400 });
    }
    if (direction === "pull") {
      return NextResponse.json({ ok: true, direction, pull: pulled });
    }

    const pushed = await flushPendingLarkScheduleSync(limit);
    return NextResponse.json({ ok: true, direction, pull: pulled, push: pushed });
  }

  const pushed = await flushPendingLarkScheduleSync(limit);
  return NextResponse.json({ ok: true, direction, push: pushed });
}
