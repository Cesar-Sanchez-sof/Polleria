/**
 * Frontend service for "General Ledger (Libro Mayor)".
 *
 * Centralizes access to `/api/mayor`: chronological account movements with running balance
 * and period totals, filtered by date range.
 */

import { ApiError, getJson } from "./http";

const BASE_URL = "/api/mayor";

export { ApiError, ApiError as ErrorApi };

export interface GeneralLedgerFilter {
  /** Account code (mandatory). */
  codigo: string;
  /** Start date (YYYY-MM-DD, inclusive). */
  desde?: string;
  /** End date (YYYY-MM-DD, inclusive). */
  hasta?: string;
}

export type BalanceType = "deudor" | "acreedor" | null;

export interface GeneralLedgerMovement {
  id: number;
  idAsiento: number;
  numero: string;
  fecha: string;
  glosa: string;
  descripcion: string;
  modulo: string;
  referencia: string | null;
  estado: "Registrado" | "Anulado";
  debe: number;
  haber: number;
  saldo: number;
  tipoSaldo: BalanceType;
}

export interface GeneralLedger {
  cuenta: { codigo: string; nombre: string; tipo: string };
  saldoAnterior: number;
  saldoFinal: number;
  totales: { debe: number; haber: number; movimientos: number };
  movimientos: GeneralLedgerMovement[];
}

/** Serializes filter to query string, omitting empty values. */
export function buildGeneralLedgerQuery(filters: GeneralLedgerFilter): string {
  const params = new URLSearchParams();

  params.set("codigo", filters.codigo);
  if (filters.desde) params.set("desde", filters.desde);
  if (filters.hasta) params.set("hasta", filters.hasta);

  return params.toString();
}

/** Fetches general ledger movements for the specified account and date range. */
export async function getGeneralLedger(filters: GeneralLedgerFilter): Promise<GeneralLedger> {
  const query = buildGeneralLedgerQuery(filters);
  return getJson<GeneralLedger>(`${BASE_URL}?${query}`);
}

// Re-export common accounting helpers
export {
  formatDate,
  formatCurrency,
  listAccountingAccounts,
  getJournalEntry,
  type JournalEntryDetail,
  type AccountingAccount,
  formatearFecha,
  formatearMoneda,
  listarCuentasContables,
  obtenerAsiento,
  type AsientoDetalle,
  type CuentaContable,
} from "./asientos.service";

// Backward-compatibility aliases
export type FiltroMayor = GeneralLedgerFilter;
export type TipoSaldo = BalanceType;
export type MovimientoMayor = GeneralLedgerMovement;
export type LibroMayor = GeneralLedger;
export const construirQueryMayor = buildGeneralLedgerQuery;
export const obtenerLibroMayor = getGeneralLedger;
