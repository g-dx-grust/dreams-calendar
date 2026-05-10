import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { setCurrentUserId } from "@/lib/self";
import { listUsers } from "@/lib/user-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const userId = String(form.get("userId") ?? "");
  const back = String(form.get("back") ?? "/calendar");
  const users = listUsers();
  if (!users.some((u) => u.id === userId)) {
    return NextResponse.json({ error: "invalid user" }, { status: 400 });
  }
  await setCurrentUserId(userId);
  revalidatePath("/calendar");
  revalidatePath("/today");
  revalidatePath("/admin");
  return NextResponse.redirect(new URL(back, request.url));
}
