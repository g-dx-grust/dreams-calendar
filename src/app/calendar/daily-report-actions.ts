"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { submitReport, getReport } from "@/lib/daily-report-store";
import {
  addReply,
  deleteReply,
  getReply,
  updateReply,
} from "@/lib/daily-report-reply-store";
import { getUser, listUsers } from "@/lib/user-store";
import {
  sendDailyReportReply,
  sendDailyReportSubmitted,
} from "@/lib/lark/notify";

type ActionResult = { ok: true } | { ok: false; error: string };

const submitSchema = z.object({
  userId: z.string().min(1, "社員 ID が不正です"),
  reportDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "対象日が不正です"),
  body: z
    .string()
    .min(1, "日報の本文を入力してください")
    .max(4000, "日報は 4000 文字以内で入力してください"),
});

export async function submitDailyReportAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = submitSchema.safeParse({
    userId: formData.get("userId"),
    reportDate: formData.get("reportDate"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const report = submitReport(
    parsed.data.userId,
    parsed.data.reportDate,
    parsed.data.body,
  );

  const user = listUsers().find((u) => u.id === parsed.data.userId);
  if (user) {
    await sendDailyReportSubmitted(user, report);
  }

  revalidatePath("/calendar");
  return { ok: true };
}

const replyBodySchema = z
  .string()
  .min(1, "返信を入力してください")
  .max(2000, "返信は 2000 文字以内で入力してください");

const postReplySchema = z.object({
  reportId: z.string().min(1, "対象の日報が不正です"),
  reportUserId: z.string().min(1, "日報の提出者が不正です"),
  reportDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "対象日が不正です"),
  authorUserId: z.string().min(1, "投稿者が不正です"),
  body: replyBodySchema,
});

export async function postDailyReportReplyAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = postReplySchema.safeParse({
    reportId: formData.get("reportId"),
    reportUserId: formData.get("reportUserId"),
    reportDate: formData.get("reportDate"),
    authorUserId: formData.get("authorUserId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const report = getReport(parsed.data.reportUserId, parsed.data.reportDate);
  if (!report || report.id !== parsed.data.reportId) {
    return { ok: false, error: "対象の日報が見つかりませんでした" };
  }

  const reply = addReply(
    parsed.data.reportId,
    parsed.data.authorUserId,
    parsed.data.body,
  );

  const reportAuthor = getUser(parsed.data.reportUserId);
  const replyAuthor = getUser(parsed.data.authorUserId);
  if (reportAuthor && replyAuthor) {
    await sendDailyReportReply(reportAuthor, report, reply, replyAuthor.name);
  }

  revalidatePath("/calendar");
  return { ok: true };
}

const updateReplySchema = z.object({
  replyId: z.string().min(1, "返信が不正です"),
  authorUserId: z.string().min(1, "投稿者が不正です"),
  body: replyBodySchema,
});

export async function updateDailyReportReplyAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateReplySchema.safeParse({
    replyId: formData.get("replyId"),
    authorUserId: formData.get("authorUserId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const existing = getReply(parsed.data.replyId);
  if (!existing) return { ok: false, error: "返信が見つかりませんでした" };
  if (existing.userId !== parsed.data.authorUserId) {
    return { ok: false, error: "本人のみ編集できます" };
  }

  const updated = updateReply(
    parsed.data.replyId,
    parsed.data.authorUserId,
    parsed.data.body,
  );
  if (!updated) return { ok: false, error: "更新できませんでした" };

  revalidatePath("/calendar");
  return { ok: true };
}

const deleteReplySchema = z.object({
  replyId: z.string().min(1, "返信が不正です"),
  authorUserId: z.string().min(1, "投稿者が不正です"),
});

export async function deleteDailyReportReplyAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = deleteReplySchema.safeParse({
    replyId: formData.get("replyId"),
    authorUserId: formData.get("authorUserId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const existing = getReply(parsed.data.replyId);
  if (!existing) return { ok: false, error: "返信が見つかりませんでした" };
  if (existing.userId !== parsed.data.authorUserId) {
    return { ok: false, error: "本人のみ削除できます" };
  }

  const ok = deleteReply(parsed.data.replyId, parsed.data.authorUserId);
  if (!ok) return { ok: false, error: "削除できませんでした" };

  revalidatePath("/calendar");
  return { ok: true };
}
