import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import { ScheduleForm } from "@/components/calendar/schedule-form";
import { listScheduleTypesAsync, listUsersAsync } from "@/lib/schedule-store";
import { getCurrentUserId } from "@/lib/self";
import { formatJstDate } from "@/lib/jst";
import { createScheduleAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewSchedulePage() {
  const session = await getSession();
  const users = await listUsersAsync();
  const types = await listScheduleTypesAsync();
  const selfUserId = await getCurrentUserId();

  // 初期値：今日の 9:00–10:00、自分が担当者
  const today = formatJstDate(new Date());

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        user={session}
        users={users}
        selfUserId={selfUserId}
        back="/calendar/new"
      />
      <main className="flex-1 px-6 py-5">
        <div className="mx-auto" style={{ maxWidth: "720px" }}>
          <h1 className="text-[18px] font-bold text-[var(--color-text-strong)] mb-4">
            予定を新規登録する
          </h1>
          <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-6">
            <ScheduleForm
              users={users}
              scheduleTypes={types}
              defaultValues={{
                userIds: selfUserId ? [selfUserId] : [],
                isAllDay: false,
                startDate: today,
                endDate: today,
                startTime: "09:00",
                endTime: "10:00",
              }}
              selfUserId={selfUserId}
              initialUserIds={selfUserId ? [selfUserId] : []}
              submitLabel="登録する"
              cancelHref="/calendar"
              action={createScheduleAction}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
