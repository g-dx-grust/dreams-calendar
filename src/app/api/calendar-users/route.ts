import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  addVisibleUserId,
  getVisibleUserIds,
  removeVisibleUserId,
} from "@/lib/calendar-user-pref";
import { listUsersAsync } from "@/lib/user-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const userId = String(form.get("userId") ?? "");

  const users = await listUsersAsync();
  if (!users.some((u) => u.id === userId)) {
    return NextResponse.json({ error: "invalid user" }, { status: 400 });
  }

  const fallback = users.map((u) => u.id);
  const current = await getVisibleUserIds();

  if (action === "add") {
    await addVisibleUserId(current, userId, fallback);
  } else if (action === "remove") {
    await removeVisibleUserId(current, userId, fallback);
  } else {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  revalidatePath("/calendar");
  return NextResponse.json({ ok: true });
}
