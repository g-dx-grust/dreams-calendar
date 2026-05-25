"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SCHEDULE_TYPE_PALETTE } from "@/lib/color-palette";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const formSchema = z.object({
  name: z.string().min(1, "種別名を入力してください").max(50),
  color: z.string().regex(HEX_RE, "色を選択してください"),
});

export type ScheduleTypeFormValues = z.infer<typeof formSchema>;

type Props = {
  defaultValues?: Partial<ScheduleTypeFormValues>;
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
    setValue,
    formState: { errors },
  } = useForm<ScheduleTypeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", color: SCHEDULE_TYPE_PALETTE[5], ...defaultValues },
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
        <input type="hidden" {...register("color")} />
        <div className="flex flex-wrap gap-2">
          {SCHEDULE_TYPE_PALETTE.map((c) => {
            const selected = colorValue === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() =>
                  setValue("color", c, { shouldValidate: true, shouldDirty: true })
                }
                aria-label={`色を ${c} に設定`}
                aria-pressed={selected}
                title={c}
                className={
                  "relative w-8 h-8 rounded-[var(--radius-s)] border transition-shadow " +
                  (selected
                    ? "border-[var(--color-text-strong)] ring-2 ring-[var(--color-primary)] ring-offset-1"
                    : "border-black/10 hover:border-[var(--color-text-mid)]")
                }
                style={{ background: c }}
              >
                {selected ? (
                  <Check
                    size={16}
                    className="absolute inset-0 m-auto"
                    color={isLight(c) ? "#1F2329" : "#fff"}
                  />
                ) : null}
              </button>
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
            className="inline-block px-2 py-1 text-[12px] leading-tight border border-black/10 rounded-[var(--radius-s)]"
            style={{
              background: HEX_RE.test(colorValue ?? "") ? colorValue : "#646A73",
              color: isLight(colorValue ?? "") ? "#1F2329" : "#fff",
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

function isLight(hex: string) {
  if (!HEX_RE.test(hex)) return false;
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 186;
}
