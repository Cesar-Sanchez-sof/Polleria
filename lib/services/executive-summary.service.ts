/**
 * Frontend service for the Resumen Ejecutivo.
 */
import { getJson } from "./http";
import type { ExecutiveSummary } from "@/lib/accounting/executive-summary";

export type {
  ExecutiveSummary,
  ExecutiveSection,
  ExecutiveMetric,
  ExecutiveMetricFormat,
} from "@/lib/accounting/executive-summary";

export { formatPen } from "./balance-sheet.service";

const BASE_URL = "/api/executive-summary";

export function buildExecutiveSummaryQuery(year?: number): string {
  const params = new URLSearchParams();
  if (year !== undefined) params.set("year", String(year));
  return params.toString();
}

/** Fetches the executive summary for the given calendar year. */
export async function getExecutiveSummary(year?: number): Promise<ExecutiveSummary> {
  const query = buildExecutiveSummaryQuery(year);
  const url = query ? `${BASE_URL}?${query}` : BASE_URL;
  return getJson<ExecutiveSummary>(url);
}

/** Formatea un porcentaje (ya en unidades de %) como "12,3%". */
export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

/** Formatea un número (días, razón) como "12,3". */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/** Formatea el año del reporte, p. ej. 2026. */
export function formatYear(year: number): string {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(year);
}
