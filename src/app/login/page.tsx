import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { larkConfig } from "@/lib/lark/config";
import { getSession } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function errorMessage(code: string): string {
  if (code === "invalid_state") {
    return "ログインの有効期限が切れたか、不正なアクセスでした。もう一度お試しください。";
  }
  if (code === "user_not_allowed") {
    return "G-DXに登録されている有効なユーザーとして確認できませんでした。管理者へお問い合わせください。";
  }
  if (code === "session_failed") {
    return "ログイン情報を保存できませんでした。.env.local とDBマイグレーションを確認してください。";
  }
  if (code === "missing_lark_config") {
    return "Larkの認証情報が設定されていません。.env.localを確認してください。";
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
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4 py-8">
      <section className="w-full max-w-[440px] bg-white border border-[var(--color-border)] rounded-[var(--radius-m)] p-8">
        <div className="mb-6 flex items-start gap-3">
          <Image
            src="/dreams-logo.png"
            alt=""
            width={42}
            height={42}
            className="h-[42px] w-[42px] shrink-0 rounded-[var(--radius-s)]"
            priority
          />
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold leading-tight text-[var(--color-text-strong)]">
            G-DX For スケジュール
            </h1>
            <p className="mt-1 text-[13px] text-[var(--color-text-mid)]">
              Larkアカウントでログインしてください。
            </p>
          </div>
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
          <div className="space-y-2">
            <Link
              href="/api/auth/preview"
              className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}
            >
              カレンダーを確認する
            </Link>
            <Link
              href="/api/auth/lark/start"
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full")}
            >
              Larkでログインする
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <Link
              href="/api/auth/preview"
              className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}
            >
              カレンダーを確認する
            </Link>
            <div className="text-[13px] text-[var(--color-danger)] border border-[var(--color-danger)] rounded-[var(--radius-s)] px-3 py-2">
              Lark の認証情報が設定されていません。
              <br />
              <code className="text-[12px]">.env.local</code> に
              <code className="text-[12px]"> LARK_APP_ID</code> と
              <code className="text-[12px]"> LARK_APP_SECRET</code> を設定してください。
            </div>
          </div>
        )}

        <p className="mt-6 text-[12px] text-[var(--color-text-weak)]">
          ログインに問題がある場合は、システム管理者へお問い合わせください。
        </p>
      </section>
    </main>
  );
}
