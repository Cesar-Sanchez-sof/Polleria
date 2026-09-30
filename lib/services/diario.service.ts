/**
 * Frontend service for "Daily Book / General Journal (Libro Diario)".
 *
 * Centralizes access to `/api/diario`: chronological listing of journal entries with lines
 * and totals, filtered by date range and pagination.
 */

import { ApiError, getJson } from "./http";

const BASE_URL = "/api/diario";

export { ApiError, ApiError as ErrorApi };

export interface DailyBookFilter {
  /** Start date (YYYY-MM-DD, inclusive). */
  desde?: string;
  /** End date (YYYY-MM-DD, inclusive). */
  hasta?: string;
  page?: number;
  pageSize?: number;
}

export interface DailyBookLine {
  id: number;
  cuentaCodigo: string;
  cuentaNombre: string;
  cuentaTipo: string;
  descripcion: string;
  debe: number;
  haber: number;
}

export interface DailyBookEntry {
  id: number;
  numero: string;
  fecha: string;
  diario: string;
  concepto: string;
  responsable: string | null;
  estado: "Registrado" | "Anulado";
  totales: { debe: number; haber: number };
  cuadrado: boolean;
  lineas: DailyBookLine[];
}

export interface DailyBookMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
  desde: string;
  hasta: string;
}

export interface DailyBookPage {
  data: DailyBookEntry[];
  meta: DailyBookMeta;
}

/** Serializes filters to query string, omitting empty values. */
export function buildDailyBookQuery(filters: DailyBookFilter): string {
  const params = new URLSearchParams();

  if (filters.desde) params.set("desde", filters.desde);
  if (filters.hasta) params.set("hasta", filters.hasta);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));

  return params.toString();
}

/** Lists daily journal entries in reverse chronological order applying period and pagination. */
export async function listDailyBookEntries(
  filters: DailyBookFilter = {}
): Promise<DailyBookPage> {
  const query = buildDailyBookQuery(filters);
  return getJson<DailyBookPage>(`${BASE_URL}${query ? `?${query}` : ""}`);
}

// Re-export formatting helpers
export {
  formatDate,
  formatCurrency,
  getJournalEntry,
  type JournalEntryDetail,
  formatearFecha,
  formatearMoneda,
  obtenerAsiento,
  type AsientoDetalle,
} from "./asientos.service";

// Backward-compatibility aliases
export type FiltroDiario = DailyBookFilter;
export type LineaDiario = DailyBookLine;
export type AsientoDiario = DailyBookEntry;
export type MetaDiario = DailyBookMeta;
export type PaginaDiario = DailyBookPage;
export const construirQueryDiario = buildDailyBookQuery;
export const listarLibroDiario = listDailyBookEntries;
