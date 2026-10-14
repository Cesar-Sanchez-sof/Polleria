/**
 * Frontend service for the Dashboard Contable (Resumen Financiero).
 *
 * Centralizes access to `/api/accounting/dashboard`: KPIs of a date range with
 * variation vs the previous period of equal length (see `lib/accounting/dashboard`
 * for the pure calculation and the payload types).
 */
import { getJson } from "./http";
import type { DashboardPayload } from "@/lib/accounting/dashboard";

export type {
  DashboardPayload,
  ExpenseCategory,
  Kpi,
  KpiKey,
  MonthlyPoint,
  TopAccount,
  Variation,
} from "@/lib/accounting/dashboard";

const BASE_URL = "/api/accounting/dashboard";

export { ApiError } from "./http";

/** Serializes the range to a query string (`desde`/`hasta`, YYYY-MM-DD). */
export function buildDashboardQuery(from: string, to: string): string {
  const params = new URLSearchParams();
  params.set("desde", from);
  params.set("hasta", to);
  return params.toString();
}

/** Fetches the dashboard payload for the given date range. */
export async function getDashboard(from: string, to: string): Promise<DashboardPayload> {
  const query = buildDashboardQuery(from, to);
  return getJson<DashboardPayload>(`${BASE_URL}?${query}`);
}

// Re-export formatting helpers shared with the accounting module
export { formatCutOffDate, formatPen } from "./balance-sheet.service";
