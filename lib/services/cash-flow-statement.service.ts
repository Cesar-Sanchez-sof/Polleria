/**
 * Frontend service for Estado de Flujos de Efectivo (NIC 7 / PCGE 2019).
 *
 * Replica el patrón de `balance-sheet.service.ts`: `getJson` de `lib/services/http.ts`,
 * helpers `formatPen`/`formatCutOffDate` reutilizados y `ApiError` re-exportado.
 */
import { getJson } from "./http";
import type { CashFlowStatementResult } from "@/lib/accounting/cash-flow-statement";

export { ApiError } from "./http";
export { formatPen, formatCutOffDate } from "./balance-sheet.service";
export type {
  CashFlowStatementResult,
  CashFlowStatementParams,
} from "@/lib/accounting/cash-flow-statement";

const BASE_URL = "/api/cash-flow-statement";

export interface CashFlowStatementFilter {
  desde: string;
  hasta: string;
}

export function buildCashFlowQuery(filter: CashFlowStatementFilter): string {
  const params = new URLSearchParams();
  params.set("desde", filter.desde);
  params.set("hasta", filter.hasta);
  return params.toString();
}

/** Fetches the cash flow statement for the given period (YYYY-MM-DD, inclusive). */
export async function getCashFlowStatement(
  filter: CashFlowStatementFilter
): Promise<CashFlowStatementResult> {
  return getJson<CashFlowStatementResult>(`${BASE_URL}?${buildCashFlowQuery(filter)}`);
}
