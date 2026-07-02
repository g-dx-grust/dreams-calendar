/*
 * Lark通知の送信・記録・リトライ
 * see: ../../G-DX_Lark_Integration_Rules.md §4.2
 *
 * - 送信結果は calendar_notification_logs に永続化する
 * - 失敗した通知は指数バックオフ（5分→15分→60分）でリトライする
 * - DB未接続（プレビュー環境）ではプロセス内メモリに記録する
 */

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  postLarkApiWithTenantToken,
  toLarkApiError,
} from "@/lib/lark/provider-client";

export type NotificationKind =
  | "invitation"
  | "schedule_changed"
  | "daily_report"
  | "daily_report_reply";

export type NotificationStatus = "pending" | "sent" | "failed" | "skipped";

export type NotificationDispatchInput = {
  kind: NotificationKind;
  receiveId: string | null;
  receiveIdType: "open_id" | "chat_id";
  recipientName: string;
  subject: string;
  msgType: "text" | "interactive";
  content: string;
  relatedId?: string;
  skipReason?: string;
};

export type NotificationLogEntry = {
  id: string;
  at: string;
  kind: NotificationKind | string;
  recipientName: string;
  subject: string;
  status: NotificationStatus;
  error: string | null;
  attempts: number;
  nextRetryAt: string | null;
};

export type DispatchResult = { ok: true } | { ok: false; reason: string };

const RETRY_DELAY_MINUTES = [5, 15, 60] as const;
const MAX_ATTEMPTS = RETRY_DELAY_MINUTES.length + 1;
const LOG_LIMIT = 100;

type LogRow = {
  id: string;
  kind: string;
  receive_id: string | null;
  receive_id_type: string;
  recipient_name: string | null;
  subject: string;
  msg_type: string;
  content: string | null;
  status: NotificationStatus;
  error: string | null;
  attempts: number;
  next_retry_at: string | null;
  created_at: string;
};

declare global {
  var __gdxNotificationLogFallback: NotificationLogEntry[] | undefined;
}

function memoryLog(): NotificationLogEntry[] {
  if (!globalThis.__gdxNotificationLogFallback) {
    globalThis.__gdxNotificationLogFallback = [];
  }
  return globalThis.__gdxNotificationLogFallback;
}

function recordToMemory(entry: NotificationLogEntry) {
  const log = memoryLog();
  log.unshift(entry);
  if (log.length > LOG_LIMIT) log.length = LOG_LIMIT;
}

function nextRetryAt(attempts: number, from: Date): string | null {
  const delay = RETRY_DELAY_MINUTES[attempts - 1];
  if (delay === undefined) return null;
  return new Date(from.getTime() + delay * 60_000).toISOString();
}

async function postImMessage(
  receiveId: string,
  receiveIdType: "open_id" | "chat_id",
  msgType: string,
  content: string,
): Promise<DispatchResult> {
  try {
    await postLarkApiWithTenantToken<unknown>(
      "/im/v1/messages",
      { receive_id: receiveId, msg_type: msgType, content },
      { receive_id_type: receiveIdType },
    );
    return { ok: true };
  } catch (error) {
    const larkError = toLarkApiError(error, "Lark通知を送信できませんでした");
    return { ok: false, reason: larkError.message };
  }
}

/*
 * 通知を1件送信し、結果をログに記録する。
 * receiveId が null の場合は送信せず skipped として記録する。
 */
