/**
 * Frontend service for "Daily Book / General Journal (Libro Diario)".
 *
 * Centralizes access to `/api/daily-book`: chronological listing of journal entries with lines
 * and totals, filtered by date range and pagination.
 */

import { ApiError, getJson } from "./http";

const BASE_URL = "/api/daily-book";

export { ApiError };

export interface DailyBookFilter {
  /** Start date (YYYY-MM-DD, inclusive). */
  from?: string;
  /** End date (YYYY-MM-DD, inclusive). */
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface DailyBookLine {
  id: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  description: string;
  debit: number;
  credit: number;
}

export interface DailyBookEntry {
  id: number;
  number: string;
  date: string;
  daily: string;
  concept: string;
  responsible: string | null;
  status: "Registrado" | "Anulado";
  totals: { debit: number; credit: number };
  balanced: boolean;
  lines: DailyBookLine[];
  createdAt?: string;
}

export interface DailyBookMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  from: string;
  to: string;
}

export interface DailyBookPage {
  data: DailyBookEntry[];
  meta: DailyBookMeta;
}

/** Serializes filters to query string, omitting empty values. */
export function buildDailyBookQuery(filters: DailyBookFilter): string {
  const params = new URLSearchParams();

  if (filters.from) params.set("desde", filters.from);
  if (filters.to) params.set("hasta", filters.to);
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
  formatDateTimePeru,
  formatTimePeru,
  getJournalEntry,
  type JournalEntryDetail
} from "./journal-entries.service";

