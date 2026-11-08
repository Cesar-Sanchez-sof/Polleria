import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import { ValidationError, NotFoundError } from "@/lib/http/errors";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseInteger(value: unknown, defaultValue: number, min: number, max: number): number {
  if (value === undefined || value === null) return defaultValue;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function getEntryReference(entry: {
  salesInvoice: { voucherType: string; series: string; number: number } | null;
  purchaseInvoice: { voucherType: string; series: string; number: number } | null;
  payroll: { month: number; year: number } | null;
}): string | null {
  const sale = entry.salesInvoice;
  if (sale) return `${sale.voucherType} ${sale.series}-${sale.number}`;
  const purchase = entry.purchaseInvoice;
  if (purchase) return `${purchase.voucherType} ${purchase.series}-${purchase.number}`;
  const payroll = entry.payroll;
  if (payroll) return `Planilla ${payroll.month}/${payroll.year}`;
  return null;
}

/* ========================================================================== */
/* LIBRO DIARIO (Daily Book)                                                 */
/* ========================================================================== */
export async function getDailyBookEntriesDomain(params: {
  fromDate?: string | null;
  toDate?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
}) {
  const fromDate = (params.fromDate ?? "").trim();
  const toDate = (params.toDate ?? "").trim();

  if (fromDate && !DATE_REGEX.test(fromDate)) {
    throw new ValidationError("La fecha inicial debe tener el formato AAAA-MM-DD.");
  }
  if (toDate && !DATE_REGEX.test(toDate)) {
    throw new ValidationError("La fecha final debe tener el formato AAAA-MM-DD.");
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw new ValidationError("La fecha inicial no puede ser posterior a la fecha final.");
  }

  const page = parseInteger(params.page, 1, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = parseInteger(params.pageSize, 10, 1, 100);

  const filter: Prisma.JournalEntryWhereInput = {};
  if (fromDate || toDate) {
    const dateRange: Prisma.DateTimeFilter<"JournalEntry"> = {};
    if (fromDate) dateRange.gte = parseUtcDate(fromDate);
    if (toDate) dateRange.lte = parseUtcDate(toDate);
    filter.entryDate = dateRange;
  }

  const total = await prisma.journalEntry.count({ where: filter });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const effectivePage = Math.min(page, totalPages);
  const offset = (effectivePage - 1) * pageSize;

  const entries = await prisma.journalEntry.findMany({
    where: filter,
    orderBy: [{ entryDate: "desc" }, { id: "desc" }],
    skip: offset,
    take: pageSize,
    select: {
      id: true,
      code: true,
      entryDate: true,
      book: true,
      description: true,
      responsible: true,
      status: true,
      createdAt: true,
      entryDetails: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          description: true,
          debit: true,
          credit: true,
          account: {
            select: { code: true, name: true, type: true },
          },
        },
      },
    },
  });

  const data = entries.map((entry) => {
    const lines = entry.entryDetails.map((line) => ({
      id: line.id,
      accountCode: line.account.code,
      accountName: line.account.name,
      accountType: line.account.type,
      description: line.description ?? "",
      debit: Number(line.debit),
      credit: Number(line.credit),
    }));

    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

    return {
      id: entry.id,
      number: entry.code,
      date: formatDateToIso(entry.entryDate),
      daily: entry.book,
      concept: entry.description,
      responsible: entry.responsible,
      status: entry.status ? ("Registrado" as const) : ("Anulado" as const),
      totals: { debit: totalDebit, credit: totalCredit },
      balanced: Math.abs(totalDebit - totalCredit) < 0.005,
      lines,
      ...(entry.createdAt ? { createdAt: entry.createdAt.toISOString() } : {}),
    };
  });

  return {
    data,
    meta: {
      total,
      page: effectivePage,
      pageSize,
      totalPages,
      from: fromDate,
      to: toDate,
    },
  };
}

