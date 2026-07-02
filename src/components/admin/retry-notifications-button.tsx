"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  action: () => Promise<
    | { ok: true; targeted: number; delivered: number }
    | { ok: false; error: string }
  >;
  disabled?: boolean;
};

export function RetryNotificationsButton({ action, disabled }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(
        result.targeted === 0
          ? "再送対象の通知はありません。"
          : `${result.targeted}件を再送し、${result.delivered}件が送信されました。`,
      );
    });
  }

  return (
    <div className="flex items-center gap-2">
      {message ? (
        <span className="text-[12px] text-[var(--color-text-mid)]">{message}</span>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={run}
        disabled={disabled || isPending}
      >
        <RefreshCw size={14} />
        {isPending ? "再送中…" : "失敗した通知を再送する"}
      </Button>
    </div>
  );
}
