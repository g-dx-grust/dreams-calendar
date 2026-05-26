import Link from "next/link";
import { redirect } from "next/navigation";
import { larkConfig } from "@/lib/lark/config";
import { getSession } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// コールバックが付ける error コードを利用者向けの文言にする
function errorMessage(code: string): string {
  if (code === "invalid_state") {
    return "ログインの有効期限が切れたか、不正なアクセスでした。もう一度お試しください。";
  }
  return "ログインに失敗しました。時間をおいて再度お試しください。";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/calendar");

  const { error } = await searchParams;
  const configured = Boolean(larkConfig.appId && larkConfig.appSecret);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <section className="w-full max-w-md bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-8">
        <div className="mb-6">
          <h1 className="text-[20px] font-bold text-[var(--color-text-strong)]">
            G-DX For スケジュール
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-mid)]">
            Lark アカウントでログインしてください。
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="mb-4 text-[13px] text-[var(--color-danger)] border border-[var(--color-danger)] rounded-[var(--radius-s)] px-3 py-2"
          >
            {errorMessage(error)}
          </div>
        ) : null}

        {configured ? (
          <Link
            href="/api/auth/lark/login"
            className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}
          >
            Lark でログインする
          </Link>
        ) : (
          <div className="text-[13px] text-[var(--color-danger)] border border-[var(--color-danger)] rounded-[var(--radius-s)] px-3 py-2">
            Lark の認証情報が設定されていません。
            <br />
            <code className="text-[12px]">.env.local</code> に
            <code className="text-[12px]"> LARK_APP_ID</code> と
            <code className="text-[12px]"> LARK_APP_SECRET</code> を設定してください。
          </div>
        )}

        <p className="mt-6 text-[12px] text-[var(--color-text-weak)]">
          ログインに問題がある場合は、システム管理者へお問い合わせください。
        </p>
      </section>
    </main>
  );
}
