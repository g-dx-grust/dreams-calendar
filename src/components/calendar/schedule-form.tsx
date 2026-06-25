"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimePicker15 } from "./time-picker-15";
import {
  SCHEDULE_STATUS_LABEL,
  type CalendarUser,
  type ScheduleStatus,
  type ScheduleType,
} from "./types";

const SCHEDULE_STATUSES = [
  "planned",
  "in_progress",
  "done",
  "carried_over",
  "cancelled",
] as const satisfies readonly ScheduleStatus[];

const formSchema = z
  .object({
    title: z.string().min(1, "タイトルを入力してください").max(200),
    userIds: z
      .array(z.string().min(1))
      .min(1, "担当者を 1 人以上選択してください"),
    typeId: z.string().min(1, "予定種別を選択してください"),
    isAllDay: z.boolean(),
    startDate: z.string().min(1, "日付を入力してください"),
    endDate: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    caseId: z.string().optional().or(z.literal("")),
    caseNumber: z.string().max(50).optional().or(z.literal("")),
    caseName: z.string().max(200).optional().or(z.literal("")),
    location: z.string().max(200).optional().or(z.literal("")),
    memo: z.string().max(2000).optional().or(z.literal("")),
    status: z.enum(SCHEDULE_STATUSES),
    actualStartAt: z.string().optional().or(z.literal("")),
    actualEndAt: z.string().optional().or(z.literal("")),
    actualMinutes: z.string().optional().or(z.literal("")),
    actualMemo: z.string().max(2000).optional().or(z.literal("")),
    onlineMeetingUrl: z.string().url("会議URLが不正です").optional().or(z.literal("")),
    larkEventId: z.string().max(200).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.isAllDay) {
      if (!v.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: "終了日を入力してください",
        });
      } else if (v.endDate < v.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: "終了日は開始日以降に設定してください",
        });
      }
    } else {
      if (!v.startTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["startTime"],
          message: "開始時刻を入力してください",
        });
      }
      if (!v.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endTime"],
          message: "終了時刻を入力してください",
        });
      }
      if (v.startTime && v.endTime && v.startTime >= v.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endTime"],
          message: "終了時刻は開始時刻より後に設定してください",
        });
      }
    }

    const hasActualStart = Boolean(v.actualStartAt);
    const hasActualEnd = Boolean(v.actualEndAt);
    if (hasActualStart !== hasActualEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actualEndAt"],
        message: "作業開始と作業終了はセットで入力してください",
      });
    }
    if (
      v.actualStartAt &&
      v.actualEndAt &&
      new Date(v.actualStartAt) >= new Date(v.actualEndAt)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actualEndAt"],
        message: "作業終了は作業開始より後に設定してください",
      });
    }

    const actualMinutes = v.actualMinutes ? Number(v.actualMinutes) : null;
    if (
      v.actualMinutes &&
      (!Number.isInteger(actualMinutes) ||
        actualMinutes == null ||
        actualMinutes <= 0 ||
        actualMinutes > 1440)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actualMinutes"],
        message: "作業時間は1〜1440分で入力してください",
      });
    }
    if (v.status === "done" && !v.actualMinutes && !hasActualStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actualMinutes"],
        message: "完了にする場合は作業時間（実施時間）を入力してください",
      });
    }
  });

export type ScheduleFormValues = z.infer<typeof formSchema>;

type CaseOption = {
  id: number;
  caseNumber: string;
  caseName: string;
};

type CaseSearchResponse = {
  items?: CaseOption[];
  error?: string;
};

type Props = {
  users: CalendarUser[];
  scheduleTypes: ScheduleType[];
  defaultValues?: Partial<ScheduleFormValues>;
  submitLabel: string;
  cancelHref: string;
  /** 「自分」を判定して未選択時はデフォルトに含める / バッジ表示 */
  selfUserId?: string | null;
  /** 既存予定の編集時、すでに含まれている userIds（招待通知判定の表示に使用） */
  initialUserIds?: string[];
  action: (
    formData: FormData,
  ) => Promise<{ ok: true } | { ok: false; error: string } | void>;
};

