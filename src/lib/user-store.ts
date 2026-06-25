/*
 * 社員マスタ ストア（プロセス内 in-memory）
 * see: ../../CLAUDE.md §D（DB 接続前の暫定実装）
 *
 * 社員は kanri-system / Lark 連携で管理する共有データ（§D）。
 * 本リポジトリでは参照のみ提供し、作成・更新・削除は持たない。
 */

import { MOCK_USERS } from "@/components/calendar/mock-data";
import type { CalendarUser } from "@/components/calendar/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role?: string | null;
  is_active: boolean;
  avatar_url?: string | null;
  lark_open_id?: string | null;
};

type CalendarUserProfileRow = {
  user_id: string;
  avatar_url: string | null;
  lark_open_id: string | null;
};

declare global {
  var __gdxUserStore: CalendarUser[] | undefined;
}

function getStore(): CalendarUser[] {
  if (!globalThis.__gdxUserStore) {
    globalThis.__gdxUserStore = MOCK_USERS.map((u) => ({ ...u }));
  }
  return globalThis.__gdxUserStore;
}

function mapUserRow(row: UserRow): CalendarUser {
  const role = row.role ?? null;
  return {
    id: row.id,
    name: row.full_name || row.email,
    avatarUrl: row.avatar_url ?? null,
    larkOpenId: row.lark_open_id ?? null,
    role,
    isAdmin: role === "admin",
  };
}

export function listUsers(): CalendarUser[] {
  return [...getStore()];
}

export async function listUsersAsync(): Promise<CalendarUser[]> {
  const db = getSupabaseAdmin();
  if (!db) return listUsers();

  const rich = await db
    .from("users")
    .select("id,email,full_name,role,is_active,avatar_url,lark_open_id")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (!rich.error && rich.data) {
    return withCalendarProfiles((rich.data as UserRow[]).map(mapUserRow));
  }

  const fallback = await db
    .from("users")
    .select("id,email,full_name,role,is_active")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (fallback.error || !fallback.data) return listUsers();
  const rows = fallback.data as UserRow[];
  return withCalendarProfiles(rows.map(mapUserRow));
}

export async function listAdminUsersAsync(): Promise<CalendarUser[]> {
  const users = await listUsersAsync();
  return users.filter((user) => user.isAdmin || user.role === "admin");
}

export function getUser(id: string): CalendarUser | null {
  return getStore().find((u) => u.id === id) ?? null;
}

export async function getUserAsync(id: string): Promise<CalendarUser | null> {
  const users = await listUsersAsync();
  return users.find((user) => user.id === id) ?? null;
}

async function withCalendarProfiles(users: CalendarUser[]): Promise<CalendarUser[]> {
  if (users.length === 0) return users;
  const db = getSupabaseAdmin();
  if (!db) return users;

  const { data, error } = await db
    .from("calendar_user_profiles")
    .select("user_id,avatar_url,lark_open_id")
    .in(
      "user_id",
      users.map((user) => user.id),
    );
  if (error || !data) return users;

  const profiles = new Map(
    (data as CalendarUserProfileRow[]).map((profile) => [
      profile.user_id,
      profile,
    ]),
  );
  return users.map((user) => {
    const profile = profiles.get(user.id);
    if (!profile) return user;
    return {
      ...user,
      avatarUrl: user.avatarUrl ?? profile.avatar_url,
      larkOpenId: user.larkOpenId ?? profile.lark_open_id,
    };
  });
}
