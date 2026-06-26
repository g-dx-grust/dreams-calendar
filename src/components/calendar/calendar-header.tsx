"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  addJstDays,
  addJstMonths,
  formatJstDate,
  formatJstDateJa,
  formatJstYearMonth,
  jstWeekday,
  parseJstDate,
  startOfJstWeek,
} from "@/lib/jst";
import { cn } from "@/lib/utils";

export type CalendarView = "day" | "week" | "month";

type Props = {
  view: CalendarView;
  date: Date;
};

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "day", label: "日" },
  { key: "week", label: "週" },
  { key: "month", label: "月" },
];

function fmtDate(d: Date) {
  return formatJstDate(d);
}

function periodTitle(view: CalendarView, date: Date) {
  if (view === "day") {
    return `${formatJstDateJa(date)}（${jstWeekday(date)}）`;
  }
  if (view === "week") {
    const s = startOfJstWeek(date);
    const e = addJstDays(s, 6);
    return `${formatJstDateJa(s)} 〜 ${formatJstDateJa(e).replace(/^\d+年/, "")}`;
  }
  return formatJstYearMonth(date);
}

function shift(view: CalendarView, date: Date, dir: -1 | 1): Date {
  if (view === "day") return addJstDays(date, dir);
  if (view === "week") return addJstDays(date, dir * 7);
  return addJstMonths(date, dir);
}

function buildUrl(view: CalendarView, date: Date) {
  return `/calendar?view=${view}&date=${fmtDate(date)}`;
}

export function CalendarHeader({ view, date }: Props) {
  const router = useRouter();
  const today = new Date();

  return (
    <div className="mb-4 space-y-4">
      {/* タイトル + 追加ボタン */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[22px] font-bold leading-tight text-[var(--color-text-strong)]">
              {periodTitle(view, date)}
            </h1>
            <Link
              href={buildUrl(view, today)}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              今日
            </Link>
          </div>
        </div>
        <Link
          href={`${buildUrl(view, date)}&new=1`}
          className={cn(buttonVariants({ variant: "primary", size: "md" }))}
        >
          <Plus size={16} />
          予定を追加する
        </Link>
      </div>

      {/* ビュー切替 + 日付ナビ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 左：ビュータブ */}
        <div className="inline-flex border border-[var(--color-border)] rounded-[var(--radius-m)] overflow-hidden">
          {VIEWS.map((v, i) => {
            const active = v.key === view;
            return (
              <Link
                key={v.key}
                href={buildUrl(v.key, date)}
                className={cn(
                  "px-4 h-9 inline-flex items-center text-[13px] font-medium",
                  active
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-white text-[var(--color-text-strong)] hover:bg-[var(--color-background)]",
                  i > 0 ? "border-l border-[var(--color-border)]" : "",
                )}
              >
                {v.label}
              </Link>
            );
          })}
        </div>

        {/* 右：前/今日/次 + 日付ピッカー */}
        <div className="flex items-center gap-2">
          <Link
            href={buildUrl(view, shift(view, date, -1))}
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "h-10 w-10 px-0",
            )}
            aria-label="前へ"
          >
            <ChevronLeft size={16} />
          </Link>
          <Link
            href={buildUrl(view, shift(view, date, 1))}
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "h-10 w-10 px-0",
            )}
            aria-label="次へ"
          >
            <ChevronRight size={16} />
          </Link>
          <input
            type="date"
            value={fmtDate(date)}
            onChange={(e) => {
              if (!e.target.value) return;
              const parsed = parseJstDate(e.target.value);
              if (parsed) router.push(buildUrl(view, parsed));
            }}
            className="h-10 px-3 text-[13px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-m)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
