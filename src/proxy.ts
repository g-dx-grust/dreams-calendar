import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";

// Next 16 の proxy（旧 middleware）規約。
// セッション署名の検証は server 側（getSession）で行う。
// proxy は edge 実行のため node:crypto を使わず、Cookie の存在だけで粗くゲートする。
const PUBLIC_PREFIXES = ["/login", "/api/auth/"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p),
  );
}

export function proxy(req: NextRequest) {
  // Lark 認証情報が未設定の間はデモモードとして全通し。
  // クレデンシャル取得前にアプリ全体がロックアウトされるのを防ぐ。
  // see: CLAUDE.md §B（Lark OAuth）・B-2（Supabase セッション化）は別途。
  const larkConfigured = Boolean(
    process.env.LARK_APP_ID && process.env.LARK_APP_SECRET,
  );
  if (!larkConfigured) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // _next 内部・favicon・静的アセットを除く全ルートに適用
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
