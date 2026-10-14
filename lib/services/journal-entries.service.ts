/**
 * Frontend service for "Search and filter accounting journal entries".
 *
 * Centralizes access to `/api/journal-entries`: filtered listing,
 * ordering and pagination, journal entry detail, and filter options.
 */

import { ApiError, getJson, postJson } from "./http";

const BASE_URL = "/api/journal-entries";

export type JournalEntrySort = "fecha" | "numero" | "concepto" | "diario" | "estado" | "total";
export type SortDirection = "asc" | "desc";
export type JournalEntryStatus = "Registrado" | "Anulado";

/** Filters applied concurrently. */
export interface JournalEntriesFilter {
  /** Start date (YYYY-MM-DD, inclusive). */
  from?: string;
  /** End date (YYYY-MM-DD, inclusive). */
  to?: string;
  /** Specific journal book. Empty = all. */
  daily?: string;
  /** "registrado" | "anulado". Empty = all. */
  status?: string;
  /** Free-text search: number/code, description (glosa), or account. */
  q?: string;
  page?: number;
  pageSize?: number;
  order?: JournalEntrySort;
  dir?: SortDirection;
}

export interface JournalEntrySummary {
  id: number;
  number: string;
  date: string;
  daily: string;
  concept: string;
  responsible: string | null;
  status: JournalEntryStatus;
  total: number;
}

export interface JournalEntriesMeta {
  total: number;
  registered: number;
  annulled: number;
  page: number;
  pageSize: number;
  totalPages: number;
  order: JournalEntrySort;
  dir: SortDirection;
}

export interface JournalEntriesPage {
  data: JournalEntrySummary[];
  meta: JournalEntriesMeta;
}

export interface JournalEntryLine {
  id: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  description: string;
  debit: number;
  credit: number;
}

export interface JournalEntryDetail {
  id: number;
  number: string;
  date: string;
  daily: string;
  concept: string;
  status: JournalEntryStatus;
  responsible: string;
  observation: string;
  createdAt: string;
  updatedAt: string;
  total: number;
  balanced: boolean;
  totals: { debit: number; credit: number };
  lines: JournalEntryLine[];
}

export interface JournalBookOption {
  name: string;
  total: number;
}

export interface JournalStatusOption {
  value: string;
  label: string;
  total: number;
}

export interface JournalEntriesOptions {
  daily: JournalBookOption[];
  statuses: JournalStatusOption[];
}

/** Chart of accounts item available for an entry line. */
export interface AccountingAccount {
  id: number;
  code: string;
  name: string;
  type: string;
}

/** Line item of a manual journal entry. */
export interface NewJournalEntryLine {
  accountId: number;
  description?: string;
  debit: number;
  credit: number;
}

/** Input payload to register a manual journal entry. */
export interface NewJournalEntryInput {
  date: string;
  daily: string;
  description: string;
  responsible?: string;
  observation?: string;
  lines: NewJournalEntryLine[];
}

const VALID_SORTS: JournalEntrySort[] = [
  "fecha",
  "numero",
  "concepto",
  "diario",
  "estado",
  "total",
];

export { ApiError };

/** Serializes filters to query string, omitting empty values. */
export function buildQuery(filters: JournalEntriesFilter): string {
  const params = new URLSearchParams();

  if (filters.from) params.set("desde", filters.from);
  if (filters.to) params.set("hasta", filters.to);
  if (filters.daily) params.set("diario", filters.daily);
  if (filters.status) params.set("estado", filters.status);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));

  const sort = filters.order && VALID_SORTS.includes(filters.order) ? filters.order : "fecha";
  params.set("orden", sort);
  params.set("dir", filters.dir === "asc" ? "asc" : "desc");

  return params.toString();
}

/** Lists journal entries applying given filters, order, and pagination. */
export async function listJournalEntries(
  filters: JournalEntriesFilter = {}
): Promise<JournalEntriesPage> {
  return getJson<JournalEntriesPage>(`${BASE_URL}?${buildQuery(filters)}`);
}

/** Returns the selected journal entry with all its lines. */
export async function getJournalEntry(id: number): Promise<JournalEntryDetail> {
  return getJson<JournalEntryDetail>(`${BASE_URL}/${id}`);
}

/** Returns journal books and statuses with count for filters. */
export async function getJournalEntriesOptions(): Promise<JournalEntriesOptions> {
  return getJson<JournalEntriesOptions>(`${BASE_URL}/options`);
}

/** Active chart of accounts list for line selection. */
export async function listAccountingAccounts(): Promise<AccountingAccount[]> {
  const response = await getJson<{ data: AccountingAccount[] }>(`${BASE_URL}/accounts`);
  return response.data ?? [];
}

/** Preview of the next suggested code for the given date. */
export async function getNextJournalEntryCode(date: string): Promise<string> {
  const params = date ? `?fecha=${encodeURIComponent(date)}` : "";
  const response = await getJson<{ code: string }>(`${BASE_URL}/next-code${params}`);
  return response.code;
}

/** Registers a manual journal entry and returns its summary. */
export async function registerJournalEntry(
  input: NewJournalEntryInput
): Promise<JournalEntrySummary> {
  return postJson<JournalEntrySummary>(BASE_URL, input);
}

/** Formats an ISO date (YYYY-MM-DD) to DD/MM/YYYY without timezone shift. */
export function formatDate(iso: string): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

/** Formats a numeric currency value to Peruvian Soles (PEN). */
export function formatCurrency(value: number): string {
  return `S/ ${(value ?? 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

