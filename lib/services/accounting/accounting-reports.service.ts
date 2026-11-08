import { prisma } from "@/lib/prisma";
import { parseUtcDate, formatDateToIso } from "@/lib/dates";
import { CLOSING_BOOK } from "@/lib/accounting/closing";
import { ValidationError, NotFoundError } from "@/lib/http/errors";

import {
  buildBalanceSheet,
  signedBalance,
  type AccountBalanceInput,
  type AccountType,
} from "@/lib/accounting/balance-sheet";

import {
  buildCashFlowStatement,
  type PeriodMovement,
} from "@/lib/accounting/cash-flow-statement";

import {
  buildExecutiveSummary,
  type ExecutiveAccountInput,
} from "@/lib/accounting/executive-summary";

import {
  buildTrialBalance,
  type TrialBalanceAccountInput,
} from "@/lib/accounting/trial-balance";

import {
  buildDashboard,
  resolvePreviousRange,
  validateRange,
  type AccountMovement,
  type MonthlyRow,
  type PreviousAggregates,
} from "@/lib/accounting/dashboard";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_REGEX = /^\d{4}$/;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function todayIsoUtc(): string {
  const now = new Date();
  return formatDateToIso(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  );
}

function currentUtcYear(): number {
  return new Date().getUTCFullYear();
}

function firstDayOfMonthIso(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** Convierte los agregados groupBy de Prisma a AccountMovement usando el catálogo. */
function toMovements(
  aggregates: Array<{ accountId: number; _sum: { debit: unknown; credit: unknown } }>,
  accountsById: Map<number, AccountMovement>
): AccountMovement[] {
  return aggregates.flatMap((row) => {
    const account = accountsById.get(row.accountId);
    if (!account) return [];
    return [
      {
        ...account,
        debit: Number(row._sum.debit ?? 0),
        credit: Number(row._sum.credit ?? 0),
      },
    ];
  });
}

const PNL_TYPES = new Set(["Ingreso", "Gasto", "Costo"]);
const isPnl = (a: AccountMovement): boolean => PNL_TYPES.has(a.type);
const isBalance = (a: AccountMovement): boolean => !PNL_TYPES.has(a.type);

/* ========================================================================== */
/* 1. BALANCE SHEET (Estado de Situación Financiera)                         */
/* ========================================================================== */
export async function generateBalanceSheetReport(rawAsOfParam?: string | null) {
  const rawAsOf = (rawAsOfParam ?? "").trim() || todayIsoUtc();

  if (!DATE_REGEX.test(rawAsOf)) {
    throw new ValidationError("La fecha de corte (hasta) debe tener el formato YYYY-MM-DD.");
  }

  const asOf = parseUtcDate(rawAsOf);
  const yearStart = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));

  const accounts = await prisma.accountingAccount.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true, type: true },
    orderBy: { code: "asc" },
  });

  if (accounts.length === 0) {
    throw new NotFoundError("No hay cuentas contables activas para elaborar el balance.");
  }

  const accountIds = accounts.map((a) => a.id);

  const [balanceAggregates, periodAggregates] = await Promise.all([
    prisma.journalEntryDetail.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accountIds },
        entry: {
          status: true,
          entryDate: { lte: asOf },
        },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalEntryDetail.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accountIds },
        entry: {
          status: true,
          book: { not: CLOSING_BOOK },
          entryDate: { gte: yearStart, lte: asOf },
        },
      },
      _sum: { debit: true, credit: true },
    }),
  ]);

  const balanceByAccount = new Map(
    balanceAggregates.map((row) => [
      row.accountId,
      {
        debit: Number(row._sum.debit ?? 0),
        credit: Number(row._sum.credit ?? 0),
      },
    ])
  );

  const periodByAccount = new Map(
    periodAggregates.map((row) => [
      row.accountId,
      {
        debit: Number(row._sum.debit ?? 0),
        credit: Number(row._sum.credit ?? 0),
      },
    ])
  );

  const balanceSheetAccounts: AccountBalanceInput[] = accounts.map((account) => {
    const pnl =
      account.type === "Ingreso" || account.type === "Gasto" || account.type === "Costo";
    const sums = pnl
      ? periodByAccount.get(account.id)
      : balanceByAccount.get(account.id);

    return {
      code: account.code,
      name: account.name,
      type: account.type as AccountType,
      debit: round2(sums?.debit ?? 0),
      credit: round2(sums?.credit ?? 0),
    };
  });

  const companyName =
    process.env.COMPANY_NAME?.trim() ||
    process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() ||
    "Pollería ERP";

  return buildBalanceSheet({
    asOf: rawAsOf,
    accounts: balanceSheetAccounts,
    companyName,
  });
}