/* ========================================================================== */
/* LIBRO MAYOR (General Ledger)                                              */
/* ========================================================================== */
export async function getGeneralLedgerReportDomain(params: {
  code?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
}) {
  const code = (params.code ?? "").trim();
  const fromDate = (params.fromDate ?? "").trim();
  const toDate = (params.toDate ?? "").trim();

  if (!code) {
    throw new ValidationError("Debe indicar la cuenta contable a consultar.");
  }
  if (fromDate && !DATE_REGEX.test(fromDate)) {
    throw new ValidationError("La fecha inicial debe tener el formato AAAA-MM-DD.");
  }
  if (toDate && !DATE_REGEX.test(toDate)) {
    throw new ValidationError("La fecha final debe tener el formato AAAA-MM-DD.");
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw new ValidationError("La fecha inicial no puede ser posterior a la fecha final.");
  }

  const account = await prisma.accountingAccount.findUnique({ where: { code } });
  if (!account) {
    throw new NotFoundError("Cuenta contable no encontrada.");
  }

  const allAccounts =
    (await prisma.accountingAccount.findMany({ select: { id: true, parentId: true } })) ?? [];
  const childrenByParent = new Map<number, number[]>();
  for (const item of allAccounts) {
    if (item.parentId === null) continue;
    const siblings = childrenByParent.get(item.parentId) ?? [];
    siblings.push(item.id);
    childrenByParent.set(item.parentId, siblings);
  }
  const accountIds = [account.id];
  for (let i = 0; i < accountIds.length; i++) {
    accountIds.push(...(childrenByParent.get(accountIds[i]) ?? []));
  }
  const accountFilter: Prisma.JournalEntryDetailWhereInput["accountId"] =
    accountIds.length === 1 ? account.id : { in: accountIds };

  const dateRange: Prisma.DateTimeFilter<"JournalEntry"> = {};
  if (fromDate) dateRange.gte = parseUtcDate(fromDate);
  if (toDate) dateRange.lte = parseUtcDate(toDate);

  let priorBalance = 0;
  if (fromDate) {
    const priorAgg = await prisma.journalEntryDetail.aggregate({
      _sum: { debit: true, credit: true },
      where: {
        accountId: accountFilter,
        entry: { entryDate: { lt: parseUtcDate(fromDate) } },
      },
    });
    priorBalance =
      Number(priorAgg._sum.debit ?? 0) - Number(priorAgg._sum.credit ?? 0);
  }

  const whereFilter: Prisma.JournalEntryDetailWhereInput = {
    accountId: accountFilter,
  };
  if (fromDate || toDate) whereFilter.entry = { entryDate: dateRange };

  const details = await prisma.journalEntryDetail.findMany({
    where: whereFilter,
    orderBy: [
      { entry: { entryDate: "asc" } },
      { entry: { id: "asc" } },
      { id: "asc" },
    ],
    select: {
      id: true,
      description: true,
      debit: true,
      credit: true,
      account: { select: { code: true, name: true } },
      entry: {
        select: {
          id: true,
          code: true,
          entryDate: true,
          description: true,
          book: true,
          status: true,
          salesInvoice: {
            select: { voucherType: true, series: true, number: true },
          },
          purchaseInvoice: {
            select: { voucherType: true, series: true, number: true },
          },
          payroll: { select: { month: true, year: true } },
        },
      },
    },
  });

  let currentBalance = priorBalance;
  const movements = details.map((detail) => {
    const debit = Number(detail.debit);
    const credit = Number(detail.credit);
    currentBalance = roundToTwo(currentBalance + debit - credit);
    const entry = detail.entry;

    return {
      id: detail.id,
      entryId: entry.id,
      number: entry.code,
      date: formatDateToIso(entry.entryDate),
      entryDescription: entry.description,
      description: detail.description ?? "",
      accountCode: detail.account?.code ?? account.code,
      accountName: detail.account?.name ?? account.name,
      module: entry.book,
      reference: getEntryReference(entry),
      status: entry.status ? ("Registrado" as const) : ("Anulado" as const),
      debit,
      credit,
      balance: currentBalance,
      balanceType:
        currentBalance > 0.004
          ? ("deudor" as const)
          : currentBalance < -0.004
          ? ("acreedor" as const)
          : null,
    };
  });

  const totalDebit = roundToTwo(movements.reduce((sum, m) => sum + m.debit, 0));
  const totalCredit = roundToTwo(movements.reduce((sum, m) => sum + m.credit, 0));
  const finalBalance = roundToTwo(priorBalance + totalDebit - totalCredit);

  return {
    account: {
      code: account.code,
      name: account.name,
      type: account.type,
    },
    previousBalance: roundToTwo(priorBalance),
    finalBalance,
    totals: { debit: totalDebit, credit: totalCredit, movements: movements.length },
    movements,
  };
}
