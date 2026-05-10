"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, addDays, addMonths, startOfWeek, endOfWeek } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
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
  return format(d, "yyyy-MM-dd");
}

function periodTitle(view: CalendarView, date: Date) {
  if (view === "day") {
    return format(date, "yyyy年M月d日(EEE)", { locale: ja });
  }
  if (view === "week") {
    const s = startOfWeek(date, { weekStartsOn: 0 });
    const e = endOfWeek(date, { weekStartsOn: 0 });
    return `${format(s, "yyyy年M月d日", { locale: ja })} 〜 ${format(e, "M月d日", { locale: ja })}`;
  }
  return format(date, "yyyy年M月", { locale: ja });
}

function shift(view: CalendarView, date: Date, dir: -1 | 1): Date {
  if (view === "day") return addDays(date, dir);
  if (view === "week") return addDays(date, dir * 7);
  return addMonths(date, dir);
}

function buildUrl(view: CalendarView, date: Date) {
  return `/calendar?view=${view}&date=${fmtDate(date)}`;
}

export function CalendarHeader({ view, date }: Props) {
  const router = useRouter();
  const today = new Date();

  return (
    <div className="space-y-3 mb-4">
      {/* タイトル + 追加ボタン */}
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--color-text-strong)]">
            {periodTitle(view, date)}
          </h1>
          <p className="text-[12px] text-[var(--color-text-weak)] mt-0.5">
            モックデータを表示中（Phase 1 / DB 接続前）
          </p>
        </div>
        <Link
          href="/calendar/new"
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
              "px-2",
            )}
            aria-label="前へ"
          >
            <ChevronLeft size={16} />
          </Link>
          <Link
            href={buildUrl(view, today)}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            今日
          </Link>
          <Link
            href={buildUrl(view, shift(view, date, 1))}
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "px-2",
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
              router.push(buildUrl(view, new Date(e.target.value)));
            }}
            className="h-8 px-2 text-[13px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-s)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
