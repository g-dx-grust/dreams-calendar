import { CheckCircle2 } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { CalendarSettingsForm } from "@/components/admin/calendar-settings-form";
import { getCalendarSettings } from "@/lib/calendar-settings-store";
import { updateCalendarSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ saved?: string }>;

export default async function CalendarSettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const settings = getCalendarSettings();

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
          <AdminNav active="/admin/calendar-settings" />

          <h2 className="text-[16px] font-bold text-[var(--color-text-strong)] mb-3">
            カレンダー表示時間帯
          </h2>
          <p className="text-[13px] text-[var(--color-text-mid)] mb-4">
            日表示カレンダーの時間軸の範囲を設定します。
            <br />
            例：08:00 〜 18:00 のみ表示する／00:00 〜 24:00 を 1 日全体表示する 等。
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
            <CalendarSettingsForm
              defaultValues={{
                startHour: settings.startHour,
                endHour: settings.endHour,
              }}
              cancelHref="/admin"
              action={updateCalendarSettingsAction}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
