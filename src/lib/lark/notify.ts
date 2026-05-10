/*
 * Lark IM 通知（招待）
 * see: ../../G-DX_Lark_Integration_Rules.md §4
 *
 * - 環境変数（LARK_APP_ID/LARK_APP_SECRET）が未設定 or 受信者の larkOpenId がない場合は
 *   コンソールログのみ（DB 接続前の暫定実装）
 * - 設定済みなら IM API /im/v1/messages?receive_id_type=open_id にテキスト送信
 */

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { larkConfig } from "./config";
import type {
  CalendarUser,
  DailyReport,
  DailyReportReply,
  Schedule,
} from "@/components/calendar/types";

type NotifyResult = { ok: true } | { ok: false; reason: string };

declare global {
  // eslint-disable-next-line no-var
  var __gdxNotificationLog: NotificationLogEntry[] | undefined;
}

export type NotificationLogEntry = {
  at: string;
  to: { id: string; name: string };
  scheduleId: string;
  title: string;
  delivered: boolean;
  reason?: string;
  kind?: "invitation" | "daily_report" | "daily_report_reply";
};

function logEntry(e: NotificationLogEntry) {
  if (!globalThis.__gdxNotificationLog) globalThis.__gdxNotificationLog = [];
  globalThis.__gdxNotificationLog.unshift(e);
  if (globalThis.__gdxNotificationLog.length > 100) {
    globalThis.__gdxNotificationLog.length = 100;
  }
}

export function listNotifications(): NotificationLogEntry[] {
  return [...(globalThis.__gdxNotificationLog ?? [])];
}

