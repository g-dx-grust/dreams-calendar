import Link from "next/link";
import { notFound } from "next/navigation";
import { format, isSameDay } from "date-fns";
import { ja } from "date-fns/locale";
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
  const assignees = schedule.userIds
    .map((uid) => users.find((u) => u.id === uid))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));
  const type = types.find((t) => t.id === schedule.typeId);

  const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");
  const fmtTime = (d: Date) => format(d, "HH:mm");
  const fmtDateLabel = (d: Date) =>
    format(d, "yyyy年M月d日(EEE)", { locale: ja });

  const timeRange = (() => {
    const sameDay = isSameDay(schedule.startAt, schedule.endAt);
    const startDate = fmtDateLabel(schedule.startAt);
    const endDate = fmtDateLabel(schedule.endAt);
    const startTime = fmtTime(schedule.startAt);
    const endTime = fmtTime(schedule.endAt);
    return sameDay
      ? `${startDate} ${startTime} 〜 ${endTime}`
      : `${startDate} ${startTime} 〜 ${endDate} ${endTime}`;
  })();

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

          <div className="flex items-baseline justify-between mb-4">
            <h1 className="text-[18px] font-bold text-[var(--color-text-strong)]">
              予定の詳細
            </h1>
            <DeleteScheduleButton id={id} />
          </div>

          {/* 概要パネル */}
          <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-5 mb-5">
            <div className="flex items-center gap-2 mb-2">
              {type ? (
                <span
                  className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-[var(--radius-s)] border border-black/10"
                  style={{
                    background: type.color,
                    color: isLight(type.color) ? "#1F2329" : "#fff",
                  }}
                >
                  {type.name}
                </span>
              ) : null}
              {schedule.caseNumber ? (
                <span className="text-[12px] text-[var(--color-text-mid)]">
                  案件番号：{schedule.caseNumber}
                </span>
              ) : null}
            </div>
            <h2 className="text-[18px] font-bold text-[var(--color-text-strong)]">
              {schedule.title}
            </h2>
            <dl className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
              <div className="md:col-span-2">
                <dt className="text-[12px] text-[var(--color-text-mid)]">
                  担当者
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {assignees.length === 0 ? (
                    <span className="text-[14px] text-[var(--color-text-strong)]">
                      —
                    </span>
                  ) : (
                    assignees.map((u) => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] rounded-[var(--radius-s)] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                      >
                        <span className="font-medium">{u.name}</span>
                        {u.id === selfUserId ? (
                          <span className="text-[10px] px-1 rounded-[2px] bg-[var(--color-primary)] text-white">
                            自分
                          </span>
                        ) : null}
                      </span>
                    ))
                  )}
                </dd>
              </div>
              <Row label="場所" value={schedule.location ?? "—"} />
              <Row label="時間" value={timeRange} />
            </dl>
            {schedule.memo ? (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <div className="text-[12px] text-[var(--color-text-mid)] mb-1">
                  メモ
                </div>
                <p className="text-[14px] whitespace-pre-wrap text-[var(--color-text-strong)]">
                  {schedule.memo}
                </p>
              </div>
            ) : null}
          </div>

          {/* 編集フォーム */}
          <h2 className="text-[14px] font-bold text-[var(--color-text-strong)] mb-3">
            編集する
          </h2>
          <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-6">
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-[var(--color-text-mid)]">{label}</dt>
      <dd className="text-[14px] text-[var(--color-text-strong)]">{value}</dd>
    </div>
  );
}

function isLight(hex: string) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 186;
}
