/*
 * カレンダー「表示する社員」の設定（ビュアー個別、Cookie 保存）
 * - 未設定（cookie なし）：全員表示（既存動作と互換）
 * - 設定済み：cookie に保存された ID のみ表示（順序保持）
 */
import { cookies } from "next/headers";

const COOKIE_NAME = "gdx_calendar_visible_users";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 年

export async function getVisibleUserIds(): Promise<string[] | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length === 0 ? null : ids;
}

export async function setVisibleUserIds(ids: string[]) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, ids.join(","), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

/** 表示順を保持しつつ id を追加（重複排除） */
export async function addVisibleUserId(
  current: string[] | null,
  id: string,
  fallbackOrder: string[],
) {
  const base =
    current && current.length > 0 ? [...current] : [...fallbackOrder];
  if (base.includes(id)) return base;
  // fallbackOrder に従ってソート挿入：元の順序に近い位置に入れる
  const indexInFallback = fallbackOrder.indexOf(id);
  const next = [...base, id];
  next.sort((a, b) => {
    const ia = fallbackOrder.indexOf(a);
    const ib = fallbackOrder.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  void indexInFallback;
  await setVisibleUserIds(next);
  return next;
}

export async function removeVisibleUserId(
  current: string[] | null,
  id: string,
  fallbackOrder: string[],
) {
  const base =
    current && current.length > 0 ? [...current] : [...fallbackOrder];
  const next = base.filter((u) => u !== id);
  // 1 名以上は残す（全員消すと「未設定」=全員表示扱いに戻ってしまうため）
  if (next.length === 0) return base;
  await setVisibleUserIds(next);
  return next;
}