/* ========================================================================== */
/* 2. CASH FLOW STATEMENT (Estado de Flujos de Efectivo)                     */
/* ========================================================================== */
export async function generateCashFlowStatementReport(fromParam?: string | null, toParam?: string | null) {
  const from = (fromParam ?? "").trim();
  const to = (toParam ?? "").trim();

  if (!DATE_REGEX.test(from)) {
    throw new ValidationError("El parámetro 'desde' debe tener el formato YYYY-MM-DD.");
  }
  if (!DATE_REGEX.test(to)) {
    throw new ValidationError("El parámetro 'hasta' debe tener el formato YYYY-MM-DD.");
  }

  const startDate = parseUtcDate(from);
  const endDate = parseUtcDate(to);

  if (startDate.getTime() > endDate.getTime()) {
    throw new ValidationError("El parámetro 'desde' no puede ser posterior a 'hasta'.");
  }

  const accounts = await prisma.accountingAccount.findMany({
    where: { active: true },
    select: { id: true, code: true, type: true },
    orderBy: { code: "asc" },
  });

  if (accounts.length === 0) {
    throw new NotFoundError("No hay cuentas contables activas para elaborar el estado de flujos de efectivo.");
  }

  const accountIds = accounts.map((a) => a.id);

  const [initialAggregates, periodAggregates, finalAggregates] = await Promise.all([
    prisma.journalEntryDetail.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accountIds },
        entry: { status: true, entryDate: { lt: startDate } },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalEntryDetail.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accountIds },
        entry: { status: true, book: { not: CLOSING_BOOK }, entryDate: { gte: startDate, lte: endDate } },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalEntryDetail.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accountIds },
        entry: { status: true, entryDate: { lte: endDate } },
      },
      _sum: { debit: true, credit: true },
    }),
  ]);

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const balancesOf = (
    rows: Array<{ accountId: number; _sum: { debit: unknown; credit: unknown } }>
  ): Record<string, number> => {
    const balances: Record<string, number> = {};
    for (const row of rows) {
      const account = accountById.get(row.accountId);
      if (!account) continue;
      balances[account.code] = signedBalance(
        account.type,
        Number(row._sum.debit ?? 0),
        Number(row._sum.credit ?? 0)
      );
    }
    return balances;
  };

  const periodMovements: PeriodMovement[] = [];
  for (const row of periodAggregates) {
    const account = accountById.get(row.accountId);
    if (!account) continue;
    periodMovements.push({
      accountCode: account.code,
      accountType: account.type,
      debit: Number(row._sum.debit ?? 0),
      credit: Number(row._sum.credit ?? 0),
    });
  }

  return buildCashFlowStatement({
    startDate: from,
    endDate: to,
    initialBalances: balancesOf(initialAggregates),
    finalBalances: balancesOf(finalAggregates),
    periodMovements,
  });
}

