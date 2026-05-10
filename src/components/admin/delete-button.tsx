"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  action: () => Promise<unknown>;
  confirmMessage: string;
  size?: "sm" | "md";
  label?: string;
};

export function AdminDeleteButton({
  action,
  confirmMessage,
  size = "sm",
  label = "削除",
}: Props) {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(confirmMessage)) return;
    startTransition(async () => {
      await action();
    });
  }

  return (
    <Button
      type="button"
      variant="danger"
      size={size}
      onClick={onClick}
      disabled={isPending}
    >
      <Trash2 size={14} />
      {isPending ? "削除中…" : label}
    </Button>
  );
}
