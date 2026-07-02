"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { retryDueNotificationsAsync } from "@/lib/notification-log-store";

type RetryActionResult =
  | { ok: true; targeted: number; delivered: number }
  | { ok: false; error: string };

export async function retryFailedNotificationsAction(): Promise<RetryActionResult> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return {
      ok: false,
      error: "この操作には管理者権限が必要です。管理者アカウントでログインし直してください。",
    };
  }

  const result = await retryDueNotificationsAsync();
  revalidatePath("/admin/notifications");
  return { ok: true, ...result };
}
