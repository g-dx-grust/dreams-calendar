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
  is_active: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var __gdxUserStore: CalendarUser[] | undefined;
}

function getStore(): CalendarUser[] {
  if (!globalThis.__gdxUserStore) {
    globalThis.__gdxUserStore = MOCK_USERS.map((u) => ({ ...u }));
  }
  return globalThis.__gdxUserStore;
}

function mapUserRow(row: UserRow): CalendarUser {
  return {
    id: row.id,
    name: row.full_name || row.email,
    avatarUrl: null,
    larkOpenId: null,
  };
}

export function listUsers(): CalendarUser[] {
  return [...getStore()];
}

export async function listUsersAsync(): Promise<CalendarUser[]> {
  const db = getSupabaseAdmin();
  if (!db) return listUsers();

  const { data, error } = await db
    .from("users")
    .select("id,email,full_name,is_active")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error || !data) return listUsers();
  const rows = data as UserRow[];
  return rows.map(mapUserRow);
}

export function getUser(id: string): CalendarUser | null {
  return getStore().find((u) => u.id === id) ?? null;
}

export async function getUserAsync(id: string): Promise<CalendarUser | null> {
  const users = await listUsersAsync();
  return users.find((user) => user.id === id) ?? null;
}
