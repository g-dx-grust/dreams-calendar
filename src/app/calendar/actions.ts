"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  moveScheduleRow,
  updateSchedule,
} from "@/lib/schedule-store";
import { listUsers } from "@/lib/user-store";
import { sendInvitation } from "@/lib/lark/notify";
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
    caseNumber: z.string().max(50).optional(),
    location: z.string().max(200).optional(),
    memo: z.string().max(2000).optional(),
    isAllDay: z.boolean().optional(),
    startAt: z.string().min(1, "開始日時を入力してください"),
    endAt: z.string().min(1, "終了日時を入力してください"),
  })
  .refine((v) => new Date(v.startAt) < new Date(v.endAt), {
    message: "終了日時は開始日時より後に設定してください",
    path: ["endAt"],
  });

function parseForm(formData: FormData) {
  // userIds は複数値で送られる（getAll）
  const userIds = formData.getAll("userIds").map(String).filter(Boolean);
  return {
    title: formData.get("title"),
    userIds,
    typeId: formData.get("typeId"),
    caseNumber: formData.get("caseNumber") ?? undefined,
    location: formData.get("location") ?? undefined,
    memo: formData.get("memo") ?? undefined,
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
  const users = listUsers();
  const fromUser = fromUserId
    ? users.find((u) => u.id === fromUserId) ?? null
    : null;
  const schedule = getSchedule(scheduleId);
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
  const created = createSchedule({
    title: parsed.data.title,
    userIds: parsed.data.userIds,
    typeId: parsed.data.typeId,
    caseNumber: parsed.data.caseNumber || undefined,
    location: parsed.data.location || undefined,
    memo: parsed.data.memo || undefined,
    isAllDay: parsed.data.isAllDay ?? false,
    startAt: new Date(parsed.data.startAt),
    endAt: new Date(parsed.data.endAt),
  });
  const selfId = await getCurrentUserId();
  await notifyInvitees(created.userIds, created.id, selfId);
  revalidatePath("/calendar");
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
  const before = getSchedule(id);
  const updated = updateSchedule(id, {
    title: parsed.data.title,
    userIds: parsed.data.userIds,
    typeId: parsed.data.typeId,
    caseNumber: parsed.data.caseNumber || undefined,
    location: parsed.data.location || undefined,
    memo: parsed.data.memo || undefined,
    isAllDay: parsed.data.isAllDay ?? false,
    startAt: new Date(parsed.data.startAt),
    endAt: new Date(parsed.data.endAt),
  });
  if (!updated) return { ok: false, error: "予定が見つかりませんでした" };

  const beforeIds = new Set(before?.userIds ?? []);
  const newlyAdded = updated.userIds.filter((u) => !beforeIds.has(u));
  const selfId = await getCurrentUserId();
  await notifyInvitees(newlyAdded, updated.id, selfId);

  revalidatePath("/calendar");
  revalidatePath(`/calendar/${id}`);
  redirect(`/calendar/${id}`);
}

export async function deleteScheduleAction(id: string): Promise<void> {
  deleteSchedule(id);
  revalidatePath("/calendar");
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

  const before = getSchedule(parsed.data.id);
  const beforeIds = new Set(before?.userIds ?? []);

  // 行を変える場合は userIds を置換
  let updated = before;
  if (parsed.data.fromUserId !== parsed.data.toUserId) {
    updated = moveScheduleRow(
      parsed.data.id,
      parsed.data.fromUserId,
      parsed.data.toUserId,
    );
  }
  // 時刻のみ更新（または行更新後にさらに時刻を反映）
  updated = updateSchedule(parsed.data.id, {
    startAt: new Date(parsed.data.startAt),
    endAt: new Date(parsed.data.endAt),
  });
  if (!updated) return { ok: false, error: "予定が見つかりませんでした" };

  // 行変更で新規担当になったユーザーがいれば通知
  const newlyAdded = updated.userIds.filter((u) => !beforeIds.has(u));
  const selfId = await getCurrentUserId();
  await notifyInvitees(newlyAdded, updated.id, selfId);

  revalidatePath("/calendar");
  return { ok: true };
}

