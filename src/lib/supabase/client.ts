/*
 * Supabase ブラウザクライアント
 * see: CLAUDE.md §D（kanri-system と同一プロジェクトを共有・ref: etngtsqidqndmwmosrff）
 *
 * "use client" コンポーネントから呼ぶ。anon キーのみ使用し RLS で保護する。
 * サーバー側からは getSupabaseServer()（server.ts）を使うこと。
 */
import { createBrowserClient } from "@supabase/ssr";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `環境変数 ${name} が未設定です。.env.local（本番は Vercel の環境変数）を確認してください。`,
    );
  }
  return value;
}

export function getSupabaseBrowser() {
  return createBrowserClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
