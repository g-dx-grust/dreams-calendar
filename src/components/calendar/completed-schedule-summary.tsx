import { differenceInMinutes, format, isSameDay } from "date-fns";
import type { Schedule } from "./types";

type Props = {
  schedules: Schedule[];
  emptyLabel?: string;
};

export function CompletedScheduleSummary({ schedules, emptyLabel }: Props) {
  const doneSchedules = schedules
    .filter((schedule) => schedule.status === "done")
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  if (doneSchedules.length === 0) {
    return emptyLabel ? (
      <p className="text-[12px] text-[var(--color-text-mid)]">{emptyLabel}</p>
    ) : null;
  }

  return (
    <ul className="space-y-2">
      {doneSchedules.map((schedule) => (
        <li
          key={schedule.id}
          className="border border-[var(--color-border)] rounded-[var(--radius-s)] bg-white px-3 py-2"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] font-medium text-[var(--color-text-strong)]">
              {schedule.title}
            </p>
            {schedule.caseNumber ? (
              <span className="text-[12px] text-[var(--color-text-mid)]">
                {schedule.caseNumber}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[12px] text-[var(--color-text-mid)]">
            予定 {formatTimeRange(schedule.startAt, schedule.endAt)}
          </p>
          <p
            className={
              "mt-0.5 text-[12px] " +
              (isLate(schedule)
                ? "text-[var(--color-danger)]"
                : "text-[var(--color-primary)]")
            }
          >
            作業時間（実施時間） {formatActualRange(schedule)}
            {formatDiff(schedule)}
          </p>
          {schedule.actualMemo ? (
            <p className="mt-1 text-[12px] text-[var(--color-text-strong)] whitespace-pre-wrap break-words">
              作業メモ：{schedule.actualMemo}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function formatTimeRange(startAt: Date, endAt: Date) {
  if (isSameDay(startAt, endAt)) {
    return `${format(startAt, "HH:mm")}〜${format(endAt, "HH:mm")}`;
  }
  return `${format(startAt, "M/d HH:mm")}〜${format(endAt, "M/d HH:mm")}`;
}

function actualMinutes(schedule: Schedule) {
  if (schedule.actualMinutes && schedule.actualMinutes > 0) {
    return schedule.actualMinutes;
  }
  if (!schedule.actualEndAt) return null;
  const startAt = schedule.actualStartAt ?? schedule.startAt;
  const minutes = differenceInMinutes(schedule.actualEndAt, startAt);
  return minutes > 0 ? minutes : null;
}

function plannedMinutes(schedule: Schedule) {
  return Math.max(0, differenceInMinutes(schedule.endAt, schedule.startAt));
}

function isLate(schedule: Schedule) {
  const actual = actualMinutes(schedule);
  if (actual == null) return false;
  return actual > plannedMinutes(schedule);
}

function formatActualRange(schedule: Schedule) {
  const startAt = schedule.actualStartAt ?? schedule.startAt;
  const endAt = schedule.actualEndAt;
  const minutes = actualMinutes(schedule);
  const minutesLabel = minutes == null ? "" : `（${formatMinutes(minutes)}）`;
  if (!endAt) return minutesLabel || "未入力";
  return `${formatTimeRange(startAt, endAt)}${minutesLabel}`;
}

function formatDiff(schedule: Schedule) {
  const actual = actualMinutes(schedule);
  if (actual == null) return "";
  const diff = actual - plannedMinutes(schedule);
  if (diff === 0) return "　予定どおり";
  return `　予定差：${diff > 0 ? "+" : "-"}${formatMinutes(Math.abs(diff))}`;
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}
