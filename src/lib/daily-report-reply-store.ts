/*
 * 日報返信ストア（プロセス内 in-memory）
 * see: ../../CLAUDE.md §D（DB 接続前の暫定実装）
 *
 * Why: Supabase 構成未確定のため、daily_report_replies もメモリ実装で代替。
 *      投稿時刻昇順のフラットスレッド。返信に対する返信（ネスト）は未対応。
 */

import { randomUUID } from "node:crypto";
import type { DailyReportReply } from "@/components/calendar/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type CommentRow = {
  id: string;
  target_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

type SerializedReply = Omit<DailyReportReply, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __gdxDailyReportReplyStore: SerializedReply[] | undefined;
}

function getStore(): SerializedReply[] {
  if (!globalThis.__gdxDailyReportReplyStore) {
    globalThis.__gdxDailyReportReplyStore = [];
  }
  return globalThis.__gdxDailyReportReplyStore;
}

function hydrate(s: SerializedReply): DailyReportReply {
  return {
    ...s,
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
  };
}

function hydrateRow(row: CommentRow): DailyReportReply {
  return {
    id: row.id,
    reportId: row.target_id,
    userId: row.user_id,
    body: row.body,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function listReplies(reportId: string): DailyReportReply[] {
  return getStore()
    .filter((r) => r.reportId === reportId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(hydrate);
}

export async function listRepliesAsync(
  reportId: string,
): Promise<DailyReportReply[]> {
  const db = getSupabaseAdmin();
  if (!db) return listReplies(reportId);

  const { data, error } = await db
    .from("comments")
    .select("id,target_id,user_id,body,created_at,updated_at")
    .eq("target_type", "daily_report")
    .eq("target_id", reportId)
    .order("created_at", { ascending: true });

  if (error || !data) return listReplies(reportId);
  return (data as CommentRow[]).map(hydrateRow);
}

export function getReply(replyId: string): DailyReportReply | null {
  const found = getStore().find((r) => r.id === replyId);
  return found ? hydrate(found) : null;
}

export async function getReplyAsync(
  replyId: string,
): Promise<DailyReportReply | null> {
  const db = getSupabaseAdmin();
  if (!db) return getReply(replyId);

  const { data, error } = await db
    .from("comments")
    .select("id,target_id,user_id,body,created_at,updated_at")
    .eq("id", replyId)
    .eq("target_type", "daily_report")
    .maybeSingle();

  if (error) return getReply(replyId);
  return data ? hydrateRow(data as CommentRow) : null;
}

export function addReply(
  reportId: string,
  userId: string,
  body: string,
): DailyReportReply {
  const now = new Date().toISOString();
  const next: SerializedReply = {
    id: randomUUID(),
    reportId,
    userId,
    body,
    createdAt: now,
    updatedAt: now,
  };
  getStore().push(next);
  return hydrate(next);
}

export async function addReplyAsync(
  reportId: string,
  userId: string,
  body: string,
): Promise<DailyReportReply> {
  const db = getSupabaseAdmin();
  if (!db) return addReply(reportId, userId, body);

  const { data, error } = await db
    .from("comments")
    .insert({
      target_type: "daily_report",
      target_id: reportId,
      user_id: userId,
      body,
    })
    .select("id,target_id,user_id,body,created_at,updated_at")
    .single();

  if (error || !data) return addReply(reportId, userId, body);
  return hydrateRow(data as CommentRow);
}

export function updateReply(
  replyId: string,
  userId: string,
  body: string,
): DailyReportReply | null {
  const store = getStore();
  const index = store.findIndex((r) => r.id === replyId);
  if (index === -1) return null;
  const current = store[index]!;
  if (current.userId !== userId) return null;
  const next: SerializedReply = {
    ...current,
    body,
    updatedAt: new Date().toISOString(),
  };
  store[index] = next;
  return hydrate(next);
}

export async function updateReplyAsync(
  replyId: string,
  userId: string,
  body: string,
): Promise<DailyReportReply | null> {
  const db = getSupabaseAdmin();
  if (!db) return updateReply(replyId, userId, body);

  const { data, error } = await db
    .from("comments")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", replyId)
    .eq("user_id", userId)
    .eq("target_type", "daily_report")
    .select("id,target_id,user_id,body,created_at,updated_at")
    .maybeSingle();

  if (error) return updateReply(replyId, userId, body);
  return data ? hydrateRow(data as CommentRow) : null;
}

export function deleteReply(replyId: string, userId: string): boolean {
  const store = getStore();
  const index = store.findIndex((r) => r.id === replyId);
  if (index === -1) return false;
  if (store[index]!.userId !== userId) return false;
  store.splice(index, 1);
  return true;
}

export async function deleteReplyAsync(
  replyId: string,
  userId: string,
): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return deleteReply(replyId, userId);

  const { error } = await db
    .from("comments")
    .delete()
    .eq("id", replyId)
    .eq("user_id", userId)
    .eq("target_type", "daily_report");

  if (error) return deleteReply(replyId, userId);
  return true;
}
