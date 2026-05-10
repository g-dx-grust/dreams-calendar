import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { ScheduleTypeForm } from "@/components/admin/schedule-type-form";
import { AdminDeleteButton } from "@/components/admin/delete-button";
import { getScheduleType } from "@/lib/schedule-type-store";
import { listSchedules } from "@/lib/schedule-store";
import {
  deleteScheduleTypeAction,
  updateScheduleTypeAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ScheduleTypeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const type = getScheduleType(id);
  if (!type) notFound();

  const session = await getSession();
  const update = updateScheduleTypeAction.bind(null, id);
  const remove = deleteScheduleTypeAction.bind(null, id);
  const count = listSchedules().filter((s) => s.typeId === id).length;
  const message =
    count > 0
      ? `予定種別「${type.name}」には ${count} 件の予定が紐づいています。削除すると種別表示が空欄になります。\n削除してよろしいですか？`
      : `予定種別「${type.name}」を削除します。よろしいですか？`;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader user={session} />
      <main className="flex-1 px-6 py-5">
        <div
          className="mx-auto"
          style={{ maxWidth: "var(--width-content-max)" }}
        >
          <h1 className="text-[18px] font-bold text-[var(--color-text-strong)] mb-4">
            管理画面
          </h1>
          <AdminNav active="/admin/schedule-types" />

          <Link
            href="/admin/schedule-types"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--color-text-mid)] hover:text-[var(--color-text-strong)] mb-3"
          >
            <ChevronLeft size={14} />
            予定種別一覧へ戻る
          </Link>

          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[16px] font-bold text-[var(--color-text-strong)]">
              予定種別を編集する
            </h2>
            <AdminDeleteButton
              action={remove}
              confirmMessage={message}
              size="md"
              label="削除する"
            />
          </div>

          <div className="max-w-[560px] bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-6">
            <ScheduleTypeForm
              defaultValues={{ name: type.name, color: type.color.toUpperCase() }}
              submitLabel="変更を保存する"
              cancelHref="/admin/schedule-types"
              action={update}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
