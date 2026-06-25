"use client";

import { UserRound } from "lucide-react";
import type { CalendarUser } from "@/components/calendar/types";

type Props = {
  users: CalendarUser[];
  selfUserId?: string | null;
  back?: string;
};

export function SelfSelector({ users, selfUserId, back }: Props) {
  return (
    <form
      action="/api/self"
      method="post"
      className="inline-flex items-center gap-1.5"
      title="現在の「自分」（招待判定に使用）"
    >
      <UserRound
        size={14}
        className="text-[var(--color-text-weak)] hidden sm:inline-block"
      />
      <select
        name="userId"
        defaultValue={selfUserId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-9 min-w-[150px] pl-3 pr-8 text-[13px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-m)] focus:border-[var(--color-primary)] focus:outline-none"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            自分: {u.name}
          </option>
        ))}
      </select>
      <input type="hidden" name="back" value={back ?? "/calendar"} />
      <noscript>
        <button
          type="submit"
          className="text-[12px] text-[var(--color-primary)]"
        >
          切替
        </button>
      </noscript>
    </form>
  );
}
