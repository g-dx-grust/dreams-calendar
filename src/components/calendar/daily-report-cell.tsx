"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText } from "lucide-react";
import { submitDailyReportAction } from "@/app/calendar/daily-report-actions";
import { CompletedScheduleSummary } from "./completed-schedule-summary";
import type { DailyReport, Schedule } from "./types";

type Props = {
  userId: string;
  userName: string;
  reportDate: string; // YYYY-MM-DD
  initialReport: DailyReport | null;
  autoDraft?: string;
  completedSchedules: Schedule[];
  buttonLabel?: string;
};

export function DailyReportCell({
  userId,
  userName,
  reportDate,
  initialReport,
  autoDraft,
  completedSchedules,
  buttonLabel,
}: Props) {
  const resetKey = [
    userId,
    reportDate,
    initialReport?.id ?? "new",
    initialReport?.updatedAt.getTime() ?? 0,
    initialReport?.body ?? "",
    autoDraft ?? "",
    ...completedSchedules.map((schedule) =>
      [
        schedule.id,
        schedule.actualEndAt?.getTime() ?? 0,
        schedule.actualMinutes ?? 0,
        schedule.actualMemo ?? "",
      ].join(":"),
    ),
  ].join(":");

  return (
    <DailyReportCellContent
      key={resetKey}
      userId={userId}
      userName={userName}
      reportDate={reportDate}
      initialReport={initialReport}
      autoDraft={autoDraft}
      completedSchedules={completedSchedules}
      buttonLabel={buttonLabel}
    />
  );
}

function DailyReportCellContent({
  userId,
  userName,
  reportDate,
  initialReport,
  autoDraft,
  completedSchedules,
  buttonLabel,
}: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [body, setBody] = useState(initialReport?.body ?? "");
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(Boolean(initialReport));
  const [isPending, startTransition] = useTransition();

  function open() {
    setServerError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("reportDate", reportDate);
    fd.set("body", body);

    startTransition(async () => {
      const result = await submitDailyReportAction(fd);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setSubmitted(true);
      close();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        title={
          submitted
            ? `${userName} の日報（${reportDate}）— 提出済み`
            : `${userName} の日報を提出する（${reportDate}）`
        }
        aria-label={
          submitted
            ? `${userName} の日報を編集する`
            : `${userName} の日報を提出する`
        }
        className={
          submitted
            ? "inline-flex items-center justify-center gap-1 h-7 px-2 rounded-[var(--radius-s)] text-[12px] border border-[var(--color-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary)] hover:border-[var(--color-primary)]"
            : "inline-flex items-center justify-center gap-1 h-7 px-2 rounded-[var(--radius-s)] text-[12px] border border-[var(--color-border)] bg-white text-[var(--color-text-strong)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        }
      >
        {submitted ? <Check size={14} /> : <FileText size={14} />}
        <span>{buttonLabel ?? "日報"}</span>
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto rounded-[var(--radius-m)] border border-[var(--color-border)] p-0 backdrop:bg-black/40"
        style={{
          width:
            "min(calc(100vw - var(--space-m) - var(--space-m)), var(--width-daily-report-modal))",
          maxHeight: "calc(100dvh - var(--space-l) - var(--space-l))",
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onClose={() => setServerError(null)}
      >
        <form
          onSubmit={onSubmit}
          className="flex flex-col"
          style={{ maxHeight: "inherit" }}
        >
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <h2 className="text-[16px] font-bold text-[var(--color-text-strong)]">
              日報を{submitted ? "編集" : "提出"}する
            </h2>
            <p className="mt-1 text-[12px] text-[var(--color-text-mid)]">
              {userName}　{reportDate}
            </p>
          </div>

          <div className="px-5 py-4 overflow-auto">
            <div className="mb-4">
              <p className="mb-1.5 text-[13px] font-medium text-[var(--color-text-strong)]">
                完了した予定
              </p>
              <CompletedScheduleSummary
                schedules={completedSchedules}
                emptyLabel="完了した予定はまだありません。"
              />
            </div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="block text-[13px] text-[var(--color-text-strong)]">
                本文
              </label>
              {autoDraft ? (
                <button
                  type="button"
                  onClick={() => setBody(autoDraft)}
                  className="text-[12px] text-[var(--color-primary)] hover:underline"
                >
                  完了予定から作成
                </button>
              ) : null}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              required
              className="w-full px-3 py-2 text-[14px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-m)] placeholder:text-[var(--color-text-weak)] focus:border-[var(--color-primary)] focus:outline-none resize-y"
              placeholder="本日の業務内容、進捗、所感などを記入してください"
            />
            {serverError ? (
              <p
                role="alert"
                className="mt-2 text-[12px] text-[var(--color-danger)] border border-[var(--color-danger)] rounded-[var(--radius-s)] px-3 py-2"
              >
                {serverError}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-background)]">
            <button
              type="button"
              onClick={close}
              className="text-[13px] text-[var(--color-text-mid)] hover:text-[var(--color-text-strong)] px-3 py-2"
              disabled={isPending}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isPending || body.trim().length === 0}
              className="inline-flex items-center gap-1 h-9 px-4 text-[13px] font-medium bg-[var(--color-primary)] text-white rounded-[var(--radius-m)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? "送信中…" : submitted ? "更新する" : "提出する"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
