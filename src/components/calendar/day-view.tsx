"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { moveScheduleAction } from "@/app/calendar/actions";
import type {
  CalendarUser,
  DailyReport,
  Schedule,
  ScheduleType,
} from "./types";
import { DailyReportCell } from "./daily-report-cell";
import { SchedulePopover } from "./schedule-popover";
import { cn } from "@/lib/utils";

import {
  HOUR_WIDTH_PX,
  REPORT_COL_PX,
  USER_COL_PX,
} from "./grid-constants";

// 表示密度の固定値（時間帯のみ管理画面で可変）
const SLOTS_PER_HOUR = 4; // 15 分刻み
const SLOT_WIDTH_PX = HOUR_WIDTH_PX / SLOTS_PER_HOUR;
const SNAP_MIN = 60 / SLOTS_PER_HOUR; // 15
const MIN_DURATION_MIN = 15;
const HEADER_ROW_HEIGHT_PX = 32;
const USER_ROW_HEIGHT_PX = 56;

type Props = {
  date: Date;
  users: CalendarUser[];
  schedules: Schedule[];
  scheduleTypes: ScheduleType[];
  startHour: number;
  endHour: number;
  reportDate: string; // YYYY-MM-DD
  reportsByUserId: Record<string, DailyReport | null>;
};

function makeMinutesFromStart(startHour: number) {
  return (d: Date) => (d.getHours() - startHour) * 60 + d.getMinutes();
}

function pxFromMinutes(minutes: number) {
  return (minutes / 60) * HOUR_WIDTH_PX;
}

function isLightColor(hex: string) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 186;
}

