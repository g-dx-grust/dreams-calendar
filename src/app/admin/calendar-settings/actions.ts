"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { updateCalendarSettingsAsync } from "@/lib/calendar-settings-store";

type ActionResult = { ok: true } | { ok: false; error: string };

const settingsSchema = z
  .object({
    startHour: z.coerce
      .number()
      .int()
      .min(0, "開始時刻は 0 以上で指定してください")
      .max(23, "開始時刻は 23 以下で指定してください"),
    endHour: z.coerce
      .number()
      .int()
      .min(1, "終了時刻は 1 以上で指定してください")
      .max(24, "終了時刻は 24 以下で指定してください"),
  })
  .refine((v) => v.endHour > v.startHour, {
    message: "終了時刻は開始時刻より後に指定してください",
    path: ["endHour"],
  });

export async function updateCalendarSettingsAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return {
      ok: false,
      error: "この操作には管理者権限が必要です。管理者アカウントでログインし直してください。",
    };
  }

  const parsed = settingsSchema.safeParse({
    startHour: formData.get("startHour"),
    endHour: formData.get("endHour"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }
  await updateCalendarSettingsAsync(parsed.data, session.userId ?? null);
  revalidatePath("/calendar");
  revalidatePath("/admin/calendar-settings");
  redirect("/admin/calendar-settings?saved=1");
}