/* ========================================================================== */
/* 3. EXECUTIVE SUMMARY (Resumen Ejecutivo)                                 */
/* ========================================================================== */
export async function generateExecutiveSummaryReport(rawYearParam?: string | null) {
  const rawYear = (rawYearParam ?? "").trim();

  let year: number;
  if (rawYear === "") {
    year = currentUtcYear();
  } else if (YEAR_REGEX.test(rawYear)) {
    year = Number(rawYear);
  } else {
    throw new ValidationError("El año (year) debe tener el formato YYYY.");
  }

  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const fromUtc = parseUtcDate(from);
  const toUtc = parseUtcDate(to);

  const accounts = await prisma.accountingAccount.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true, type: true },
    orderBy: { code: "asc" },
  });

  if (accounts.length === 0) {
    throw new NotFoundError("No hay cuentas contables activas para elaborar el resumen ejecutivo.");
  }

  const accountIds = accounts.map((a) => a.id);

  const [periodAggregates, balanceAggregates] = await Promise.all([
    prisma.journalEntryDetail.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accountIds },
        entry: { status: true, book: { not: CLOSING_BOOK }, entryDate: { gte: fromUtc, lte: toUtc } },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalEntryDetail.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accountIds },
        entry: { status: true, entryDate: { lte: toUtc } },
      },
      _sum: { debit: true, credit: true },
    }),
  ]);

  const periodByAccount = new Map(
    periodAggregates.map((row) => [
      row.accountId,
      { debit: Number(row._sum.debit ?? 0), credit: Number(row._sum.credit ?? 0) },
    ])
  );
  const balanceByAccount = new Map(
    balanceAggregates.map((row) => [
      row.accountId,
      { debit: Number(row._sum.debit ?? 0), credit: Number(row._sum.credit ?? 0) },
    ])
  );

  const executiveAccounts: ExecutiveAccountInput[] = accounts.map((account) => {
    const period = periodByAccount.get(account.id);
    const balance = balanceByAccount.get(account.id);

    return {
      code: account.code,
      name: account.name,
      type: account.type,
      periodDebit: Number(period?.debit ?? 0),
      periodCredit: Number(period?.credit ?? 0),
      balanceDebit: Number(balance?.debit ?? 0),
      balanceCredit: Number(balance?.credit ?? 0),
    };
  });

  const companyName =
    process.env.COMPANY_NAME?.trim() ||
    process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() ||
    "Pollería ERP";

  return buildExecutiveSummary({
    year,
    from,
    to,
    accounts: executiveAccounts,
    companyName,
  });
}

/* ========================================================================== */
/* 4. TRIAL BALANCE (Balance de Comprobación)                                 */
/* ========================================================================== */
export async function generateTrialBalanceReport(rawFromParam?: string | null, rawToParam?: string | null) {
  const rawTo = (rawToParam ?? "").trim() || todayIsoUtc();
  const rawFrom = (rawFromParam ?? "").trim() || firstDayOfMonthIso(rawTo);

  if (!DATE_REGEX.test(rawFrom)) {
    throw new ValidationError("La fecha inicial (desde) debe tener el formato YYYY-MM-DD.");
  }
  if (!DATE_REGEX.test(rawTo)) {
    throw new ValidationError("La fecha final (hasta) debe tener el formato YYYY-MM-DD.");
  }
  if (rawFrom > rawTo) {
    throw new ValidationError("La fecha inicial no puede ser posterior a la fecha final.");
  }

  const from = parseUtcDate(rawFrom);
  const to = parseUtcDate(rawTo);

  const accounts = await prisma.accountingAccount.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true, type: true },
    orderBy: { code: "asc" },
  });

  if (accounts.length === 0) {
    throw new NotFoundError("No hay cuentas contables activas para elaborar el balance de comprobación.");
  }

  const accountIds = accounts.map((a) => a.id);

  const [initialAggregates, periodAggregates] = await Promise.all([
    prisma.journalEntryDetail.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accountIds },
        entry: { status: true, entryDate: { lt: from } },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalEntryDetail.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accountIds },
        entry: { status: true, entryDate: { gte: from, lte: to } },
      },
      _sum: { debit: true, credit: true },
    }),
  ]);

  const initialByAccount = new Map(
    initialAggregates.map((row) => [
      row.accountId,
      {
        debit: Number(row._sum.debit ?? 0),
        credit: Number(row._sum.credit ?? 0),
      },
    ])
  );
  const periodByAccount = new Map(
    periodAggregates.map((row) => [
      row.accountId,
      {
        debit: Number(row._sum.debit ?? 0),
        credit: Number(row._sum.credit ?? 0),
      },
    ])
  );

  const trialBalanceAccounts: TrialBalanceAccountInput[] = accounts.map((account) => {
    const initial = initialByAccount.get(account.id);
    const period = periodByAccount.get(account.id);

    return {
      code: account.code,
      name: account.name,
      type: account.type,
      initialDebit: round2(initial?.debit ?? 0),
      initialCredit: round2(initial?.credit ?? 0),
      periodDebit: round2(period?.debit ?? 0),
      periodCredit: round2(period?.credit ?? 0),
    };
  });

  const companyName =
    process.env.COMPANY_NAME?.trim() ||
    process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() ||
    "Pollería ERP";

  return buildTrialBalance({
    from: rawFrom,
    to: rawTo,
    accounts: trialBalanceAccounts,
    companyName,
  });
}

