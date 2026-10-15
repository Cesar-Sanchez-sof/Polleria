import { CURRENCY_CODE, PURCHASE_CREDIT_WINDOW_MONTHS } from "../constants";
import { formatPeriod, isoInMonth, monthsBetween, toCents } from "../format";
import { formatVoucherNumber, resolveInvoiceLinks } from "../journal";
import type { PleSnapshot } from "../snapshot";
import { IssueCollector } from "../serializer";
import {
  givesTaxCredit,
  identityDocFromNumber,
  IDENTITY_DOC,
  VOUCHER_TYPE,
  voucherTypeCode,
} from "../tables";
import type { BookDefinition, PleRecord } from "../types";
import { field } from "./fields";

/**
 * Format 8.1 - Purchases Register (RS 361-2015/SUNAT Annex 2, item 8.1).
 * 41 fields; fields 42-82 are free use and are not emitted.
 */
export const PURCHASES_REGISTER_DEFINITION: BookDefinition = {
  id: "purchases-register",
  fields: [
    field(1, "period", "Period", "numeric", 8, true),
    field(2, "cuo", "Unique operation code (CUO)", "alphanumeric", 40, true),
    field(3, "lineRef", "Entry line reference", "alphanumeric", 10, true),
    field(4, "issueDate", "Issue date", "date", 10, true),
    field(5, "dueDate", "Due or payment date", "date", 10),
    field(6, "voucherType", "Voucher type", "numeric", 2, true),
    field(7, "series", "Voucher series", "alphanumeric", 20),
    field(8, "customsYear", "DUA / DSI issue year", "numeric", 4),
    field(9, "number", "Voucher number", "alphanumeric", 20, true),
    field(10, "finalNumber", "Final voucher number (consolidated)", "numeric", 20),
    field(11, "supplierDocType", "Supplier identity document type", "alphanumeric", 1),
    field(12, "supplierDocNumber", "Supplier identity document number", "alphanumeric", 15),
    field(13, "supplierName", "Supplier name", "text", 100),
    field(14, "creditBase", "Taxable base: credit, taxed operations", "money", 15),
    field(15, "creditIgv", "IGV of the base in field 14", "money", 15),
    field(16, "mixedBase", "Taxable base: credit, taxed and non-taxed operations", "money", 15),
    field(17, "mixedIgv", "IGV of the base in field 16", "money", 15),
    field(18, "noCreditBase", "Taxable base: no tax credit", "money", 15),
    field(19, "noCreditIgv", "IGV of the base in field 18", "money", 15),
    field(20, "nonTaxed", "Value of non-taxed acquisitions", "money", 15),
    field(21, "isc", "Selective consumption tax", "money", 15),
    field(22, "otherCharges", "Other charges outside the taxable base", "money", 15),
    field(23, "total", "Total of the voucher", "money", 15, true),
    field(24, "currency", "Currency", "alphanumeric", 3),
    field(25, "exchangeRate", "Exchange rate", "rate", 5),
    field(26, "modifiedIssueDate", "Modified voucher issue date", "date", 10),
    field(27, "modifiedVoucherType", "Modified voucher type", "numeric", 2),
    field(28, "modifiedSeries", "Modified voucher series", "alphanumeric", 20),
    field(29, "customsCode", "Customs office code (DUA / DSI)", "alphanumeric", 3),
    field(30, "modifiedNumber", "Modified voucher number", "alphanumeric", 20),
    field(31, "detractionDate", "Detraction deposit date", "date", 10),
    field(32, "detractionNumber", "Detraction deposit number", "alphanumeric", 24),
    field(33, "withholdingMark", "Subject to withholding", "numeric", 1),
    field(34, "goodsClassification", "Goods and services classification (table 30)", "numeric", 1),
    field(35, "contractId", "Contract or project identification", "alphanumeric", 12),
    field(36, "error1", "Error type 1: exchange rate inconsistency", "numeric", 1),
    field(37, "error2", "Error type 2: non-habido suppliers", "numeric", 1),
    field(38, "error3", "Error type 3: suppliers that waived the IGV exemption", "numeric", 1),
    field(39, "error4", "Error type 4: DNIs that already have RUC", "numeric", 1),
    field(40, "paidWithBankedMeans", "Paid with a payment method (table 1)", "numeric", 1),
    field(41, "status", "Operation status", "numeric", 1, true),
  ],
};