export function DayView({
  date,
  users,
  schedules,
  scheduleTypes,
  startHour,
  endHour,
  reportDate,
  reportsByUserId,
}: Props) {
  const totalHours = endHour - startHour;
  const totalSlots = totalHours * SLOTS_PER_HOUR;
  const totalMinutes = totalHours * 60;
  const timelineWidthPx = totalHours * HOUR_WIDTH_PX;
  const minutesFromStart = useMemo(
    () => makeMinutesFromStart(startHour),
    [startHour],
  );
  const [, startTransition] = useTransition();
  const [popover, setPopover] = useState<{
    scheduleId: string;
    rect: DOMRect;
  } | null>(null);

  function handleScheduleClick(id: string, target: HTMLElement) {
    setPopover({ scheduleId: id, rect: target.getBoundingClientRect() });
  }

  // 楽観的更新用：サーバーから来た schedules を初期値とし、D&D 直後はローカルで先に動かす
  const [localSchedules, setLocalSchedules] = useState<Schedule[]>(schedules);
  useEffect(() => {
    setLocalSchedules(schedules);
  }, [schedules]);

  const typeMap = useMemo(
    () => new Map(scheduleTypes.map((t) => [t.id, t])),
    [scheduleTypes],
  );

  // 表示する社員はページ側で確定しているので、users をそのまま使う
  const visibleUsers = users;

  const schedulesByUser = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const s of localSchedules) {
      for (const uid of s.userIds) {
        const list = map.get(uid) ?? [];
        list.push(s);
        map.set(uid, list);
      }
    }
    return map;
  }, [localSchedules]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over, delta } = event;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith("user-")) return;
    const activeId = String(active.id);
    // active.id は "{scheduleId}::{fromUserId}" 形式
    const [scheduleId, fromUserId] = activeId.split("::");
    if (!scheduleId || !fromUserId) return;

    const targetUserId = overId.slice("user-".length);
    const original = localSchedules.find((s) => s.id === scheduleId);
    if (!original) return;

    // 横方向の移動量を 15 分単位にスナップ
    const slotsDelta = Math.round(delta.x / SLOT_WIDTH_PX);
    let minutesDelta = slotsDelta * SNAP_MIN;

    // 開始/終了が範囲内に収まるようクランプ
    const origStartMin = minutesFromStart(original.startAt);
    const origEndMin = minutesFromStart(original.endAt);
    const minShift = -origStartMin;
    const maxShift = totalMinutes - origEndMin;
    minutesDelta = Math.max(minShift, Math.min(maxShift, minutesDelta));

    const sameRow = fromUserId === targetUserId;
    if (minutesDelta === 0 && sameRow) return;

    const newStart = new Date(original.startAt.getTime() + minutesDelta * 60_000);
    const newEnd = new Date(original.endAt.getTime() + minutesDelta * 60_000);

    // 楽観的更新：行が変わるなら userIds を置換 + 重複除去
    const newUserIds = sameRow
      ? original.userIds
      : (() => {
          const idx = original.userIds.indexOf(fromUserId);
          const replaced =
            idx === -1
              ? [...original.userIds, targetUserId]
              : original.userIds.map((u, i) => (i === idx ? targetUserId : u));
          // dedupe
          const seen = new Set<string>();
          return replaced.filter((u) => (seen.has(u) ? false : seen.add(u)));
        })();

    setLocalSchedules((prev) =>
      prev.map((s) =>
        s.id === scheduleId
          ? { ...s, userIds: newUserIds, startAt: newStart, endAt: newEnd }
          : s,
      ),
    );

    startTransition(async () => {
      await moveScheduleAction({
        id: scheduleId,
        fromUserId,
        toUserId: targetUserId,
        startAt: newStart.toISOString(),
        endAt: newEnd.toISOString(),
      });
    });
  }

  function handleResize(id: string, newStart: Date, newEnd: Date) {
    const original = localSchedules.find((s) => s.id === id);
    if (!original) return;
    if (
      newStart.getTime() === original.startAt.getTime() &&
      newEnd.getTime() === original.endAt.getTime()
    ) {
      return;
    }

    setLocalSchedules((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, startAt: newStart, endAt: newEnd } : s,
      ),
    );

    const primaryUserId = original.userIds[0]!;
    startTransition(async () => {
      await moveScheduleAction({
        id,
        fromUserId: primaryUserId,
        toUserId: primaryUserId,
        startAt: newStart.toISOString(),
        endAt: newEnd.toISOString(),
      });
    });
  }

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] overflow-hidden">
      {/* 日付ヘッダー */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <h2 className="text-[16px] font-bold text-[var(--color-text-strong)]">
          {format(date, "yyyy年M月d日(EEE)", { locale: ja })}
        </h2>
      </div>

      {/* グリッド本体（横スクロール） */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="overflow-auto">
          <div
            className="relative"
            style={{ width: USER_COL_PX + REPORT_COL_PX + timelineWidthPx }}
          >
            {/* ヘッダー：左上空セル + 日報 + 時間目盛 */}
            <div
              className="flex sticky top-0 z-30 bg-[var(--color-background)] border-b border-[var(--color-border)]"
              style={{ height: HEADER_ROW_HEIGHT_PX }}
            >
              <div
                className="sticky left-0 z-40 bg-[var(--color-background)] border-r border-[var(--color-border)] flex items-center px-3 text-[12px] text-[var(--color-text-mid)]"
                style={{ width: USER_COL_PX, minWidth: USER_COL_PX }}
              >
                社員
              </div>
              <div
                className="sticky z-40 bg-[var(--color-background)] border-r border-[var(--color-border)] flex items-center px-3 text-[12px] text-[var(--color-text-mid)]"
                style={{
                  width: REPORT_COL_PX,
                  minWidth: REPORT_COL_PX,
                  left: USER_COL_PX,
                }}
              >
                日報
              </div>
              <div
                className="relative"
                style={{
                  width: timelineWidthPx,
                  minWidth: timelineWidthPx,
                }}
              >
                {Array.from({ length: totalHours + 1 }, (_, i) => {
                  const hour = startHour + i;
                  return (
                    <div
                      key={hour}
                      className="absolute top-0 bottom-0 flex items-center text-[11px] text-[var(--color-text-weak)] px-1"
                      style={{
                        left: i * HOUR_WIDTH_PX,
                        borderLeft:
                          i === 0
                            ? undefined
                            : "1px solid var(--color-border)",
                      }}
                    >
                      {String(hour % 24).padStart(2, "0")}:00
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 各社員行 */}
            {visibleUsers.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                schedules={schedulesByUser.get(u.id) ?? []}
                typeMap={typeMap}
                startHour={startHour}
                totalSlots={totalSlots}
                totalMinutes={totalMinutes}
                timelineWidthPx={timelineWidthPx}
                reportDate={reportDate}
                report={reportsByUserId[u.id] ?? null}
                onScheduleClick={handleScheduleClick}
                onResize={handleResize}
              />
            ))}
          </div>
        </div>
      </DndContext>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-[var(--color-border)]">
        {scheduleTypes.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-mid)]"
          >
            <span
              className="inline-block w-3 h-3 rounded-[2px] border border-black/10"
              style={{ background: t.color }}
              aria-hidden
            />
            {t.name}
          </span>
        ))}
      </div>

      {popover
        ? (() => {
            const target = localSchedules.find(
              (s) => s.id === popover.scheduleId,
            );
            if (!target) return null;
            const assignees = target.userIds
              .map((uid) => users.find((u) => u.id === uid))
              .filter((u): u is CalendarUser => Boolean(u));
            return (
              <SchedulePopover
                schedule={target}
                type={typeMap.get(target.typeId)}
                assignees={assignees}
                anchorRect={popover.rect}
                onClose={() => setPopover(null)}
              />
            );
          })()
        : null}
    </div>
  );
}

