import { CHART_OF_ACCOUNTS_CODE } from "../constants";
import { formatPeriod } from "../format";
import type { JournalLine } from "../journal";
import type { PleSnapshot } from "../snapshot";
import { IssueCollector } from "../serializer";
import type { BookDefinition, PleRecord } from "../types";
import { field } from "./fields";

/**
 * Format 5.3 - Journal, detail of the chart of accounts used (RS 286-2009/SUNAT Annex 2,
 * item 5.3). 8 fields; fields 9-16 are free use and are not emitted.
 */
export const CHART_OF_ACCOUNTS_DEFINITION: BookDefinition = {
  id: "chart-of-accounts",
  fields: [
    field(1, "period", "Period", "numeric", 8, true),
    field(2, "accountCode", "Account code", "numeric", 24, true),
    field(3, "accountName", "Account name", "text", 100, true),
    field(4, "planCode", "Chart of accounts code (table 17)", "numeric", 2, true),
    field(5, "planName", "Chart of accounts name", "text", 60),
    field(6, "corporateCode", "Corporate account code", "numeric", 24),
    field(7, "corporateName", "Corporate account name", "text", 100),
    field(8, "status", "Operation status", "numeric", 1, true),
  ],
};

/** Accounts that appear in the lines of the period, ordered by code. */
export function buildChartOfAccountsRecords(
  lines: readonly JournalLine[],
  snapshot: PleSnapshot,
  collector: IssueCollector
): PleRecord[] {
  const names = new Map(snapshot.accounts.map((account) => [account.code, account.name]));
  const used = [...new Set(lines.map((line) => line.accountCode))].sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true })
  );

  return used.map((code) => {
    const name = names.get(code);
    if (!name) {
      collector.error(code, "Account used in the journal is missing from the chart of accounts.", 2);
    }
    if (code.length < 3) {
      collector.error(code, "Account codes must have at least three digits.", 2);
    }
    return {
      ref: code,
      values: {
        period: formatPeriod(snapshot.period.year, snapshot.period.month),
        accountCode: code,
        accountName: name ?? "",
        planCode: CHART_OF_ACCOUNTS_CODE,
        status: "1",
      },
    };
  });
}
