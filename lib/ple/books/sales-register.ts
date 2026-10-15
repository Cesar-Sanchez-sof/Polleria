import { BOLETA_DETAIL_THRESHOLD, CURRENCY_CODE } from "../constants";
import { formatPeriod, isoInMonth, padNumber, toCents } from "../format";
import { formatVoucherNumber, resolveInvoiceLinks } from "../journal";
import type { PleSnapshot, SnapshotSalesInvoice } from "../snapshot";
import { IssueCollector } from "../serializer";
import { identityDocFromNumber, IDENTITY_DOC, VOUCHER_TYPE, voucherTypeCode } from "../tables";
import type { BookDefinition, PleRecord } from "../types";
import { field } from "./fields";

/**
 * Format 14.1 - Sales and Income Register (RS 361-2015/SUNAT Annex 1, item 14.1, with the
 * field 9 change of RS 042-2021/SUNAT). 34 fields; fields 35-68 are free use and are not emitted.
 */
export const SALES_REGISTER_DEFINITION: BookDefinition = {
  id: "sales-register",
  fields: [
    field(1, "period", "Period", "numeric", 8, true),
    field(2, "cuo", "Unique operation code (CUO)", "alphanumeric", 40, true),
    field(3, "lineRef", "Entry line reference", "alphanumeric", 10, true),
    field(4, "issueDate", "Issue date", "date", 10),
    field(5, "dueDate", "Due or payment date", "date", 10),
    field(6, "voucherType", "Voucher type", "numeric", 2, true),
    field(7, "series", "Voucher series", "alphanumeric", 20, true),
    field(8, "number", "Voucher number", "alphanumeric", 20, true),
    field(9, "finalNumber", "Final voucher number (consolidated)", "numeric", 20),
    field(10, "customerDocType", "Customer identity document type", "alphanumeric", 1),
    field(11, "customerDocNumber", "Customer identity document number", "alphanumeric", 15),
    field(12, "customerName", "Customer name", "text", 100),
    field(13, "exportValue", "Export invoiced value", "money", 15),
    field(14, "taxableBase", "Taxable base", "money", 15),
    field(15, "baseDiscount", "Taxable base discount", "money", 15),
    field(16, "igv", "IGV / IPM", "money", 15),
    field(17, "igvDiscount", "IGV / IPM discount", "money", 15),
    field(18, "exempt", "Exempt operation total", "money", 15),
    field(19, "unaffected", "Unaffected operation total", "money", 15),
    field(20, "isc", "Selective consumption tax", "money", 15),
    field(21, "ivapBase", "Rice IVAP taxable base", "money", 15),
    field(22, "ivap", "Rice IVAP", "money", 15),
    field(23, "otherCharges", "Other charges outside the taxable base", "money", 15),
    field(24, "total", "Voucher total", "money", 15),
    field(25, "currency", "Currency", "alphanumeric", 3),
    field(26, "exchangeRate", "Exchange rate", "rate", 5),
    field(27, "modifiedIssueDate", "Modified voucher issue date", "date", 10),
    field(28, "modifiedVoucherType", "Modified voucher type", "numeric", 2),
    field(29, "modifiedSeries", "Modified voucher series", "alphanumeric", 20),
    field(30, "modifiedNumber", "Modified voucher number", "alphanumeric", 20),
    field(31, "contractId", "Contract or project identification", "alphanumeric", 12),
    field(32, "exchangeRateError", "Error type 1: exchange rate inconsistency", "numeric", 1),
    field(33, "paidWithBankedMeans", "Paid with a payment method (table 1)", "numeric", 1),
    field(34, "status", "Operation status", "numeric", 1, true),
  ],
};

/** Canonical sales register row, reusable by the future SIRE (RVIE) export. */
export interface SalesRegisterRow {
  invoiceId: number;
  period: string;
  cuo: string;
  lineRef: string;
  issueDate: string;
  voucherType: string;
  series: string;
  number: string;
  customerDocType: string;
  customerDocNumber: string;
  customerName: string;
  taxableBase: number;
  igv: number;
  total: number;
  /** "1" operation of the period, "2" annulled before delivery. */
  status: "1" | "2";
  ref: string;
}

function isAnnulled(invoice: SnapshotSalesInvoice): boolean {
  return /annul|cancel|void|anul/i.test(invoice.status);
}

