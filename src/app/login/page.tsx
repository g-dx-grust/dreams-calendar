import Link from "next/link";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { buildAuthorizeUrl, larkConfig } from "@/lib/lark/config";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function issueAuthorizeUrl() {
  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("lark_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });
  return buildAuthorizeUrl(state);
}

export default async function LoginPage() {
  const configured = Boolean(larkConfig.appId && larkConfig.appSecret);
  const authorizeUrl = configured ? await issueAuthorizeUrl() : null;

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

        {authorizeUrl ? (
          <Link
            href={authorizeUrl}
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
