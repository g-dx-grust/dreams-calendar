import { ClipboardList } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import {
  ScheduleForm,
  type ScheduleFormValues,
} from "@/components/calendar/schedule-form";
import { DayView } from "@/components/calendar/day-view";
import {
  HOUR_WIDTH_PX,
  REPORT_COL_PX,
  USER_COL_PX,
} from "@/components/calendar/grid-constants";
import { WeekView } from "@/components/calendar/week-view";
import { MonthView } from "@/components/calendar/month-view";
import {
  CalendarHeader,
  type CalendarView,
} from "@/components/calendar/calendar-header";
import { CalendarUserFilter } from "@/components/calendar/calendar-user-filter";
import { DailyReportCell } from "@/components/calendar/daily-report-cell";
import { DailyReportThread } from "@/components/calendar/daily-report-thread";
import { CompletedScheduleSummary } from "@/components/calendar/completed-schedule-summary";
import {
  listSchedulesInRangeAsync,
  listScheduleTypesAsync,
  listUsersAsync,
} from "@/lib/schedule-store";
import { getCalendarSettingsAsync } from "@/lib/calendar-settings-store";
import { getVisibleUserIds } from "@/lib/calendar-user-pref";
import { getCurrentUserId } from "@/lib/self";
import {
  addJstDays,
  endExclusiveOfJstMonth,
  formatJstDate,
  formatJstShortDateTime,
  formatJstTime,
  parseJstDate,
  startOfJstDay,
  startOfJstMonth,
  startOfJstWeek,
} from "@/lib/jst";
import { listReportsByDateAsync } from "@/lib/daily-report-store";
import { listRepliesByReportIdsAsync } from "@/lib/daily-report-reply-store";
import { createScheduleAction } from "./actions";
import type {
  CalendarUser,
  DailyReport,
  DailyReportReply,
  Schedule,
} from "@/components/calendar/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  view?: string;
  date?: string;
  new?: string;
  userId?: string;
  start?: string;
  end?: string;
}>;

function parseView(raw?: string): CalendarView {
  if (raw === "week" || raw === "month") return raw;
  return "day";
}

function parseDate(raw?: string): Date {
  const parsed = raw ? parseJstDate(raw) : null;
  return parsed ?? startOfJstDay(new Date()) ?? new Date();
}

