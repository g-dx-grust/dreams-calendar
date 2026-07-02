"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { updateNotificationSettingsAsync } from "@/lib/calendar-settings-store";

type ActionResult = { ok: true } | { ok: false; error: string };

const settingsSchema = z.object({
  dailyReportChatId: z
    .string()
    .max(200, "チャットIDが長すぎます")
    .transform((v) => v.trim()),
  dailyReportChatName: z
    .string()
    .max(200, "チャット名が長すぎます")
    .transform((v) => v.trim()),
  dailyReportDmAdmins: z.enum(["true", "false"]),
});

export async function updateNotificationSettingsAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "この操作には管理者権限が必要です。管理者アカウントでログインし直してください。" };
  }

  const parsed = settingsSchema.safeParse({
    dailyReportChatId: formData.get("dailyReportChatId") ?? "",
    dailyReportChatName: formData.get("dailyReportChatName") ?? "",
    dailyReportDmAdmins: formData.get("dailyReportDmAdmins") ?? "true",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const chatId = parsed.data.dailyReportChatId || null;
  if (chatId && !/^oc_[0-9a-f]+$/i.test(chatId)) {
    return {
      ok: false,
      error:
        "チャットIDの形式が正しくありません。oc_ から始まるIDを入力してください。",
    };
  }

  await updateNotificationSettingsAsync(
    {
      dailyReportChatId: chatId,
      dailyReportChatName: chatId ? parsed.data.dailyReportChatName || null : null,
      dailyReportDmAdmins: parsed.data.dailyReportDmAdmins === "true",
    },
    session.userId ?? null,
  );

  revalidatePath("/admin/notification-settings");
  redirect("/admin/notification-settings?saved=1");
}
