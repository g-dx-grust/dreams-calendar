/*
 * 予定種別マスタ ストア（プロセス内 in-memory）
 * see: ../../CLAUDE.md §D（DB 接続前の暫定実装）
 */

import { randomUUID } from "node:crypto";
import { SCHEDULE_TYPES } from "@/components/calendar/mock-data";
import type { ScheduleType } from "@/components/calendar/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type ScheduleTypeRow = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
};

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

function mapScheduleTypeRow(row: ScheduleTypeRow): ScheduleType {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
  };
}

export function listScheduleTypes(): ScheduleType[] {
  return [...getStore()];
}

export async function listScheduleTypesAsync(): Promise<ScheduleType[]> {
  const db = getSupabaseAdmin();
  if (!db) return listScheduleTypes();

  const { data, error } = await db
    .from("schedule_types")
    .select("id,name,color,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) return listScheduleTypes();
  const rows = data as ScheduleTypeRow[];
  return rows.map(mapScheduleTypeRow);
}

export function getScheduleType(id: string): ScheduleType | null {
  return getStore().find((t) => t.id === id) ?? null;
}

export async function getScheduleTypeAsync(
  id: string,
): Promise<ScheduleType | null> {
  const types = await listScheduleTypesAsync();
  return types.find((type) => type.id === id) ?? null;
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

export async function createScheduleTypeAsync(
  input: ScheduleTypeInput,
): Promise<ScheduleType> {
  const db = getSupabaseAdmin();
  if (!db) return createScheduleType(input);

  const { data, error } = await db
    .from("schedule_types")
    .insert({ name: input.name, color: input.color })
    .select("id,name,color,sort_order,is_active")
    .single();

  if (error || !data) return createScheduleType(input);
  return mapScheduleTypeRow(data as ScheduleTypeRow);
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

export async function updateScheduleTypeAsync(
  id: string,
  patch: Partial<ScheduleTypeInput>,
): Promise<ScheduleType | null> {
  const db = getSupabaseAdmin();
  if (!db) return updateScheduleType(id, patch);

  const payload: Partial<ScheduleTypeInput> & { updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.color !== undefined) payload.color = patch.color;

  const { data, error } = await db
    .from("schedule_types")
    .update(payload)
    .eq("id", id)
    .eq("is_active", true)
    .select("id,name,color,sort_order,is_active")
    .maybeSingle();

  if (error) return updateScheduleType(id, patch);
  return data ? mapScheduleTypeRow(data as ScheduleTypeRow) : null;
}

export function deleteScheduleType(id: string): boolean {
  const store = getStore();
  const index = store.findIndex((t) => t.id === id);
  if (index === -1) return false;
  store.splice(index, 1);
  return true;
}

export async function deleteScheduleTypeAsync(id: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return deleteScheduleType(id);

  const { error } = await db
    .from("schedule_types")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("is_active", true);

  if (error) return deleteScheduleType(id);
  return true;
}
