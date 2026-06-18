import Link from "next/link";

type Tab = { href: string; label: string };

const TABS: Tab[] = [
  { href: "/admin/users", label: "社員マスタ" },
  { href: "/admin/schedule-types", label: "予定種別マスタ" },
  { href: "/admin/calendar-settings", label: "カレンダー設定" },
  { href: "/admin/notifications", label: "通知ログ" },
];

export function AdminNav({ active }: { active: string }) {
  return (
    <nav className="flex border-b border-[var(--color-border)] mb-5">
      {TABS.map((t) => {
        const isActive = active === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              "px-4 h-10 inline-flex items-center text-[13px] font-medium border-b-2 -mb-px " +
              (isActive
                ? "text-[var(--color-primary)] border-[var(--color-primary)]"
                : "text-[var(--color-text-mid)] border-transparent hover:text-[var(--color-text-strong)]")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
