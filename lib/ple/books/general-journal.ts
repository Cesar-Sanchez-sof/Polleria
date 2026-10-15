import { CURRENCY_CODE, type PleBookId } from "../constants";
import { toCents } from "../format";
import { formatPeriod } from "../format";
import type { JournalLine } from "../journal";
import type { PleSnapshot } from "../snapshot";
import { IssueCollector } from "../serializer";
import type { BookDefinition, PleRecord } from "../types";
import { field } from "./fields";

/**
 * Format 5.1 (General Journal) and 6.1 (General Ledger) share the same 21-field
 * structure (RS 286-2009/SUNAT Annex 2, item 5.1 and 6.1). Fields 22-44 are free use
 * and are not emitted.
 */
const JOURNAL_FIELDS = [
  field(1, "period", "Period", "numeric", 8, true),
  field(2, "cuo", "Unique operation code (CUO)", "alphanumeric", 40, true),
  field(3, "lineRef", "Entry line reference", "alphanumeric", 10, true),
  field(4, "accountCode", "Account code", "numeric", 24, true),
  field(5, "operationUnit", "Operation unit code", "alphanumeric", 24),
  field(6, "costCenter", "Cost center code", "alphanumeric", 24),
  field(7, "currency", "Origin currency", "alphanumeric", 3, true),
  field(8, "counterpartDocType", "Issuer identity document type", "alphanumeric", 1),
  field(9, "counterpartDocNumber", "Issuer identity document number", "alphanumeric", 15),
  field(10, "voucherType", "Voucher type", "numeric", 2, true),
  field(11, "voucherSeries", "Voucher series", "alphanumeric", 20),
  field(12, "voucherNumber", "Voucher number", "alphanumeric", 20, true),
  field(13, "accountingDate", "Accounting date", "date", 10),
  field(14, "dueDate", "Due date", "date", 10),
  field(15, "operationDate", "Operation date", "date", 10, true),
  field(16, "gloss", "Gloss", "text", 200, true),
  field(17, "referenceGloss", "Reference gloss", "text", 200),
  field(18, "debit", "Debit", "money", 15, true),
  field(19, "credit", "Credit", "money", 15, true),
  field(20, "structured", "Structured data", "structured", 92),
  field(21, "status", "Operation status", "numeric", 1, true),
] as const;

export const GENERAL_JOURNAL_DEFINITION: BookDefinition = {
  id: "general-journal",
  fields: JOURNAL_FIELDS,
};

export const GENERAL_LEDGER_DEFINITION: BookDefinition = {
  id: "general-ledger",
  fields: JOURNAL_FIELDS,
};

/** Converts accounting lines to records of the 5.1 / 6.1 structure. */
export function journalLineToRecord(line: JournalLine, snapshot: PleSnapshot): PleRecord {
  return {
    ref: `${line.cuo} ${line.lineRef}`,
    values: {
      period: formatPeriod(snapshot.period.year, snapshot.period.month),
      cuo: line.cuo,
      lineRef: line.lineRef,
      accountCode: line.accountCode,
      currency: CURRENCY_CODE,
      counterpartDocType: line.counterpartDocType,
      counterpartDocNumber: line.counterpartDocNumber,
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
  };
}

/**
 * Validates the double-entry rules: a line cannot have debit and credit at the same time and
 * the sum of the debit column must equal the sum of the credit column (per entry and overall).
 */
export function validateJournalBalance(
  book: PleBookId,
  lines: readonly JournalLine[],
  collector: IssueCollector
): { debitCents: number; creditCents: number } {
  const perEntry = new Map<string, { debit: number; credit: number }>();
  let debitCents = 0;
  let creditCents = 0;

  for (const line of lines) {
    const debit = toCents(line.debit);
    const credit = toCents(line.credit);
    if (debit < 0 || credit < 0) {
      collector.error(`${line.cuo} ${line.lineRef}`, "Debit and credit must not be negative.", 18);
    }
    if (debit > 0 && credit > 0) {
      collector.error(
        `${line.cuo} ${line.lineRef}`,
        "A line cannot have debit and credit at the same time.",
        18
      );
    }
    debitCents += debit;
    creditCents += credit;
    const totals = perEntry.get(line.cuo) ?? { debit: 0, credit: 0 };
    totals.debit += debit;
    totals.credit += credit;
    perEntry.set(line.cuo, totals);
  }

  if (book === "general-journal" || book === "general-ledger") {
    for (const [cuo, totals] of perEntry) {
      if (totals.debit !== totals.credit) {
        collector.error(cuo, "Entry is unbalanced: debit and credit totals differ.", 18);
      }
    }
    if (debitCents !== creditCents) {
      collector.error(
        "TOTAL",
        "The sum of the debit column must equal the sum of the credit column.",
        18
      );
    }
  }

  return { debitCents, creditCents };
}

/** Records of the General Journal (chronological order). */
export function buildGeneralJournalRecords(
  lines: readonly JournalLine[],
  snapshot: PleSnapshot
): PleRecord[] {
  return lines.map((line) => journalLineToRecord(line, snapshot));
}

function compareAccounts(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true });
}

/** Records of the General Ledger: grouped by account, then by date, CUO and line. */
export function buildGeneralLedgerRecords(
  lines: readonly JournalLine[],
  snapshot: PleSnapshot
): PleRecord[] {
  return [...lines]
    .sort(
      (a, b) =>
        compareAccounts(a.accountCode, b.accountCode) ||
        a.accountingDate.localeCompare(b.accountingDate) ||
        a.entryId - b.entryId ||
        a.position - b.position
    )
    .map((line) => journalLineToRecord(line, snapshot));
}
