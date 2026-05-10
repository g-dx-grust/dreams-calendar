export type ScheduleType = {
  id: string;
  name: string;
  color: string;
};

export type CalendarUser = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  larkOpenId?: string | null;
};

// see: docs/02_database_schema.md schedules.status
export type ScheduleStatus =
  | "planned"
  | "in_progress"
  | "done"
  | "carried_over"
  | "cancelled";

export const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  planned: "予定",
  in_progress: "進行中",
  done: "完了",
  carried_over: "持ち越し",
  cancelled: "中止",
};

export type DailyReport = {
  id: string;
  userId: string;
  reportDate: string; // YYYY-MM-DD
  body: string;
  submittedAt: Date;
  updatedAt: Date;
};

export type DailyReportReply = {
  id: string;
  reportId: string;
  userId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Schedule = {
  id: string;
  userIds: string[]; // 担当者（複数可、最低 1 人）
  title: string;
  caseNumber?: string;
  typeId: string;
  startAt: Date;
  endAt: Date;
  isAllDay: boolean;
  location?: string;
  memo?: string;
  status: ScheduleStatus;
};
