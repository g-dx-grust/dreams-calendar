"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, startOfWeek, addDays, isToday } from "date-fns";
import { ja } from "date-fns/locale";
import type { CalendarUser, Schedule, ScheduleType } from "./types";
import { SchedulePopover } from "./schedule-popover";

const USER_COL_PX = 140;
const DAY_COL_MIN_PX = 160;

type Props = {
  date: Date;
  users: CalendarUser[];
  schedules: Schedule[];
  scheduleTypes: ScheduleType[];
};

function isLight(hex: string) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 186;
}

export function WeekView({ date, users, schedules, scheduleTypes }: Props) {
  const typeMap = useMemo(
    () => new Map(scheduleTypes.map((t) => [t.id, t])),
    [scheduleTypes],
  );
  // 表示する社員はページ側で確定済み
  const visibleUsers = users;
  const [popover, setPopover] = useState<{
    scheduleId: string;
    rect: DOMRect;
  } | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(date, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [date]);

  const indexed = useMemo(() => {
    // userId + yyyy-MM-dd → schedules（時刻昇順）
    const map = new Map<string, Schedule[]>();
    for (const s of schedules) {
      for (const uid of s.userIds) {
        const key = `${uid}|${format(s.startAt, "yyyy-MM-dd")}`;
        const list = map.get(key) ?? [];
        list.push(s);
        map.set(key, list);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    }
    return map;
  }, [schedules]);

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] overflow-hidden">
      <div className="overflow-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `${USER_COL_PX}px repeat(7, minmax(${DAY_COL_MIN_PX}px, 1fr))`,
          }}
        >
          {/* ヘッダー行 */}
          <div
            className="sticky top-0 left-0 z-30 bg-[var(--color-background)] border-b border-r border-[var(--color-border)] h-10 flex items-center px-3 text-[12px] text-[var(--color-text-mid)]"
          >
            社員
          </div>
          {days.map((d) => {
            const today = isToday(d);
            const dow = format(d, "EEEEE", { locale: ja }); // 1文字曜日
            return (
              <div
                key={d.toISOString()}
                className="sticky top-0 z-20 bg-[var(--color-background)] border-b border-r border-[var(--color-border)] h-10 flex items-center justify-between gap-2 px-3"
              >
                <Link
                  href={`/calendar?view=day&date=${format(d, "yyyy-MM-dd")}`}
                  className="text-[13px] font-medium hover:underline"
                  style={{
                    color: today
                      ? "var(--color-primary)"
                      : "var(--color-text-strong)",
                  }}
                >
                  {format(d, "M/d")}（{dow}）
                </Link>
                {today ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-[var(--radius-s)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    今日
                  </span>
                ) : null}
              </div>
            );
          })}

          {/* 各社員行 */}
          {visibleUsers.map((u) => (
            <div key={u.id} className="contents">
              <div
                className="sticky left-0 z-10 bg-white border-b border-r border-[var(--color-border)] flex items-center px-3 text-[13px] font-medium text-[var(--color-text-strong)] min-h-[88px]"
              >
                {u.name}
              </div>
              {days.map((d) => {
                const key = `${u.id}|${format(d, "yyyy-MM-dd")}`;
                const dayItems = indexed.get(key) ?? [];
                const today = isToday(d);
                return (
                  <div
                    key={key}
                    className="border-b border-r border-[var(--color-border)] p-1.5 min-h-[88px] space-y-1"
                    style={{
                      background: today ? "rgba(51,112,255,0.04)" : "white",
                    }}
                  >
                    {dayItems.length === 0 ? (
                      <div className="text-[11px] text-[var(--color-text-disabled)] text-center pt-2">
                        —
                      </div>
                    ) : (
                      dayItems.map((s) => {
                        const t = typeMap.get(s.typeId);
                        const bg = t?.color ?? "#646A73";
                        const fg = isLight(bg) ? "#1F2329" : "#fff";
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
                            className="block w-full text-left px-2 py-1 text-[11px] leading-tight border border-black/10 rounded-[var(--radius-s)] truncate cursor-pointer"
                            style={{ background: bg, color: fg }}
                            title={`${s.title}${s.caseNumber ? ` (${s.caseNumber})` : ""}`}
                          >
                            <span className="font-medium">
                              {format(s.startAt, "HH:mm")}
                            </span>{" "}
                            {s.title}
                          </button>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
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
