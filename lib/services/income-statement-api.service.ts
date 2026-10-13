/**
 * Frontend service for the Estado de Resultados por Función (Income Statement).
 *
 * Talks to `GET /api/income-statement`. The server-side orchestrator that queries Prisma lives in
 * `income-statement.service.ts` (server only): never import that one from a component.
 */
import { getJson, ApiError } from "./http";
import { formatPen } from "./balance-sheet.service";
import type { IncomeStatementResult } from "@/lib/accounting/income-statement";

export { ApiError, formatPen };
export type {
  IncomeStatementResult,
  OperatingIncome,
  SalesCosts,
  GrossProfit,
  OperatingExpenses,
  OperatingProfit,
  OtherRevenuesAndExpenses,
  ExchangeDifferenceNet,
  FinancialIncome,
  FinancialExpenses,
  ResultBeforeTaxes,
  IncomeTaxExpense,
  NetProfit,
  PeriodRange,
} from "@/lib/accounting/income-statement";

const BASE_URL = "/api/income-statement";

export interface IncomeStatementPeriod {
  /** Fecha inicial del periodo (YYYY-MM-DD, inclusive). */
  desde?: string;
  /** Fecha final del periodo (YYYY-MM-DD, inclusive). */
  hasta?: string;
}

/** Serializa el periodo a query string, omitiendo los valores vacíos. */
export function buildIncomeStatementQuery(period: IncomeStatementPeriod = {}): string {
  const params = new URLSearchParams();
  if (period.desde) params.set("desde", period.desde);
  if (period.hasta) params.set("hasta", period.hasta);
  return params.toString();
}

/**
 * Genera el Estado de Resultados para el periodo indicado (ambas fechas inclusivas).
 *
 * @throws {ApiError} con el mensaje del servidor cuando el periodo es inválido (400)
 *         o falla la consulta (500).
 */
export async function getIncomeStatement(
  period: IncomeStatementPeriod = {}
): Promise<IncomeStatementResult> {
  const query = buildIncomeStatementQuery(period);
  return getJson<IncomeStatementResult>(query ? `${BASE_URL}?${query}` : BASE_URL);
}

/** Formatea un `YYYY-MM-DD` como "01 de enero de 2026" (sin corrimiento de zona horaria). */
function formatDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Rótulo del periodo impreso: "Del 01 de enero de 2026 al 31 de enero de 2026". */
export function formatPeriodLabel(desde: string, hasta: string): string {
  if (!desde || !hasta) return "";
  if (desde === hasta) return `Al ${formatDay(hasta)}`;
  return `Del ${formatDay(desde)} al ${formatDay(hasta)}`;
}