function buildBody(schedule: Schedule, fromName?: string) {
  const dt = format(schedule.startAt, "yyyy/MM/dd(EEE) HH:mm", {
    locale: ja,
  });
  const head = fromName
    ? `${fromName} さんから予定に招待されました`
    : "予定に招待されました";
  return [
    head,
    "",
    `件名：${schedule.title}`,
    `日時：${dt} 〜 ${format(schedule.endAt, "HH:mm")}`,
    schedule.location ? `場所：${schedule.location}` : null,
    schedule.caseNumber ? `案件番号：${schedule.caseNumber}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function getAppAccessToken(): Promise<string | null> {
  if (!larkConfig.appId || !larkConfig.appSecret) return null;
  try {
    const res = await fetch(
      `${larkConfig.openApiBase}/auth/v3/app_access_token/internal`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: larkConfig.appId,
          app_secret: larkConfig.appSecret,
        }),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { code: number; app_access_token: string };
    if (json.code !== 0) return null;
    return json.app_access_token;
  } catch {
    return null;
  }
}

async function postIm(
  token: string,
  openId: string,
  body: string,
): Promise<NotifyResult> {
  const res = await fetch(
    `${larkConfig.openApiBase}/im/v1/messages?receive_id_type=open_id`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receive_id: openId,
        msg_type: "text",
        content: JSON.stringify({ text: body }),
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const json = (await res.json()) as { code: number; msg: string };
  if (json.code !== 0) return { ok: false, reason: json.msg };
  return { ok: true };
}

export async function sendInvitation(
  to: CalendarUser,
  schedule: Schedule,
  fromName?: string,
): Promise<NotifyResult> {
  const body = buildBody(schedule, fromName);
  const recordResult = (delivered: boolean, reason?: string) => {
    logEntry({
      at: new Date().toISOString(),
      to: { id: to.id, name: to.name },
      scheduleId: schedule.id,
      title: schedule.title,
      delivered,
      reason,
    });
  };

  if (!to.larkOpenId) {
    console.info("[lark/notify] skip (no larkOpenId)", {
      to: to.name,
      schedule: schedule.title,
    });
    recordResult(false, "Lark openId 未登録（社員マスタで設定）");
    return { ok: false, reason: "no larkOpenId" };
  }

  const token = await getAppAccessToken();
  if (!token) {
    console.info("[lark/notify] skip (no Lark credentials)", {
      to: to.name,
      schedule: schedule.title,
      body,
    });
    recordResult(false, "Lark 認証情報が未設定（.env.local）");
    return { ok: false, reason: "no app credentials" };
  }

  const result = await postIm(token, to.larkOpenId, body);
  if (result.ok) {
    console.info("[lark/notify] delivered", {
      to: to.name,
      schedule: schedule.title,
    });
    recordResult(true);
  } else {
    console.warn("[lark/notify] failed", { to: to.name, reason: result.reason });
    recordResult(false, result.reason);
  }
  return result;
}

function buildDailyReportBody(report: DailyReport, userName: string): string {
  const date = format(new Date(`${report.reportDate}T00:00`), "yyyy/MM/dd(EEE)", {
    locale: ja,
  });
  return [
    `【日報提出】${userName} さん`,
    `対象日：${date}`,
    "",
    report.body,
  ].join("\n");
}

/**
 * 日報提出時の Lark 通知。
 * 現状の宛先は「提出した本人の Lark DM」。
 * 上司やチーム共有チャットへの通知は、calendar-settings に通知先チャットID を追加する次フェーズで対応。
 */
export async function sendDailyReportSubmitted(
  to: CalendarUser,
  report: DailyReport,
): Promise<NotifyResult> {
  const body = buildDailyReportBody(report, to.name);
  const recordResult = (delivered: boolean, reason?: string) => {
    logEntry({
      at: new Date().toISOString(),
      to: { id: to.id, name: to.name },
      scheduleId: report.id,
      title: `日報 ${report.reportDate}`,
      delivered,
      reason,
      kind: "daily_report",
    });
  };

  if (!to.larkOpenId) {
    console.info("[lark/notify] daily-report skip (no larkOpenId)", {
      to: to.name,
      report: report.reportDate,
    });
    recordResult(false, "Lark openId 未登録（社員マスタで設定）");
    return { ok: false, reason: "no larkOpenId" };
  }

  const token = await getAppAccessToken();
  if (!token) {
    console.info("[lark/notify] daily-report skip (no Lark credentials)", {
      to: to.name,
      report: report.reportDate,
      body,
    });
    recordResult(false, "Lark 認証情報が未設定（.env.local）");
    return { ok: false, reason: "no app credentials" };
  }

  const result = await postIm(token, to.larkOpenId, body);
  if (result.ok) {
    console.info("[lark/notify] daily-report delivered", {
      to: to.name,
      report: report.reportDate,
    });
    recordResult(true);
  } else {
    console.warn("[lark/notify] daily-report failed", {
      to: to.name,
      reason: result.reason,
    });
    recordResult(false, result.reason);
  }
  return result;
}

function buildDailyReportReplyBody(
  report: DailyReport,
  reply: DailyReportReply,
  fromName: string,
): string {
  const date = format(new Date(`${report.reportDate}T00:00`), "yyyy/MM/dd(EEE)", {
    locale: ja,
  });
  return [
    `【日報への返信】${fromName} さん`,
    `対象日：${date} の日報`,
    "",
    reply.body,
  ].join("\n");
}

/**
 * 日報への返信が投稿されたときの Lark 通知。
 * 宛先は「日報を提出した本人」。返信者本人が日報の提出者と同一の場合は通知しない。
 */
export async function sendDailyReportReply(
  to: CalendarUser,
  report: DailyReport,
  reply: DailyReportReply,
  fromName: string,
): Promise<NotifyResult> {
  if (reply.userId === to.id) {
    return { ok: false, reason: "self reply (skip)" };
  }
  const body = buildDailyReportReplyBody(report, reply, fromName);
  const recordResult = (delivered: boolean, reason?: string) => {
    logEntry({
      at: new Date().toISOString(),
      to: { id: to.id, name: to.name },
      scheduleId: reply.id,
      title: `日報返信 ${report.reportDate}`,
      delivered,
      reason,
      kind: "daily_report_reply",
    });
  };

  if (!to.larkOpenId) {
    console.info("[lark/notify] daily-report-reply skip (no larkOpenId)", {
      to: to.name,
      report: report.reportDate,
    });
    recordResult(false, "Lark openId 未登録（社員マスタで設定）");
    return { ok: false, reason: "no larkOpenId" };
  }

  const token = await getAppAccessToken();
  if (!token) {
    console.info("[lark/notify] daily-report-reply skip (no Lark credentials)", {
      to: to.name,
      report: report.reportDate,
      body,
    });
    recordResult(false, "Lark 認証情報が未設定（.env.local）");
    return { ok: false, reason: "no app credentials" };
  }

  const result = await postIm(token, to.larkOpenId, body);
  if (result.ok) {
    console.info("[lark/notify] daily-report-reply delivered", {
      to: to.name,
      report: report.reportDate,
    });
    recordResult(true);
  } else {
    console.warn("[lark/notify] daily-report-reply failed", {
      to: to.name,
      reason: result.reason,
    });
    recordResult(false, result.reason);
  }
  return result;
}
