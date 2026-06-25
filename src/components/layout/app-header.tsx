import Image from "next/image";
import Link from "next/link";
import { Eye, LogOut, Settings, Smartphone } from "lucide-react";
import type { SessionUser } from "@/lib/session";
import type { CalendarUser } from "@/components/calendar/types";
import { SelfSelector } from "./self-selector";

type Props = {
  user: SessionUser | null;
  selfUserId?: string | null;
  users?: CalendarUser[];
  back?: string;
};

export function AppHeader({ user, selfUserId, users, back }: Props) {
  return (
    <header className="h-[var(--header-height)] bg-white border-b border-[var(--color-border)] flex items-center justify-between gap-4 px-5">
      <Link
        href="/calendar"
        className="flex min-w-0 items-center gap-2 text-[15px] font-bold text-[var(--color-text-strong)]"
        aria-label="G-DX For スケジュール"
      >
        <Image
          src="/dreams-logo.png"
          alt=""
          width={30}
          height={30}
          className="h-[30px] w-[30px] shrink-0 rounded-[var(--radius-s)]"
          priority
        />
        <span className="hidden truncate sm:inline">
          G-DX For スケジュール
        </span>
      </Link>

      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        {users && users.length > 0 ? (
          <SelfSelector users={users} selfUserId={selfUserId} back={back} />
        ) : null}

        <Link
          href="/today"
          className="inline-flex items-center gap-1 text-[13px] text-[var(--color-text-mid)] hover:text-[var(--color-primary)]"
          title="今日の自分の予定（モバイル簡易表示）"
        >
          <Smartphone size={14} />
          <span className="hidden sm:inline">今日の予定</span>
        </Link>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-[13px] text-[var(--color-text-mid)] hover:text-[var(--color-primary)]"
          title="管理画面"
        >
          <Settings size={14} />
          <span className="hidden sm:inline">管理</span>
        </Link>
        <Link
          href="/api/auth/preview"
          className="inline-flex items-center gap-1 text-[13px] text-[var(--color-text-mid)] hover:text-[var(--color-primary)]"
          title="プレビュー"
        >
          <Eye size={14} />
          <span className="hidden sm:inline">プレビュー</span>
        </Link>
        {user ? (
          <div className="flex min-w-0 items-center gap-2">
            {!users || users.length === 0 ? (
              <>
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt=""
                    width={28}
                    height={28}
                    className="rounded-full border border-[var(--color-border)]"
                    unoptimized
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center text-[12px] font-medium">
                    {user.name.slice(0, 1)}
                  </div>
                )}
                <span className="hidden max-w-[120px] truncate text-[13px] text-[var(--color-text-strong)] lg:inline">
                  {user.name}
                </span>
              </>
            ) : null}
            <form action="/api/auth/logout" method="post" className="contents">
              <button
                type="submit"
                title="ログアウト"
                className="inline-flex items-center gap-1 text-[13px] text-[var(--color-text-mid)] hover:text-[var(--color-primary)]"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">ログアウト</span>
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-[13px] text-[var(--color-primary)] hover:underline"
          >
            ログイン
          </Link>
        )}
      </div>
    </header>
  );
}
