import Link from "next/link";

type Tab = { href: string; label: string };

const TABS: Tab[] = [
  { href: "/admin/users", label: "社員マスタ" },
  { href: "/admin/schedule-types", label: "予定種別マスタ" },
  { href: "/admin/calendar-settings", label: "カレンダー設定" },
  { href: "/admin/notification-settings", label: "通知設定" },
  { href: "/admin/notifications", label: "通知ログ" },
];

export function AdminNav({ active }: { active: string }) {
  return (
    <nav className="mb-5 inline-flex max-w-full overflow-auto rounded-[var(--radius-m)] border border-[var(--color-border)] bg-white">
      {TABS.map((t) => {
        const isActive = active === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              "h-9 shrink-0 border-r border-[var(--color-border)] px-4 inline-flex items-center text-[13px] font-medium last:border-r-0 " +
              (isActive
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-mid)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-strong)]")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
