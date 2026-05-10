"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTransition } from "react";
import { format, isSameDay } from "date-fns";
import { ja } from "date-fns/locale";
import { Clock, MapPin, Pencil, Trash2, Users, X } from "lucide-react";
import type { CalendarUser, Schedule, ScheduleType } from "./types";
import { deleteScheduleAction } from "@/app/calendar/actions";

const POPOVER_WIDTH = 360;
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 8;

type Props = {
  schedule: Schedule;
  type: ScheduleType | undefined;
  assignees: CalendarUser[];
  anchorRect: DOMRect;
  onClose: () => void;
};

export function SchedulePopover({
  schedule,
  type,
  assignees,
  anchorRect,
  onClose,
}: Props) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [isDeleting, startDelete] = useTransition();

  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el) return;
    const measured = el.getBoundingClientRect();
    const height = measured.height || 280;

    const placeRight =
      anchorRect.right + ANCHOR_GAP + POPOVER_WIDTH + VIEWPORT_MARGIN <
      window.innerWidth;
    let left = placeRight
      ? anchorRect.right + ANCHOR_GAP
      : anchorRect.left - POPOVER_WIDTH - ANCHOR_GAP;
    let top = anchorRect.top;

    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN),
    );
    top = Math.max(
      VIEWPORT_MARGIN,
      Math.min(top, window.innerHeight - height - VIEWPORT_MARGIN),
    );
    setPos({ left, top });
  }, [anchorRect]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (popoverRef.current && target && !popoverRef.current.contains(target)) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [onClose]);

  const fmtTime = (d: Date) => format(d, "HH:mm");
  const fmtDateLabel = (d: Date) => format(d, "M月d日(EEE)", { locale: ja });
  const sameDay = isSameDay(schedule.startAt, schedule.endAt);
  const timeRange = sameDay
    ? `${fmtDateLabel(schedule.startAt)}　${fmtTime(schedule.startAt)} 〜 ${fmtTime(schedule.endAt)}`
    : `${fmtDateLabel(schedule.startAt)} ${fmtTime(schedule.startAt)} 〜 ${fmtDateLabel(schedule.endAt)} ${fmtTime(schedule.endAt)}`;

  function onDelete() {
    if (isDeleting) return;
    if (!confirm("この予定を削除します。よろしいですか？")) return;
    startDelete(async () => {
      await deleteScheduleAction(schedule.id);
      onClose();
    });
  }

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="予定の詳細"
      className="fixed z-50 bg-white border border-[var(--color-border)] rounded-[var(--radius-m)]"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        width: POPOVER_WIDTH,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-end gap-0.5 px-2 py-1.5 border-b border-[var(--color-border)]">
        <Link
          href={`/calendar/${schedule.id}`}
          aria-label="編集する"
          title="編集する"
          className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-s)] text-[var(--color-text-mid)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-strong)]"
        >
          <Pencil size={16} />
        </Link>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label="削除する"
          title="削除する"
          className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-s)] text-[var(--color-text-mid)] hover:bg-[var(--color-background)] hover:text-[var(--color-danger)] disabled:opacity-50"
        >
          <Trash2 size={16} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          title="閉じる"
          className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-s)] text-[var(--color-text-mid)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-strong)]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <span
            className="mt-1.5 inline-block w-2.5 h-2.5 rounded-full border border-black/10 shrink-0"
            style={{ background: type?.color ?? "#646A73" }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-[var(--color-text-strong)] break-words leading-snug">
              {schedule.title}
            </h3>
            {type || schedule.caseNumber ? (
              <p className="mt-1 text-[12px] text-[var(--color-text-mid)]">
                {type ? type.name : ""}
                {type && schedule.caseNumber ? "　" : ""}
                {schedule.caseNumber ? `案件番号 ${schedule.caseNumber}` : ""}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 space-y-2 text-[13px] text-[var(--color-text-strong)]">
          <Row icon={<Clock size={14} />} text={timeRange} />
          {schedule.location ? (
            <Row icon={<MapPin size={14} />} text={schedule.location} />
          ) : null}
          {assignees.length > 0 ? (
            <Row
              icon={<Users size={14} />}
              text={assignees.map((u) => u.name).join("、")}
            />
          ) : null}
        </div>

        {schedule.memo ? (
          <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
            <p className="text-[12px] text-[var(--color-text-mid)] mb-1">
              メモ
            </p>
            <p className="text-[13px] whitespace-pre-wrap break-words text-[var(--color-text-strong)]">
              {schedule.memo}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[var(--color-text-mid)] shrink-0 mt-0.5">
        {icon}
      </span>
      <span className="break-words">{text}</span>
    </div>
  );
}
