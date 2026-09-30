/**
 * Frontend service for "Search and filter accounting journal entries".
 *
 * Centralizes access to `/api/asientos`: filtered listing,
 * ordering and pagination, journal entry detail, and filter options.
 */

import { ApiError, getJson, postJson } from "./http";

const BASE_URL = "/api/asientos";

export type JournalEntrySort = "fecha" | "numero" | "concepto" | "diario" | "estado" | "total";
export type SortDirection = "asc" | "desc";
export type JournalEntryStatus = "Registrado" | "Anulado";

/** Filters applied concurrently. */
export interface JournalEntriesFilter {
  /** Start date (YYYY-MM-DD, inclusive). */
  desde?: string;
  /** End date (YYYY-MM-DD, inclusive). */
  hasta?: string;
  /** Specific journal book. Empty = all. */
  diario?: string;
  /** "registrado" | "anulado". Empty = all. */
  estado?: string;
  /** Free-text search: number/code, description (glosa), or account. */
  q?: string;
  page?: number;
  pageSize?: number;
  orden?: JournalEntrySort;
  dir?: SortDirection;
}

export interface JournalEntrySummary {
  id: number;
  numero: string;
  fecha: string;
  diario: string;
  concepto: string;
  responsable: string | null;
  estado: JournalEntryStatus;
  total: number;
}

export interface JournalEntriesMeta {
  total: number;
  registrados: number;
  anulados: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
  orden: JournalEntrySort;
  dir: SortDirection;
}

export interface JournalEntriesPage {
  data: JournalEntrySummary[];
  meta: JournalEntriesMeta;
}

export interface JournalEntryLine {
  id: number;
  cuentaCodigo: string;
  cuentaNombre: string;
  cuentaTipo: string;
  descripcion: string;
  debe: number;
  haber: number;
}

export interface JournalEntryDetail {
  id: number;
  numero: string;
  fecha: string;
  diario: string;
  concepto: string;
  estado: JournalEntryStatus;
  responsable: string;
  observacion: string;
  fechaCreacion: string;
  fechaActualizacion: string;
  total: number;
  cuadrado: boolean;
  totales: { debe: number; haber: number };
  lineas: JournalEntryLine[];
}

export interface JournalBookOption {
  nombre: string;
  total: number;
}

export interface JournalStatusOption {
  valor: string;
  etiqueta: string;
  total: number;
}

export interface JournalEntriesOptions {
  diarios: JournalBookOption[];
  estados: JournalStatusOption[];
}

/** Chart of accounts item available for an entry line. */
export interface AccountingAccount {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
}

/** Line item of a manual journal entry. */
export interface NewJournalEntryLine {
  idCuenta: number;
  descripcion?: string;
  debe: number;
  haber: number;
}

/** Input payload to register a manual journal entry. */
export interface NewJournalEntryInput {
  fecha: string;
  diario: string;
  glosa: string;
  responsable?: string;
  observacion?: string;
  lineas: NewJournalEntryLine[];
}

const VALID_SORTS: JournalEntrySort[] = [
  "fecha",
  "numero",
  "concepto",
  "diario",
  "estado",
  "total",
];

export { ApiError, ApiError as ErrorApi };

/** Serializes filters to query string, omitting empty values. */
export function buildQuery(filters: JournalEntriesFilter): string {
  const params = new URLSearchParams();

  if (filters.desde) params.set("desde", filters.desde);
  if (filters.hasta) params.set("hasta", filters.hasta);
  if (filters.diario) params.set("diario", filters.diario);
  if (filters.estado) params.set("estado", filters.estado);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));

  const sort = filters.orden && VALID_SORTS.includes(filters.orden) ? filters.orden : "fecha";
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
  return getJson<JournalEntriesOptions>(`${BASE_URL}/opciones`);
}

/** Active chart of accounts list for line selection. */
export async function listAccountingAccounts(): Promise<AccountingAccount[]> {
  const response = await getJson<{ data: AccountingAccount[] }>(`${BASE_URL}/cuentas`);
  return response.data ?? [];
}

/** Preview of the next suggested code for the given date. */
export async function getNextJournalEntryCode(date: string): Promise<string> {
  const params = date ? `?fecha=${encodeURIComponent(date)}` : "";
  const response = await getJson<{ codigo: string }>(`${BASE_URL}/siguiente-codigo${params}`);
  return response.codigo;
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

// Backward-compatibility aliases
export type OrdenAsiento = JournalEntrySort;
export type DireccionOrden = SortDirection;
export type EstadoAsiento = JournalEntryStatus;
export type FiltroAsientos = JournalEntriesFilter;
export type AsientoResumen = JournalEntrySummary;
export type MetaAsientos = JournalEntriesMeta;
export type PaginaAsientos = JournalEntriesPage;
export type LineaAsiento = JournalEntryLine;
export type AsientoDetalle = JournalEntryDetail;
export type OpcionDiario = JournalBookOption;
export type OpcionEstado = JournalStatusOption;
export type OpcionesAsientos = JournalEntriesOptions;
export type CuentaContable = AccountingAccount;
export type LineaNuevaAsiento = NewJournalEntryLine;
export type EntradaAsiento = NewJournalEntryInput;

export const construirQuery = buildQuery;
export const listarAsientos = listJournalEntries;
export const obtenerAsiento = getJournalEntry;
export const obtenerOpcionesAsientos = getJournalEntriesOptions;
export const listarCuentasContables = listAccountingAccounts;
export const obtenerSiguienteCodigo = getNextJournalEntryCode;
export const registrarAsiento = registerJournalEntry;
export const formatearFecha = formatDate;
export const formatearMoneda = formatCurrency;
