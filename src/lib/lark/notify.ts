/*
 * Lark IM 通知（招待）
 * see: ../../G-DX_Lark_Integration_Rules.md §4
 *
 * - 環境変数（LARK_APP_ID/LARK_APP_SECRET）が未設定 or 受信者の larkOpenId がない場合は
 *   コンソールログのみ（DB 接続前の暫定実装）
 * - 設定済みなら tenant token で IM API /im/v1/messages?receive_id_type=open_id に送信
 */

import {
  postLarkApiWithTenantToken,
  toLarkApiError,
} from "./provider-client";
import {
  formatJstSlashDate,
  formatJstSlashDateTime,
  formatJstTime,
  isSameJstDay,
  parseJstDate,
} from "@/lib/jst";
import type {
  CalendarUser,
  DailyReport,
  DailyReportReply,
  Schedule,
} from "@/components/calendar/types";

type NotifyResult = { ok: true } | { ok: false; reason: string };

declare global {
  var __gdxNotificationLog: NotificationLogEntry[] | undefined;
}

export type NotificationLogEntry = {
  at: string;
  to: { id: string; name: string };
  scheduleId: string;
  title: string;
  delivered: boolean;
  reason?: string;
  kind?:
    | "invitation"
    | "schedule_changed"
    | "daily_report"
    | "daily_report_reply";
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
  const dt = formatJstSlashDateTime(schedule.startAt);
  const head = fromName
    ? `${fromName} さんから予定に招待されました`
    : "予定に招待されました";
  return [
    head,
    "",
    `件名：${schedule.title}`,
    `日時：${dt} 〜 ${formatJstTime(schedule.endAt)}`,
    schedule.location ? `場所：${schedule.location}` : null,
    schedule.caseNumber ? `案件番号：${schedule.caseNumber}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildScheduleChangedBody(
  before: Schedule,
  after: Schedule,
  fromName?: string,
) {
  const head = fromName
    ? `${fromName} さんが予定を変更しました`
    : "予定が変更されました";
  return [
    head,
    "",
    `件名：${after.title}`,
    `変更前：${formatScheduleRange(before)}`,
    `変更後：${formatScheduleRange(after)}`,
    after.location ? `場所：${after.location}` : null,
    after.caseNumber ? `案件番号：${after.caseNumber}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatScheduleRange(schedule: Schedule) {
  const start = formatJstSlashDateTime(schedule.startAt);
  const end = isSameJstDay(schedule.startAt, schedule.endAt)
    ? formatJstTime(schedule.endAt)
    : formatJstSlashDateTime(schedule.endAt);
  return `${start} 〜 ${end}`;
}

function formatReportDate(value: string) {
  const parsed = parseJstDate(value);
  return parsed ? formatJstSlashDate(parsed) : value;
}

async function postIm(
  openId: string,
  body: string,
): Promise<NotifyResult> {
  try {
    await postLarkApiWithTenantToken<unknown>(
      "/im/v1/messages",
      {
        receive_id: openId,
        msg_type: "text",
        content: JSON.stringify({ text: body }),
      },
      { receive_id_type: "open_id" },
    );
    return { ok: true };
  } catch (error) {
    const larkError = toLarkApiError(error, "Lark通知を送信できませんでした");
    return { ok: false, reason: larkError.message };
  }
}

async function postInteractiveCard(
  openId: string,
  card: Record<string, unknown>,
): Promise<NotifyResult> {
  try {
    await postLarkApiWithTenantToken<unknown>(
      "/im/v1/messages",
      {
        receive_id: openId,
        msg_type: "interactive",
        content: JSON.stringify(card),
      },
      { receive_id_type: "open_id" },
    );
    return { ok: true };
  } catch (error) {
    const larkError = toLarkApiError(error, "Lark通知を送信できませんでした");
    return { ok: false, reason: larkError.message };
  }
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

  const result = await postIm(to.larkOpenId, body);
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

export async function sendScheduleChanged(
  to: CalendarUser,
  before: Schedule,
  after: Schedule,
  fromName?: string,
): Promise<NotifyResult> {
  const body = buildScheduleChangedBody(before, after, fromName);
  const recordResult = (delivered: boolean, reason?: string) => {
    logEntry({
      at: new Date().toISOString(),
      to: { id: to.id, name: to.name },
      scheduleId: after.id,
      title: after.title,
      delivered,
      reason,
      kind: "schedule_changed",
    });
  };

  if (!to.larkOpenId) {
    recordResult(false, "Lark openId 未登録（社員マスタで設定）");
    return { ok: false, reason: "no larkOpenId" };
  }

  const result = await postIm(to.larkOpenId, body);
  if (result.ok) {
    recordResult(true);
  } else {
    recordResult(false, result.reason);
  }
  return result;
}

function buildDailyReportBody(
  report: DailyReport,
  reportUserName: string,
  reportUrl?: string,
): string {
  const date = formatReportDate(report.reportDate);
  return [
    `【日報提出】${reportUserName} さん`,
    `対象日：${date}`,
    reportUrl ? `確認URL：${reportUrl}` : null,
    "",
    report.body,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function buildDailyReportCard(
  report: DailyReport,
  reportUserName: string,
  reportUrl: string,
) {
  const date = formatReportDate(report.reportDate);
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: "日報が提出されました" },
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**${reportUserName} さん**\n対象日：${date}`,
        },
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: "日報を確認する" },
            url: reportUrl,
            type: "primary",
          },
        ],
      },
    ],
  };
}

/**
 * 日報提出時の Lark 通知。
 * 呼び出し側で管理者宛を優先し、評価環境では本人宛にフォールバックする。
 */
export async function sendDailyReportSubmitted(
  to: CalendarUser,
  report: DailyReport,
  reportUserName: string,
  reportUrl?: string,
): Promise<NotifyResult> {
  const body = buildDailyReportBody(report, reportUserName, reportUrl);
  const recordResult = (delivered: boolean, reason?: string) => {
    logEntry({
      at: new Date().toISOString(),
      to: { id: to.id, name: to.name },
      scheduleId: report.id,
      title: `日報 ${report.reportDate} ${reportUserName}`,
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

  const result = reportUrl
    ? await postInteractiveCard(
        to.larkOpenId,
        buildDailyReportCard(report, reportUserName, reportUrl),
      )
    : await postIm(to.larkOpenId, body);
  const delivered =
    result.ok || !reportUrl ? result : await postIm(to.larkOpenId, body);
  if (delivered.ok) {
    console.info("[lark/notify] daily-report delivered", {
      to: to.name,
      report: report.reportDate,
    });
    recordResult(true);
  } else {
    console.warn("[lark/notify] daily-report failed", {
      to: to.name,
      reason: delivered.reason,
    });
    recordResult(false, delivered.reason);
  }
  return delivered;
}

function buildDailyReportReplyBody(
  report: DailyReport,
  reply: DailyReportReply,
  fromName: string,
): string {
  const date = formatReportDate(report.reportDate);
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

  const result = await postIm(to.larkOpenId, body);
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
