/*
 * Supabase サーバークライアント（雛形）
 *
 * 本番接続は CLAUDE.md §D の通り「kanri-system と共有 / 別プロジェクト」が確定するまで保留。
 * 環境変数が未設定の場合は null を返し、呼び出し側でフォールバック処理する想定。
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        for (const { name, value, options } of toSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
