/*
 * 日報ストア（プロセス内 in-memory）
 * see: ../../CLAUDE.md §D（DB 接続前の暫定実装）
 *
 * Why: Supabase 構成未確定のため、daily_reports もメモリ実装で代替。
 *      キーは `${userId}-${reportDate}` で 1 件のみ保持。
 */

import { randomUUID } from "node:crypto";
import type { DailyReport } from "@/components/calendar/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type DailyReportRow = {
  id: string;
  user_id: string;
  report_date: string;
  body: string;
  submitted_at: string | null;
  updated_at: string;
};

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

function hydrateRow(row: DailyReportRow): DailyReport {
  return {
    id: row.id,
    userId: row.user_id,
    reportDate: row.report_date,
    body: row.body,
    submittedAt: new Date(row.submitted_at ?? row.updated_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getReportAsync(
  userId: string,
  reportDate: string,
): Promise<DailyReport | null> {
  const db = getSupabaseAdmin();
  if (!db) return getReport(userId, reportDate);

  const { data, error } = await db
    .from("daily_reports")
    .select("id,user_id,report_date,body,submitted_at,updated_at")
    .eq("user_id", userId)
    .eq("report_date", reportDate)
    .maybeSingle();

  if (error) return getReport(userId, reportDate);
  return data ? hydrateRow(data as DailyReportRow) : null;
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

export async function listReportsByDateAsync(
  reportDate: string,
): Promise<Map<string, DailyReport>> {
  const db = getSupabaseAdmin();
  if (!db) return listReportsByDate(reportDate);

  const { data, error } = await db
    .from("daily_reports")
    .select("id,user_id,report_date,body,submitted_at,updated_at")
    .eq("report_date", reportDate);

  if (error || !data) return listReportsByDate(reportDate);
  const out = new Map<string, DailyReport>();
  for (const row of data as DailyReportRow[]) {
    const report = hydrateRow(row);
    out.set(report.userId, report);
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

export async function submitReportAsync(
  userId: string,
  reportDate: string,
  body: string,
): Promise<DailyReport> {
  const db = getSupabaseAdmin();
  if (!db) return submitReport(userId, reportDate, body);

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("daily_reports")
    .upsert(
      {
        user_id: userId,
        report_date: reportDate,
        body,
        status: "submitted",
        submitted_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,report_date" },
    )
    .select("id,user_id,report_date,body,submitted_at,updated_at")
    .single();

  if (error || !data) return submitReport(userId, reportDate, body);
  return hydrateRow(data as DailyReportRow);
}

export async function markReportLarkNotifiedAsync(
  reportId: string,
): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;

  const now = new Date().toISOString();
  await db
    .from("daily_reports")
    .update({ lark_notified_at: now, updated_at: now })
    .eq("id", reportId);
}