/**
 * Builds the canonical rows of the month. An invoice belongs to the period of its supporting
 * entry (fallback: issue date). Annulled vouchers without an entry get a synthetic CUO.
 */
export function buildSalesRegisterRows(
  snapshot: PleSnapshot,
  collector: IssueCollector
): SalesRegisterRow[] {
  const { year, month } = snapshot.period;
  const period = formatPeriod(year, month);
  const links = resolveInvoiceLinks(snapshot);
  const rows: SalesRegisterRow[] = [];

  const invoices = [...snapshot.salesInvoices].sort(
    (a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.id - b.id
  );

  for (const invoice of invoices) {
    const link = links.sales.get(invoice.id);
    const annotationDate = link?.entryDate ?? invoice.issuedAt;
    if (!isoInMonth(annotationDate, year, month)) continue;

    const voucherType = voucherTypeCode(invoice.voucherType);
    const number = formatVoucherNumber(invoice.number);
    const ref = `${invoice.series}-${number}`;
    const annulled = isAnnulled(invoice);

    if (voucherType === VOUCHER_TYPE.other) {
      collector.error(ref, `Unsupported voucher type "${invoice.voucherType}".`, 6);
      continue;
    }
    if (!/^[A-Za-z0-9]{4}$/.test(invoice.series)) {
      collector.error(ref, "Voucher series must have 4 alphanumeric characters.", 7);
    }

    let cuo = link?.cuo ?? "";
    let lineRef = link?.lineRef ?? "";
    if (!link) {
      if (annulled) {
        cuo = `ANU${year}${String(month).padStart(2, "0")}${padNumber(invoice.id, 6)}`;
        lineRef = "M1";
      } else {
        collector.error(ref, "The voucher has no supporting accounting entry (CUO).", 2);
        continue;
      }
    }

    const doc = identityDocFromNumber(invoice.customer?.documentNumber);
    const total = invoice.total;
    const needsCustomer =
      voucherType === VOUCHER_TYPE.invoice || total >= BOLETA_DETAIL_THRESHOLD;

    if (!annulled && needsCustomer) {
      if (!doc) {
        collector.error(ref, "The customer identity document is required for this voucher.", 10);
      } else if (voucherType === VOUCHER_TYPE.invoice && doc.type !== IDENTITY_DOC.ruc) {
        collector.error(ref, "Invoices must be issued to a customer with RUC.", 10);
      }
    }

    if (!annulled && toCents(invoice.subtotal) + toCents(invoice.igv) !== toCents(total)) {
      collector.warning(ref, "Total differs from taxable base plus IGV.", 24);
    }

    const showCustomer = !annulled && doc !== null;
    rows.push({
      invoiceId: invoice.id,
      period,
      cuo,
      lineRef,
      issueDate: annulled ? "" : invoice.issuedAt,
      voucherType,
      series: invoice.series,
      number,
      customerDocType: showCustomer ? doc!.type : "",
      customerDocNumber: showCustomer ? doc!.number : "",
      customerName: showCustomer ? (invoice.customer?.name ?? "") : "",
      taxableBase: annulled ? 0 : invoice.subtotal,
      igv: annulled ? 0 : invoice.igv,
      total: annulled ? 0 : total,
      status: annulled ? "2" : "1",
      ref,
    });
  }
  return rows;
}

/** Converts canonical rows to 14.1 records. */
export function salesRowsToRecords(rows: readonly SalesRegisterRow[]): PleRecord[] {
  return rows.map((row) => {
    const annulled = row.status === "2";
    return {
      ref: row.ref,
      values: {
        period: row.period,
        cuo: row.cuo,
        lineRef: row.lineRef,
        issueDate: row.issueDate,
        voucherType: row.voucherType,
        series: row.series,
        number: row.number,
        customerDocType: row.customerDocType,
        customerDocNumber: row.customerDocNumber,
        customerName: row.customerName,
        taxableBase: row.taxableBase,
        igv: row.igv,
        total: row.total,
        currency: annulled ? "" : CURRENCY_CODE,
        status: row.status,
      },
    };
  });
}

/** Validates that dates are present for non-annulled vouchers (field 4 rule). */
export function validateSalesRows(
  rows: readonly SalesRegisterRow[],
  collector: IssueCollector
): void {
  for (const row of rows) {
    if (row.status !== "2" && !row.issueDate) {
      collector.error(row.ref, "Issue date is required unless the voucher is annulled.", 4);
    }
  }
}
