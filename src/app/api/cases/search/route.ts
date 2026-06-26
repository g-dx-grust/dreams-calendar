import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CaseSearchItem = {
  id: number;
  caseNumber: string;
  caseName: string;
  clientName?: string;
};

type CaseRow = {
  id: number;
  case_number: string;
  case_name: string;
  updated_at: string | null;
};

type CasePersonRow = {
  case_id: number;
  role: string | null;
  snapshot_name: string | null;
};

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function toPattern(query: string): string {
  return `%${query.replace(/[%_]/g, "").slice(0, 50)}%`;
}

function toItem(row: CaseRow, clientName?: string): CaseSearchItem {
  return {
    id: row.id,
    caseNumber: row.case_number,
    caseName: row.case_name,
    ...(clientName ? { clientName } : {}),
  };
}

function isCaseSearchItem(value: unknown): value is CaseSearchItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "number" &&
    typeof item.caseNumber === "string" &&
    typeof item.caseName === "string" &&
    (item.clientName === undefined || typeof item.clientName === "string")
  );
}

function normalizeItems(payload: unknown): CaseSearchItem[] {
  if (!payload || typeof payload !== "object") return [];
  const items = (payload as Record<string, unknown>).items;
  if (!Array.isArray(items)) return [];
  return items.filter(isCaseSearchItem).slice(0, 10);
}

function pickClientName(rows: CasePersonRow[]) {
  return (
    rows.find((row) => row.role === "billing" && row.snapshot_name)
      ?.snapshot_name ??
    rows.find((row) => row.role === "applicant" && row.snapshot_name)
      ?.snapshot_name ??
    rows.find((row) => row.snapshot_name)?.snapshot_name ??
    undefined
  );
}

async function searchCasesFromSharedDatabase(
  query: string,
): Promise<CaseSearchItem[] | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const pattern = toPattern(query);
  const [numberResult, nameResult, personResult] = await Promise.all([
    db
      .from("cases")
      .select("id, case_number, case_name, updated_at")
      .ilike("case_number", pattern)
      .order("updated_at", { ascending: false })
      .limit(10),
    db
      .from("cases")
      .select("id, case_number, case_name, updated_at")
      .ilike("case_name", pattern)
      .order("updated_at", { ascending: false })
      .limit(10),
    db
      .from("case_persons")
      .select("case_id, role, snapshot_name")
      .ilike("snapshot_name", pattern)
      .limit(20),
  ]);

  if (numberResult.error || nameResult.error || personResult.error) {
    return null;
  }

  const byId = new Map<number, CaseRow>();
  for (const row of (numberResult.data ?? []) as CaseRow[]) byId.set(row.id, row);
  for (const row of (nameResult.data ?? []) as CaseRow[]) byId.set(row.id, row);

  const matchedPersons = (personResult.data ?? []) as CasePersonRow[];
  const caseIdsFromPeople = [
    ...new Set(matchedPersons.map((row) => row.case_id).filter(Boolean)),
  ];
  if (caseIdsFromPeople.length > 0) {
    const { data } = await db
      .from("cases")
      .select("id, case_number, case_name, updated_at")
      .in("id", caseIdsFromPeople)
      .order("updated_at", { ascending: false })
      .limit(10);
    for (const row of (data ?? []) as CaseRow[]) byId.set(row.id, row);
  }

  const rows = Array.from(byId.values())
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
    .slice(0, 10);
  if (rows.length === 0) return [];

  const { data: clientRows } = await db
    .from("case_persons")
    .select("case_id, role, snapshot_name")
    .in(
      "case_id",
      rows.map((row) => row.id),
    )
    .in("role", ["billing", "applicant", "other"]);

  const clientsByCaseId = new Map<number, CasePersonRow[]>();
  for (const row of (clientRows ?? []) as CasePersonRow[]) {
    const list = clientsByCaseId.get(row.case_id) ?? [];
    list.push(row);
    clientsByCaseId.set(row.case_id, list);
  }

  return rows.map((row) =>
    toItem(row, pickClientName(clientsByCaseId.get(row.id) ?? [])),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < 2) {
    return NextResponse.json({ items: [] satisfies CaseSearchItem[] });
  }

  const databaseItems = await searchCasesFromSharedDatabase(query);
  if (databaseItems) {
    return NextResponse.json({ items: databaseItems });
  }

  const baseUrl =
    process.env.KANRI_SYSTEM_URL ?? process.env.NEXT_PUBLIC_KANRI_SYSTEM_URL;
  if (!baseUrl) {
    return NextResponse.json({ items: [] satisfies CaseSearchItem[] });
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
    return NextResponse.json(
      { items: [] satisfies CaseSearchItem[], error: "案件検索に失敗しました。" },
      { status: 502 },
    );
  }
}
