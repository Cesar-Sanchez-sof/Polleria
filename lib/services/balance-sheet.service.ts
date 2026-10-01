/**
 * Frontend service for Estado de Situación Financiera (Balance General).
 */
import { getJson } from "./http";
import type { BalanceSheetStatement } from "@/lib/accounting/balance-sheet";

export type { BalanceSheetStatement, BalanceSheetLine } from "@/lib/accounting/balance-sheet";

const BASE_URL = "/api/balance-sheet";

export function buildBalanceSheetQuery(asOf?: string): string {
  const params = new URLSearchParams();
  if (asOf) params.set("hasta", asOf);
  return params.toString();
}

/** Fetches the balance sheet as of the given cut-off date (YYYY-MM-DD). */
export async function getBalanceSheet(asOf?: string): Promise<BalanceSheetStatement> {
  const query = buildBalanceSheetQuery(asOf);
  const url = query ? `${BASE_URL}?${query}` : BASE_URL;
  return getJson<BalanceSheetStatement>(url);
}

export function formatPen(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "";
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCutOffDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}
