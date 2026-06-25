import Link from "next/link";
import type { ReactNode } from "react";
import { differenceInMinutes, format } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import {
  SCHEDULE_STATUS_LABEL,
  type CalendarUser,
  type Schedule,
  type ScheduleType,
} from "@/components/calendar/types";
import {
  listSchedulesAsync,
  listScheduleTypesAsync,
  listUsersAsync,
} from "@/lib/schedule-store";
import { listProjectScheduleLogsByCaseAsync } from "@/lib/project-schedule-log-store";
import { getSession } from "@/lib/session";
import { getCurrentUserId } from "@/lib/self";

export const dynamic = "force-dynamic";

export default async function CalendarCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId: rawCaseId } = await params;
  const caseId = Number(rawCaseId);
  const isValidCaseId = Number.isInteger(caseId) && caseId > 0;
  const session = await getSession();
  const users = await listUsersAsync();
  const types = await listScheduleTypesAsync();
  const selfUserId = await getCurrentUserId();

  const schedules = isValidCaseId
    ? (await listSchedulesAsync())
        .filter((schedule) => schedule.caseId === caseId)
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    : [];
  const logs = isValidCaseId
    ? await listProjectScheduleLogsByCaseAsync(caseId)
    : [];
  const first = schedules[0];
  const caseNumber = first?.caseNumber ?? `ID ${rawCaseId}`;
  const caseName = first?.caseName ?? "案件名未取得";
  const kanriSystemUrl =
    process.env.NEXT_PUBLIC_KANRI_SYSTEM_URL?.replace(/\/+$/, "") ?? "";
  const kanriHref =
    kanriSystemUrl && isValidCaseId ? `${kanriSystemUrl}/cases/${caseId}` : "";
  const plannedMinutes = schedules.reduce(
    (sum, schedule) =>
      sum +
      Math.max(0, differenceInMinutes(schedule.endAt, schedule.startAt)) *
        schedule.userIds.length,
    0,
  );
  const actualMinutes = logs.reduce((sum, log) => sum + log.minutes, 0);
  const userMap = new Map(users.map((user) => [user.id, user]));
  const typeMap = new Map(types.map((type) => [type.id, type]));

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        user={session}
        users={users}
        selfUserId={selfUserId}
        back={`/calendar/cases/${rawCaseId}`}
      />
      <main className="flex-1 px-4 py-4">
        <div
          className="mx-auto"
          style={{ maxWidth: "var(--width-content-max)" }}
        >
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--color-text-mid)] hover:text-[var(--color-text-strong)] mb-3"
          >
            <ChevronLeft size={14} />
            カレンダーへ戻る
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h1 className="text-[18px] font-bold text-[var(--color-text-strong)]">
                案件別の予定と作業時間
              </h1>
              <p className="mt-1 text-[13px] text-[var(--color-text-mid)]">
                {caseNumber}　{caseName}
              </p>
            </div>
            {kanriHref ? (
              <Link
                href={kanriHref}
                className="inline-flex h-9 items-center rounded-[var(--radius-m)] border border-[var(--color-border)] bg-white px-4 text-[13px] text-[var(--color-text-strong)] hover:bg-[var(--color-background)]"
              >
                kanri-systemで開く
              </Link>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SummaryItem label="予定件数" value={`${schedules.length}件`} />
            <SummaryItem label="予定時間" value={formatMinutes(plannedMinutes)} />
            <SummaryItem
              label="作業時間（実施時間）"
              value={formatMinutes(actualMinutes)}
            />
          </div>

          <section className="mt-4 overflow-hidden rounded-[var(--radius-m)] border border-[var(--color-border)] bg-white">
            <div className="border-b border-[var(--color-border)] px-4 py-3">
              <h2 className="text-[14px] font-bold text-[var(--color-text-strong)]">
                予定一覧
              </h2>
            </div>
            {schedules.length === 0 ? (
              <p className="px-4 py-5 text-[13px] text-[var(--color-text-mid)]">
                この案件に紐付く予定はまだありません。
              </p>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full border-collapse text-[13px]">
                  <thead className="bg-[var(--color-background)] text-[12px] text-[var(--color-text-mid)]">
                    <tr>
                      <Th>日時</Th>
                      <Th>件名</Th>
                      <Th>担当者</Th>
                      <Th>種別</Th>
                      <Th>ステータス</Th>
                      <Th align="right">作業時間</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((schedule) => (
                      <ScheduleRow
                        key={schedule.id}
                        schedule={schedule}
                        users={userMap}
                        types={typeMap}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-4 overflow-hidden rounded-[var(--radius-m)] border border-[var(--color-border)] bg-white">
            <div className="border-b border-[var(--color-border)] px-4 py-3">
              <h2 className="text-[14px] font-bold text-[var(--color-text-strong)]">
                稼働ログ
              </h2>
            </div>
            {logs.length === 0 ? (
              <p className="px-4 py-5 text-[13px] text-[var(--color-text-mid)]">
                完了済みの作業時間ログはまだありません。
              </p>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full border-collapse text-[13px]">
                  <thead className="bg-[var(--color-background)] text-[12px] text-[var(--color-text-mid)]">
                    <tr>
                      <Th>作業日</Th>
                      <Th>担当者</Th>
                      <Th>予定</Th>
                      <Th align="right">作業時間</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const schedule = schedules.find(
                        (item) => item.id === log.scheduleId,
                      );
                      return (
                        <tr
                          key={log.id}
                          className="border-b border-[var(--color-border)] last:border-b-0"
                        >
                          <Td>{formatDate(log.workDate)}</Td>
                          <Td>{userMap.get(log.userId)?.name ?? "—"}</Td>
                          <Td>{schedule?.title ?? log.scheduleId}</Td>
                          <Td align="right">{formatMinutes(log.minutes)}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-m)] border border-[var(--color-border)] bg-white px-4 py-3">
      <div className="text-[12px] text-[var(--color-text-mid)]">{label}</div>
      <div className="mt-1 text-[18px] font-bold text-[var(--color-text-strong)]">
        {value}
      </div>
    </div>
  );
}

function ScheduleRow({
  schedule,
  users,
  types,
}: {
  schedule: Schedule;
  users: Map<string, CalendarUser>;
  types: Map<string, ScheduleType>;
}) {
  const type = types.get(schedule.typeId);
  return (
    <tr className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-background)]">
      <Td>
        <span className="whitespace-nowrap">
          {format(schedule.startAt, "M/d(EEE) HH:mm", { locale: ja })}〜
          {format(schedule.endAt, "HH:mm")}
        </span>
      </Td>
      <Td>
        <Link
          href={`/calendar/${schedule.id}`}
          className="text-[var(--color-primary)] hover:underline"
        >
          {schedule.title}
        </Link>
      </Td>
      <Td>
        {schedule.userIds
          .map((userId) => users.get(userId)?.name)
          .filter(Boolean)
          .join("、") || "—"}
      </Td>
      <Td>{type?.name ?? "—"}</Td>
      <Td>{SCHEDULE_STATUS_LABEL[schedule.status]}</Td>
      <Td align="right">
        {schedule.actualMinutes ? formatMinutes(schedule.actualMinutes) : "—"}
      </Td>
    </tr>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={
        "border-b border-[var(--color-border)] px-3 py-2 font-medium " +
        (align === "right" ? "text-right" : "text-left")
      }
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={
        "px-3 py-2 text-[var(--color-text-strong)] " +
        (align === "right" ? "text-right tabular-nums" : "")
      }
    >
      {children}
    </td>
  );
}

function formatMinutes(minutes: number) {
  if (minutes <= 0) return "0分";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}

function formatDate(value: string) {
  return format(new Date(`${value}T00:00`), "M/d(EEE)", { locale: ja });
}
