/*
 * 日報返信ストア（プロセス内 in-memory）
 * see: ../../CLAUDE.md §D（DB 接続前の暫定実装）
 *
 * Why: Supabase 構成未確定のため、daily_report_replies もメモリ実装で代替。
 *      投稿時刻昇順のフラットスレッド。返信に対する返信（ネスト）は未対応。
 */

import { randomUUID } from "node:crypto";
import type { DailyReportReply } from "@/components/calendar/types";

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

export function listReplies(reportId: string): DailyReportReply[] {
  return getStore()
    .filter((r) => r.reportId === reportId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(hydrate);
}

export function getReply(replyId: string): DailyReportReply | null {
  const found = getStore().find((r) => r.id === replyId);
  return found ? hydrate(found) : null;
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

export function deleteReply(replyId: string, userId: string): boolean {
  const store = getStore();
  const index = store.findIndex((r) => r.id === replyId);
  if (index === -1) return false;
  if (store[index]!.userId !== userId) return false;
  store.splice(index, 1);
  return true;
}
