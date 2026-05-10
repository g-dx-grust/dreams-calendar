import type { CalendarUser, Schedule, ScheduleType } from "./types";

// see: docs/02_database_schema.md 初期データ
export const SCHEDULE_TYPES: ScheduleType[] = [
  { id: "important", name: "重要", color: "#F54A45" },
  { id: "field", name: "現場", color: "#3370FF" },
  { id: "internal", name: "社内", color: "#646A73" },
  { id: "external", name: "社外", color: "#34C724" },
  { id: "office", name: "役所", color: "#FF8800" },
  { id: "survey", name: "測量", color: "#8F959E" },
  { id: "registration", name: "登記", color: "#C5C8CE" },
  { id: "application", name: "申請", color: "#DEE0E3" },
  { id: "guest", name: "来客", color: "#4E83FF" },
  { id: "transit", name: "移動", color: "#1F2329" },
];

export const MOCK_USERS: CalendarUser[] = [
  { id: "u1", name: "山田 太郎" },
  { id: "u2", name: "鈴木 花子" },
  { id: "u3", name: "佐藤 次郎" },
  { id: "u4", name: "田中 美咲" },
  { id: "u5", name: "高橋 健一" },
];

function at(dayOffset: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const RAW_SCHEDULES: Omit<Schedule, "status" | "isAllDay">[] = [
  // === 今日 ===
  {
    id: "s1",
    userIds: ["u1"],
    title: "豊橋市A現場 立会",
    caseNumber: "2026-LI-001",
    typeId: "field",
    startAt: at(0, 8, 30),
    endAt: at(0, 10, 0),
  },
  {
    id: "s2",
    userIds: ["u1"],
    title: "移動",
    typeId: "transit",
    startAt: at(0, 10, 0),
    endAt: at(0, 11, 0),
  },
  {
    id: "s3",
    userIds: ["u2"],
    title: "法務局 登記申請",
    caseNumber: "2026-FC-002",
    typeId: "office",
    startAt: at(0, 9, 0),
    endAt: at(0, 11, 30),
  },
  {
    id: "s4",
    userIds: ["u3", "u1", "u5"],
    title: "社内ミーティング",
    caseNumber: "2026-BS-003",
    typeId: "internal",
    startAt: at(0, 8, 0),
    endAt: at(0, 9, 30),
  },
  {
    id: "s5",
    userIds: ["u3"],
    title: "来客対応 ハウスパレット様",
    typeId: "guest",
    startAt: at(0, 10, 0),
    endAt: at(0, 11, 0),
  },
  {
    id: "s6",
    userIds: ["u2"],
    title: "書類作成",
    typeId: "internal",
    startAt: at(0, 13, 0),
    endAt: at(0, 15, 0),
  },
  {
    id: "s7",
    userIds: ["u4"],
    title: "測量 名古屋市B現場",
    caseNumber: "2026-LI-004",
    typeId: "survey",
    startAt: at(0, 8, 30),
    endAt: at(0, 12, 0),
  },
  {
    id: "s8",
    userIds: ["u5", "u1", "u3"],
    title: "重要：役員会",
    typeId: "important",
    startAt: at(0, 14, 0),
    endAt: at(0, 16, 0),
  },
  {
    id: "s9",
    userIds: ["u1"],
    title: "豊橋市A現場 続き",
    caseNumber: "2026-LI-001",
    typeId: "field",
    startAt: at(0, 13, 30),
    endAt: at(0, 17, 0),
  },

  // === 明日 ===
  {
    id: "s10",
    userIds: ["u2", "u1"],
    title: "C現場 図面打ち合わせ",
    caseNumber: "2026-LI-005",
    typeId: "field",
    startAt: at(1, 9, 0),
    endAt: at(1, 11, 0),
  },
  {
    id: "s11",
    userIds: ["u3"],
    title: "市役所 申請手続き",
    caseNumber: "2026-FC-006",
    typeId: "office",
    startAt: at(1, 13, 0),
    endAt: at(1, 15, 30),
  },
  {
    id: "s12",
    userIds: ["u4"],
    title: "測量データ整理",
    caseNumber: "2026-LI-004",
    typeId: "internal",
    startAt: at(1, 14, 0),
    endAt: at(1, 17, 0),
  },

  // === 明後日 ===
  {
    id: "s13",
    userIds: ["u1", "u2"],
    title: "新規顧客 ヒアリング",
    typeId: "external",
    startAt: at(2, 10, 0),
    endAt: at(2, 12, 0),
  },
  {
    id: "s14",
    userIds: ["u5"],
    title: "重要：四半期レビュー",
    typeId: "important",
    startAt: at(2, 13, 0),
    endAt: at(2, 16, 0),
  },

  // === 3日後 ===
  {
    id: "s15",
    userIds: ["u2"],
    title: "登記書類受領",
    caseNumber: "2026-FC-002",
    typeId: "registration",
    startAt: at(3, 11, 0),
    endAt: at(3, 12, 0),
  },

  // === 4日後 ===
  {
    id: "s16",
    userIds: ["u3"],
    title: "申請書 再提出",
    typeId: "application",
    startAt: at(4, 9, 30),
    endAt: at(4, 10, 30),
  },
  {
    id: "s17",
    userIds: ["u4"],
    title: "D現場 測量",
    caseNumber: "2026-LI-007",
    typeId: "survey",
    startAt: at(4, 13, 0),
    endAt: at(4, 17, 0),
  },

  // === 昨日 ===
  {
    id: "s18",
    userIds: ["u1"],
    title: "前日打ち合わせ",
    typeId: "internal",
    startAt: at(-1, 14, 0),
    endAt: at(-1, 15, 0),
  },
  {
    id: "s19",
    userIds: ["u5"],
    title: "現場視察",
    caseNumber: "2026-LI-001",
    typeId: "field",
    startAt: at(-1, 10, 0),
    endAt: at(-1, 12, 30),
  },

  // === 2日前 ===
  {
    id: "s20",
    userIds: ["u2"],
    title: "案件キックオフ",
    caseNumber: "2026-LI-005",
    typeId: "internal",
    startAt: at(-2, 9, 0),
    endAt: at(-2, 10, 0),
  },
];

// 過去日のうち一部は完了済みにしておく
const DONE_IDS = new Set(["s18", "s19", "s20"]);

export const MOCK_SCHEDULES: Schedule[] = RAW_SCHEDULES.map((s) => ({
  ...s,
  isAllDay: false,
  status: DONE_IDS.has(s.id) ? "done" : "planned",
}));
