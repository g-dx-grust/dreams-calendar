"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createScheduleType,
  deleteScheduleType,
  updateScheduleType,
} from "@/lib/schedule-type-store";

type ActionResult = { ok: true } | { ok: false; error: string };

const typeSchema = z.object({
  name: z
    .string()
    .min(1, "種別名を入力してください")
    .max(50, "種別名は50文字以内で入力してください"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "色は #RRGGBB 形式で指定してください"),
});

function parseForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    color: String(formData.get("color") ?? ""),
  };
}

export async function createScheduleTypeAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = typeSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }
  createScheduleType(parsed.data);
  revalidatePath("/admin/schedule-types");
  revalidatePath("/calendar");
  redirect("/admin/schedule-types");
}

export async function updateScheduleTypeAction(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = typeSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }
  const updated = updateScheduleType(id, parsed.data);
  if (!updated) return { ok: false, error: "予定種別が見つかりませんでした" };
  revalidatePath("/admin/schedule-types");
  revalidatePath("/calendar");
  redirect("/admin/schedule-types");
}

export async function deleteScheduleTypeAction(id: string): Promise<void> {
  deleteScheduleType(id);
  revalidatePath("/admin/schedule-types");
  revalidatePath("/calendar");
  redirect("/admin/schedule-types");
}
