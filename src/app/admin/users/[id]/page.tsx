import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { UserForm } from "@/components/admin/user-form";
import { AdminDeleteButton } from "@/components/admin/delete-button";
import { getUser } from "@/lib/user-store";
import { listSchedules } from "@/lib/schedule-store";
import { deleteUserAction, updateUserAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function UserEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = getUser(id);
  if (!user) notFound();

  const session = await getSession();
  const update = updateUserAction.bind(null, id);
  const remove = deleteUserAction.bind(null, id);
  const count = listSchedules().filter((s) => s.userIds.includes(id)).length;
  const message =
    count > 0
      ? `この社員には ${count} 件の予定が紐づいています。削除すると予定の担当者が空欄になります。\n削除してよろしいですか？`
      : "この社員を削除します。よろしいですか？";

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

          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[16px] font-bold text-[var(--color-text-strong)]">
              社員を編集する
            </h2>
            <AdminDeleteButton
              action={remove}
              confirmMessage={message}
              size="md"
              label="削除する"
            />
          </div>

          <div className="max-w-[560px] bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-6">
            <UserForm
              defaultValues={{
                name: user.name,
                avatarUrl: user.avatarUrl ?? "",
                larkOpenId: user.larkOpenId ?? "",
              }}
              submitLabel="変更を保存する"
              cancelHref="/admin/users"
              action={update}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
