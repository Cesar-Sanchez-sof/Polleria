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
export function buildDashboardQuery(desde: string, hasta: string): string {
  const params = new URLSearchParams();
  params.set("desde", desde);
  params.set("hasta", hasta);
  return params.toString();
}

/** Fetches the dashboard payload for the given date range. */
export async function getDashboard(desde: string, hasta: string): Promise<DashboardPayload> {
  const query = buildDashboardQuery(desde, hasta);
  return getJson<DashboardPayload>(`${BASE_URL}?${query}`);
}

// Re-export formatting helpers shared with the accounting module
export { formatCutOffDate, formatPen } from "./balance-sheet.service";
