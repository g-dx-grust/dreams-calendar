/*
 * 社員マスタ ストア（プロセス内 in-memory）
 * see: ../../CLAUDE.md §D（DB 接続前の暫定実装）
 */

import { randomUUID } from "node:crypto";
import { MOCK_USERS } from "@/components/calendar/mock-data";
import type { CalendarUser } from "@/components/calendar/types";

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

export function listUsers(): CalendarUser[] {
  return [...getStore()];
}

export function getUser(id: string): CalendarUser | null {
  return getStore().find((u) => u.id === id) ?? null;
}

export type UserInput = {
  name: string;
  avatarUrl?: string | null;
  larkOpenId?: string | null;
};

export function createUser(input: UserInput): CalendarUser {
  const created: CalendarUser = {
    id: randomUUID(),
    name: input.name,
    avatarUrl: input.avatarUrl ?? null,
    larkOpenId: input.larkOpenId ?? null,
  };
  getStore().push(created);
  return created;
}

export function updateUser(
  id: string,
  patch: Partial<UserInput>,
): CalendarUser | null {
  const store = getStore();
  const index = store.findIndex((u) => u.id === id);
  if (index === -1) return null;
  const current = store[index]!;
  const next: CalendarUser = {
    ...current,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
    ...(patch.larkOpenId !== undefined ? { larkOpenId: patch.larkOpenId } : {}),
  };
  store[index] = next;
  return next;
}

export function deleteUser(id: string): boolean {
  const store = getStore();
  const index = store.findIndex((u) => u.id === id);
  if (index === -1) return false;
  store.splice(index, 1);
  return true;
}
