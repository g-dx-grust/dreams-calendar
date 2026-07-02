import { CheckCircle2 } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { NotificationSettingsForm } from "@/components/admin/notification-settings-form";
import { getNotificationSettingsAsync } from "@/lib/calendar-settings-store";
import { listBotChatsAsync } from "@/lib/lark/chats";
import { updateNotificationSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ saved?: string }>;

export default async function NotificationSettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const [session, settings, botChats] = await Promise.all([
    getSession(),
    getNotificationSettingsAsync(),
    listBotChatsAsync(),
  ]);

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
          <AdminNav active="/admin/notification-settings" />

          <h2 className="text-[16px] font-bold text-[var(--color-text-strong)] mb-3">
            Lark通知設定
          </h2>
          <p className="text-[13px] text-[var(--color-text-mid)] mb-4">
            日報が提出されたときに通知を送るLarkグループチャットを設定します。
            <br />
            設定はデータベースに保存され、即時反映されます。
          </p>

          {sp.saved ? (
            <div
              role="status"
              className="mb-4 flex items-center gap-2 text-[13px] text-[var(--color-primary)] bg-[var(--color-primary-soft)] border border-[var(--color-primary)] rounded-[var(--radius-s)] px-3 py-2"
            >
              <CheckCircle2 size={14} />
              設定を保存しました。
            </div>
          ) : null}

          <div className="max-w-[640px] bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-6">
            <NotificationSettingsForm
              defaultValues={{
                dailyReportChatId: settings.dailyReportChatId ?? "",
                dailyReportChatName: settings.dailyReportChatName ?? "",
                dailyReportDmAdmins: settings.dailyReportDmAdmins,
              }}
              botChats={botChats.ok ? botChats.chats : []}
              botChatsError={botChats.ok ? null : botChats.reason}
              cancelHref="/admin"
              action={updateNotificationSettingsAction}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
