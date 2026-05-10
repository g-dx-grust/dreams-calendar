"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createUser, deleteUser, updateUser } from "@/lib/user-store";

type ActionResult = { ok: true } | { ok: false; error: string };

const userSchema = z.object({
  name: z
    .string()
    .min(1, "名前を入力してください")
    .max(60, "名前は60文字以内で入力してください"),
  avatarUrl: z
    .string()
    .url("URL の形式で入力してください")
    .max(500)
    .optional()
    .or(z.literal("")),
  larkOpenId: z.string().max(120).optional().or(z.literal("")),
});

function parseForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    avatarUrl: String(formData.get("avatarUrl") ?? ""),
    larkOpenId: String(formData.get("larkOpenId") ?? ""),
  };
}

export async function createUserAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = userSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }
  createUser({
    name: parsed.data.name,
    avatarUrl: parsed.data.avatarUrl || null,
    larkOpenId: parsed.data.larkOpenId || null,
  });
  revalidatePath("/admin/users");
  revalidatePath("/calendar");
  redirect("/admin/users");
}

export async function updateUserAction(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = userSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }
  const updated = updateUser(id, {
    name: parsed.data.name,
    avatarUrl: parsed.data.avatarUrl || null,
    larkOpenId: parsed.data.larkOpenId || null,
  });
  if (!updated) return { ok: false, error: "社員が見つかりませんでした" };
  revalidatePath("/admin/users");
  revalidatePath("/calendar");
  redirect("/admin/users");
}

export async function deleteUserAction(id: string): Promise<void> {
  deleteUser(id);
  revalidatePath("/admin/users");
  revalidatePath("/calendar");
  redirect("/admin/users");
}
