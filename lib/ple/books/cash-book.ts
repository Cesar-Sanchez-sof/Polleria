import { CURRENCY_CODE } from "../constants";
import { formatPeriod } from "../format";
import type { JournalLine } from "../journal";
import type { PleSnapshot } from "../snapshot";
import type { BookDefinition, PleRecord } from "../types";
import { field } from "./fields";

/**
 * Format 1.1 - Cash and Banks book, movements of cash (RS 286-2009/SUNAT Annex 2, item 1.1).
 * 19 fields; fields 20-38 are free use and are not emitted.
 */
export const CASH_BOOK_DEFINITION: BookDefinition = {
  id: "cash-book",
  fields: [
    field(1, "period", "Period", "numeric", 8, true),
    field(2, "cuo", "Unique operation code (CUO)", "alphanumeric", 40, true),
    field(3, "lineRef", "Entry line reference", "alphanumeric", 10, true),
    field(4, "accountCode", "Cash account code", "numeric", 24, true),
    field(5, "operationUnit", "Operation unit code", "alphanumeric", 24),
    field(6, "costCenter", "Cost center code", "alphanumeric", 24),
    field(7, "currency", "Origin currency", "alphanumeric", 3, true),
    field(8, "voucherType", "Voucher type", "numeric", 2, true),
    field(9, "voucherSeries", "Voucher series", "alphanumeric", 20),
    field(10, "voucherNumber", "Voucher number", "alphanumeric", 20, true),
    field(11, "accountingDate", "Accounting date", "date", 10),
    field(12, "dueDate", "Due date", "date", 10),
    field(13, "operationDate", "Operation date", "date", 10, true),
    field(14, "gloss", "Gloss", "text", 200, true),
    field(15, "referenceGloss", "Reference gloss", "text", 200),
    field(16, "debit", "Debit", "money", 15, true),
    field(17, "credit", "Credit", "money", 15, true),
    field(18, "structured", "Structured data", "structured", 92),
    field(19, "status", "Operation status", "numeric", 1, true),
  ],
};

/**
 * PCGE accounts 101 (cash), 102 (fixed funds) and 103 (cash in transit) belong to format 1.1.
 * Accounts 104+ (bank current accounts) belong to format 1.2, which is out of scope.
 */
export function isCashAccount(accountCode: string): boolean {
  return /^10[123]/.test(accountCode);
}

export function selectCashLines(lines: readonly JournalLine[]): JournalLine[] {
  return lines.filter((line) => isCashAccount(line.accountCode));
}

export function buildCashBookRecords(
  lines: readonly JournalLine[],
  snapshot: PleSnapshot
): PleRecord[] {
  return selectCashLines(lines).map((line) => ({
    ref: `${line.cuo} ${line.lineRef}`,
    values: {
      period: formatPeriod(snapshot.period.year, snapshot.period.month),
      cuo: line.cuo,
      lineRef: line.lineRef,
      accountCode: line.accountCode,
      currency: CURRENCY_CODE,
      voucherType: line.voucherType,
      voucherSeries: line.voucherSeries,
      voucherNumber: line.voucherNumber,
      accountingDate: line.accountingDate,
      operationDate: line.operationDate,
      gloss: line.gloss,
      debit: line.debit,
      credit: line.credit,
      structured: line.structured,
      status: "1",
    },
  }));
}
