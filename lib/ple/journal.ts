import { formatPeriod, isoInMonth, padNumber, sanitizeText } from "./format";
import { identityDocFromNumber, VOUCHER_TYPE, voucherTypeCode } from "./tables";
import type {
  PleSnapshot,
  SnapshotEntryLine,
  SnapshotJournalEntry,
  SnapshotPurchaseInvoice,
  SnapshotSalesInvoice,
} from "./snapshot";

/** Maximum length of the CUO (field 2 of every book). */
const CUO_MAX_LENGTH = 40;

/**
 * Unique operation code (CUO). It is the journal entry code with the characters the
 * layout forbids (`&`, `|`) removed.
 */
export function sanitizeCuo(code: string): string {
  return sanitizeText(code, CUO_MAX_LENGTH).text.replace(/\s+/g, "");
}

/** Line reference inside an entry: "M1", "M2"... (M = movements of the month). */
export function lineReference(position: number): string {
  return `M${position}`;
}

/** Link between an invoice and the journal line that supports it. */
export interface InvoiceLink {
  entryId: number;
  cuo: string;
  lineRef: string;
  /** Accounting date of the supporting entry. */
  entryDate: string;
}

/** Accounting line ready to be written in books 5.1, 6.1 and 1.1. */
export interface JournalLine {
  entryId: number;
  cuo: string;
  lineRef: string;
  /** Position of the line inside the entry (1-based, zero lines are skipped). */
  position: number;
  accountCode: string;
  accountingDate: string;
  operationDate: string;
  gloss: string;
  debit: number;
  credit: number;
  voucherType: string;
  voucherSeries: string;
  voucherNumber: string;
  counterpartDocType: string;
  counterpartDocNumber: string;
  /** Book code & period & CUO & line reference, for sales/purchases supporting lines. */
  structured: string;
}

/** Non-zero lines of an entry, in their original order. */
export function reportableLines(entry: SnapshotJournalEntry): SnapshotEntryLine[] {
  return entry.lines.filter((line) => line.debit !== 0 || line.credit !== 0);
}

function firstLineWithPrefix(lines: SnapshotEntryLine[], prefix: string): number {
  const index = lines.findIndex((line) => line.accountCode.startsWith(prefix));
  return index >= 0 ? index + 1 : 1;
}

/**
 * The supporting entry of an invoice is the first (lowest id) active entry linked to it:
 * the sale/purchase provision. The reference line is the receivable (12) or payable (42).
 */
function pickLink(
  entries: SnapshotJournalEntry[],
  invoiceId: number,
  kind: "sales" | "purchases"
): InvoiceLink | null {
  const candidates = entries
    .filter(
      (entry) =>
        entry.active &&
        (kind === "sales" ? entry.salesInvoiceId : entry.purchaseInvoiceId) === invoiceId
    )
    .sort((a, b) => a.id - b.id);
  const entry = candidates[0];
  if (!entry) return null;

  const lines = reportableLines(entry);
  const position = firstLineWithPrefix(lines, kind === "sales" ? "12" : "42");
  return {
    entryId: entry.id,
    cuo: sanitizeCuo(entry.code),
    lineRef: lineReference(position),
    entryDate: entry.date,
  };
}

export interface InvoiceLinks {
  sales: Map<number, InvoiceLink>;
  purchases: Map<number, InvoiceLink>;
}

export function resolveInvoiceLinks(snapshot: PleSnapshot): InvoiceLinks {
  const sales = new Map<number, InvoiceLink>();
  const purchases = new Map<number, InvoiceLink>();

  for (const invoice of snapshot.salesInvoices) {
    const link = pickLink(snapshot.journalEntries, invoice.id, "sales");
    if (link) sales.set(invoice.id, link);
  }
  for (const invoice of snapshot.purchaseInvoices) {
    const link = pickLink(snapshot.journalEntries, invoice.id, "purchases");
    if (link) purchases.set(invoice.id, link);
  }
  return { sales, purchases };
}

/** Series (up to 4 chars) and number (8 digits) as reported to SUNAT. */
export function formatVoucherNumber(number: number): string {
  return padNumber(number, 8);
}

