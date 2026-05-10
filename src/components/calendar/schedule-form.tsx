"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimePicker15 } from "./time-picker-15";
import type { CalendarUser, ScheduleType } from "./types";

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
    caseNumber: z.string().max(50).optional().or(z.literal("")),
    location: z.string().max(200).optional().or(z.literal("")),
    memo: z.string().max(2000).optional().or(z.literal("")),
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
  });

export type ScheduleFormValues = z.infer<typeof formSchema>;

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
  action: (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string } | void>;
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
      caseNumber: "",
      location: "",
      memo: "",
      ...defaultValues,
    },
  });

  const watchedUserIds = watch("userIds") ?? [];
  const isAllDay = watch("isAllDay") ?? false;
  const initialSet = new Set(initialUserIds ?? []);
  // 通知対象 = 現在選択されているが、初期に含まれず、かつ自分でないユーザー
  const inviteCandidates = watchedUserIds.filter(
    (id) => !initialSet.has(id) && id !== selfUserId,
  );

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
      if (values.caseNumber) fd.set("caseNumber", values.caseNumber);
      if (values.location) fd.set("location", values.location);
      if (values.memo) fd.set("memo", values.memo);

      const result = await action(fd);
      if (result && "ok" in result && !result.ok) {
        setServerError(result.error);
      }
    });
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
        label="案件番号"
        hint="kanri-system 接続後にサジェスト検索が有効になります"
        error={errors.caseNumber?.message}
      >
        <Input
          {...register("caseNumber")}
          placeholder="例：2026-LI-001"
        />
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
