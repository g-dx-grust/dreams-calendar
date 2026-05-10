import Link from "next/link";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminDeleteButton } from "@/components/admin/delete-button";
import { listScheduleTypes } from "@/lib/schedule-type-store";
import { listSchedules } from "@/lib/schedule-store";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteScheduleTypeAction } from "./actions";

export const dynamic = "force-dynamic";

function isLight(hex: string) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 186;
}

export default async function ScheduleTypesAdminPage() {
  const session = await getSession();
  const types = listScheduleTypes();
  const schedules = listSchedules();

  const usageCount = new Map<string, number>();
  for (const s of schedules) {
    usageCount.set(s.typeId, (usageCount.get(s.typeId) ?? 0) + 1);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader user={session} />
      <main className="flex-1 px-6 py-5">
        <div className="mx-auto" style={{ maxWidth: "var(--width-content-max)" }}>
          <h1 className="text-[18px] font-bold text-[var(--color-text-strong)] mb-4">
            管理画面
          </h1>
          <AdminNav active="/admin/schedule-types" />

          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[13px] text-[var(--color-text-mid)]">
              登録種別数：{types.length} 件
            </p>
            <Link
              href="/admin/schedule-types/new"
              className={cn(buttonVariants({ variant: "primary", size: "md" }))}
            >
              <Plus size={16} />
              種別を追加する
            </Link>
          </div>

          <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--color-background)] border-b border-[var(--color-border)]">
                <tr>
                  <Th>プレビュー</Th>
                  <Th>種別名</Th>
                  <Th>カラー</Th>
                  <Th align="right">関連予定数</Th>
                  <Th align="right">操作</Th>
                </tr>
              </thead>
              <tbody>
                {types.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-[var(--color-text-weak)]"
                    >
                      予定種別が登録されていません。
                    </td>
                  </tr>
                ) : (
                  types.map((t) => {
                    const count = usageCount.get(t.id) ?? 0;
                    return (
                      <tr
                        key={t.id}
                        className="border-b border-[var(--color-border)] last:border-b-0"
                      >
                        <Td>
                          <span
                            className="inline-block px-2 py-1 text-[12px] leading-tight border border-black/10 rounded-[var(--radius-s)]"
                            style={{
                              background: t.color,
                              color: isLight(t.color) ? "#1F2329" : "#fff",
                            }}
                          >
                            {t.name}
                          </span>
                        </Td>
                        <Td>
                          <Link
                            href={`/admin/schedule-types/${t.id}`}
                            className="text-[var(--color-primary)] hover:underline font-medium"
                          >
                            {t.name}
                          </Link>
                        </Td>
                        <Td>
                          <code className="font-mono text-[12px] text-[var(--color-text-mid)]">
                            {t.color}
                          </code>
                        </Td>
                        <Td align="right">{count}</Td>
                        <Td align="right">
                          <div className="inline-flex items-center gap-2">
                            <Link
                              href={`/admin/schedule-types/${t.id}`}
                              className="text-[var(--color-primary)] hover:underline"
                            >
                              編集
                            </Link>
                            <DeleteTypeButton id={t.id} count={count} name={t.name} />
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

function DeleteTypeButton({
  id,
  count,
  name,
}: {
  id: string;
  count: number;
  name: string;
}) {
  const message =
    count > 0
      ? `予定種別「${name}」には ${count} 件の予定が紐づいています。削除すると種別表示が空欄になります。\n削除してよろしいですか？`
      : `予定種別「${name}」を削除します。よろしいですか？`;
  const action = deleteScheduleTypeAction.bind(null, id);
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