/** Canonical purchases register row, reusable by the future SIRE (RCE) export. */
export interface PurchaseRegisterRow {
  invoiceId: number;
  period: string;
  cuo: string;
  lineRef: string;
  issueDate: string;
  voucherType: string;
  series: string;
  number: string;
  supplierDocType: string;
  supplierDocNumber: string;
  supplierName: string;
  /** Base and IGV with tax credit (fields 14 and 15). */
  creditBase: number;
  creditIgv: number;
  /** Amount without tax credit (field 20). */
  nonTaxed: number;
  total: number;
  /** "0" no credit, "1" same period, "6" within 12 months, "7" older. */
  status: "0" | "1" | "6" | "7";
  ref: string;
}

/** Status (field 41) from the voucher type and the distance between issue date and period. */
export function purchaseStatus(
  voucherType: string,
  issuedAt: string,
  year: number,
  month: number
): PurchaseRegisterRow["status"] | null {
  if (!givesTaxCredit(voucherType)) return "0";
  const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const months = monthsBetween(issuedAt, periodStart);
  if (months < 0) return null;
  if (months === 0) return "1";
  return months <= PURCHASE_CREDIT_WINDOW_MONTHS ? "6" : "7";
}

export function buildPurchaseRegisterRows(
  snapshot: PleSnapshot,
  collector: IssueCollector
): PurchaseRegisterRow[] {
  const { year, month } = snapshot.period;
  const period = formatPeriod(year, month);
  const links = resolveInvoiceLinks(snapshot);
  const rows: PurchaseRegisterRow[] = [];

  const invoices = [...snapshot.purchaseInvoices]
    .filter((invoice) => invoice.active)
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.id - b.id);

  for (const invoice of invoices) {
    const link = links.purchases.get(invoice.id);
    const annotationDate = link?.entryDate ?? invoice.issuedAt;
    if (!isoInMonth(annotationDate, year, month)) continue;

    const voucherType = voucherTypeCode(invoice.voucherType);
    const number = formatVoucherNumber(invoice.number);
    const ref = `${invoice.series}-${number}`;

    if (!link) {
      collector.error(ref, "The voucher has no supporting accounting entry (CUO).", 2);
      continue;
    }
    if (voucherType === VOUCHER_TYPE.other) {
      collector.warning(
        ref,
        `Voucher type "${invoice.voucherType}" is reported as 00 (Other) without tax credit.`,
        6
      );
    }

    const status = purchaseStatus(voucherType, invoice.issuedAt, year, month);
    if (status === null) {
      collector.error(ref, "The issue date is later than the registration period.", 4);
      continue;
    }

    const supplierDoc = identityDocFromNumber(invoice.supplier.documentNumber);
    if (voucherType === VOUCHER_TYPE.invoice && supplierDoc?.type !== IDENTITY_DOC.ruc) {
      collector.error(ref, "Invoices require the supplier RUC.", 12);
    }

    const credit = givesTaxCredit(voucherType);
    const derivedTotal = credit
      ? (toCents(invoice.subtotal) + toCents(invoice.igv)) / 100
      : invoice.total;
    if (credit && toCents(derivedTotal) !== toCents(invoice.total)) {
      collector.warning(
        ref,
        "Voucher total differs from taxable base plus IGV; the register uses base plus IGV.",
        23
      );
    }

    rows.push({
      invoiceId: invoice.id,
      period,
      cuo: link.cuo,
      lineRef: link.lineRef,
      issueDate: invoice.issuedAt,
      voucherType,
      series: invoice.series,
      number,
      supplierDocType: supplierDoc?.type ?? "",
      supplierDocNumber: supplierDoc?.number ?? "",
      supplierName: invoice.supplier.name,
      creditBase: credit ? invoice.subtotal : 0,
      creditIgv: credit ? invoice.igv : 0,
      nonTaxed: credit ? 0 : invoice.total,
      total: derivedTotal,
      status,
      ref,
    });
  }
  return rows;
}

/** Converts canonical rows to 8.1 records. Field 23 equals the sum of fields 14 to 22. */
export function purchaseRowsToRecords(rows: readonly PurchaseRegisterRow[]): PleRecord[] {
  return rows.map((row) => {
    const credit = row.status !== "0";
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
        supplierDocType: row.supplierDocType,
        supplierDocNumber: row.supplierDocNumber,
        supplierName: row.supplierName,
        creditBase: credit ? row.creditBase : "",
        creditIgv: credit ? row.creditIgv : "",
        nonTaxed: credit ? "" : row.nonTaxed,
        total: row.total,
        currency: CURRENCY_CODE,
        status: row.status,
      },
    };
  });
}
