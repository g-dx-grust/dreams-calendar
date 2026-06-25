import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, getSessionLarkUserAccessToken } from "@/lib/session";
import { getUserAsync } from "@/lib/user-store";
import { createLarkMeetingUrlForCurrentUser } from "@/lib/lark/calendar-meeting";
import { LarkApiError, toLarkApiError } from "@/lib/lark/provider-client";

export const dynamic = "force-dynamic";

const createMeetingUrlSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    mainAssigneeId: z.string().min(1),
  })
  .superRefine((input, ctx) => {
    if (new Date(input.startAt) >= new Date(input.endAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "終了日時は開始日時より後に設定してください",
      });
    }
  });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return jsonError(
      401,
      "unauthorized",
      "Lark会議URLを発行するには、Larkでログインしてください",
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createMeetingUrlSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      "validation_error",
      parsed.error.issues[0]?.message ?? "入力内容が不正です",
    );
  }

  const assignee = await getUserAsync(parsed.data.mainAssigneeId);
  if (!assignee) {
    return jsonError(400, "invalid_assignee", "担当者が見つかりません");
  }
  if (parsed.data.mainAssigneeId !== session.userId) {
    return jsonError(
      403,
      "assignee_user_token_required",
      "担当者本人としてLarkでログインしてから会議URLを発行してください",
    );
  }

  const userAccessToken = await getSessionLarkUserAccessToken();
  if (!userAccessToken) {
    return jsonError(
      401,
      "lark_relogin_required",
      "Lark会議URLを発行するには、Larkで再ログインしてください",
    );
  }

  try {
    const data = await createLarkMeetingUrlForCurrentUser({
      title: parsed.data.title,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
      userId: session.userId,
      userAccessToken,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const larkError =
      error instanceof LarkApiError
        ? error
        : toLarkApiError(error, "Lark会議URLの発行に失敗しました");
    return jsonError(larkError.status, larkError.code, larkError.message);
  }
}

function jsonError(status: number, code: string, error: string) {
  return NextResponse.json({ code, error }, { status });
}
