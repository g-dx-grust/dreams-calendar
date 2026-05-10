/*
 * 日報ストア（プロセス内 in-memory）
 * see: ../../CLAUDE.md §D（DB 接続前の暫定実装）
 *
 * Why: Supabase 構成未確定のため、daily_reports もメモリ実装で代替。
 *      キーは `${userId}-${reportDate}` で 1 件のみ保持。
 */

import { randomUUID } from "node:crypto";
import type { DailyReport } from "@/components/calendar/types";

type SerializedDailyReport = Omit<DailyReport, "submittedAt" | "updatedAt"> & {
  submittedAt: string;
  updatedAt: string;
};

declare global {
  var __gdxDailyReportStore: Map<string, SerializedDailyReport> | undefined;
}

function getStore(): Map<string, SerializedDailyReport> {
  if (!globalThis.__gdxDailyReportStore) {
    globalThis.__gdxDailyReportStore = new Map();
  }
  return globalThis.__gdxDailyReportStore;
}

function key(userId: string, reportDate: string) {
  return `${userId}::${reportDate}`;
}

function hydrate(s: SerializedDailyReport): DailyReport {
  return {
    ...s,
    submittedAt: new Date(s.submittedAt),
    updatedAt: new Date(s.updatedAt),
  };
}

export function getReport(
  userId: string,
  reportDate: string,
): DailyReport | null {
  const found = getStore().get(key(userId, reportDate));
  return found ? hydrate(found) : null;
}

export function listReportsByDate(
  reportDate: string,
): Map<string, DailyReport> {
  const out = new Map<string, DailyReport>();
  for (const s of getStore().values()) {
    if (s.reportDate === reportDate) {
      out.set(s.userId, hydrate(s));
    }
  }
  return out;
}

export function submitReport(
  userId: string,
  reportDate: string,
  body: string,
): DailyReport {
  const store = getStore();
  const existing = store.get(key(userId, reportDate));
  const now = new Date().toISOString();
  const next: SerializedDailyReport = existing
    ? { ...existing, body, updatedAt: now }
    : {
        id: randomUUID(),
        userId,
        reportDate,
        body,
        submittedAt: now,
        updatedAt: now,
      };
  store.set(key(userId, reportDate), next);
  return hydrate(next);
}
