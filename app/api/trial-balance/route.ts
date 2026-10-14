import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseUtcDate, formatDateToIso } from "@/lib/dates";
import {
  buildTrialBalance,
  type TrialBalanceAccountInput,
} from "@/lib/accounting/trial-balance";

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

/** First day of the month of the given ISO date (UTC). */
function firstDayOfMonthIso(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * GET /api/trial-balance?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 *
 * Balance de Comprobación por elemento y sub-elemento del plan contable.
 * - Saldos iniciales: movimientos anteriores a `desde`.
 * - Movimiento del periodo: movimientos dentro de [desde, hasta].
 * - Saldos finales: inicial + movimiento.
 */
/**
 * @openapi
 * /api/trial-balance:
 *   get:
 *     tags:
 *       - Trial Balance
 *     summary: Obtener balance de comprobación
 *     description: >-
 *       Genera el Balance de Comprobación (saldos inicial, del periodo y final)
 *       agrupado por elemento y sub-elemento del plan contable.
 *     parameters:
 *       - in: query
 *         name: desde
 *         schema:
 *           type: string
 *           format: date
 *         description: >-
 *           Fecha inicial del periodo (YYYY-MM-DD). Por defecto, el primer día
 *           del mes de la fecha final.
 *       - in: query
 *         name: hasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha final del periodo (YYYY-MM-DD). Por defecto, hoy.
 *     responses:
 *       200:
 *         description: Balance de comprobación generado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TrialBalance'
 *       400:
 *         description: Parámetro de fecha inválido o rango invertido.
 *       404:
 *         description: No hay cuentas contables activas.
 *       500:
 *         description: Error interno al generar el balance.
 */
export async function GET(request: NextRequest) {
  try {
    const rawTo = (request.nextUrl.searchParams.get("hasta") ?? "").trim() || todayIsoUtc();
    const rawFrom =
      (request.nextUrl.searchParams.get("desde") ?? "").trim() || firstDayOfMonthIso(rawTo);

    if (!DATE_REGEX.test(rawFrom)) {
      return Response.json(
        { error: "La fecha inicial (desde) debe tener el formato YYYY-MM-DD." },
        { status: 400 }
      );
    }
    if (!DATE_REGEX.test(rawTo)) {
      return Response.json(
        { error: "La fecha final (hasta) debe tener el formato YYYY-MM-DD." },
        { status: 400 }
      );
    }
    if (rawFrom > rawTo) {
      return Response.json(
        { error: "La fecha inicial no puede ser posterior a la fecha final." },
        { status: 400 }
      );
    }

    const from = parseUtcDate(rawFrom);
    const to = parseUtcDate(rawTo);

    const accounts = await prisma.accountingAccount.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, type: true },
      orderBy: { code: "asc" },
    });

    if (accounts.length === 0) {
      return Response.json(
        { error: "No hay cuentas contables activas para elaborar el balance de comprobación." },
        { status: 404 }
      );
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

    const statement = buildTrialBalance({
      from: rawFrom,
      to: rawTo,
      accounts: trialBalanceAccounts,
      companyName,
    });

    return Response.json(statement);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[api/trial-balance] prisma:", error.code, error.message);
    } else {
      console.error("[api/trial-balance] error:", error);
    }
    return Response.json(
      { error: "No se pudo generar el balance de comprobación." },
      { status: 500 }
    );
  }
}
