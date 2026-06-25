import {
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  endOfDay,
} from "date-fns";
import { ja } from "date-fns/locale";
import { ClipboardList } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
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
  listSchedules,
  listSchedulesAsync,
  listScheduleTypes,
  listScheduleTypesAsync,
  listUsers,
  listUsersAsync,
} from "@/lib/schedule-store";
import { getCalendarSettings } from "@/lib/calendar-settings-store";
import { getVisibleUserIds } from "@/lib/calendar-user-pref";
import { getCurrentUserId } from "@/lib/self";
import { listReportsByDateAsync } from "@/lib/daily-report-store";
import { listRepliesAsync } from "@/lib/daily-report-reply-store";
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
}>;

function parseView(raw?: string): CalendarView {
  if (raw === "week" || raw === "month") return raw;
  return "day";
}

function parseDate(raw?: string): Date {
  if (!raw) return new Date();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date() : d;
}

function filterByView(
  view: CalendarView,
  date: Date,
  schedules: Schedule[],
): Schedule[] {
  let interval: { start: Date; end: Date };
  if (view === "day") {
    interval = { start: startOfDay(date), end: endOfDay(date) };
  } else if (view === "week") {
    interval = {
      start: startOfWeek(date, { weekStartsOn: 0 }),
      end: endOfWeek(date, { weekStartsOn: 0 }),
    };
  } else {
    interval = { start: startOfMonth(date), end: endOfMonth(date) };
  }
  return schedules.filter((s) => isWithinInterval(s.startAt, interval));
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const view = parseView(sp.view);
  const date = parseDate(sp.date);

  const session = await getSession();
  let allUsers = await listUsersAsync();
  let types = await listScheduleTypesAsync();
  let all = await listSchedulesAsync();
  const dataMode = all.length === 0 ? "mock" : "database";
  if (dataMode === "mock") {
    allUsers = listUsers();
    types = listScheduleTypes();
    all = listSchedules();
  }
  const schedules = filterByView(view, date, all);
  const { startHour, endHour } = getCalendarSettings();
  let selfUserId = await getCurrentUserId();
  if (dataMode === "mock" && !allUsers.some((u) => u.id === selfUserId)) {
    selfUserId = allUsers[0]?.id ?? null;
  }
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
  const reportDateStr = format(date, "yyyy-MM-dd");
  const reportsMap = await listReportsByDateAsync(reportDateStr);
  const reportsByUserId: Record<string, DailyReport | null> = {};
  const repliesByReportId: Record<string, DailyReportReply[]> = {};
  const completedSchedulesByUserId: Record<string, Schedule[]> = {};
  for (const u of visibleUsers) {
    const canReadReport = canViewAllReports || u.id === selfUserId;
    const r = reportsMap.get(u.id) ?? null;
    reportsByUserId[u.id] = canReadReport ? r : null;
    completedSchedulesByUserId[u.id] = schedules.filter(
      (schedule) =>
        schedule.status === "done" && schedule.userIds.includes(u.id),
    );
    if (r && canReadReport) {
      repliesByReportId[r.id] = await listRepliesAsync(r.id);
    }
  }
  if (currentUser && !Object.hasOwn(reportsByUserId, currentUser.id)) {
    const r = reportsMap.get(currentUser.id) ?? null;
    reportsByUserId[currentUser.id] = r;
    completedSchedulesByUserId[currentUser.id] = schedules.filter(
      (schedule) =>
        schedule.status === "done" && schedule.userIds.includes(currentUser.id),
    );
    if (r) {
      repliesByReportId[r.id] = await listRepliesAsync(r.id);
    }
  }
  const reportUsers = canViewAllReports
    ? visibleUsers
    : visibleUsers.filter((user) => user.id === selfUserId);

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
          <CalendarHeader view={view} date={date} dataMode={dataMode} />

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

  const fmtSubmittedAt = (d: Date) =>
    format(d, "M/d(EEE) HH:mm", { locale: ja });

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
      return `・${format(schedule.startAt, "HH:mm")}〜${format(actualEnd, "HH:mm")} ${schedule.title}${casePart}${actualPart}${memoPart}`;
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
