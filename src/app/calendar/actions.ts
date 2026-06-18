"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createScheduleAsync,
  deleteScheduleAsync,
  getScheduleAsync,
  listUsersAsync,
  moveScheduleRowAsync,
  updateScheduleAsync,
} from "@/lib/schedule-store";
import {
  deleteProjectScheduleLogsAsync,
  syncProjectScheduleLogsAsync,
} from "@/lib/project-schedule-log-store";
import { sendInvitation } from "@/lib/lark/notify";
import { deleteScheduleFromLark } from "@/lib/lark/calendar-sync";
import { getCurrentUserId } from "@/lib/self";

type ActionResult = { ok: true } | { ok: false; error: string };

const scheduleSchema = z
  .object({
    title: z
      .string()
      .min(1, "タイトルを入力してください")
      .max(200, "タイトルは200文字以内で入力してください"),
    userIds: z
      .array(z.string().min(1))
      .min(1, "担当者を1人以上選択してください"),
    typeId: z.string().min(1, "予定種別を選択してください"),
    caseId: z.preprocess((value) => {
      if (typeof value !== "string" || value.trim() === "") return undefined;
      const parsed = Number(value);
      return Number.isInteger(parsed) ? parsed : value;
    }, z.number().int().positive().optional()),
    caseNumber: z.string().max(50).optional(),
    caseName: z.string().max(200).optional(),
    location: z.string().max(200).optional(),
    memo: z.string().max(2000).optional(),
    status: z
      .enum(["planned", "in_progress", "done", "carried_over", "cancelled"])
      .optional(),
    actualStartAt: z.string().optional(),
    actualEndAt: z.string().optional(),
    actualMinutes: z.preprocess((value) => {
      if (typeof value !== "string" || value.trim() === "") return undefined;
      const parsed = Number(value);
      return Number.isInteger(parsed) ? parsed : value;
    }, z.number().int().positive().max(1440).optional()),
    isAllDay: z.boolean().optional(),
    startAt: z.string().min(1, "開始日時を入力してください"),
    endAt: z.string().min(1, "終了日時を入力してください"),
  })
  .superRefine((v, ctx) => {
    if (new Date(v.startAt) >= new Date(v.endAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "終了日時は開始日時より後に設定してください",
        path: ["endAt"],
      });
    }

    const hasActualStart = Boolean(v.actualStartAt);
    const hasActualEnd = Boolean(v.actualEndAt);
    if (hasActualStart !== hasActualEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "実績開始と実績終了はセットで入力してください",
        path: ["actualEndAt"],
      });
    }
    if (
      v.actualStartAt &&
      v.actualEndAt &&
      new Date(v.actualStartAt) >= new Date(v.actualEndAt)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "実績終了は実績開始より後に設定してください",
        path: ["actualEndAt"],
      });
    }
    if (v.status === "done" && !v.actualMinutes && !hasActualStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "完了にする場合は実績時間を入力してください",
        path: ["actualMinutes"],
      });
    }
  });

function parseForm(formData: FormData) {
  // userIds は複数値で送られる（getAll）
  const userIds = formData.getAll("userIds").map(String).filter(Boolean);
  return {
    title: formData.get("title"),
    userIds,
    typeId: formData.get("typeId"),
    caseId: formData.get("caseId") ?? undefined,
    caseNumber: formData.get("caseNumber") ?? undefined,
    caseName: formData.get("caseName") ?? undefined,
    location: formData.get("location") ?? undefined,
    memo: formData.get("memo") ?? undefined,
    status: formData.get("status") ?? undefined,
    actualStartAt: formData.get("actualStartAt") ?? undefined,
    actualEndAt: formData.get("actualEndAt") ?? undefined,
    actualMinutes: formData.get("actualMinutes") ?? undefined,
    isAllDay: formData.get("isAllDay") === "true",
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
  };
}

async function notifyInvitees(
  newlyAddedIds: string[],
  scheduleId: string,
  fromUserId: string | null,
) {
  if (newlyAddedIds.length === 0) return;
  const users = await listUsersAsync();
  const fromUser = fromUserId
    ? users.find((u) => u.id === fromUserId) ?? null
    : null;
  const schedule = await getScheduleAsync(scheduleId);
  if (!schedule) return;
  const fromName = fromUser?.name;

  await Promise.all(
    newlyAddedIds.map(async (id) => {
      // 自分自身は通知しない
      if (id === fromUserId) return;
      const target = users.find((u) => u.id === id);
      if (!target) return;
      await sendInvitation(target, schedule, fromName);
    }),
  );
}

