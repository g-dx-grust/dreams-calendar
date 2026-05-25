import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import { ScheduleForm } from "@/components/calendar/schedule-form";
import { DeleteScheduleButton } from "@/components/calendar/delete-button";
import {
  getSchedule,
  listScheduleTypes,
  listUsers,
} from "@/lib/schedule-store";
import { getCurrentUserId } from "@/lib/self";
import { updateScheduleAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const schedule = getSchedule(id);
  if (!schedule) notFound();

  const session = await getSession();
  const users = listUsers();
  const types = listScheduleTypes();
  const selfUserId = await getCurrentUserId();

  const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");
  const fmtTime = (d: Date) => format(d, "HH:mm");

  const update = updateScheduleAction.bind(null, id);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        user={session}
        users={users}
        selfUserId={selfUserId}
        back={`/calendar/${id}`}
      />
      <main className="flex-1 px-6 py-5">
        <div className="mx-auto" style={{ maxWidth: "720px" }}>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--color-text-mid)] hover:text-[var(--color-text-strong)] mb-3"
          >
            <ChevronLeft size={14} />
            カレンダーへ戻る
          </Link>

          <div className="flex items-baseline justify-between mb-3">
            <h1 className="text-[18px] font-bold text-[var(--color-text-strong)]">
              予定を編集
            </h1>
            <DeleteScheduleButton id={id} />
          </div>

          <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-5">
            <ScheduleForm
              users={users}
              scheduleTypes={types}
              defaultValues={{
                title: schedule.title,
                userIds: schedule.userIds,
                typeId: schedule.typeId,
                isAllDay: schedule.isAllDay,
                startDate: fmtDate(schedule.startAt),
                endDate: fmtDate(schedule.endAt),
                startTime: fmtTime(schedule.startAt),
                endTime: fmtTime(schedule.endAt),
                caseNumber: schedule.caseNumber ?? "",
                location: schedule.location ?? "",
                memo: schedule.memo ?? "",
              }}
              selfUserId={selfUserId}
              initialUserIds={schedule.userIds}
              submitLabel="変更を保存する"
              cancelHref="/calendar"
              action={update}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
