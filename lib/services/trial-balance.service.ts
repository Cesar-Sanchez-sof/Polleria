/**
 * Frontend service for the Balance de Comprobación.
 */
import { getJson } from "./http";
import type { TrialBalanceStatement } from "@/lib/accounting/trial-balance";

export type {
  TrialBalanceStatement,
  TrialBalanceLine,
  TrialBalanceAmounts,
} from "@/lib/accounting/trial-balance";

export { formatCutOffDate, formatPen } from "./balance-sheet.service";

const BASE_URL = "/api/trial-balance";

export function buildTrialBalanceQuery(from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (from) params.set("desde", from);
  if (to) params.set("hasta", to);
  return params.toString();
}

/** Fetches the trial balance for the given period (both YYYY-MM-DD). */
export async function getTrialBalance(from?: string, to?: string): Promise<TrialBalanceStatement> {
  const query = buildTrialBalanceQuery(from, to);
  const url = query ? `${BASE_URL}?${query}` : BASE_URL;
  return getJson<TrialBalanceStatement>(url);
}
