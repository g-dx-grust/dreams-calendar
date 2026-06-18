"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isScheduleTypeColorToken,
  normalizeScheduleTypeColor,
  scheduleTypeBackground,
  scheduleTypeForeground,
  SCHEDULE_TYPE_COLOR_OPTIONS,
} from "@/components/calendar/color-utils";

const formSchema = z.object({
  name: z.string().min(1, "種別名を入力してください").max(50),
  color: z
    .string()
    .refine(
      (value) => Boolean(isScheduleTypeColorToken(value)),
      "色を選択してください",
    ),
});

export type ScheduleTypeFormValues = z.infer<typeof formSchema>;

type Props = {
  defaultValues?: {
    name?: string;
    color?: string | null;
  };
  submitLabel: string;
  cancelHref: string;
  action: (
    formData: FormData,
  ) => Promise<{ ok: true } | { ok: false; error: string } | void>;
};

export function ScheduleTypeForm({
  defaultValues,
  submitLabel,
  cancelHref,
  action,
}: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ScheduleTypeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      color: normalizeScheduleTypeColor(defaultValues?.color),
    },
  });

  const colorValue = watch("color");
  const nameValue = watch("name");

  function onSubmit(values: ScheduleTypeFormValues) {
    setServerError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", values.name);
      fd.set("color", values.color);
      const result = await action(fd);
      if (result && "ok" in result && !result.ok) {
        setServerError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label>
          種別名 <span className="text-[var(--color-danger)]">*</span>
        </Label>
        <Input
          {...register("name")}
          placeholder="例：現場、社内、来客"
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name ? (
          <p className="text-[12px] text-[var(--color-danger)]">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>
          色 <span className="text-[var(--color-danger)]">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SCHEDULE_TYPE_COLOR_OPTIONS.map((option) => {
            const selected = colorValue === option.value;
            return (
              <label
                key={option.value}
                className={
                  "flex h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-s)] border px-2 text-[12px] " +
                  (selected
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                    : "border-[var(--color-border)] bg-white text-[var(--color-text-strong)] hover:border-[var(--color-border-strong)]")
                }
              >
                <input
                  type="radio"
                  value={option.value}
                  className="sr-only"
                  {...register("color")}
                />
                <span
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 rounded-[var(--radius-s)] border border-[var(--color-border)]"
                  style={{ background: scheduleTypeBackground(option.value) }}
                />
                <span className="truncate">{option.label}</span>
              </label>
            );
          })}
        </div>
        {errors.color ? (
          <p className="text-[12px] text-[var(--color-danger)]">
            {errors.color.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>プレビュー</Label>
        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-[var(--radius-s)] p-3">
          <span
            className="inline-block px-2 py-1 text-[12px] leading-tight border border-[var(--color-border)] rounded-[var(--radius-s)]"
            style={{
              background: scheduleTypeBackground(colorValue),
              color: scheduleTypeForeground(colorValue),
            }}
          >
            {nameValue || "種別名"}
          </span>
        </div>
      </div>

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
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? "保存中…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
