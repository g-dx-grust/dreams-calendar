"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteScheduleAction } from "@/app/calendar/actions";

export function DeleteScheduleButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("この予定を削除します。よろしいですか？")) return;
    startTransition(async () => {
      await deleteScheduleAction(id);
    });
  }

  return (
    <Button
      type="button"
      variant="danger"
      size="md"
      onClick={onClick}
      disabled={isPending}
    >
      <Trash2 size={14} />
      {isPending ? "削除中…" : "削除する"}
    </Button>
  );
}