/* ========================================================================== */
/* 5. ACCOUNTING DASHBOARD                                                   */
/* ========================================================================== */
export async function generateAccountingDashboardReport(fromParam?: string | null, toParam?: string | null) {
  const from = (fromParam ?? "").trim();
  const to = (toParam ?? "").trim();

  const rangeError = validateRange(from, to);
  if (rangeError) {
    throw new ValidationError(rangeError);
  }

  const fromDate = parseUtcDate(from);
  const toDate = parseUtcDate(to);

  const accounts = await prisma.accountingAccount.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true, type: true },
    orderBy: { code: "asc" },
  });

  if (accounts.length === 0) {
    throw new NotFoundError("No hay cuentas contables activas para elaborar el dashboard.");
  }

  const accountsById = new Map<number, AccountMovement>(
    accounts.map((a) => [a.id, { code: a.code, name: a.name, type: a.type, debit: 0, credit: 0 }])
  );
  const accountIds = accounts.map((a) => a.id);

  const previous = resolvePreviousRange(from, to);

  const [
    periodAgg,
    balanceAgg,
    entryCount,
    prevPeriodAgg,
    prevBalanceAgg,
    prevEntryCount,
    monthlyAgg,
  ] = await Promise.all([
    prisma.journalEntryDetail.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accountIds },
        entry: { status: true, book: { not: CLOSING_BOOK }, entryDate: { gte: fromDate, lte: toDate } },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalEntryDetail.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accountIds },
        entry: { status: true, entryDate: { lte: toDate } },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalEntry.count({
      where: { status: true, entryDate: { gte: fromDate, lte: toDate } },
    }),
    previous
      ? prisma.journalEntryDetail.groupBy({
          by: ["accountId"],
          where: {
            accountId: { in: accountIds },
            entry: {
              status: true,
              book: { not: CLOSING_BOOK },
              entryDate: { gte: parseUtcDate(previous.from), lte: parseUtcDate(previous.to) },
            },
          },
          _sum: { debit: true, credit: true },
        })
      : Promise.resolve([]),
    previous
      ? prisma.journalEntryDetail.groupBy({
          by: ["accountId"],
          where: {
            accountId: { in: accountIds },
            entry: { status: true, entryDate: { lte: parseUtcDate(previous.to) } },
          },
          _sum: { debit: true, credit: true },
        })
      : Promise.resolve([]),
    previous
      ? prisma.journalEntry.count({
          where: {
            status: true,
            entryDate: { gte: parseUtcDate(previous.from), lte: parseUtcDate(previous.to) },
          },
        })
      : Promise.resolve(0),
    prisma.$queryRaw<Array<{ month: Date; type: string; debit: unknown; credit: unknown }>>`
      SELECT date_trunc('month', e.entry_date) AS month,
             a.type AS type,
             COALESCE(SUM(d.debit), 0)  AS debit,
             COALESCE(SUM(d.credit), 0) AS credit
      FROM journal_entry_detail d
      JOIN journal_entry e ON e.id = d.entry_id AND e.status = TRUE
      JOIN accounting_account a ON a.id = d.account_id AND a.active = TRUE
      WHERE e.entry_date BETWEEN ${fromDate} AND ${toDate}
        AND e.book <> ${CLOSING_BOOK}
        AND a.type IN ('Ingreso','Gasto','Costo')
      GROUP BY 1, 2
      ORDER BY 1
    `,
  ]);

  const monthlyRows: MonthlyRow[] = (monthlyAgg ?? []).map((row) => ({
    month: `${row.month.getUTCFullYear()}-${String(row.month.getUTCMonth() + 1).padStart(2, "0")}`,
    type: row.type,
    debit: Number(row.debit ?? 0),
    credit: Number(row.credit ?? 0),
  }));

  const periodMovements = toMovements(periodAgg, accountsById);
  const balanceMovements = toMovements(balanceAgg, accountsById);

  const previousAggregates: PreviousAggregates | null = previous
    ? {
        from: previous.from,
        to: previous.to,
        periodAccounts: toMovements(prevPeriodAgg, accountsById).filter(isPnl),
        balanceAccounts: toMovements(prevBalanceAgg, accountsById).filter(isBalance),
        entryCount: prevEntryCount,
      }
    : null;

  return buildDashboard({
    from,
    to,
    periodAccounts: periodMovements.filter(isPnl),
    balanceAccounts: balanceMovements.filter(isBalance),
    previous: previousAggregates,
    monthlyRows,
    accountMovement: periodMovements,
    entryCount,
  });
}
