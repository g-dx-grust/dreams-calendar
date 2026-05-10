/*
 * 予定種別マスタ ストア（プロセス内 in-memory）
 * see: ../../CLAUDE.md §D（DB 接続前の暫定実装）
 */

import { randomUUID } from "node:crypto";
import { SCHEDULE_TYPES } from "@/components/calendar/mock-data";
import type { ScheduleType } from "@/components/calendar/types";

declare global {
  // eslint-disable-next-line no-var
  var __gdxScheduleTypeStore: ScheduleType[] | undefined;
}

function getStore(): ScheduleType[] {
  if (!globalThis.__gdxScheduleTypeStore) {
    globalThis.__gdxScheduleTypeStore = SCHEDULE_TYPES.map((t) => ({ ...t }));
  }
  return globalThis.__gdxScheduleTypeStore;
}

export function listScheduleTypes(): ScheduleType[] {
  return [...getStore()];
}

export function getScheduleType(id: string): ScheduleType | null {
  return getStore().find((t) => t.id === id) ?? null;
}

export type ScheduleTypeInput = {
  name: string;
  color: string;
};

export function createScheduleType(input: ScheduleTypeInput): ScheduleType {
  const created: ScheduleType = {
    id: randomUUID(),
    name: input.name,
    color: input.color,
  };
  getStore().push(created);
  return created;
}

export function updateScheduleType(
  id: string,
  patch: Partial<ScheduleTypeInput>,
): ScheduleType | null {
  const store = getStore();
  const index = store.findIndex((t) => t.id === id);
  if (index === -1) return null;
  const current = store[index]!;
  const next: ScheduleType = {
    ...current,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.color !== undefined ? { color: patch.color } : {}),
  };
  store[index] = next;
  return next;
}

export function deleteScheduleType(id: string): boolean {
  const store = getStore();
  const index = store.findIndex((t) => t.id === id);
  if (index === -1) return false;
  store.splice(index, 1);
  return true;
}
