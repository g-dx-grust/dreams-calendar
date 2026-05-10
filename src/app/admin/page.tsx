import Link from "next/link";
import { Users, Tag, Clock, Bell } from "lucide-react";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";

export const dynamic = "force-dynamic";

const ITEMS = [
  {
    href: "/admin/users",
    label: "社員マスタ",
    description: "カレンダーに表示される社員を登録・編集します。",
    Icon: Users,
  },
  {
    href: "/admin/schedule-types",
    label: "予定種別マスタ",
    description: "予定の種別と色を登録・編集します。",
    Icon: Tag,
  },
  {
    href: "/admin/calendar-settings",
    label: "カレンダー設定",
    description: "日表示カレンダーの時間軸の範囲を設定します。",
    Icon: Clock,
  },
  {
    href: "/admin/notifications",
    label: "招待通知ログ",
    description: "予定への招待時に Lark へ送信した通知の履歴を確認します。",
    Icon: Bell,
  },
];

export default async function AdminPage() {
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ITEMS.map((item) => {
              const { Icon } = item;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-5 hover:border-[var(--color-primary)] transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={18} className="text-[var(--color-primary)]" />
                    <h2 className="text-[15px] font-bold text-[var(--color-text-strong)]">
                      {item.label}
                    </h2>
                  </div>
                  <p className="text-[13px] text-[var(--color-text-mid)]">
                    {item.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
