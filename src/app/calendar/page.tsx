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
import { DailyReportThread } from "@/components/calendar/daily-report-thread";
import {
  listSchedules,
  listScheduleTypes,
  listUsers,
} from "@/lib/schedule-store";
import { getCalendarSettings } from "@/lib/calendar-settings-store";
import { getVisibleUserIds } from "@/lib/calendar-user-pref";
import { getCurrentUserId } from "@/lib/self";
import { listReportsByDate } from "@/lib/daily-report-store";
import { listReplies } from "@/lib/daily-report-reply-store";
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
  const allUsers = listUsers();
  const types = listScheduleTypes();
  const all = listSchedules();
  const schedules = filterByView(view, date, all);
  const { startHour, endHour } = getCalendarSettings();
  const selfUserId = await getCurrentUserId();

  // 表示対象社員（cookie 未設定なら全員）
  const stored = await getVisibleUserIds();
  const visibleUserIds =
    stored && stored.length > 0
      ? stored.filter((id) => allUsers.some((u) => u.id === id))
      : allUsers.map((u) => u.id);
  const visibleUsers = allUsers.filter((u) => visibleUserIds.includes(u.id));

  // 日報マップ（日ビュー用）：表示日の日報を社員IDで引けるオブジェクトに整形
  const reportDateStr = format(date, "yyyy-MM-dd");
  const reportsMap = listReportsByDate(reportDateStr);
  const reportsByUserId: Record<string, DailyReport | null> = {};
  const repliesByReportId: Record<string, DailyReportReply[]> = {};
  for (const u of visibleUsers) {
    const r = reportsMap.get(u.id) ?? null;
    reportsByUserId[u.id] = r;
    if (r) {
      repliesByReportId[r.id] = listReplies(r.id);
    }
  }

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
          style={{ maxWidth: "var(--width-content-max)" }}
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
              />
              <SubmittedReportsPanel
                users={visibleUsers}
                allUsers={allUsers}
                reportsByUserId={reportsByUserId}
                repliesByReportId={repliesByReportId}
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
  reportDate,
  currentUserId,
  totalWidthPx,
}: {
  users: CalendarUser[];
  allUsers: CalendarUser[];
  reportsByUserId: Record<string, DailyReport | null>;
  repliesByReportId: Record<string, DailyReportReply[]>;
  reportDate: string;
  currentUserId: string | null;
  totalWidthPx: number;
}) {
  const submitted = users
    .map((u) => ({ user: u, report: reportsByUserId[u.id] }))
    .filter((x): x is { user: CalendarUser; report: DailyReport } =>
      Boolean(x.report),
    );

  const fmtSubmittedAt = (d: Date) =>
    format(d, "M/d(EEE) HH:mm", { locale: ja });

  return (
    <section className="mt-5 bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] overflow-hidden">
      <h3 className="px-4 py-3 text-[14px] font-bold text-[var(--color-text-strong)] border-b border-[var(--color-border)]">
        日報
      </h3>
      {submitted.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-[var(--color-text-mid)]">
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
                  className={`px-3 py-3 ${rowBorder} border-[var(--color-border)] text-[var(--color-text-strong)]`}
                >
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
