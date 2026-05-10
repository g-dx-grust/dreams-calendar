"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import type { CalendarUser } from "./types";

type Props = {
  users: CalendarUser[]; // 全社員
  visibleUserIds: string[]; // 現在表示中の社員 ID（順序保持）
};

export function CalendarUserFilter({ users, visibleUserIds }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const visibleSet = new Set(visibleUserIds);
  const visible = users.filter((u) => visibleSet.has(u.id));
  const candidates = users.filter((u) => !visibleSet.has(u.id));

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function send(action: "add" | "remove", userId: string) {
    const fd = new FormData();
    fd.set("action", action);
    fd.set("userId", userId);
    startTransition(async () => {
      await fetch("/api/calendar-users", { method: "POST", body: fd });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.length === 0 ? (
        <span className="text-[12px] text-[var(--color-text-weak)]">
          表示中の社員がいません。
        </span>
      ) : (
        visible.map((u) => (
          <span
            key={u.id}
            className="inline-flex items-center gap-1 pl-3 pr-1 py-1 text-[13px] rounded-[var(--radius-s)] bg-white border border-[var(--color-border)]"
          >
            {u.name}
            <button
              type="button"
              onClick={() => send("remove", u.id)}
              disabled={visible.length <= 1}
              aria-label={`${u.name} を非表示にする`}
              title="このカレンダーから非表示にする"
              className="ml-0.5 p-1 rounded-[2px] text-[var(--color-text-weak)] hover:text-[var(--color-danger)] hover:bg-[var(--color-background)] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <X size={12} />
            </button>
          </span>
        ))
      )}

      {candidates.length > 0 ? (
        <div ref={wrapRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 px-3 py-1 text-[13px] rounded-[var(--radius-s)] bg-white border border-dashed border-[var(--color-border)] text-[var(--color-text-mid)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]"
          >
            <Plus size={14} />
            社員を表示
          </button>

          {open ? (
            <div
              role="listbox"
              className="absolute top-full left-0 mt-1 max-h-64 overflow-auto bg-white border border-[var(--color-border)] rounded-[var(--radius-s)] shadow-md z-50 min-w-[180px]"
            >
              {candidates.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  role="option"
                  onClick={() => {
                    send("add", u.id);
                    setOpen(false);
                  }}
                  className="block w-full text-left px-3 py-1.5 text-[13px] text-[var(--color-text-strong)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
                >
                  {u.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
