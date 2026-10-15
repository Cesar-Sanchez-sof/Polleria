/**
 * Plain-data input of the PLE generators. The service layer fills it from Prisma;
 * the book builders never touch the database, so they are easy to test.
 * Dates are ISO strings ("YYYY-MM-DD") and amounts are plain numbers.
 */

export interface SnapshotParty {
  documentNumber: string;
  name: string;
}

export interface SnapshotSalesInvoice {
  id: number;
  /** ERP label: "Factura" | "Boleta". */
  voucherType: string;
  series: string;
  number: number;
  issuedAt: string;
  subtotal: number;
  igv: number;
  total: number;
  /** ERP status ("Issued" or an annulled/cancelled variant). */
  status: string;
  customer: SnapshotParty | null;
}

export interface SnapshotPurchaseInvoice {
  id: number;
  /** ERP label: "Factura" | "Boleta" | "Guia"... */
  voucherType: string;
  series: string;
  number: number;
  issuedAt: string;
  subtotal: number;
  igv: number;
  total: number;
  active: boolean;
  supplier: SnapshotParty;
}

export interface SnapshotEntryLine {
  accountCode: string;
  description: string | null;
  debit: number;
  credit: number;
}

export interface SnapshotJournalEntry {
  id: number;
  code: string;
  /** Accounting date. */
  date: string;
  description: string;
  /** Entries flagged `false` are annulled and never reported. */
  active: boolean;
  salesInvoiceId: number | null;
  purchaseInvoiceId: number | null;
  lines: SnapshotEntryLine[];
}

export interface SnapshotAccount {
  code: string;
  name: string;
}

export interface PleSnapshot {
  taxpayer: { ruc: string; name: string };
  period: { year: number; month: number };
  salesInvoices: SnapshotSalesInvoice[];
  purchaseInvoices: SnapshotPurchaseInvoice[];
  /** Entries dated in the period plus the entries that support the loaded invoices. */
  journalEntries: SnapshotJournalEntry[];
  accounts: SnapshotAccount[];
}
