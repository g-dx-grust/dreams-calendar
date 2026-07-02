import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import { ScheduleForm } from "@/components/calendar/schedule-form";
import { DeleteScheduleButton } from "@/components/calendar/delete-button";
import {
  SCHEDULE_STATUS_LABEL,
  SCHEDULE_VISIBILITY_LABEL,
} from "@/components/calendar/types";
import { canViewScheduleDetails } from "@/lib/schedule-visibility";
import {
  scheduleTypeBackground,
  scheduleTypeForeground,
} from "@/components/calendar/color-utils";
import {
  getScheduleAsync,
  listScheduleTypesAsync,
  listUsersAsync,
} from "@/lib/schedule-store";
import { getCurrentUserId } from "@/lib/self";
import {
  formatJstDate,
  formatJstDateLabel,
  formatJstDateTimeLocal,
  formatJstTime,
  isSameJstDay,
} from "@/lib/jst";
import { updateScheduleAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const schedule = await getScheduleAsync(id);
  if (!schedule) notFound();

  const [session, users, types, selfUserId] = await Promise.all([
    getSession(),
    listUsersAsync(),
    listScheduleTypesAsync(),
    getCurrentUserId(),
  ]);

  // 非公開の予定は担当者以外に詳細を表示しない（Larkカレンダー踏襲）
  if (!canViewScheduleDetails(schedule, selfUserId)) {
    return (
      <PrivateScheduleNotice
        session={session}
        users={users}
        selfUserId={selfUserId}
        timeRange={buildTimeRange(schedule.startAt, schedule.endAt)}
      />
    );
  }

  const type = types.find((item) => item.id === schedule.typeId) ?? null;
  const assignees = schedule.userIds
    .map((userId) => users.find((user) => user.id === userId))
    .filter((user): user is (typeof users)[number] => Boolean(user));

  const fmtDate = (d: Date) => formatJstDate(d);
  const fmtTime = (d: Date) => formatJstTime(d);
  const fmtDateTimeLocal = (d?: Date) => formatJstDateTimeLocal(d);
  const fmtDateLabel = (d: Date) => formatJstDateLabel(d);

  const timeRange = buildTimeRange(schedule.startAt, schedule.endAt);

  const update = updateScheduleAction.bind(null, id);
  const caseParts: string[] = [];
  if (schedule.caseNumber) caseParts.push(`案件番号：${schedule.caseNumber}`);
  if (schedule.caseName) caseParts.push(schedule.caseName);
  const caseLabel = caseParts.join("　");
  const kanriSystemUrl =
    process.env.NEXT_PUBLIC_KANRI_SYSTEM_URL?.replace(/\/+$/, "") ?? "";
  const caseHref =
    kanriSystemUrl && schedule.caseId
      ? `${kanriSystemUrl}/cases/${schedule.caseId}`
      : "";
  const calendarCaseHref = schedule.caseId
    ? `/calendar/cases/${schedule.caseId}`
    : "";
  const actualRange =
    schedule.actualStartAt && schedule.actualEndAt
      ? isSameJstDay(schedule.actualStartAt, schedule.actualEndAt)
        ? `${fmtDateLabel(schedule.actualStartAt)} ${fmtTime(schedule.actualStartAt)} 〜 ${fmtTime(schedule.actualEndAt)}`
        : `${fmtDateLabel(schedule.actualStartAt)} ${fmtTime(schedule.actualStartAt)} 〜 ${fmtDateLabel(schedule.actualEndAt)} ${fmtTime(schedule.actualEndAt)}`
      : "";
  const actualMinutesLabel =
    typeof schedule.actualMinutes === "number"
      ? formatMinutes(schedule.actualMinutes)
      : "—";
  const syncStatusLabel =
    {
      pending: "同期待ち",
      synced: "同期済み",
      failed: "同期失敗",
      ignored: "同期対象外",
    }[schedule.syncStatus] ?? schedule.syncStatus;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        user={session}
        users={users}
        selfUserId={selfUserId}
        back={`/calendar/${id}`}
      />
      <main className="flex-1 px-6 py-5">
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

          <div className="flex items-baseline justify-between mb-3">
            <h1 className="text-[18px] font-bold text-[var(--color-text-strong)]">
              予定を編集
            </h1>
            <DeleteScheduleButton id={id} />
          </div>

          <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-5 mb-5">
            <div className="flex items-center gap-2 mb-2">
              {type ? (
                <span
                  className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-[var(--radius-s)] border border-[var(--color-border)]"
                  style={{
                    background: scheduleTypeBackground(type.color),
                    color: scheduleTypeForeground(type.color),
                  }}
                >
                  {type.name}
                </span>
              ) : null}
              {caseLabel ? (
                caseHref ? (
                  <Link
                    href={caseHref}
                    className="text-[12px] text-[var(--color-primary)] hover:underline"
                  >
                    {caseLabel}
                  </Link>
                ) : (
                  <span className="text-[12px] text-[var(--color-text-mid)]">
                    {caseLabel}
                  </span>
                )
              ) : null}
            </div>
            <h2 className="text-[18px] font-bold text-[var(--color-text-strong)]">
              {schedule.title}
            </h2>
            <dl className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
              <div className="md:col-span-2">
                <dt className="text-[12px] text-[var(--color-text-mid)]">
                  担当者
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {assignees.length === 0 ? (
                    <span className="text-[14px] text-[var(--color-text-strong)]">
                      —
                    </span>
                  ) : (
                    assignees.map((user) => (
                      <span
                        key={user.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] rounded-[var(--radius-s)] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                      >
                        <span className="font-medium">{user.name}</span>
                        {user.id === selfUserId ? (
                          <span className="text-[10px] px-1 rounded-[var(--radius-s)] bg-[var(--color-primary)] text-white">
                            自分
                          </span>
                        ) : null}
                      </span>
                    ))
                  )}
                </dd>
              </div>
              <Row label="場所" value={schedule.location ?? "—"} />
              <Row label="時間" value={timeRange} />
              <Row
                label="ステータス"
                value={SCHEDULE_STATUS_LABEL[schedule.status]}
              />
              <Row
                label="公開範囲"
                value={SCHEDULE_VISIBILITY_LABEL[schedule.visibility ?? "public"]}
              />
              <Row label="作業時間（実施時間）" value={actualMinutesLabel} />
              <Row label="作業開始・終了" value={actualRange || "—"} />
              <Row label="Lark同期" value={syncStatusLabel} />
            </dl>
            {schedule.onlineMeetingUrl ? (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <div className="text-[12px] text-[var(--color-text-mid)] mb-1">
                  会議URL
                </div>
                <Link
                  href={schedule.onlineMeetingUrl}
                  className="text-[13px] text-[var(--color-primary)] hover:underline break-all"
                >
                  {schedule.onlineMeetingUrl}
                </Link>
              </div>
            ) : null}
            {calendarCaseHref ? (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <Link
                  href={calendarCaseHref}
                  className="text-[13px] text-[var(--color-primary)] hover:underline"
                >
                  案件別の予定と作業時間を見る
                </Link>
              </div>
            ) : null}
            {schedule.memo ? (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <div className="text-[12px] text-[var(--color-text-mid)] mb-1">
                  メモ
                </div>
                <p className="text-[14px] whitespace-pre-wrap text-[var(--color-text-strong)]">
                  {schedule.memo}
                </p>
              </div>
            ) : null}
            {schedule.actualMemo ? (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <div className="text-[12px] text-[var(--color-text-mid)] mb-1">
                  作業メモ
                </div>
                <p className="text-[14px] whitespace-pre-wrap text-[var(--color-text-strong)]">
                  {schedule.actualMemo}
                </p>
              </div>
            ) : null}
          </div>

          <h2 className="text-[14px] font-bold text-[var(--color-text-strong)] mb-3">
            編集する
          </h2>
          <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-6">
            <ScheduleForm
              users={users}
              scheduleTypes={types}
              defaultValues={{
                title: schedule.title,
                userIds: schedule.userIds,
                typeId: schedule.typeId,
                isAllDay: schedule.isAllDay,
                startDate: fmtDate(schedule.startAt),
                endDate: fmtDate(schedule.endAt),
                startTime: fmtTime(schedule.startAt),
                endTime: fmtTime(schedule.endAt),
                caseId: schedule.caseId ? String(schedule.caseId) : "",
                caseNumber: schedule.caseNumber ?? "",
                caseName: schedule.caseName ?? "",
                location: schedule.location ?? "",
                memo: schedule.memo ?? "",
                status: schedule.status,
                visibility: schedule.visibility ?? "public",
                actualStartAt: fmtDateTimeLocal(schedule.actualStartAt),
                actualEndAt: fmtDateTimeLocal(schedule.actualEndAt),
                actualMinutes: schedule.actualMinutes
                  ? String(schedule.actualMinutes)
                  : "",
                actualMemo: schedule.actualMemo ?? "",
                onlineMeetingUrl: schedule.onlineMeetingUrl ?? "",
                larkEventId: schedule.larkEventId ?? "",
              }}
              selfUserId={selfUserId}
              initialUserIds={schedule.userIds}
              submitLabel="変更を保存する"
              cancelHref="/calendar"
              action={update}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function buildTimeRange(startAt: Date, endAt: Date) {
  const sameDay = isSameJstDay(startAt, endAt);
  const startDate = formatJstDateLabel(startAt);
  const endDate = formatJstDateLabel(endAt);
  const startTime = formatJstTime(startAt);
  const endTime = formatJstTime(endAt);
  return sameDay
    ? `${startDate} ${startTime} 〜 ${endTime}`
    : `${startDate} ${startTime} 〜 ${endDate} ${endTime}`;
}

function PrivateScheduleNotice({
  session,
  users,
  selfUserId,
  timeRange,
}: {
  session: Awaited<ReturnType<typeof getSession>>;
  users: Awaited<ReturnType<typeof listUsersAsync>>;
  selfUserId: string | null;
  timeRange: string;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader user={session} users={users} selfUserId={selfUserId} />
      <main className="flex-1 px-6 py-5">
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

          <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-5">
            <h1 className="text-[16px] font-bold text-[var(--color-text-strong)]">
              非公開の予定
            </h1>
            <p className="mt-2 text-[13px] text-[var(--color-text-mid)]">
              この予定は非公開に設定されています。詳細は担当者のみ確認できます。
            </p>
            <dl className="mt-3">
              <dt className="text-[12px] text-[var(--color-text-mid)]">時間</dt>
              <dd className="text-[14px] text-[var(--color-text-strong)]">
                {timeRange}
              </dd>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-[var(--color-text-mid)]">{label}</dt>
      <dd className="text-[14px] text-[var(--color-text-strong)]">{value}</dd>
    </div>
  );
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}
