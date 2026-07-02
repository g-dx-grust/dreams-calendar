/*
 * Lark IM 通知（予定招待・予定変更・日報）
 * see: ../../G-DX_Lark_Integration_Rules.md §4
 *
 * - 送信は tenant token で /im/v1/messages を使用
 * - 個人宛は open_id、グループ宛は chat_id（管理画面で設定）
 * - 送信結果は calendar_notification_logs に記録し、失敗分はリトライする
 *   （実装は notification-log-store.ts）
 */

import {
  dispatchNotification,
  type DispatchResult,
} from "@/lib/notification-log-store";
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

export type NotifyResult = DispatchResult;

const NO_OPEN_ID_REASON = "Lark openId 未登録（管理システムのLark同期で設定）";

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

function textContent(body: string): string {
  return JSON.stringify({ text: body });
}

export async function sendInvitation(
  to: CalendarUser,
  schedule: Schedule,
  fromName?: string,
): Promise<NotifyResult> {
  return dispatchNotification({
    kind: "invitation",
    receiveId: to.larkOpenId ?? null,
    receiveIdType: "open_id",
    recipientName: to.name,
    subject: schedule.title,
    msgType: "text",
    content: textContent(buildBody(schedule, fromName)),
    relatedId: schedule.id,
    skipReason: NO_OPEN_ID_REASON,
  });
}

export async function sendScheduleChanged(
  to: CalendarUser,
  before: Schedule,
  after: Schedule,
  fromName?: string,
): Promise<NotifyResult> {
  return dispatchNotification({
    kind: "schedule_changed",
    receiveId: to.larkOpenId ?? null,
    receiveIdType: "open_id",
    recipientName: to.name,
    subject: after.title,
    msgType: "text",
    content: textContent(buildScheduleChangedBody(before, after, fromName)),
    relatedId: after.id,
    skipReason: NO_OPEN_ID_REASON,
  });
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
 * 日報提出時の Lark 通知（個人DM宛）。
 * 送付先グループチャットが未設定の場合に管理者へ送る。
 */
export async function sendDailyReportSubmitted(
  to: CalendarUser,
  report: DailyReport,
  reportUserName: string,
  reportUrl?: string,
): Promise<NotifyResult> {
  const subject = `日報 ${report.reportDate} ${reportUserName}`;
  if (!to.larkOpenId) {
    return dispatchNotification({
      kind: "daily_report",
      receiveId: null,
      receiveIdType: "open_id",
      recipientName: to.name,
      subject,
      msgType: "text",
      content: textContent(buildDailyReportBody(report, reportUserName, reportUrl)),
      relatedId: report.id,
      skipReason: NO_OPEN_ID_REASON,
    });
  }

  if (reportUrl) {
    const cardResult = await dispatchNotification({
      kind: "daily_report",
      receiveId: to.larkOpenId ?? null,
      receiveIdType: "open_id",
      recipientName: to.name,
      subject,
      msgType: "interactive",
      content: JSON.stringify(buildDailyReportCard(report, reportUserName, reportUrl)),
      relatedId: report.id,
    });
    if (cardResult.ok) return cardResult;
  }

  return dispatchNotification({
    kind: "daily_report",
    receiveId: to.larkOpenId ?? null,
    receiveIdType: "open_id",
    recipientName: to.name,
    subject,
    msgType: "text",
    content: textContent(buildDailyReportBody(report, reportUserName, reportUrl)),
    relatedId: report.id,
  });
}

/**
 * 日報提出時の Lark 通知（グループチャット宛）。
 * 送付先は管理画面「通知設定」で設定した chat_id。
 * 事前に対象チャットへ本システムのボットを追加しておく必要がある。
 */
export async function sendDailyReportToChat(
  chatId: string,
  chatName: string,
  report: DailyReport,
  reportUserName: string,
  reportUrl?: string,
): Promise<NotifyResult> {
  const subject = `日報 ${report.reportDate} ${reportUserName}`;
  if (reportUrl) {
    const cardResult = await dispatchNotification({
      kind: "daily_report",
      receiveId: chatId,
      receiveIdType: "chat_id",
      recipientName: chatName,
      subject,
      msgType: "interactive",
      content: JSON.stringify(buildDailyReportCard(report, reportUserName, reportUrl)),
      relatedId: report.id,
    });
    if (cardResult.ok) return cardResult;
  }

  return dispatchNotification({
    kind: "daily_report",
    receiveId: chatId,
    receiveIdType: "chat_id",
    recipientName: chatName,
    subject,
    msgType: "text",
    content: textContent(buildDailyReportBody(report, reportUserName, reportUrl)),
    relatedId: report.id,
  });
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
  return dispatchNotification({
    kind: "daily_report_reply",
    receiveId: to.larkOpenId ?? null,
    receiveIdType: "open_id",
    recipientName: to.name,
    subject: `日報返信 ${report.reportDate}`,
    msgType: "text",
    content: textContent(buildDailyReportReplyBody(report, reply, fromName)),
    relatedId: reply.id,
    skipReason: NO_OPEN_ID_REASON,
  });
}
