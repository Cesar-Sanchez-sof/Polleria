/**
 * Frontend service for "General Ledger (Libro Mayor)".
 *
 * Centralizes access to `/api/general-ledger`: chronological account movements with running balance
 * and period totals, filtered by date range.
 */

import { ApiError, getJson } from "./http";

const BASE_URL = "/api/general-ledger";

export { ApiError };

export interface GeneralLedgerFilter {
  /** Account code (mandatory). */
  code: string;
  /** Start date (YYYY-MM-DD, inclusive). */
  from?: string;
  /** End date (YYYY-MM-DD, inclusive). */
  to?: string;
}

export type BalanceType = "deudor" | "acreedor" | null;

export interface GeneralLedgerMovement {
  id: number;
  entryId: number;
  number: string;
  date: string;
  entryDescription: string;
  description: string;
  /** Account the movement was posted to (differs from the queried one for parent accounts). */
  accountCode: string;
  accountName: string;
  module: string;
  reference: string | null;
  status: "Registrado" | "Anulado";
  debit: number;
  credit: number;
  balance: number;
  balanceType: BalanceType;
}

export interface GeneralLedger {
  account: { code: string; name: string; type: string };
  previousBalance: number;
  finalBalance: number;
  totals: { debit: number; credit: number; movements: number };
  movements: GeneralLedgerMovement[];
}

/** Serializes filter to query string, omitting empty values. */
export function buildGeneralLedgerQuery(filters: GeneralLedgerFilter): string {
  const params = new URLSearchParams();

  params.set("codigo", filters.code);
  if (filters.from) params.set("desde", filters.from);
  if (filters.to) params.set("hasta", filters.to);

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
  type AccountingAccount
} from "./journal-entries.service";

