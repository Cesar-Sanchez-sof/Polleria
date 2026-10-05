import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseUtcDate, formatDateToIso } from "@/lib/dates";
import {
  buildBalanceSheet,
  type AccountBalanceInput,
  type AccountType,
} from "@/lib/accounting/balance-sheet";

export const dynamic = "force-dynamic";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function todayIsoUtc(): string {
  const now = new Date();
  return formatDateToIso(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  );
}

/**
 * GET /api/balance-sheet?hasta=YYYY-MM-DD
 *
 * Estado de Situación Financiera (Balance General) a una fecha de corte.
 * - Cuentas de balance: saldos acumulados hasta `hasta` (inclusive).
 * - Resultado del ejercicio: P&L desde el 01-ene del año de `hasta` hasta `hasta`.
 */
export async function GET(request: NextRequest) {
  try {
    const rawAsOf = (request.nextUrl.searchParams.get("hasta") ?? "").trim() || todayIsoUtc();

    if (!DATE_REGEX.test(rawAsOf)) {
      return Response.json(
        { error: "La fecha de corte (hasta) debe tener el formato YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const asOf = parseUtcDate(rawAsOf);
    const yearStart = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));

    const accounts = await prisma.accountingAccount.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, type: true },
      orderBy: { code: "asc" },
    });

    if (accounts.length === 0) {
      return Response.json(
        { error: "No hay cuentas contables activas para elaborar el balance." },
        { status: 404 }
      );
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
      const isPnl =
        account.type === "Ingreso" || account.type === "Gasto" || account.type === "Costo";
      const sums = isPnl
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

    const statement = buildBalanceSheet({
      asOf: rawAsOf,
      accounts: balanceSheetAccounts,
      companyName,
    });

    return Response.json(statement);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[api/balance-sheet] prisma:", error.code, error.message);
    } else {
      console.error("[api/balance-sheet] error:", error);
    }
    return Response.json(
      { error: "No se pudo generar el Estado de Situación Financiera." },
      { status: 500 }
    );
  }
}
