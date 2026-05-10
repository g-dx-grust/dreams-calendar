import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { UserForm } from "@/components/admin/user-form";
import { createUserAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const session = await getSession();
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader user={session} />
      <main className="flex-1 px-6 py-5">
        <div className="mx-auto" style={{ maxWidth: "var(--width-content-max)" }}>
          <h1 className="text-[18px] font-bold text-[var(--color-text-strong)] mb-4">
            管理画面
          </h1>
          <AdminNav active="/admin/users" />

          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--color-text-mid)] hover:text-[var(--color-text-strong)] mb-3"
          >
            <ChevronLeft size={14} />
            社員一覧へ戻る
          </Link>

          <h2 className="text-[16px] font-bold text-[var(--color-text-strong)] mb-3">
            社員を追加する
          </h2>
          <div className="max-w-[560px] bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-6">
            <UserForm
              submitLabel="登録する"
              cancelHref="/admin/users"
              action={createUserAction}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
