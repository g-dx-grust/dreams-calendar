import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Bell, CheckCircle2, AlertTriangle } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { listNotifications } from "@/lib/lark/notify";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getSession();
  const items = listNotifications();

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
          <AdminNav active="/admin/notifications" />

          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} className="text-[var(--color-primary)]" />
            <h2 className="text-[16px] font-bold text-[var(--color-text-strong)]">
              Lark 招待通知ログ
            </h2>
          </div>
          <p className="text-[13px] text-[var(--color-text-mid)] mb-4">
            予定への招待時に送信した通知の履歴です（最新 100 件、プロセス内保持）。
          </p>

          <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--color-background)] border-b border-[var(--color-border)]">
                <tr>
                  <Th>日時</Th>
                  <Th>宛先</Th>
                  <Th>件名</Th>
                  <Th>結果</Th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-6 text-center text-[var(--color-text-weak)]"
                    >
                      まだ通知履歴はありません。予定に他のメンバーを担当者として追加すると記録されます。
                    </td>
                  </tr>
                ) : (
                  items.map((it, i) => (
                    <tr
                      key={`${it.at}-${i}`}
                      className="border-b border-[var(--color-border)] last:border-b-0"
                    >
                      <Td>
                        <span className="text-[12px] text-[var(--color-text-mid)] font-mono">
                          {format(new Date(it.at), "yyyy/MM/dd HH:mm:ss", {
                            locale: ja,
                          })}
                        </span>
                      </Td>
                      <Td>{it.to.name}</Td>
                      <Td>
                        <span className="text-[var(--color-text-strong)]">
                          {it.title}
                        </span>
                      </Td>
                      <Td>
                        {it.delivered ? (
                          <span className="inline-flex items-center gap-1 text-[var(--color-success)]">
                            <CheckCircle2 size={14} />
                            送信済み
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[var(--color-warning)]">
                            <AlertTriangle size={14} />
                            未送信
                            {it.reason ? (
                              <span className="text-[11px] text-[var(--color-text-mid)] ml-1">
                                （{it.reason}）
                              </span>
                            ) : null}
                          </span>
                        )}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-[12px] font-medium text-[var(--color-text-mid)] text-left">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5">{children}</td>;
}