interface VoucherData {
  voucherType: string;
  voucherSeries: string;
  voucherNumber: string;
  counterpartDocType: string;
  counterpartDocNumber: string;
  operationDate: string | null;
}

function salesVoucher(invoice: SnapshotSalesInvoice): VoucherData {
  const doc = identityDocFromNumber(invoice.customer?.documentNumber);
  return {
    voucherType: voucherTypeCode(invoice.voucherType),
    voucherSeries: invoice.series,
    voucherNumber: formatVoucherNumber(invoice.number),
    counterpartDocType: doc?.type ?? "",
    counterpartDocNumber: doc?.number ?? "",
    operationDate: invoice.issuedAt,
  };
}

function purchaseVoucher(invoice: SnapshotPurchaseInvoice): VoucherData {
  const doc = identityDocFromNumber(invoice.supplier.documentNumber);
  return {
    voucherType: voucherTypeCode(invoice.voucherType),
    voucherSeries: invoice.series,
    voucherNumber: formatVoucherNumber(invoice.number),
    counterpartDocType: doc?.type ?? "",
    counterpartDocNumber: doc?.number ?? "",
    operationDate: invoice.issuedAt,
  };
}

/** Entries without a supporting voucher use document type 00 and the CUO tail as number. */
function otherVoucher(cuo: string): VoucherData {
  const tail = cuo.replace(/\D/g, "").slice(-8) || "1";
  return {
    voucherType: VOUCHER_TYPE.other,
    voucherSeries: "",
    voucherNumber: tail,
    counterpartDocType: "",
    counterpartDocNumber: "",
    operationDate: null,
  };
}

/**
 * Builds every accounting line of the period (annulled entries excluded) in entry order.
 * Lines that support a sale or purchase carry the structured data of the register.
 */
export function buildJournalLines(snapshot: PleSnapshot): JournalLine[] {
  const { year, month } = snapshot.period;
  const period = formatPeriod(year, month);
  const salesById = new Map(snapshot.salesInvoices.map((invoice) => [invoice.id, invoice]));
  const purchasesById = new Map(
    snapshot.purchaseInvoices.map((invoice) => [invoice.id, invoice])
  );
  const links = resolveInvoiceLinks(snapshot);

  const entries = snapshot.journalEntries
    .filter((entry) => entry.active && isoInMonth(entry.date, year, month))
    .sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));

  const lines: JournalLine[] = [];
  for (const entry of entries) {
    const cuo = sanitizeCuo(entry.code);
    const sale = entry.salesInvoiceId ? salesById.get(entry.salesInvoiceId) : undefined;
    const purchase = entry.purchaseInvoiceId
      ? purchasesById.get(entry.purchaseInvoiceId)
      : undefined;
    const voucher = sale
      ? salesVoucher(sale)
      : purchase
        ? purchaseVoucher(purchase)
        : otherVoucher(cuo);

    const link = sale
      ? links.sales.get(sale.id)
      : purchase
        ? links.purchases.get(purchase.id)
        : undefined;
    const bookCode = sale ? "140100" : "080100";
    const supportsRegister = Boolean(link && link.entryId === entry.id);

    reportableLines(entry).forEach((line, index) => {
      const position = index + 1;
      const lineRef = lineReference(position);
      lines.push({
        entryId: entry.id,
        cuo,
        lineRef,
        position,
        accountCode: line.accountCode,
        accountingDate: entry.date,
        operationDate: voucher.operationDate ?? entry.date,
        gloss: line.description?.trim() || entry.description,
        debit: line.debit,
        credit: line.credit,
        voucherType: voucher.voucherType,
        voucherSeries: voucher.voucherSeries,
        voucherNumber: voucher.voucherNumber,
        counterpartDocType: voucher.counterpartDocType,
        counterpartDocNumber: voucher.counterpartDocNumber,
        structured:
          supportsRegister && link && link.lineRef === lineRef
            ? [bookCode, period, cuo, lineRef].join("&")
            : "",
      });
    });
  }
  return lines;
}
