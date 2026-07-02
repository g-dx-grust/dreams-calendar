import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { listUsersAsync } from "@/lib/user-store";
import { countSchedulesByUserAsync } from "@/lib/schedule-store";

export const dynamic = "force-dynamic";

// 社員は kanri-system / Lark 連携で管理する共有データ（CLAUDE.md §D）。
// 本画面は参照専用。追加・編集・削除は kanri-system 側で行う。
export default async function UsersAdminPage() {
  // 各社員に紐づく予定数（参照件数：担当者の何れかとして含まれる予定）
  const [session, users, usageCount] = await Promise.all([
    getSession(),
    listUsersAsync(),
    countSchedulesByUserAsync(),
  ]);

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

          <div className="mb-3 space-y-1">
            <p className="text-[13px] text-[var(--color-text-mid)]">
              登録社員数：{users.length} 名
            </p>
            <p className="text-[12px] text-[var(--color-text-weak)]">
              社員情報は kanri-system および Lark 連携で管理されます。本画面は参照専用です。
            </p>
          </div>

          <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--color-background)] border-b border-[var(--color-border)]">
                <tr>
                  <Th>名前</Th>
                  <Th>アバター</Th>
                  <Th align="right">関連予定数</Th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
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
                          <span className="font-medium text-[var(--color-text-strong)]">
                            {u.name}
                          </span>
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