function UserRow({
  user,
  schedules,
  typeMap,
  startHour,
  totalSlots,
  totalMinutes,
  timelineWidthPx,
  reportDate,
  report,
  onScheduleClick,
  onResize,
}: {
  user: CalendarUser;
  schedules: Schedule[];
  typeMap: Map<string, ScheduleType>;
  startHour: number;
  totalSlots: number;
  totalMinutes: number;
  timelineWidthPx: number;
  reportDate: string;
  report: DailyReport | null;
  onScheduleClick: (id: string, target: HTMLElement) => void;
  onResize: (id: string, newStart: Date, newEnd: Date) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `user-${user.id}` });

  return (
    <div
      className="flex border-b border-[var(--color-border)]"
      style={{ height: USER_ROW_HEIGHT_PX }}
    >
      {/* 左：社員名（固定） */}
      <div
        className="sticky left-0 z-20 bg-white border-r border-[var(--color-border)] flex items-center px-3 text-[13px] font-medium text-[var(--color-text-strong)]"
        style={{ width: USER_COL_PX, minWidth: USER_COL_PX }}
      >
        {user.name}
      </div>

      {/* 中央：日報ボタン（固定） */}
      <div
        className="sticky z-20 bg-white border-r border-[var(--color-border)] flex items-center justify-center px-2"
        style={{
          width: REPORT_COL_PX,
          minWidth: REPORT_COL_PX,
          left: USER_COL_PX,
        }}
      >
        <DailyReportCell
          userId={user.id}
          userName={user.name}
          reportDate={reportDate}
          initialReport={report}
        />
      </div>

      {/* 右：タイムライン（Droppable） */}
      <div
        ref={setNodeRef}
        className={cn(
          "relative transition-colors",
          isOver ? "bg-[var(--color-primary-soft)]" : "bg-white",
        )}
        style={{ width: timelineWidthPx, minWidth: timelineWidthPx }}
      >
        {/* 15 分刻みの縦グリッド線（毎時のみ実線、それ以外は薄い破線） */}
        {Array.from({ length: totalSlots }, (_, i) => (
          <div
            key={i}
            className={
              i % SLOTS_PER_HOUR === 0
                ? "absolute top-0 bottom-0 border-l border-[var(--color-border)]"
                : "absolute top-0 bottom-0 border-l border-dashed border-[var(--color-border)] opacity-40"
            }
            style={{ left: i * SLOT_WIDTH_PX }}
          />
        ))}

        {/* 予定ブロック */}
        {schedules.map((s) => (
          <DraggableScheduleBlock
            key={`${s.id}::${user.id}`}
            schedule={s}
            rowUserId={user.id}
            typeMap={typeMap}
            startHour={startHour}
            totalMinutes={totalMinutes}
            onClick={(target) => onScheduleClick(s.id, target)}
            onResize={onResize}
          />
        ))}
      </div>
    </div>
  );
}