export function ScheduleForm({
  users,
  scheduleTypes,
  defaultValues,
  submitLabel,
  cancelHref,
  selfUserId,
  initialUserIds,
  action,
}: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fallbackInitial =
    initialUserIds && initialUserIds.length > 0
      ? initialUserIds
      : selfUserId
        ? [selfUserId]
        : users[0]
          ? [users[0].id]
          : [];

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      userIds: fallbackInitial,
      typeId: scheduleTypes[0]?.id ?? "",
      isAllDay: false,
      startDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      caseId: "",
      caseNumber: "",
      caseName: "",
      location: "",
      memo: "",
      status: "planned",
      actualStartAt: "",
      actualEndAt: "",
      actualMinutes: "",
      actualMemo: "",
      onlineMeetingUrl: "",
      larkEventId: "",
      ...defaultValues,
    },
  });

  const watchedUserIds = watch("userIds") ?? [];
  const isAllDay = watch("isAllDay") ?? false;
  const title = watch("title") ?? "";
  const startDate = watch("startDate") ?? "";
  const endDate = watch("endDate") ?? "";
  const startTime = watch("startTime") ?? "";
  const endTime = watch("endTime") ?? "";
  const caseNumber = watch("caseNumber") ?? "";
  const selectedCaseId = watch("caseId") ?? "";
  const selectedCaseName = watch("caseName") ?? "";
  const status = watch("status") ?? "planned";
  const typeId = watch("typeId") ?? "";
  const onlineMeetingUrl = watch("onlineMeetingUrl") ?? "";
  const larkEventId = watch("larkEventId") ?? "";
  const selectedType = scheduleTypes.find((item) => item.id === typeId);
  const isOnlineType =
    selectedType?.id === "online" || selectedType?.name === "オンライン";
  const caseNumberField = register("caseNumber");
  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([]);
  const [isCaseSearching, setIsCaseSearching] = useState(false);
  const [caseSearchError, setCaseSearchError] = useState<string | null>(null);
  const [isCaseSuggestOpen, setIsCaseSuggestOpen] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [isMeetingGenerating, setIsMeetingGenerating] = useState(false);
  const initialSet = new Set(initialUserIds ?? []);
  // 通知対象 = 現在選択されているが、初期に含まれず、かつ自分でないユーザー
  const inviteCandidates = watchedUserIds.filter(
    (id) => !initialSet.has(id) && id !== selfUserId,
  );
  const hasCaseSearchKeyword = caseNumber.trim().length >= 2;
  const showCaseSearchPanel = isCaseSuggestOpen && hasCaseSearchKeyword;

  useEffect(() => {
    const keyword = caseNumber.trim();
    let cancelled = false;

    if (keyword.length < 2) {
      setCaseOptions([]);
      setCaseSearchError(null);
      setIsCaseSearching(false);
      return;
    }

    setIsCaseSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/cases/search?q=${encodeURIComponent(keyword)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as CaseSearchResponse;
        if (cancelled) return;

        if (!response.ok) {
          setCaseOptions([]);
          setCaseSearchError(
            payload.error ?? "案件検索に失敗しました。時間をおいて再度お試しください。",
          );
          return;
        }

        setCaseOptions(payload.items ?? []);
        setCaseSearchError(null);
      } catch {
        if (!cancelled) {
          setCaseOptions([]);
          setCaseSearchError(
            "案件検索に失敗しました。時間をおいて再度お試しください。",
          );
        }
      } finally {
        if (!cancelled) setIsCaseSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [caseNumber]);

  useEffect(() => {
    if (!isOnlineType || onlineMeetingUrl || larkEventId) return;
    void generateLarkMeetingUrl();
    // 初回発行だけを自動化し、入力変更時の再発行はボタン操作に寄せる。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnlineType, onlineMeetingUrl, larkEventId]);

  function selectCase(option: CaseOption) {
    setValue("caseId", String(option.id), {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("caseNumber", option.caseNumber, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("caseName", option.caseName, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setIsCaseSuggestOpen(false);
  }

  function clearSelectedCase() {
    setValue("caseId", "", { shouldDirty: true, shouldValidate: true });
    setValue("caseName", "", { shouldDirty: true, shouldValidate: true });
  }

  function onSubmit(values: ScheduleFormValues) {
    setServerError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("title", values.title);
      for (const uid of values.userIds) {
        fd.append("userIds", uid);
      }
      fd.set("typeId", values.typeId);
      fd.set("isAllDay", values.isAllDay ? "true" : "false");
      if (values.isAllDay) {
        fd.set("startAt", `${values.startDate}T00:00`);
        fd.set("endAt", `${values.endDate}T23:59`);
      } else {
        fd.set("startAt", `${values.startDate}T${values.startTime}`);
        fd.set("endAt", `${values.startDate}T${values.endTime}`);
      }
      if (values.caseId) fd.set("caseId", values.caseId);
      if (values.caseNumber) fd.set("caseNumber", values.caseNumber);
      if (values.caseName) fd.set("caseName", values.caseName);
      if (values.location) fd.set("location", values.location);
      if (values.memo) fd.set("memo", values.memo);
      fd.set("status", values.status);
      if (values.actualStartAt) fd.set("actualStartAt", values.actualStartAt);
      if (values.actualEndAt) fd.set("actualEndAt", values.actualEndAt);
      if (values.actualMinutes) fd.set("actualMinutes", values.actualMinutes);
      if (values.actualMemo) fd.set("actualMemo", values.actualMemo);
      if (values.onlineMeetingUrl) {
        fd.set("onlineMeetingUrl", values.onlineMeetingUrl);
      }
      if (values.larkEventId) fd.set("larkEventId", values.larkEventId);

      const result = await action(fd);
      if (result && "ok" in result && !result.ok) {
        setServerError(result.error);
      }
    });
  }

  async function generateLarkMeetingUrl(force = false) {
    if (isMeetingGenerating) return;
    const mainAssigneeId = watchedUserIds[0] ?? "";
    const startAt = toIsoFromLocal(startDate, startTime);
    const endAt = toIsoFromLocal(isAllDay ? endDate : startDate, endTime);
    if (!isOnlineType || isAllDay) return;
    if (!mainAssigneeId || !startAt || !endAt) return;
    if (!force && onlineMeetingUrl) return;

    setMeetingError(null);
    setIsMeetingGenerating(true);
    try {
      const response = await fetch("/api/calendar/meeting-url/lark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "オンライン予定",
          startAt,
          endAt,
          mainAssigneeId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: {
              meetingUrl?: string;
              larkEventId?: string | null;
            };
            error?: string;
          }
        | null;
      if (!response.ok || !payload?.data?.meetingUrl) {
        setMeetingError(
          payload?.error ??
            "Lark会議URLを発行できませんでした。Larkで再ログインしてください。",
        );
        return;
      }
      setValue("onlineMeetingUrl", payload.data.meetingUrl, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue("larkEventId", payload.data.larkEventId ?? "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    } catch {
      setMeetingError(
        "Lark会議URLを発行できませんでした。時間をおいて再度お試しください。",
      );
    } finally {
      setIsMeetingGenerating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Field label="タイトル" required error={errors.title?.message}>
        <Input
          {...register("title")}
          placeholder="例：豊橋市A現場 立会"
          aria-invalid={Boolean(errors.title)}
        />
      </Field>

      <Field
        label="担当者"
        required
        error={errors.userIds?.message}
      >
        <Controller
          control={control}
          name="userIds"
          render={({ field }) => (
            <UserMultiSelect
              users={users}
              selectedIds={field.value}
              onChange={field.onChange}
              selfUserId={selfUserId ?? null}
              initialIds={initialUserIds ?? []}
            />
          )}
        />
        {inviteCandidates.length > 0 ? (
          <p className="text-[12px] text-[var(--color-primary)] mt-2">
            保存時に {inviteCandidates.length} 名へ Lark で招待通知を送信します。
          </p>
        ) : null}
      </Field>

      <Field label="予定種別" required error={errors.typeId?.message}>
        <Select {...register("typeId")}>
          {scheduleTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>

      {isOnlineType ? (
        <Field
          label="会議URL"
          hint="Larkの主カレンダーに会議予定を作成し、予定詳細に表示します。"
          error={meetingError ?? errors.onlineMeetingUrl?.message}
        >
          <input type="hidden" {...register("larkEventId")} />
          <div className="flex flex-wrap gap-2">
            <Input
              {...register("onlineMeetingUrl")}
              readOnly
              className="flex-1 min-w-[260px]"
              placeholder={isMeetingGenerating ? "会議URLを発行中…" : ""}
            />
            <button
              type="button"
              onClick={() => void generateLarkMeetingUrl(true)}
              disabled={isMeetingGenerating || isAllDay}
              className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-m)] border border-[var(--color-border)] bg-white px-3 text-[13px] text-[var(--color-text-strong)] hover:bg-[var(--color-background)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Video size={14} />
              {isMeetingGenerating ? "発行中…" : "Larkで再発行する"}
            </button>
          </div>
        </Field>
      ) : null}

      <Field label="ステータス" required error={errors.status?.message}>
        <Select {...register("status")}>
          {SCHEDULE_STATUSES.map((item) => (
            <option key={item} value={item}>
              {SCHEDULE_STATUS_LABEL[item]}
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-1.5">
        <Label>
          日時 <span className="ml-1 text-[var(--color-danger)]">*</span>
        </Label>
        <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-3 space-y-2">
          <label className="inline-flex items-center gap-2 text-[13px] text-[var(--color-text-strong)] cursor-pointer">
            <input
              type="checkbox"
              {...register("isAllDay")}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            終日
          </label>
          {isAllDay ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                {...register("startDate")}
                className="h-9 px-3 text-[14px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-s)] focus:border-[var(--color-primary)] focus:outline-none flex-1 min-w-[160px]"
                aria-invalid={Boolean(errors.startDate)}
              />
              <span className="text-[14px] text-[var(--color-text-mid)]">〜</span>
              <input
                type="date"
                {...register("endDate")}
                className="h-9 px-3 text-[14px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-s)] focus:border-[var(--color-primary)] focus:outline-none flex-1 min-w-[160px]"
                aria-invalid={Boolean(errors.endDate)}
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                {...register("startDate")}
                className="h-9 px-3 text-[14px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-s)] focus:border-[var(--color-primary)] focus:outline-none flex-1 min-w-[160px]"
                aria-invalid={Boolean(errors.startDate)}
              />
              <Controller
                control={control}
                name="startTime"
                render={({ field }) => (
                  <TimePicker15
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    ariaInvalid={Boolean(errors.startTime)}
                  />
                )}
              />
              <span className="text-[14px] text-[var(--color-text-mid)]">〜</span>
              <Controller
                control={control}
                name="endTime"
                render={({ field }) => (
                  <TimePicker15
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    ariaInvalid={Boolean(errors.endTime)}
                  />
                )}
              />
            </div>
          )}
        </div>
        {errors.startDate ? (
          <p className="text-[12px] text-[var(--color-danger)]">
            {errors.startDate.message}
          </p>
        ) : errors.endDate ? (
          <p className="text-[12px] text-[var(--color-danger)]">
            {errors.endDate.message}
          </p>
        ) : errors.startTime ? (
          <p className="text-[12px] text-[var(--color-danger)]">
            {errors.startTime.message}
          </p>
        ) : errors.endTime ? (
          <p className="text-[12px] text-[var(--color-danger)]">
            {errors.endTime.message}
          </p>
        ) : null}
      </div>

      <Field
        label="作業時間（実施時間）"
        hint={
          status === "done"
            ? "完了にする場合は作業時間（実施時間）を入力してください。案件別集計に反映されます。"
            : "完了ステータスにすると案件別の作業時間として集計されます。"
        }
        error={
          errors.actualStartAt?.message ||
          errors.actualEndAt?.message ||
          errors.actualMinutes?.message ||
          errors.actualMemo?.message
        }
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_120px]">
          <label className="space-y-1">
            <span className="block text-[12px] text-[var(--color-text-mid)]">
              作業開始
            </span>
            <input
              type="datetime-local"
              {...register("actualStartAt")}
              className="h-9 w-full px-3 text-[14px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-s)] focus:border-[var(--color-primary)] focus:outline-none"
              aria-invalid={Boolean(errors.actualStartAt)}
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[12px] text-[var(--color-text-mid)]">
              作業終了
            </span>
            <input
              type="datetime-local"
              {...register("actualEndAt")}
              className="h-9 w-full px-3 text-[14px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-s)] focus:border-[var(--color-primary)] focus:outline-none"
              aria-invalid={Boolean(errors.actualEndAt)}
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[12px] text-[var(--color-text-mid)]">
              作業分
            </span>
            <input
              type="number"
              min={1}
              max={1440}
              step={1}
              inputMode="numeric"
              {...register("actualMinutes")}
              className="h-9 w-full px-3 text-[14px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-s)] focus:border-[var(--color-primary)] focus:outline-none"
              aria-invalid={Boolean(errors.actualMinutes)}
            />
          </label>
        </div>
        <label className="mt-2 block space-y-1">
          <span className="block text-[12px] text-[var(--color-text-mid)]">
            作業メモ
          </span>
          <textarea
            {...register("actualMemo")}
            rows={3}
            className="w-full px-3 py-2 text-[14px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-m)] placeholder:text-[var(--color-text-weak)] focus:border-[var(--color-primary)] focus:outline-none resize-y"
            placeholder="作業時間の理由や所感を記入"
          />
        </label>
      </Field>

      <Field
        label="案件番号"
        hint="2文字以上でkanri-systemの案件を検索します。選択しない場合は番号だけ保存されます。"
        error={errors.caseNumber?.message}
      >
        <input type="hidden" {...register("caseId")} />
        <input type="hidden" {...register("caseName")} />
        <div className="relative">
          <Input
            {...caseNumberField}
            autoComplete="off"
            placeholder="例：2026-LI-001"
            aria-autocomplete="list"
            aria-expanded={showCaseSearchPanel}
            onFocus={() => setIsCaseSuggestOpen(true)}
            onChange={(event) => {
              caseNumberField.onChange(event);
              clearSelectedCase();
              setIsCaseSuggestOpen(true);
            }}
          />
          {showCaseSearchPanel ? (
            <CaseSuggestionPanel
              options={caseOptions}
              isSearching={isCaseSearching}
              error={caseSearchError}
              onSelect={selectCase}
            />
          ) : null}
        </div>
        {selectedCaseId && selectedCaseName ? (
          <p className="text-[12px] text-[var(--color-text-mid)]">
            紐付け先：{selectedCaseName}
          </p>
        ) : null}
      </Field>

      <Field label="場所" error={errors.location?.message}>
        <Input
          {...register("location")}
          placeholder="例：愛知県豊橋市…"
        />
      </Field>

      <Field label="メモ" error={errors.memo?.message}>
        <textarea
          {...register("memo")}
          rows={4}
          className="w-full px-3 py-2 text-[14px] bg-white text-[var(--color-text-strong)] border border-[var(--color-border)] rounded-[var(--radius-m)] placeholder:text-[var(--color-text-weak)] focus:border-[var(--color-primary)] focus:outline-none resize-y"
          placeholder="補足事項があれば記入"
        />
      </Field>

      {serverError ? (
        <div
          role="alert"
          className="text-[13px] text-[var(--color-danger)] border border-[var(--color-danger)] rounded-[var(--radius-s)] px-3 py-2"
        >
          {serverError}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
        <Link
          href={cancelHref}
          className="text-[13px] text-[var(--color-text-mid)] hover:text-[var(--color-text-strong)] px-3 py-2"
        >
          キャンセル
        </Link>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => router.back()}
        >
          戻る
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? "保存中…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? (
          <span className="ml-1 text-[var(--color-danger)]">*</span>
        ) : null}
      </Label>
      {children}
      {hint ? (
        <p className="text-[12px] text-[var(--color-text-weak)]">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-[12px] text-[var(--color-danger)]">{error}</p>
      ) : null}
    </div>
  );
}

function CaseSuggestionPanel({
  options,
  isSearching,
  error,
  onSelect,
}: {
  options: CaseOption[];
  isSearching: boolean;
  error: string | null;
  onSelect: (option: CaseOption) => void;
}) {
  return (
    <div
      role="listbox"
      className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-[var(--radius-m)] border border-[var(--color-border)] bg-white"
    >
      {isSearching ? (
        <div className="px-3 py-2 text-[13px] text-[var(--color-text-mid)]">
          検索中…
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="px-3 py-2 text-[13px] text-[var(--color-danger)]"
        >
          {error}
        </div>
      ) : null}
      {!isSearching && !error && options.length === 0 ? (
        <div className="px-3 py-2 text-[13px] text-[var(--color-text-mid)]">
          一致する案件がありません。
        </div>
      ) : null}
      {!error
        ? options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(option)}
              className="block w-full border-t border-[var(--color-border)] px-3 py-2 text-left first:border-t-0 hover:bg-[var(--color-background)] focus:bg-[var(--color-background)] focus:outline-none"
            >
              <span className="block text-[13px] font-medium text-[var(--color-text-strong)]">
                {option.caseNumber}
              </span>
              <span className="block text-[12px] text-[var(--color-text-mid)]">
                {option.caseName}
              </span>
            </button>
          ))
        : null}
    </div>
  );
}

const Select = ({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={
      "h-9 w-full px-3 text-[14px] bg-white text-[var(--color-text-strong)] " +
      "border border-[var(--color-border)] rounded-[var(--radius-m)] " +
      "focus:border-[var(--color-primary)] focus:outline-none " +
      (className ?? "")
    }
    {...props}
  />
);

function toIsoFromLocal(date: string, time: string) {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function UserMultiSelect({
  users,
  selectedIds,
  onChange,
  selfUserId,
  initialIds,
}: {
  users: CalendarUser[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  selfUserId: string | null;
  initialIds: string[];
}) {
  const initialSet = new Set(initialIds);
  const selectedSet = new Set(selectedIds);
  const selected = users.filter((u) => selectedSet.has(u.id));
  const candidates = users.filter((u) => !selectedSet.has(u.id));

  function add(id: string) {
    if (selectedSet.has(id)) return;
    onChange([...selectedIds, id]);
  }
  function remove(id: string) {
    // 担当者は最低 1 名残す
    if (selectedIds.length <= 1) return;
    onChange(selectedIds.filter((u) => u !== id));
  }

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-2">
      {/* 選択済みチップ */}
      <div className="flex flex-wrap gap-1.5">
        {selected.length === 0 ? (
          <span className="text-[12px] text-[var(--color-text-weak)] px-1 py-1">
            担当者を追加してください
          </span>
        ) : (
          selected.map((u) => {
            const isSelf = u.id === selfUserId;
            const isInvited = !initialSet.has(u.id) && !isSelf;
            return (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[12px] rounded-[var(--radius-s)] border bg-[var(--color-primary-soft)] border-[var(--color-primary)] text-[var(--color-primary)]"
              >
                <span className="font-medium">{u.name}</span>
                {isSelf ? (
                  <span className="text-[10px] px-1 rounded-[2px] bg-[var(--color-primary)] text-white">
                    自分
                  </span>
                ) : null}
                {isInvited ? (
                  <span
                    className="text-[10px] px-1 rounded-[2px] bg-[var(--color-warning)] text-white"
                    title="保存時に Lark で招待通知が送信されます"
                  >
                    招待
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(u.id)}
                  disabled={selectedIds.length <= 1}
                  className="ml-0.5 p-0.5 rounded-[2px] hover:bg-white/40 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label={`${u.name} を外す`}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })
        )}
      </div>

      {/* 追加候補 */}
      {candidates.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-[var(--color-border)]">
          <span className="text-[11px] text-[var(--color-text-weak)] mr-1 self-center">
            追加：
          </span>
          {candidates.map((u) => {
            const isSelf = u.id === selfUserId;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => add(u.id)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] rounded-[var(--radius-s)] border border-[var(--color-border)] bg-white text-[var(--color-text-strong)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              >
                <Plus size={12} />
                {u.name}
                {isSelf ? null : (
                  <span className="text-[10px] text-[var(--color-warning)]">
                    招待
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
