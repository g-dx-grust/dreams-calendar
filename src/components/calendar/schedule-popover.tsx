"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { differenceInMinutes } from "date-fns";
import {
  CheckCircle2,
  Clock,
  LinkIcon,
  MapPin,
  Pencil,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { CalendarUser, Schedule, ScheduleType } from "./types";
import {
  completeScheduleAction,
  deleteScheduleAction,
} from "@/app/calendar/actions";
import {
  formatJstDate,
  formatJstMonthDayLabel,
  formatJstTime,
  isSameJstDay,
  parseJstDateTime,
  toJstOffsetDateTime,
} from "@/lib/jst";
import { scheduleTypeBackground } from "./color-utils";

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
  const router = useRouter();
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [isCompleting, startComplete] = useTransition();
  const [isCompletionOpen, setIsCompletionOpen] = useState(false);
  const defaultActualEndAt = schedule.actualEndAt ?? schedule.endAt;
  const [actualEndDate, setActualEndDate] = useState(
    formatJstDate(defaultActualEndAt),
  );
  const [actualEndTime, setActualEndTime] = useState(
    formatJstTime(defaultActualEndAt),
  );
  const [actualMemo, setActualMemo] = useState(schedule.actualMemo ?? "");
  const [completionError, setCompletionError] = useState<string | null>(null);

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
  }, [anchorRect, isCompletionOpen]);

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

  const fmtTime = (d: Date) => formatJstTime(d);
  const fmtDateLabel = (d: Date) => formatJstMonthDayLabel(d);
  const sameDay = isSameJstDay(schedule.startAt, schedule.endAt);
  const timeRange = sameDay
    ? `${fmtDateLabel(schedule.startAt)}　${fmtTime(schedule.startAt)} 〜 ${fmtTime(schedule.endAt)}`
    : `${fmtDateLabel(schedule.startAt)} ${fmtTime(schedule.startAt)} 〜 ${fmtDateLabel(schedule.endAt)} ${fmtTime(schedule.endAt)}`;
  const caseParts: string[] = [];
  if (schedule.caseNumber) caseParts.push(`案件番号 ${schedule.caseNumber}`);
  if (schedule.caseName) caseParts.push(schedule.caseName);
  const caseLabel = caseParts.join("　");
  const kanriSystemUrl =
    process.env.NEXT_PUBLIC_KANRI_SYSTEM_URL?.replace(/\/+$/, "") ?? "";
  const caseHref =
    kanriSystemUrl && schedule.caseId
      ? `${kanriSystemUrl}/cases/${schedule.caseId}`
      : "";

  function onDelete() {
    if (isDeleting) return;
    if (!confirm("この予定を削除します。よろしいですか？")) return;
    startDelete(async () => {
      await deleteScheduleAction(schedule.id);
      onClose();
    });
  }

  function onComplete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCompleting) return;
    setCompletionError(null);
    const fd = new FormData();
    const actualEndAt = toJstOffsetDateTime(actualEndDate, actualEndTime);
    if (!actualEndAt) {
      setCompletionError("作業終了が不正です");
      return;
    }
    fd.set("actualEndAt", actualEndAt);
    if (actualMemo.trim()) fd.set("actualMemo", actualMemo.trim());

    startComplete(async () => {
      const result = await completeScheduleAction(schedule.id, fd);
      if (!result.ok) {
        setCompletionError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const actualStartAt = schedule.actualStartAt ?? schedule.startAt;
  const parsedActualEndAt = parseJstDateTime(actualEndDate, actualEndTime);
  const previewMinutes = !parsedActualEndAt
    ? null
    : differenceInMinutes(parsedActualEndAt, actualStartAt);

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
        maxHeight: "calc(100dvh - 16px)",
        overflowY: "auto",
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-end gap-0.5 px-2 py-1.5 border-b border-[var(--color-border)]">
        {schedule.isMasked ? (
          <span className="mr-auto pl-2 text-[12px] text-[var(--color-text-mid)]">
            非公開の予定（詳細は担当者のみ）
          </span>
        ) : null}
        {!schedule.isMasked && schedule.status !== "done" ? (
          <button
            type="button"
            onClick={() => {
              setIsCompletionOpen((value) => !value);
              setCompletionError(null);
            }}
            aria-label="完了する"
            title="完了する"
            className="inline-flex items-center justify-center gap-1 h-8 px-2 rounded-[var(--radius-s)] text-[12px] text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] disabled:opacity-50"
          >
            <CheckCircle2 size={15} />
            完了
          </button>
        ) : null}
        {!schedule.isMasked ? (
          <Link
            href={`/calendar/${schedule.id}`}
            aria-label="編集する"
            title="編集する"
            className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-s)] text-[var(--color-text-mid)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-strong)]"
          >
            <Pencil size={16} />
          </Link>
        ) : null}
        {!schedule.isMasked ? (
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
        ) : null}
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
            style={{ background: scheduleTypeBackground(type?.color ?? "text-grey") }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-[var(--color-text-strong)] break-words leading-snug">
              {schedule.title}
            </h3>
            {type || caseLabel ? (
              <p className="mt-1 text-[12px] text-[var(--color-text-mid)]">
                {type ? type.name : ""}
                {type && caseLabel ? "　" : ""}
                {caseLabel && caseHref ? (
                  <Link
                    href={caseHref}
                    className="text-[var(--color-primary)] hover:underline"
                  >
                    {caseLabel}
                  </Link>
                ) : (
                  caseLabel
                )}
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
          {schedule.onlineMeetingUrl ? (
            <LinkRow href={schedule.onlineMeetingUrl} text="会議URLを開く" />
          ) : null}
        </div>

        {isCompletionOpen ? (
          <form
            onSubmit={onComplete}
            className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-2"
          >
            <div>
              <p className="text-[12px] font-medium text-[var(--color-text-strong)]">
                作業時間（実施時間）
              </p>
              <p className="text-[12px] text-[var(--color-text-mid)]">
                予定 {fmtTime(schedule.startAt)}〜{fmtTime(schedule.endAt)}
              </p>
            </div>
            <label className="block space-y-1">
              <span className="block text-[12px] text-[var(--color-text-mid)]">
                作業終了日
              </span>
              <input
                type="date"
                value={actualEndDate}
                onChange={(event) => setActualEndDate(event.target.value)}
                required
                className="h-9 w-full px-3 text-[14px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-s)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </label>
            <label className="block space-y-1">
              <span className="block text-[12px] text-[var(--color-text-mid)]">
                作業終了
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={actualEndTime}
                onChange={(event) => setActualEndTime(event.target.value)}
                pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$"
                placeholder="17:30"
                required
                className="h-9 w-full px-3 text-[14px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-s)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </label>
            <label className="block space-y-1">
              <span className="block text-[12px] text-[var(--color-text-mid)]">
                作業メモ
              </span>
              <textarea
                value={actualMemo}
                onChange={(event) => setActualMemo(event.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-[13px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-s)] placeholder:text-[var(--color-text-weak)] focus:border-[var(--color-primary)] focus:outline-none resize-y"
                placeholder="早く完了できた理由など"
              />
            </label>
            {previewMinutes && previewMinutes > 0 ? (
              <p className="text-[12px] text-[var(--color-text-mid)]">
                作業時間 {formatWorkMinutes(previewMinutes)}
              </p>
            ) : null}
            {completionError ? (
              <p
                role="alert"
                className="text-[12px] text-[var(--color-danger)] border border-[var(--color-danger)] rounded-[var(--radius-s)] px-2 py-1"
              >
                {completionError}
              </p>
            ) : null}
            <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-[var(--color-border)] bg-white px-4 py-2">
              <button
                type="button"
                onClick={() => setIsCompletionOpen(false)}
                disabled={isCompleting}
                className="h-8 px-3 text-[12px] text-[var(--color-text-mid)] hover:text-[var(--color-text-strong)]"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isCompleting}
                className="inline-flex h-8 items-center rounded-[var(--radius-s)] bg-[var(--color-primary)] px-3 text-[12px] font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
              >
                {isCompleting ? "保存中…" : "完了する"}
              </button>
            </div>
          </form>
        ) : null}

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
        {schedule.actualMemo ? (
          <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
            <p className="text-[12px] text-[var(--color-text-mid)] mb-1">
              作業メモ
            </p>
            <p className="text-[13px] whitespace-pre-wrap break-words text-[var(--color-text-strong)]">
              {schedule.actualMemo}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatWorkMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}

function LinkRow({ href, text }: { href: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[var(--color-text-mid)] shrink-0 mt-0.5">
        <LinkIcon size={14} />
      </span>
      <Link
        href={href}
        className="break-all text-[var(--color-primary)] hover:underline"
      >
        {text}
      </Link>
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