export async function createScheduleAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }
  const created = await createScheduleAsync({
    title: parsed.data.title,
    userIds: parsed.data.userIds,
    typeId: parsed.data.typeId,
    caseId: parsed.data.caseId,
    caseNumber: parsed.data.caseNumber || undefined,
    caseName: parsed.data.caseName || undefined,
    location: parsed.data.location || undefined,
    memo: parsed.data.memo || undefined,
    status: parsed.data.status ?? "planned",
    actualStartAt: parsed.data.actualStartAt
      ? new Date(parsed.data.actualStartAt)
      : null,
    actualEndAt: parsed.data.actualEndAt
      ? new Date(parsed.data.actualEndAt)
      : null,
    actualMinutes: parsed.data.actualMinutes ?? null,
    syncSource: "app",
    syncStatus: "pending",
    lastSyncedAt: null,
    syncError: null,
    isAllDay: parsed.data.isAllDay ?? false,
    startAt: new Date(parsed.data.startAt),
    endAt: new Date(parsed.data.endAt),
  });
  await syncProjectScheduleLogsAsync(created);
  const selfId = await getCurrentUserId();
  await notifyInvitees(created.userIds, created.id, selfId);
  revalidatePath("/calendar");
  if (created.caseId) revalidatePath(`/calendar/cases/${created.caseId}`);
  redirect("/calendar");
}

export async function updateScheduleAction(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }
  const before = await getScheduleAsync(id);
  const updated = await updateScheduleAsync(id, {
    title: parsed.data.title,
    userIds: parsed.data.userIds,
    typeId: parsed.data.typeId,
    caseId: parsed.data.caseId,
    caseNumber: parsed.data.caseNumber || undefined,
    caseName: parsed.data.caseName || undefined,
    location: parsed.data.location || undefined,
    memo: parsed.data.memo || undefined,
    status: parsed.data.status ?? "planned",
    actualStartAt: parsed.data.actualStartAt
      ? new Date(parsed.data.actualStartAt)
      : null,
    actualEndAt: parsed.data.actualEndAt
      ? new Date(parsed.data.actualEndAt)
      : null,
    actualMinutes: parsed.data.actualMinutes ?? null,
    syncSource: "app",
    syncStatus: "pending",
    lastSyncedAt: null,
    syncError: null,
    isAllDay: parsed.data.isAllDay ?? false,
    startAt: new Date(parsed.data.startAt),
    endAt: new Date(parsed.data.endAt),
  });
  if (!updated) return { ok: false, error: "予定が見つかりませんでした" };
  await syncProjectScheduleLogsAsync(updated);

  const beforeIds = new Set(before?.userIds ?? []);
  const newlyAdded = updated.userIds.filter((u) => !beforeIds.has(u));
  const selfId = await getCurrentUserId();
  await notifyInvitees(newlyAdded, updated.id, selfId);

  revalidatePath("/calendar");
  revalidatePath(`/calendar/${id}`);
  if (before?.caseId) revalidatePath(`/calendar/cases/${before.caseId}`);
  if (updated.caseId) revalidatePath(`/calendar/cases/${updated.caseId}`);
  redirect(`/calendar/${id}`);
}

export async function deleteScheduleAction(id: string): Promise<void> {
  const before = await getScheduleAsync(id);
  if (before?.larkEventId) {
    await deleteScheduleFromLark(before);
  }
  await deleteScheduleAsync(id);
  await deleteProjectScheduleLogsAsync(id);
  revalidatePath("/calendar");
  if (before?.caseId) revalidatePath(`/calendar/cases/${before.caseId}`);
  redirect("/calendar");
}

const moveSchema = z.object({
  id: z.string().min(1),
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
});

export async function moveScheduleAction(input: {
  id: string;
  fromUserId: string;
  toUserId: string;
  startAt: string;
  endAt: string;
}): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "入力エラー" };

  const before = await getScheduleAsync(parsed.data.id);
  const beforeIds = new Set(before?.userIds ?? []);

  // 行を変える場合は userIds を置換
  let updated = before;
  if (parsed.data.fromUserId !== parsed.data.toUserId) {
    updated = await moveScheduleRowAsync(
      parsed.data.id,
      parsed.data.fromUserId,
      parsed.data.toUserId,
    );
  }
  // 時刻のみ更新（または行更新後にさらに時刻を反映）
  updated = await updateScheduleAsync(parsed.data.id, {
    startAt: new Date(parsed.data.startAt),
    endAt: new Date(parsed.data.endAt),
    syncSource: "app",
    syncStatus: "pending",
    lastSyncedAt: null,
    syncError: null,
  });
  if (!updated) return { ok: false, error: "予定が見つかりませんでした" };
  await syncProjectScheduleLogsAsync(updated);

  // 行変更で新規担当になったユーザーがいれば通知
  const newlyAdded = updated.userIds.filter((u) => !beforeIds.has(u));
  const selfId = await getCurrentUserId();
  await notifyInvitees(newlyAdded, updated.id, selfId);

  revalidatePath("/calendar");
  if (updated.caseId) revalidatePath(`/calendar/cases/${updated.caseId}`);
  return { ok: true };
}