export async function dispatchNotification(
  input: NotificationDispatchInput,
): Promise<DispatchResult> {
  const db = getSupabaseAdmin();
  const now = new Date();

  if (!input.receiveId) {
    const reason = input.skipReason ?? "宛先が未設定です";
    if (db) {
      await db
        .from("calendar_notification_logs")
        .insert({
          kind: input.kind,
          receive_id: null,
          receive_id_type: input.receiveIdType,
          recipient_name: input.recipientName,
          subject: input.subject,
          msg_type: input.msgType,
          content: input.content,
          related_id: input.relatedId ?? null,
          status: "skipped",
          error: reason,
          attempts: 0,
        })
        .then(({ error }) => {
          if (error) console.warn("[notify] log insert failed", error.message);
        });
    } else {
      recordToMemory({
        id: crypto.randomUUID(),
        at: now.toISOString(),
        kind: input.kind,
        recipientName: input.recipientName,
        subject: input.subject,
        status: "skipped",
        error: reason,
        attempts: 0,
        nextRetryAt: null,
      });
    }
    return { ok: false, reason };
  }

  const result = await postImMessage(
    input.receiveId,
    input.receiveIdType,
    input.msgType,
    input.content,
  );

  if (db) {
    const { error } = await db.from("calendar_notification_logs").insert({
      kind: input.kind,
      receive_id: input.receiveId,
      receive_id_type: input.receiveIdType,
      recipient_name: input.recipientName,
      subject: input.subject,
      msg_type: input.msgType,
      content: input.content,
      related_id: input.relatedId ?? null,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.reason,
      attempts: 1,
      next_retry_at: result.ok ? null : nextRetryAt(1, now),
      sent_at: result.ok ? now.toISOString() : null,
    });
    if (error) console.warn("[notify] log insert failed", error.message);
  } else {
    recordToMemory({
      id: crypto.randomUUID(),
      at: now.toISOString(),
      kind: input.kind,
      recipientName: input.recipientName,
      subject: input.subject,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.reason,
      attempts: 1,
      nextRetryAt: null,
    });
  }

  return result;
}

/*
 * リトライ期限が到来した失敗通知を再送する。
 * 管理画面の再送ボタン・cron（/api/notifications/retry）から呼ぶ。
 */
export async function retryDueNotificationsAsync(): Promise<{
  targeted: number;
  delivered: number;
}> {
  const db = getSupabaseAdmin();
  if (!db) return { targeted: 0, delivered: 0 };

  const now = new Date();
  const { data, error } = await db
    .from("calendar_notification_logs")
    .select(
      "id, kind, receive_id, receive_id_type, recipient_name, subject, msg_type, content, status, error, attempts, next_retry_at, created_at",
    )
    .eq("status", "failed")
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", now.toISOString())
    .lt("attempts", MAX_ATTEMPTS)
    .order("next_retry_at", { ascending: true })
    .limit(50);

  if (error || !data) return { targeted: 0, delivered: 0 };

  let delivered = 0;
  for (const row of data as LogRow[]) {
    if (!row.receive_id || !row.content) continue;
    const receiveIdType = row.receive_id_type === "chat_id" ? "chat_id" : "open_id";
    const result = await postImMessage(
      row.receive_id,
      receiveIdType,
      row.msg_type,
      row.content,
    );
    const attempts = row.attempts + 1;
    const sentAt = new Date();
    await db
      .from("calendar_notification_logs")
      .update(
        result.ok
          ? {
              status: "sent",
              error: null,
              attempts,
              next_retry_at: null,
              sent_at: sentAt.toISOString(),
              updated_at: sentAt.toISOString(),
            }
          : {
              status: "failed",
              error: result.reason,
              attempts,
              next_retry_at: attempts < MAX_ATTEMPTS ? nextRetryAt(attempts, sentAt) : null,
              updated_at: sentAt.toISOString(),
            },
      )
      .eq("id", row.id);
    if (result.ok) delivered += 1;
  }

  return { targeted: data.length, delivered };
}

export async function listNotificationLogsAsync(
  limit = LOG_LIMIT,
): Promise<NotificationLogEntry[]> {
  const db = getSupabaseAdmin();
  if (!db) return [...memoryLog()];

  const { data, error } = await db
    .from("calendar_notification_logs")
    .select(
      "id, kind, receive_id, receive_id_type, recipient_name, subject, msg_type, content, status, error, attempts, next_retry_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [...memoryLog()];

  return (data as LogRow[]).map((row) => ({
    id: row.id,
    at: row.created_at,
    kind: row.kind,
    recipientName: row.recipient_name ?? "-",
    subject: row.subject,
    status: row.status,
    error: row.error,
    attempts: row.attempts,
    nextRetryAt: row.next_retry_at,
  }));
}