function viewInterval(
  view: CalendarView,
  date: Date,
): { start: Date; endExclusive: Date } {
  if (view === "day") {
    const start = startOfJstDay(date) ?? date;
    return { start, endExclusive: addJstDays(start, 1) };
  }
  if (view === "week") {
    const start = startOfJstWeek(date);
    return { start, endExclusive: addJstDays(start, 7) };
  }
  return {
    start: startOfJstMonth(date),
    endExclusive: endExclusiveOfJstMonth(date),
  };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const view = parseView(sp.view);
  const date = parseDate(sp.date);

  const interval = viewInterval(view, date);
  const [session, allUsers, types, schedules, { startHour, endHour }, selfUserId] =
    await Promise.all([
      getSession(),
      listUsersAsync(),
      listScheduleTypesAsync(),
      listSchedulesInRangeAsync(interval.start, interval.endExclusive),
      getCalendarSettingsAsync(),
      getCurrentUserId(),
    ]);
  const currentUser = selfUserId
    ? allUsers.find((user) => user.id === selfUserId)
    : null;
  const canViewAllReports = Boolean(
    currentUser?.isAdmin || currentUser?.role === "admin",
  );

  // 表示対象社員（cookie 未設定なら全員）
  const stored = await getVisibleUserIds();
  const visibleUserIds =
    stored && stored.length > 0
      ? stored.filter((id) => allUsers.some((u) => u.id === id))
      : allUsers.map((u) => u.id);
  const visibleUsers = allUsers.filter((u) => visibleUserIds.includes(u.id));

  // 日報マップ（日ビュー用）：表示日の日報を社員IDで引けるオブジェクトに整形
  const reportDateStr = formatJstDate(date);
  const reportsMap = await listReportsByDateAsync(reportDateStr);
  const reportsByUserId: Record<string, DailyReport | null> = {};
  const completedSchedulesByUserId: Record<string, Schedule[]> = {};
  for (const u of visibleUsers) {
    const canReadReport = canViewAllReports || u.id === selfUserId;
    const r = reportsMap.get(u.id) ?? null;
    reportsByUserId[u.id] = canReadReport ? r : null;
    completedSchedulesByUserId[u.id] = schedules.filter(
      (schedule) =>
        schedule.status === "done" && schedule.userIds.includes(u.id),
    );
  }
  if (currentUser && !Object.hasOwn(reportsByUserId, currentUser.id)) {
    reportsByUserId[currentUser.id] = reportsMap.get(currentUser.id) ?? null;
    completedSchedulesByUserId[currentUser.id] = schedules.filter(
      (schedule) =>
        schedule.status === "done" && schedule.userIds.includes(currentUser.id),
    );
  }

  // 返信は日報単位ではなく1クエリでまとめて取得する（N+1対策）
  const visibleReportIds = Object.values(reportsByUserId)
    .filter((report): report is DailyReport => report !== null)
    .map((report) => report.id);
  const repliesMap = await listRepliesByReportIdsAsync(visibleReportIds);
  const repliesByReportId: Record<string, DailyReportReply[]> = {};
  for (const reportId of visibleReportIds) {
    repliesByReportId[reportId] = repliesMap.get(reportId) ?? [];
  }
  const reportUsers = canViewAllReports
    ? visibleUsers
    : visibleUsers.filter((user) => user.id === selfUserId);
  const newScheduleDefaults = buildNewScheduleDefaults({
    users: allUsers,
    selfUserId,
    date,
    userId: sp.userId,
    start: sp.start,
    end: sp.end,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        user={session}
        users={allUsers}
        selfUserId={selfUserId}
        back="/calendar"
      />
      <main className="flex-1 px-6 py-5">
        <div
          className="mx-auto"
          style={{ maxWidth: "var(--width-calendar-max)" }}
        >
          <CalendarHeader view={view} date={date} />

          {view !== "month" ? (
            <div className="mb-3">
              <CalendarUserFilter
                users={allUsers}
                visibleUserIds={visibleUserIds}
              />
            </div>
          ) : null}

          {view === "day" ? (
            <>
              <DayView
                date={date}
                users={visibleUsers}
                schedules={schedules}
                scheduleTypes={types}
                startHour={startHour}
                endHour={endHour}
                reportDate={reportDateStr}
                reportsByUserId={reportsByUserId}
                currentUserId={selfUserId}
                canViewAllReports={canViewAllReports}
              />
              <SubmittedReportsPanel
                users={reportUsers}
                allUsers={allUsers}
                reportsByUserId={reportsByUserId}
                repliesByReportId={repliesByReportId}
                completedSchedulesByUserId={completedSchedulesByUserId}
                reportDate={reportDateStr}
                currentUserId={selfUserId}
                totalWidthPx={
                  USER_COL_PX +
                  REPORT_COL_PX +
                  (endHour - startHour) * HOUR_WIDTH_PX
                }
              />
            </>
          ) : view === "week" ? (
            <WeekView
              date={date}
              users={visibleUsers}
              schedules={schedules}
              scheduleTypes={types}
            />
          ) : (
            <MonthView
              date={date}
              users={visibleUsers}
              schedules={schedules}
              scheduleTypes={types}
            />
          )}
        </div>
      </main>
      {sp.new === "1" ? (
        <ScheduleFormModal
          title="予定を新規登録する"
          returnHref={calendarHref(view, date)}
        >
          <ScheduleForm
            users={allUsers}
            scheduleTypes={types}
            defaultValues={newScheduleDefaults}
            selfUserId={selfUserId}
            initialUserIds={newScheduleDefaults.userIds}
            submitLabel="登録する"
            cancelHref={calendarHref(view, date)}
            action={createScheduleAction}
          />
        </ScheduleFormModal>
      ) : null}
    </div>
  );
}

function calendarHref(view: CalendarView, date: Date) {
  return `/calendar?view=${view}&date=${formatJstDate(date)}`;
}

function normalizeTime(raw: string | undefined, fallback: string) {
  if (!raw) return fallback;
  return /^\d{2}:\d{2}$/.test(raw) ? raw : fallback;
}

function addOneHour(time: string) {
  const [hour = "09", minute = "00"] = time.split(":");
  const total = Number(hour) * 60 + Number(minute) + 60;
  const next = Math.min(total, 23 * 60 + 45);
  return `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(
    next % 60,
  ).padStart(2, "0")}`;
}

function buildNewScheduleDefaults({
  users,
  selfUserId,
  date,
  userId,
  start,
  end,
}: {
  users: CalendarUser[];
  selfUserId: string | null;
  date: Date;
  userId?: string;
  start?: string;
  end?: string;
}): Partial<ScheduleFormValues> {
  const selectedUserId =
    userId && users.some((user) => user.id === userId)
      ? userId
      : selfUserId && users.some((user) => user.id === selfUserId)
        ? selfUserId
        : users[0]?.id;
  const startTime = normalizeTime(start, "09:00");
  return {
    userIds: selectedUserId ? [selectedUserId] : [],
    isAllDay: false,
    startDate: formatJstDate(date),
    endDate: formatJstDate(date),
    startTime,
    endTime: normalizeTime(end, addOneHour(startTime)),
  };
}

function ScheduleFormModal({
  title,
  returnHref,
  children,
}: {
  title: string;
  returnHref: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-form-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-text-strong)]/30 px-4 py-6"
    >
      <a
        href={returnHref}
        className="absolute inset-0"
        aria-label="モーダルを閉じる"
      />
      <div className="relative max-h-[calc(100dvh-48px)] w-full max-w-[760px] overflow-auto rounded-[var(--radius-m)] border border-[var(--color-border)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2
            id="schedule-form-modal-title"
            className="text-[16px] font-bold text-[var(--color-text-strong)]"
          >
            {title}
          </h2>
          <a
            href={returnHref}
            className="text-[13px] text-[var(--color-text-mid)] hover:text-[var(--color-text-strong)]"
          >
            閉じる
          </a>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function SubmittedReportsPanel({
  users,
  allUsers,
  reportsByUserId,
  repliesByReportId,
  completedSchedulesByUserId,
  reportDate,
  currentUserId,
  totalWidthPx,
}: {
  users: CalendarUser[];
  allUsers: CalendarUser[];
  reportsByUserId: Record<string, DailyReport | null>;
  repliesByReportId: Record<string, DailyReportReply[]>;
  completedSchedulesByUserId: Record<string, Schedule[]>;
  reportDate: string;
  currentUserId: string | null;
  totalWidthPx: number;
}) {
  const submitted = users
    .map((u) => ({ user: u, report: reportsByUserId[u.id] }))
    .filter((x): x is { user: CalendarUser; report: DailyReport } =>
      Boolean(x.report),
    );
  const currentUser = currentUserId
    ? allUsers.find((user) => user.id === currentUserId)
    : null;
  const currentReport = currentUser
    ? reportsByUserId[currentUser.id] ?? null
    : null;
  const currentCompletedSchedules = currentUser
    ? completedSchedulesByUserId[currentUser.id] ?? []
    : [];

  const fmtSubmittedAt = (d: Date) => formatJstShortDateTime(d);

  return (
    <section className="mt-5 bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <ClipboardList size={18} className="text-[var(--color-primary)]" />
          <h3 className="text-[16px] font-bold text-[var(--color-text-strong)]">
            日報
          </h3>
        </div>
        {currentUser ? (
          <DailyReportCell
            userId={currentUser.id}
            userName={currentUser.name}
            reportDate={reportDate}
            initialReport={currentReport}
            autoDraft={buildReportDraftFromSchedules(currentCompletedSchedules)}
            completedSchedules={currentCompletedSchedules}
            buttonLabel={currentReport ? "日報を編集" : "日報を作成"}
          />
        ) : null}
      </div>
      {submitted.length === 0 ? (
        <p className="px-5 py-5 text-[14px] text-[var(--color-text-mid)]">
          当日の日報はまだ提出されていません。
        </p>
      ) : (
        <div className="overflow-auto">
          <div
            className="grid text-[13px]"
            style={{
              gridTemplateColumns: "119px 108px 1fr",
              minWidth: totalWidthPx,
            }}
          >
            <div className="px-3 py-2 bg-[var(--color-background)] border-b border-r border-[var(--color-border)] text-[12px] text-[var(--color-text-mid)] font-medium">
              社員
            </div>
            <div className="px-3 py-2 bg-[var(--color-background)] border-b border-r border-[var(--color-border)] text-[12px] text-[var(--color-text-mid)] font-medium">
              提出日時
            </div>
            <div className="px-3 py-2 bg-[var(--color-background)] border-b border-[var(--color-border)] text-[12px] text-[var(--color-text-mid)] font-medium">
              内容
            </div>

            {submitted.map(({ user, report }, i) => {
              const isLast = i === submitted.length - 1;
              const rowBorder = isLast ? "" : "border-b";
              const replies = repliesByReportId[report.id] ?? [];
              const completedSchedules = completedSchedulesByUserId[user.id] ?? [];
              return (
                <div key={user.id} className="contents">
                  <div
                    className={`px-3 py-3 ${rowBorder} border-r border-[var(--color-border)] font-medium text-[var(--color-text-strong)]`}
                  >
                    {user.name}
                  </div>
                  <div
                    className={`px-3 py-3 ${rowBorder} border-r border-[var(--color-border)] text-[var(--color-text-mid)] whitespace-nowrap`}
                  >
                    {fmtSubmittedAt(report.submittedAt)}
                  </div>
                  <div
                    id={`daily-report-${user.id}`}
                    className={`px-3 py-3 ${rowBorder} border-[var(--color-border)] text-[var(--color-text-strong)]`}
                  >
                    <div className="mb-3">
                      <p className="mb-1.5 text-[12px] font-medium text-[var(--color-text-mid)]">
                        完了した予定
                      </p>
                      <CompletedScheduleSummary
                        schedules={completedSchedules}
                        emptyLabel="完了した予定はまだありません。"
                      />
                    </div>
                    <p className="whitespace-pre-wrap break-words">
                      {report.body}
                    </p>
                    <DailyReportThread
                      reportId={report.id}
                      reportUserId={report.userId}
                      reportDate={reportDate}
                      initialReplies={replies}
                      currentUserId={currentUserId}
                      users={allUsers}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function buildReportDraftFromSchedules(schedules: Schedule[]): string | undefined {
  const doneSchedules = schedules
    .filter((schedule) => schedule.status === "done")
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  if (doneSchedules.length === 0) return undefined;

  return doneSchedules
    .map((schedule) => {
      const casePart = schedule.caseNumber ? `（${schedule.caseNumber}）` : "";
      const actualPart = schedule.actualMinutes
        ? ` ${formatWorkMinutes(schedule.actualMinutes)}`
        : "";
      const memoPart = schedule.actualMemo
        ? `\n  作業メモ：${schedule.actualMemo}`
        : "";
      const actualEnd = schedule.actualEndAt ?? schedule.endAt;
      return `・${formatJstTime(schedule.startAt)}〜${formatJstTime(actualEnd)} ${schedule.title}${casePart}${actualPart}${memoPart}`;
    })
    .join("\n");
}

function formatWorkMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}
