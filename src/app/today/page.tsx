import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import {
  listSchedulesAsync,
  listScheduleTypesAsync,
  listUsersAsync,
} from "@/lib/schedule-store";
import {
  SCHEDULE_STATUS_LABEL,
  type Schedule,
  type ScheduleStatus,
} from "@/components/calendar/types";
import {
  scheduleTypeBackground,
  scheduleTypeForeground,
} from "@/components/calendar/color-utils";
import {
  formatJstDateLabel,
  formatJstTime,
  isSameJstDay,
} from "@/lib/jst";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ user?: string }>;

export default async function TodayPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const users = await listUsersAsync();
  const types = await listScheduleTypesAsync();
  const typeMap = new Map(types.map((t) => [t.id, t]));

  const selfId = sp.user && users.find((u) => u.id === sp.user)
    ? sp.user
    : (users[0]?.id ?? "");
  const self = users.find((u) => u.id === selfId);

  const today = new Date();
  const all = await listSchedulesAsync();
  const items = all
    .filter(
      (s) => s.userIds.includes(selfId) && isSameJstDay(s.startAt, today),
    )
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader user={session} />
      <main className="flex-1 px-4 py-4">
        <div className="mx-auto" style={{ maxWidth: "560px" }}>
          {/* 日付 + ユーザー選択 */}
          <div className="mb-4">
            <h1 className="text-[18px] font-bold text-[var(--color-text-strong)]">
              今日の予定
            </h1>
            <p className="text-[13px] text-[var(--color-text-mid)] mt-0.5">
              {formatJstDateLabel(today)}
            </p>

            <form
              action="/today"
              method="get"
              className="mt-3 flex items-center gap-2"
            >
              <label className="text-[12px] text-[var(--color-text-mid)]">
                自分：
              </label>
              <select
                name="user"
                defaultValue={selfId}
                className="h-9 px-3 text-[14px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-m)] focus:border-[var(--color-primary)] focus:outline-none flex-1"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-9 px-3 text-[13px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-m)] hover:bg-[var(--color-background)]"
              >
                切替
              </button>
            </form>
          </div>

          {/* 予定リスト */}
          <ScheduleList items={items} typeMap={typeMap} self={self?.name} />

          {/* フルカレンダーへの導線 */}
          <div className="mt-6 pt-4 border-t border-[var(--color-border)] text-center">
            <Link
              href="/calendar"
              className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-primary)] hover:underline"
            >
              <CalendarDays size={14} />
              フルカレンダーを開く
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function ScheduleList({
  items,
  typeMap,
  self,
}: {
  items: Schedule[];
  typeMap: Map<string, { id: string; name: string; color: string }>;
  self?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-8 text-center">
        <p className="text-[14px] text-[var(--color-text-mid)]">
          {self ?? "—"} さんの今日の予定はありません。
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((s) => {
        const t = typeMap.get(s.typeId);
        const rawColor = t?.color ?? "text-grey";
        const bg = scheduleTypeBackground(rawColor);
        const fg = scheduleTypeForeground(rawColor);
        const isDone = s.status === "done";

        return (
          <li
            key={s.id}
            className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] overflow-hidden"
          >
            {/* 上部：時刻 + 種別 + ステータス */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-background)]">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-[var(--color-text-strong)]">
                  {formatJstTime(s.startAt)} – {formatJstTime(s.endAt)}
                </span>
                {t ? (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 text-[11px] rounded-[var(--radius-s)] border border-black/10"
                    style={{ background: bg, color: fg }}
                  >
                    {t.name}
                  </span>
                ) : null}
              </div>
              <StatusChip status={s.status} />
            </div>

            {/* 中央：タイトル + 案件番号 */}
            <Link
              href={`/calendar/${s.id}`}
              className={
                "block px-3 py-3 hover:bg-[var(--color-background)] " +
                (isDone ? "opacity-60" : "")
              }
            >
              <div
                className={
                  "text-[15px] font-medium text-[var(--color-text-strong)] " +
                  (isDone ? "line-through" : "")
                }
              >
                {s.title}
              </div>
              {s.caseNumber || s.caseName ? (
                <div className="text-[12px] text-[var(--color-text-mid)] mt-0.5">
                  {[s.caseNumber ? `案件番号：${s.caseNumber}` : null, s.caseName]
                    .filter(Boolean)
                    .join("　")}
                </div>
              ) : null}
              {s.location ? (
                <div className="text-[12px] text-[var(--color-text-mid)] mt-0.5">
                  場所：{s.location}
                </div>
              ) : null}
              {s.onlineMeetingUrl ? (
                <div className="text-[12px] text-[var(--color-primary)] mt-0.5 break-all">
                  会議URL：{s.onlineMeetingUrl}
                </div>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function StatusChip({ status }: { status: ScheduleStatus }) {
  const label = SCHEDULE_STATUS_LABEL[status];
  const styles: Record<ScheduleStatus, { bg: string; fg: string }> = {
    planned: {
      bg: "var(--color-background)",
      fg: "var(--color-text-mid)",
    },
    in_progress: {
      bg: "var(--color-primary-soft)",
      fg: "var(--color-primary)",
    },
    done: {
      bg: "var(--color-background)",
      fg: "var(--color-success)",
    },
    carried_over: {
      bg: "var(--color-background)",
      fg: "var(--color-warning)",
    },
    cancelled: {
      bg: "var(--color-background)",
      fg: "var(--color-text-weak)",
    },
  };
  const { bg, fg } = styles[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-[var(--radius-s)] border border-black/5"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
}
