"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  name: z.string().min(1, "名前を入力してください").max(60),
  avatarUrl: z
    .string()
    .url("URL の形式で入力してください")
    .max(500)
    .optional()
    .or(z.literal("")),
  larkOpenId: z.string().max(120).optional().or(z.literal("")),
});

export type UserFormValues = z.infer<typeof formSchema>;

type Props = {
  defaultValues?: Partial<UserFormValues>;
  submitLabel: string;
  cancelHref: string;
  action: (
    formData: FormData,
  ) => Promise<{ ok: true } | { ok: false; error: string } | void>;
};

export function UserForm({
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
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      avatarUrl: "",
      larkOpenId: "",
      ...defaultValues,
    },
  });

  function onSubmit(values: UserFormValues) {
    setServerError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", values.name);
      if (values.avatarUrl) fd.set("avatarUrl", values.avatarUrl);
      if (values.larkOpenId) fd.set("larkOpenId", values.larkOpenId);
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
          名前 <span className="text-[var(--color-danger)]">*</span>
        </Label>
        <Input
          {...register("name")}
          placeholder="例：山田 太郎"
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name ? (
          <p className="text-[12px] text-[var(--color-danger)]">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>アバター URL</Label>
        <Input
          {...register("avatarUrl")}
          placeholder="https://…"
        />
        <p className="text-[12px] text-[var(--color-text-weak)]">
          Lark OAuth 連携後は自動同期されます。手入力は任意。
        </p>
        {errors.avatarUrl ? (
          <p className="text-[12px] text-[var(--color-danger)]">
            {errors.avatarUrl.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>Lark openId</Label>
        <Input
          {...register("larkOpenId")}
          placeholder="ou_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          className="font-mono"
        />
        <p className="text-[12px] text-[var(--color-text-weak)]">
          予定への招待時に Lark で通知を受け取るために必要。Lark OAuth 連携後は自動同期されます。
        </p>
        {errors.larkOpenId ? (
          <p className="text-[12px] text-[var(--color-danger)]">
            {errors.larkOpenId.message}
          </p>
        ) : null}
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