function DraggableScheduleBlock({
  schedule,
  rowUserId,
  typeMap,
  startHour,
  totalMinutes,
  onClick,
  onResize,
}: {
  schedule: Schedule;
  rowUserId: string;
  typeMap: Map<string, ScheduleType>;
  startHour: number;
  totalMinutes: number;
  onClick: (target: HTMLElement) => void;
  onResize: (id: string, newStart: Date, newEnd: Date) => void;
}) {
  const minutesFromStart = makeMinutesFromStart(startHour);
  const [resizing, setResizing] = useState<{
    side: "start" | "end";
    deltaPx: number;
  } | null>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `${schedule.id}::${rowUserId}`,
      disabled: resizing !== null,
    });
  const isCoAssignee =
    schedule.userIds.length > 1 && schedule.userIds[0] !== rowUserId;

  const baseLeft = pxFromMinutes(minutesFromStart(schedule.startAt));
  const baseWidth = pxFromMinutes(
    minutesFromStart(schedule.endAt) - minutesFromStart(schedule.startAt),
  );

  let displayLeft = baseLeft;
  let displayWidth = baseWidth;
  if (resizing) {
    if (resizing.side === "start") {
      displayLeft = baseLeft + resizing.deltaPx;
      displayWidth = baseWidth - resizing.deltaPx;
    } else {
      displayWidth = baseWidth + resizing.deltaPx;
    }
    if (displayWidth < 24) displayWidth = 24;
  }

  const type = typeMap.get(schedule.typeId);
  const bg = type?.color ?? "#646A73";
  const fg = isLightColor(bg) ? "#1F2329" : "#ffffff";
  const isResizing = resizing !== null;

  const style: React.CSSProperties = {
    left: displayLeft,
    width: Math.max(displayWidth - 2, 24),
    background: bg,
    color: fg,
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging || isResizing ? 50 : 1,
    cursor: isResizing ? "ew-resize" : isDragging ? "grabbing" : "grab",
  };

  function startResize(side: "start" | "end") {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      // 親のドラッグ・ナビゲーションを抑止
      e.stopPropagation();
      e.preventDefault();
      const handle = e.currentTarget;
      const startX = e.clientX;
      try {
        handle.setPointerCapture(e.pointerId);
      } catch {
        // captureが取れなくても処理は続行
      }
      setResizing({ side, deltaPx: 0 });

      const onMove = (ev: PointerEvent) => {
        setResizing({ side, deltaPx: ev.clientX - startX });
      };
      const onUp = (ev: PointerEvent) => {
        try {
          handle.releasePointerCapture(ev.pointerId);
        } catch {
          // ignore
        }
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);

        const finalDeltaPx = ev.clientX - startX;
        const slotsDelta = Math.round(finalDeltaPx / SLOT_WIDTH_PX);
        const minutesDelta = slotsDelta * SNAP_MIN;

        const origStartMin = minutesFromStart(schedule.startAt);
        const origEndMin = minutesFromStart(schedule.endAt);

        let newStartMin = origStartMin;
        let newEndMin = origEndMin;
        if (side === "start") {
          newStartMin = Math.min(
            origEndMin - MIN_DURATION_MIN,
            Math.max(0, origStartMin + minutesDelta),
          );
        } else {
          newEndMin = Math.max(
            origStartMin + MIN_DURATION_MIN,
            Math.min(totalMinutes, origEndMin + minutesDelta),
          );
        }

        setResizing(null);

        if (newStartMin === origStartMin && newEndMin === origEndMin) return;

        const newStart = new Date(schedule.startAt);
        newStart.setHours(startHour, 0, 0, 0);
        newStart.setMinutes(newStartMin);
        const newEnd = new Date(schedule.endAt);
        newEnd.setHours(startHour, 0, 0, 0);
        newEnd.setMinutes(newEndMin);

        onResize(schedule.id, newStart, newEnd);
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    };
  }

  // 表示用の時刻（リサイズ中はスナップ前の暫定値）
  function previewMinutes() {
    const origStartMin = minutesFromStart(schedule.startAt);
    const origEndMin = minutesFromStart(schedule.endAt);
    if (!resizing) return { startMin: origStartMin, endMin: origEndMin };
    const slotsDelta = Math.round(resizing.deltaPx / SLOT_WIDTH_PX);
    const minutesDelta = slotsDelta * SNAP_MIN;
    if (resizing.side === "start") {
      const startMin = Math.min(
        origEndMin - MIN_DURATION_MIN,
        Math.max(0, origStartMin + minutesDelta),
      );
      return { startMin, endMin: origEndMin };
    }
    const endMin = Math.max(
      origStartMin + MIN_DURATION_MIN,
      Math.min(totalMinutes, origEndMin + minutesDelta),
    );
    return { startMin: origStartMin, endMin };
  }

  function fmtMin(min: number) {
    const h = (Math.floor(min / 60) + startHour) % 24;
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  const { startMin, endMin } = previewMinutes();
  const startLabel = fmtMin(startMin);
  const endLabel = fmtMin(endMin);

  const blockClass =
    "absolute top-1 bottom-1 text-[12px] leading-tight overflow-hidden rounded-[var(--radius-s)] select-none group " +
    (isCoAssignee
      ? "border border-dashed border-white/70 ring-1 ring-black/10"
      : "border border-black/10");

  return (
    <div
      ref={setNodeRef}
      title={`${schedule.title}${schedule.caseNumber ? ` (${schedule.caseNumber})` : ""}${schedule.userIds.length > 1 ? ` / 担当者 ${schedule.userIds.length} 名` : ""}`}
      className={blockClass}
      style={style}
      onClick={(e) => {
        if (isDragging || isResizing) return;
        e.stopPropagation();
        onClick(e.currentTarget);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e.currentTarget);
        }
      }}
      {...listeners}
      {...attributes}
    >
      {/* 左ハンドル */}
      <div
        onPointerDown={startResize("start")}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden
      />

      {/* 中身 */}
      <div className="px-2 py-1 h-full">
        <div className="flex items-center justify-between gap-1">
          <span className="font-medium truncate">
            {startLabel}–{endLabel}
          </span>
          {schedule.userIds.length > 1 ? (
            <span
              className="shrink-0 text-[10px] px-1 py-0 rounded-[2px] bg-black/30"
              title={`担当者 ${schedule.userIds.length} 名`}
            >
              +{schedule.userIds.length - 1}
            </span>
          ) : null}
        </div>
        <div className="truncate">{schedule.title}</div>
        {schedule.caseNumber ? (
          <div className="truncate opacity-90 text-[11px]">
            {schedule.caseNumber}
          </div>
        ) : null}
      </div>

      {/* 右ハンドル */}
      <div
        onPointerDown={startResize("end")}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden
      />
    </div>
  );
}
