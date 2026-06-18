import { NextResponse } from "next/server";
import { MOCK_CASES } from "@/components/calendar/mock-data";

export const dynamic = "force-dynamic";

type CaseSearchItem = {
  id: number;
  caseNumber: string;
  caseName: string;
};

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function searchMockCases(query: string): CaseSearchItem[] {
  const keyword = query.toLowerCase();
  return MOCK_CASES.filter((item) => {
    return (
      item.caseNumber.toLowerCase().includes(keyword) ||
      item.caseName.toLowerCase().includes(keyword)
    );
  }).slice(0, 10);
}

function isCaseSearchItem(value: unknown): value is CaseSearchItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "number" &&
    typeof item.caseNumber === "string" &&
    typeof item.caseName === "string"
  );
}

function normalizeItems(payload: unknown): CaseSearchItem[] {
  if (!payload || typeof payload !== "object") return [];
  const items = (payload as Record<string, unknown>).items;
  if (!Array.isArray(items)) return [];
  return items.filter(isCaseSearchItem).slice(0, 10);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < 2) {
    return NextResponse.json({ items: [] satisfies CaseSearchItem[] });
  }

  const baseUrl =
    process.env.KANRI_SYSTEM_URL ?? process.env.NEXT_PUBLIC_KANRI_SYSTEM_URL;
  if (!baseUrl) {
    return NextResponse.json({ items: searchMockCases(query) });
  }

  const url = new URL("/api/cases/search", normalizeBaseUrl(baseUrl));
  url.searchParams.set("q", query);

  const headers = new Headers({ accept: "application/json" });
  const apiSecret = process.env.KANRI_CALENDAR_API_SECRET;
  if (apiSecret) headers.set("x-kanri-calendar-secret", apiSecret);

  try {
    const response = await fetch(url, {
      headers,
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return NextResponse.json(
        { items: [] satisfies CaseSearchItem[], error: "案件検索に失敗しました。" },
        { status: response.status },
      );
    }

    return NextResponse.json({ items: normalizeItems(payload) });
  } catch {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ items: searchMockCases(query) });
    }

    return NextResponse.json(
      { items: [] satisfies CaseSearchItem[], error: "案件検索に失敗しました。" },
      { status: 502 },
    );
  }
}
