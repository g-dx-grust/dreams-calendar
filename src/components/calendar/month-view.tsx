"use client";

import { useState } from "react";
import Link from "next/link";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isToday,
} from "date-fns";
import { ja } from "date-fns/locale";
import type { CalendarUser, Schedule, ScheduleType } from "./types";
import { SchedulePopover } from "./schedule-popover";
import {
  scheduleTypeBackground,
  scheduleTypeForeground,
} from "./color-utils";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const MAX_VISIBLE_PER_DAY = 3;

type Props = {
  date: Date;
  users: CalendarUser[];
  schedules: Schedule[];
  scheduleTypes: ScheduleType[];
};

export function MonthView({ date, users, schedules, scheduleTypes }: Props) {
  const [popover, setPopover] = useState<{
    scheduleId: string;
    rect: DOMRect;
  } | null>(null);
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  // グリッドの全日付（5 or 6 週分）
  const days: Date[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const typeMap = new Map(scheduleTypes.map((t) => [t.id, t]));

  // yyyy-MM-dd → schedules
  const byDay = new Map<string, Schedule[]>();
  for (const s of schedules) {
    const key = format(s.startAt, "yyyy-MM-dd");
    const list = byDay.get(key) ?? [];
    list.push(s);
    byDay.set(key, list);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] overflow-hidden">
      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-background)]">
        {DAY_LABELS.map((d, i) => (
          <div
            key={d}
            className="px-3 py-2 text-[12px] font-medium text-[var(--color-text-mid)] text-center border-r border-[var(--color-border)] last:border-r-0"
            style={
              i === 0
                ? { color: "var(--color-danger)" }
                : i === 6
                  ? { color: "var(--color-primary)" }
                  : undefined
            }
          >
            {d}
          </div>
        ))}
      </div>

      {/* 月グリッド */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((d) => {
          const inMonth = isSameMonth(d, date);
          const today = isToday(d);
          const key = format(d, "yyyy-MM-dd");
          const items = byDay.get(key) ?? [];
          const visible = items.slice(0, MAX_VISIBLE_PER_DAY);
          const hidden = items.length - visible.length;
          const dow = d.getDay();
          const dateColor =
            !inMonth
              ? "var(--color-text-disabled)"
              : today
                ? "var(--color-primary)"
                : dow === 0
                  ? "var(--color-danger)"
                  : dow === 6
                    ? "var(--color-primary)"
                    : "var(--color-text-strong)";

          return (
            <div
              key={key}
              className="border-b border-r border-[var(--color-border)] last-of-type:border-r min-h-[110px] p-1.5 space-y-1"
              style={{
                background: today
                  ? "rgba(51,112,255,0.04)"
                  : inMonth
                    ? "white"
                    : "var(--color-background)",
              }}
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/calendar?view=day&date=${key}`}
                  className="text-[12px] font-medium hover:underline"
                  style={{ color: dateColor }}
                >
                  {format(d, "d")}
                </Link>
                {today ? (
                  <span className="text-[10px] px-1.5 rounded-[var(--radius-s)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    今日
                  </span>
                ) : null}
              </div>
              <div className="space-y-0.5">
                {visible.map((s) => {
                  const t = typeMap.get(s.typeId);
                  const rawColor = t?.color ?? "text-grey";
                  const bg = scheduleTypeBackground(rawColor);
                  const fg = scheduleTypeForeground(rawColor);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPopover({
                          scheduleId: s.id,
                          rect: e.currentTarget.getBoundingClientRect(),
                        });
                      }}
                      className="block w-full text-left px-1.5 py-0.5 text-[11px] leading-tight rounded-[var(--radius-s)] border border-black/10 truncate cursor-pointer"
                      style={{ background: bg, color: fg }}
                      title={`${s.title}${s.caseNumber ? ` (${s.caseNumber})` : ""}`}
                    >
                      <span className="font-medium">
                        {format(s.startAt, "HH:mm")}
                      </span>{" "}
                      {s.title}
                    </button>
                  );
                })}
                {hidden > 0 ? (
                  <Link
                    href={`/calendar?view=day&date=${key}`}
                    className="block text-[10px] text-[var(--color-text-mid)] hover:text-[var(--color-primary)] px-1.5"
                  >
                    他 {hidden} 件
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {popover
        ? (() => {
            const target = schedules.find((s) => s.id === popover.scheduleId);
            if (!target) return null;
            const assignees = target.userIds
              .map((uid) => users.find((u) => u.id === uid))
              .filter((u): u is CalendarUser => Boolean(u));
            return (
              <SchedulePopover
                schedule={target}
                type={typeMap.get(target.typeId)}
                assignees={assignees}
                anchorRect={popover.rect}
                onClose={() => setPopover(null)}
              />
            );
          })()
        : null}
    </div>
  );
}
