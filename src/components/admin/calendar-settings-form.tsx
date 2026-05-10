"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const formSchema = z
  .object({
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
  })
  .refine((v) => v.endHour > v.startHour, {
    message: "終了時刻は開始時刻より後に指定してください",
    path: ["endHour"],
  });

type FormValues = z.infer<typeof formSchema>;

type Props = {
  defaultValues: FormValues;
  cancelHref: string;
  action: (
    formData: FormData,
  ) => Promise<{ ok: true } | { ok: false; error: string } | void>;
};

export function CalendarSettingsForm({
  defaultValues,
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
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const startHourValue = Number(watch("startHour"));
  const endHourValue = Number(watch("endHour"));

  function onSubmit(values: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("startHour", String(values.startHour));
      fd.set("endHour", String(values.endHour));
      const result = await action(fd);
      if (result && "ok" in result && !result.ok) {
        setServerError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label>
            開始時刻 <span className="text-[var(--color-danger)]">*</span>
          </Label>
          <Select {...register("startHour", { valueAsNumber: true })}>
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {String(i).padStart(2, "0")}:00
              </option>
            ))}
          </Select>
          {errors.startHour ? (
            <p className="text-[12px] text-[var(--color-danger)]">
              {errors.startHour.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label>
            終了時刻 <span className="text-[var(--color-danger)]">*</span>
          </Label>
          <Select {...register("endHour", { valueAsNumber: true })}>
            {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>
                {String(h % 24).padStart(2, "0")}:00
                {h === 24 ? "（翌 00:00）" : ""}
              </option>
            ))}
          </Select>
          {errors.endHour ? (
            <p className="text-[12px] text-[var(--color-danger)]">
              {errors.endHour.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-[var(--radius-s)] p-3">
        <div className="text-[12px] text-[var(--color-text-mid)]">
          現在の設定プレビュー
        </div>
        <div className="text-[15px] font-medium text-[var(--color-text-strong)] mt-1">
          {String(startHourValue).padStart(2, "0")}:00 〜{" "}
          {String(endHourValue % 24).padStart(2, "0")}:00（
          {endHourValue - startHourValue} 時間）
        </div>
        <p className="text-[12px] text-[var(--color-text-weak)] mt-1">
          スナップ単位は 15 分（変更不可）
        </p>
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
          {isPending ? "保存中…" : "変更を保存する"}
        </Button>
      </div>
    </form>
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
