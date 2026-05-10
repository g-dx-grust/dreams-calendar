"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteDailyReportReplyAction,
  postDailyReportReplyAction,
  updateDailyReportReplyAction,
} from "@/app/calendar/daily-report-actions";
import type { CalendarUser, DailyReportReply } from "./types";

type Props = {
  reportId: string;
  reportUserId: string;
  reportDate: string;
  initialReplies: DailyReportReply[];
  currentUserId: string | null;
  users: CalendarUser[];
};

export function DailyReportThread({
  reportId,
  reportUserId,
  reportDate,
  initialReplies,
  currentUserId,
  users,
}: Props) {
  const [replies, setReplies] = useState<DailyReportReply[]>(initialReplies);
  const userMap = new Map(users.map((u) => [u.id, u] as const));

  return (
    <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
      {replies.length > 0 ? (
        <>
          <p className="text-[12px] text-[var(--color-text-mid)] mb-1.5">
            返信 {replies.length} 件
          </p>
          <ul className="space-y-1.5 mb-2">
            {replies.map((r) => (
              <ReplyItem
                key={r.id}
                reply={r}
                authorName={userMap.get(r.userId)?.name ?? "（不明なユーザー）"}
                isOwn={Boolean(currentUserId) && r.userId === currentUserId}
                onUpdated={(updated) =>
                  setReplies((prev) =>
                    prev.map((x) => (x.id === updated.id ? updated : x)),
                  )
                }
                onDeleted={() =>
                  setReplies((prev) => prev.filter((x) => x.id !== r.id))
                }
              />
            ))}
          </ul>
        </>
      ) : null}
      {currentUserId ? (
        <ReplyForm
          reportId={reportId}
          reportUserId={reportUserId}
          reportDate={reportDate}
          authorUserId={currentUserId}
          onPosted={(reply) => setReplies((prev) => [...prev, reply])}
        />
      ) : (
        <p className="text-[12px] text-[var(--color-text-mid)]">
          返信するにはログインが必要です。
        </p>
      )}
    </div>
  );
}

function ReplyItem({
  reply,
  authorName,
  isOwn,
  onUpdated,
  onDeleted,
}: {
  reply: DailyReportReply;
  authorName: string;
  isOwn: boolean;
  onUpdated: (updated: DailyReportReply) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reply.body);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSave() {
    setError(null);
    const fd = new FormData();
    fd.set("replyId", reply.id);
    fd.set("authorUserId", reply.userId);
    fd.set("body", draft);
    startTransition(async () => {
      const result = await updateDailyReportReplyAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onUpdated({ ...reply, body: draft, updatedAt: new Date() });
      setEditing(false);
    });
  }

  function onDelete() {
    if (!confirm("この返信を削除します。よろしいですか？")) return;
    setError(null);
    const fd = new FormData();
    fd.set("replyId", reply.id);
    fd.set("authorUserId", reply.userId);
    startTransition(async () => {
      const result = await deleteDailyReportReplyAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDeleted();
    });
  }

  const stamp = format(reply.updatedAt, "M/d(EEE) HH:mm", { locale: ja });
  const edited = reply.updatedAt.getTime() !== reply.createdAt.getTime();

  return (
    <li className="border border-[var(--color-border)] rounded-[var(--radius-s)] bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] text-[var(--color-text-mid)]">
          <span className="font-medium text-[var(--color-text-strong)]">
            {authorName}
          </span>
          <span className="ml-2">
            {stamp}
            {edited ? "（編集済み）" : ""}
          </span>
        </div>
        {isOwn && !editing ? (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                setDraft(reply.body);
                setEditing(true);
              }}
              aria-label="編集する"
              title="編集する"
              disabled={isPending}
              className="inline-flex items-center justify-center w-7 h-7 rounded-[var(--radius-s)] text-[var(--color-text-mid)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-strong)] disabled:opacity-50"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="削除する"
              title="削除する"
              disabled={isPending}
              className="inline-flex items-center justify-center w-7 h-7 rounded-[var(--radius-s)] text-[var(--color-text-mid)] hover:bg-[var(--color-background)] hover:text-[var(--color-danger)] disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 text-[13px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-s)] focus:border-[var(--color-primary)] focus:outline-none resize-y"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(reply.body);
                setError(null);
              }}
              disabled={isPending}
              className="text-[12px] text-[var(--color-text-mid)] hover:text-[var(--color-text-strong)] px-2 py-1"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isPending || draft.trim().length === 0}
              className="inline-flex items-center h-8 px-3 text-[12px] font-medium bg-[var(--color-primary)] text-white rounded-[var(--radius-s)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? "保存中…" : "保存する"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-[13px] text-[var(--color-text-strong)] whitespace-pre-wrap break-words">
          {reply.body}
        </p>
      )}
      {error ? (
        <p
          role="alert"
          className="mt-2 text-[12px] text-[var(--color-danger)] border border-[var(--color-danger)] rounded-[var(--radius-s)] px-2 py-1"
        >
          {error}
        </p>
      ) : null}
    </li>
  );
}

function ReplyForm({
  reportId,
  reportUserId,
  reportDate,
  authorUserId,
  onPosted,
}: {
  reportId: string;
  reportUserId: string;
  reportDate: string;
  authorUserId: string;
  onPosted: (reply: DailyReportReply) => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("reportId", reportId);
    fd.set("reportUserId", reportUserId);
    fd.set("reportDate", reportDate);
    fd.set("authorUserId", authorUserId);
    fd.set("body", body);

    startTransition(async () => {
      const result = await postDailyReportReplyAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const now = new Date();
      onPosted({
        id: crypto.randomUUID(),
        reportId,
        userId: authorUserId,
        body,
        createdAt: now,
        updatedAt: now,
      });
      setBody("");
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (body.trim().length === 0 || isPending) return;
      const form = e.currentTarget.form;
      form?.requestSubmit();
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="flex items-stretch gap-1.5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          className="flex-1 min-w-0 px-2 py-1.5 text-[13px] leading-tight bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-s)] placeholder:text-[var(--color-text-weak)] focus:border-[var(--color-primary)] focus:outline-none resize-y"
          placeholder="この日報に返信する（⌘ + Enter で送信）"
        />
        <button
          type="submit"
          disabled={isPending || body.trim().length === 0}
          className="shrink-0 inline-flex items-center h-8 self-start px-3 text-[12px] font-medium bg-[var(--color-primary)] text-white rounded-[var(--radius-s)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "送信中…" : "返信する"}
        </button>
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-1.5 text-[12px] text-[var(--color-danger)] border border-[var(--color-danger)] rounded-[var(--radius-s)] px-2 py-1"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
