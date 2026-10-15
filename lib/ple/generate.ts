import { FIELD_SEPARATOR, RECORD_TERMINATOR, type PleBookId } from "./constants";
import { buildCashBookRecords, CASH_BOOK_DEFINITION, selectCashLines } from "./books/cash-book";
import {
  buildChartOfAccountsRecords,
  CHART_OF_ACCOUNTS_DEFINITION,
} from "./books/chart-of-accounts";
import {
  buildGeneralJournalRecords,
  buildGeneralLedgerRecords,
  GENERAL_JOURNAL_DEFINITION,
  GENERAL_LEDGER_DEFINITION,
  validateJournalBalance,
} from "./books/general-journal";
import {
  buildPurchaseRegisterRows,
  PURCHASES_REGISTER_DEFINITION,
  purchaseRowsToRecords,
} from "./books/purchases-register";
import {
  buildSalesRegisterRows,
  SALES_REGISTER_DEFINITION,
  salesRowsToRecords,
  validateSalesRows,
} from "./books/sales-register";
import { buildPleFileName } from "./file-name";
import { toCents } from "./format";
import { buildJournalLines } from "./journal";
import { IssueCollector, joinCells, serializeCells } from "./serializer";
import type { PleSnapshot } from "./snapshot";
import type { BookDefinition, PleRecord, PleResult, PleTotals } from "./types";

interface BookBuild {
  definition: BookDefinition;
  records: PleRecord[];
  totals: PleTotals;
}

function sumCents(records: readonly PleRecord[], key: string): number {
  return records.reduce((sum, record) => {
    const value = record.values[key];
    return sum + (typeof value === "number" || typeof value === "string" ? toCents(value) : 0);
  }, 0);
}

function buildBook(
  book: PleBookId,
  snapshot: PleSnapshot,
  collector: IssueCollector
): BookBuild {
  switch (book) {
    case "sales-register": {
      const rows = buildSalesRegisterRows(snapshot, collector);
      validateSalesRows(rows, collector);
      const records = salesRowsToRecords(rows);
      return {
        definition: SALES_REGISTER_DEFINITION,
        records,
        totals: {
          taxableBase: sumCents(records, "taxableBase") / 100,
          igv: sumCents(records, "igv") / 100,
          total: sumCents(records, "total") / 100,
        },
      };
    }
    case "purchases-register": {
      const rows = buildPurchaseRegisterRows(snapshot, collector);
      const records = purchaseRowsToRecords(rows);
      return {
        definition: PURCHASES_REGISTER_DEFINITION,
        records,
        totals: {
          creditBase: sumCents(records, "creditBase") / 100,
          creditIgv: sumCents(records, "creditIgv") / 100,
          nonTaxed: sumCents(records, "nonTaxed") / 100,
          total: sumCents(records, "total") / 100,
        },
      };
    }
    case "general-journal": {
      const lines = buildJournalLines(snapshot);
      const { debitCents, creditCents } = validateJournalBalance(book, lines, collector);
      return {
        definition: GENERAL_JOURNAL_DEFINITION,
        records: buildGeneralJournalRecords(lines, snapshot),
        totals: { debit: debitCents / 100, credit: creditCents / 100 },
      };
    }
    case "general-ledger": {
      const lines = buildJournalLines(snapshot);
      const { debitCents, creditCents } = validateJournalBalance(book, lines, collector);
      return {
        definition: GENERAL_LEDGER_DEFINITION,
        records: buildGeneralLedgerRecords(lines, snapshot),
        totals: { debit: debitCents / 100, credit: creditCents / 100 },
      };
    }
    case "chart-of-accounts": {
      const lines = buildJournalLines(snapshot);
      const records = buildChartOfAccountsRecords(lines, snapshot, collector);
      return {
        definition: CHART_OF_ACCOUNTS_DEFINITION,
        records,
        totals: { accounts: records.length },
      };
    }
    case "cash-book": {
      const lines = buildJournalLines(snapshot);
      const cashLines = selectCashLines(lines);
      validateJournalBalance(book, cashLines, collector);
      const records = buildCashBookRecords(lines, snapshot);
      return {
        definition: CASH_BOOK_DEFINITION,
        records,
        totals: {
          debit: sumCents(records, "debit") / 100,
          credit: sumCents(records, "credit") / 100,
        },
      };
    }
  }
}

/**
 * Generates one PLE book: validates every record, builds the TXT and the file name.
 * The content is a ready-to-write string; callers must not deliver it when `hasErrors`.
 */
export function generatePleBook(book: PleBookId, snapshot: PleSnapshot): PleResult {
  const collector = new IssueCollector(book);
  const build = buildBook(book, snapshot, collector);
  const rows = build.records.map((record) => serializeCells(build.definition, record, collector));
  const lines = rows.map(joinCells);

  // Every serialized line must have exactly one separator per field (field count guard).
  for (const line of lines) {
    const separators = line.split(FIELD_SEPARATOR).length - 1;
    if (separators !== build.definition.fields.length) {
      collector.error("STRUCTURE", "A record has an unexpected number of fields.");
      break;
    }
  }

  let fileName = "";
  try {
    fileName = buildPleFileName({
      book,
      ruc: snapshot.taxpayer.ruc,
      year: snapshot.period.year,
      month: snapshot.period.month,
      hasContent: lines.length > 0,
    });
  } catch (error) {
    collector.error(
      "FILE",
      error instanceof Error ? error.message : "The file name could not be built."
    );
  }

  return {
    book,
    fileName,
    content: lines.map((line) => line + RECORD_TERMINATOR).join(""),
    recordCount: lines.length,
    columns: build.definition.fields.map((f) => ({ index: f.index, label: f.label })),
    rows,
    totals: build.totals,
    issues: collector.issues,
    hasErrors: collector.hasErrors,
  };
}
