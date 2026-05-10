/*
 * 「自分」識別ヘルパー
 * Why: 認証完了前のため、Cookie で「自分」を擬似的に保持。
 *      Lark OAuth がフルに動くようになったら session.larkOpenId → users マッチに置換。
 */
import { cookies } from "next/headers";
import { listUsers } from "@/lib/user-store";
import { getSession } from "@/lib/session";

const COOKIE_NAME = "gdx_self_user_id";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 年

export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(COOKIE_NAME)?.value;
  const users = listUsers();
  if (fromCookie && users.some((u) => u.id === fromCookie)) {
    return fromCookie;
  }

  // セッションがあれば larkOpenId でマッチ（将来）
  const session = await getSession();
  if (session?.larkOpenId) {
    const matched = users.find((u) => u.larkOpenId === session.larkOpenId);
    if (matched) return matched.id;
  }

  // フォールバック：先頭ユーザー
  return users[0]?.id ?? null;
}

export async function setCurrentUserId(id: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, id, {
    httpOnly: false, // クライアント側で読む可能性
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}
