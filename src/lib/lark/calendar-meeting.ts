import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  LarkApiError,
  postLarkApiWithUserAccessToken,
} from "./provider-client";

type LarkPrimaryCalendarResponse = {
  calendar?: {
    calendar_id?: string;
  };
  calendars?: Array<{
    calendar?: {
      calendar_id?: string;
    };
  }>;
};

type LarkCalendarEventCreateResponse = {
  event?: {
    event_id?: string;
    app_link?: string;
    vchat?: {
      meeting_url?: string;
    };
  };
};

export type CreateLarkMeetingInput = {
  title: string;
  startAt: string;
  endAt: string;
  userId: string;
  userAccessToken: string;
};

export type LarkMeetingResult = {
  meetingUrl: string;
  larkEventId: string | null;
  appLink: string | null;
};

export async function createLarkMeetingUrlForCurrentUser(
  input: CreateLarkMeetingInput,
): Promise<LarkMeetingResult> {
  const calendarId = await ensurePrimaryCalendarId(
    input.userId,
    input.userAccessToken,
  );
  const data = await postLarkApiWithUserAccessToken<LarkCalendarEventCreateResponse>(
    input.userAccessToken,
    `/calendar/v4/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      summary: input.title || "オンライン予定",
      start_time: toLarkEventTime(input.startAt),
      end_time: toLarkEventTime(input.endAt),
      vchat: {
        vc_type: "vc",
        meeting_settings: {
          allow_attendees_start: true,
        },
      },
    },
  );

  const meetingUrl = data.event?.vchat?.meeting_url ?? null;
  if (!meetingUrl) {
    throw new LarkApiError(
      502,
      "lark_meeting_url_missing",
      "Lark会議URLを取得できませんでした",
    );
  }

  return {
    meetingUrl,
    larkEventId: data.event?.event_id ?? null,
    appLink: data.event?.app_link ?? null,
  };
}

export async function ensurePrimaryCalendarId(
  userId: string,
  userAccessToken: string,
) {
  const existing = await getStoredCalendarId(userId);
  if (existing) return existing;

  const calendarId = await fetchPrimaryLarkCalendarId(userAccessToken);
  await saveStoredCalendarId(userId, calendarId);
  return calendarId;
}

async function fetchPrimaryLarkCalendarId(userAccessToken: string) {
  const data = await postLarkApiWithUserAccessToken<LarkPrimaryCalendarResponse>(
    userAccessToken,
    "/calendar/v4/calendars/primary",
  );
  const calendarId =
    data.calendar?.calendar_id ??
    data.calendars
      ?.map((item) => item.calendar?.calendar_id?.trim())
      .find((value): value is string => Boolean(value));

  if (!calendarId) {
    throw new LarkApiError(
      502,
      "lark_primary_calendar_id_missing",
      "Lark主カレンダーIDを取得できませんでした",
    );
  }
  return calendarId;
}

async function getStoredCalendarId(userId: string) {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("calendar_user_profiles")
    .select("lark_calendar_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return ((data as { lark_calendar_id?: string | null }).lark_calendar_id ?? "").trim() || null;
}

async function saveStoredCalendarId(userId: string, calendarId: string) {
  const db = getSupabaseAdmin();
  if (!db) return;
  await db
    .from("calendar_user_profiles")
    .update({
      lark_calendar_id: calendarId,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

function toLarkEventTime(value: string) {
  return {
    timestamp: Math.floor(new Date(value).getTime() / 1000).toString(),
    timezone: "Asia/Tokyo",
  };
}
