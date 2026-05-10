import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { ScheduleTypeForm } from "@/components/admin/schedule-type-form";
import { createScheduleTypeAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewScheduleTypePage() {
  const session = await getSession();
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

          <h2 className="text-[16px] font-bold text-[var(--color-text-strong)] mb-3">
            予定種別を追加する
          </h2>
          <div className="max-w-[560px] bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-6">
            <ScheduleTypeForm
              submitLabel="登録する"
              cancelHref="/admin/schedule-types"
              action={createScheduleTypeAction}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
