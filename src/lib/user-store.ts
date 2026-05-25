/*
 * 社員マスタ ストア（プロセス内 in-memory）
 * see: ../../CLAUDE.md §D（DB 接続前の暫定実装）
 *
 * 社員は kanri-system / Lark 連携で管理する共有データ（§D）。
 * 本リポジトリでは参照のみ提供し、作成・更新・削除は持たない。
 */

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
