import { Bell, CheckCircle2, AlertTriangle, MinusCircle } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import { AdminNav } from "@/components/admin/admin-nav";
import {
  listNotificationLogsAsync,
  type NotificationLogEntry,
} from "@/lib/notification-log-store";
import { formatJstSlashDateTime } from "@/lib/jst";
import { RetryNotificationsButton } from "@/components/admin/retry-notifications-button";
import { retryFailedNotificationsAction } from "./actions";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  invitation: "予定招待",
  schedule_changed: "予定変更",
  daily_report: "日報提出",
  daily_report_reply: "日報返信",
};

export default async function NotificationsPage() {
  const [session, items] = await Promise.all([
    getSession(),
    listNotificationLogsAsync(),
  ]);
  const retryableCount = items.filter(
    (item) => item.status === "failed" && item.nextRetryAt !== null,
  ).length;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader user={session} />
      <main className="flex-1 px-6 py-5">
        <div
          className="mx-auto"
          style={{ maxWidth: "var(--width-content-max)" }}
        >
          <h1 className="text-[18px] font-bold text-[var(--color-text-strong)] mb-4">
            管理画面
          </h1>
          <AdminNav active="/admin/notifications" />

          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-[var(--color-primary)]" />
              <h2 className="text-[16px] font-bold text-[var(--color-text-strong)]">
                Lark 通知ログ
              </h2>
            </div>
            <RetryNotificationsButton
              action={retryFailedNotificationsAction}
              disabled={retryableCount === 0}
            />
          </div>
          <p className="text-[13px] text-[var(--color-text-mid)] mb-4">
            予定招待や日報提出で送信した通知の履歴です（最新 100 件）。
            送信に失敗した通知は 5分後・15分後・60分後に自動で再送されます。
          </p>

          <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--color-background)] border-b border-[var(--color-border)]">
                <tr>
                  <Th>日時</Th>
                  <Th>種別</Th>
                  <Th>宛先</Th>
                  <Th>件名</Th>
                  <Th>結果</Th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-[var(--color-text-weak)]"
                    >
                      まだ通知履歴はありません。予定招待または日報提出を行うと記録されます。
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr
                      key={it.id}
                      className="border-b border-[var(--color-border)] last:border-b-0"
                    >
                      <Td>
                        <span className="text-[12px] text-[var(--color-text-mid)] font-mono">
                          {formatJstSlashDateTime(new Date(it.at))}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[12px] text-[var(--color-text-mid)]">
                          {KIND_LABELS[it.kind] ?? it.kind}
                        </span>
                      </Td>
                      <Td>{it.recipientName}</Td>
                      <Td>
                        <span className="text-[var(--color-text-strong)]">
                          {it.subject}
                        </span>
                      </Td>
                      <Td>
                        <StatusCell item={it} />
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusCell({ item }: { item: NotificationLogEntry }) {
  if (item.status === "sent") {
    return (
      <span className="inline-flex items-center gap-1 text-[var(--color-success)]">
        <CheckCircle2 size={14} />
        送信済み
      </span>
    );
  }
  if (item.status === "skipped") {
    return (
      <span className="inline-flex items-center gap-1 text-[var(--color-text-mid)]">
        <MinusCircle size={14} />
        送信対象外
        {item.error ? (
          <span className="text-[11px] text-[var(--color-text-mid)] ml-1">
            （{item.error}）
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[var(--color-warning)]">
      <AlertTriangle size={14} />
      {item.nextRetryAt ? `失敗（再送予定・${item.attempts}回目）` : "失敗"}
      {item.error ? (
        <span className="text-[11px] text-[var(--color-text-mid)] ml-1">
          （{item.error}）
        </span>
      ) : null}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-[12px] font-medium text-[var(--color-text-mid)] text-left">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5">{children}</td>;
}
