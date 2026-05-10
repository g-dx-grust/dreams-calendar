"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  ariaInvalid?: boolean;
  className?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const QUARTER_OPTIONS: string[] = (() => {
  const arr: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      arr.push(`${pad(h)}:${pad(m)}`);
    }
  }
  return arr;
})();

/**
 * 時刻入力：
 * - テキスト欄に直接タイピングは 1 分単位で自由
 * - 時計アイコンを押すと 15 分刻みのドロップダウンが開く
 */
export function TimePicker15({
  value,
  onChange,
  ariaInvalid,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  // 開いた時に近い時刻をスクロール表示
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const target = value && /^\d{2}:\d{2}$/.test(value) ? value : "09:00";
    // 15 分単位に丸めた近い値
    const [h, m] = target.split(":").map((n) => parseInt(n, 10));
    const rounded = `${pad(h ?? 0)}:${pad(Math.round((m ?? 0) / 15) * 15 === 60 ? 0 : Math.round((m ?? 0) / 15) * 15)}`;
    const el = list.querySelector<HTMLButtonElement>(
      `button[data-time="${rounded}"]`,
    );
    el?.scrollIntoView({ block: "center" });
  }, [open, value]);

  return (
    <div
      ref={wrapRef}
      className={`relative inline-flex items-stretch h-9 w-[120px] bg-white border border-[var(--color-border)] rounded-[var(--radius-s)] focus-within:border-[var(--color-primary)] ${className ?? ""}`}
    >
      <input
        type="time"
        step={60}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={ariaInvalid}
        className="flex-1 min-w-0 px-2 text-[14px] bg-transparent text-[var(--color-text-strong)] focus:outline-none gdx-no-native-time-picker"
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="15分単位で選択"
        title="15分単位で選択"
        className="px-2 border-l border-[var(--color-border)] text-[var(--color-text-mid)] hover:text-[var(--color-primary)]"
      >
        <Clock size={14} />
      </button>

      {open ? (
        <div
          ref={listRef}
          role="listbox"
          className="absolute top-full left-0 mt-1 max-h-64 overflow-auto bg-white border border-[var(--color-border)] rounded-[var(--radius-s)] shadow-md z-50 w-[120px]"
        >
          {QUARTER_OPTIONS.map((opt) => {
            const active = opt === value;
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={active}
                data-time={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={
                  "block w-full text-left px-3 py-1 text-[13px] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] " +
                  (active
                    ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-medium"
                    : "text-[var(--color-text-strong)]")
                }
              >
                {opt}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
