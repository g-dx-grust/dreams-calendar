import Link from "next/link";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminDeleteButton } from "@/components/admin/delete-button";
import { listUsers } from "@/lib/user-store";
import { listSchedules } from "@/lib/schedule-store";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteUserAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  const session = await getSession();
  const users = listUsers();
  const schedules = listSchedules();

  // 各社員に紐づく予定数（参照件数：担当者の何れかとして含まれる予定）
  const usageCount = new Map<string, number>();
  for (const s of schedules) {
    for (const uid of s.userIds) {
      usageCount.set(uid, (usageCount.get(uid) ?? 0) + 1);
    }
  }

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
          <AdminNav active="/admin/users" />

          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[13px] text-[var(--color-text-mid)]">
              登録社員数：{users.length} 名
            </p>
            <Link
              href="/admin/users/new"
              className={cn(buttonVariants({ variant: "primary", size: "md" }))}
            >
              <Plus size={16} />
              社員を追加する
            </Link>
          </div>

          <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--color-background)] border-b border-[var(--color-border)]">
                <tr>
                  <Th>名前</Th>
                  <Th>アバター</Th>
                  <Th align="right">関連予定数</Th>
                  <Th align="right">操作</Th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-6 text-center text-[var(--color-text-weak)]"
                    >
                      社員が登録されていません。
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const count = usageCount.get(u.id) ?? 0;
                    return (
                      <tr
                        key={u.id}
                        className="border-b border-[var(--color-border)] last:border-b-0"
                      >
                        <Td>
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="text-[var(--color-primary)] hover:underline font-medium"
                          >
                            {u.name}
                          </Link>
                        </Td>
                        <Td>
                          {u.avatarUrl ? (
                            <span className="text-[12px] text-[var(--color-text-mid)] truncate inline-block max-w-[260px] align-middle">
                              {u.avatarUrl}
                            </span>
                          ) : (
                            <span className="text-[var(--color-text-disabled)]">
                              —
                            </span>
                          )}
                        </Td>
                        <Td align="right">{count}</Td>
                        <Td align="right">
                          <div className="inline-flex items-center gap-2">
                            <Link
                              href={`/admin/users/${u.id}`}
                              className="text-[var(--color-primary)] hover:underline"
                            >
                              編集
                            </Link>
                            <DeleteUserButton id={u.id} count={count} />
                          </div>
                        </Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function DeleteUserButton({ id, count }: { id: string; count: number }) {
  const message =
    count > 0
      ? `この社員には ${count} 件の予定が紐づいています。削除すると予定の担当者が空欄になります。\n削除してよろしいですか？`
      : "この社員を削除します。よろしいですか？";
  const action = deleteUserAction.bind(null, id);
  return (
    <AdminDeleteButton action={action} confirmMessage={message} size="sm" />
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className="px-3 py-2 text-[12px] font-medium text-[var(--color-text-mid)]"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  );
}
function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td className="px-3 py-2.5" style={{ textAlign: align }}>
      {children}
    </td>
  );
}
