import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseUtcDate } from "@/lib/dates";
import {
  buildExecutiveSummary,
  type ExecutiveAccountInput,
} from "@/lib/accounting/executive-summary";

export const dynamic = "force-dynamic";

const YEAR_REGEX = /^\d{4}$/;

function currentUtcYear(): number {
  return new Date().getUTCFullYear();
}

/**
 * GET /api/executive-summary?year=2026
 *
 * Resumen Ejecutivo de un ejercicio (año calendario). Combina dos agregados:
 * - Movimientos del periodo [01-ene .. 31-dic del año] para efectivo y P&L.
 * - Saldos acumulados hasta el cierre del año para las cuentas de balance.
 */
/**
 * @openapi
 * /api/executive-summary:
 *   get:
 *     tags:
 *       - Executive Summary
 *     summary: Obtener resumen ejecutivo
 *     description: >-
 *       Genera el Resumen Ejecutivo (efectivo, rentabilidad, balance general,
 *       rendimiento y posición) para el año indicado.
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           format: int32
 *         description: >-
 *           Año calendario (YYYY). Por defecto, el año en curso según UTC.
 *     responses:
 *       200:
 *         description: Resumen ejecutivo generado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExecutiveSummary'
 *       400:
 *         description: Parámetro de año inválido.
 *       404:
 *         description: No hay cuentas contables activas.
 *       500:
 *         description: Error interno al generar el resumen.
 */
export async function GET(request: NextRequest) {
  try {
    const rawYear = (request.nextUrl.searchParams.get("year") ?? "").trim();

    let year: number;
    if (rawYear === "") {
      year = currentUtcYear();
    } else if (YEAR_REGEX.test(rawYear)) {
      year = Number(rawYear);
    } else {
      return Response.json(
        { error: "El año (year) debe tener el formato YYYY." },
        { status: 400 }
      );
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
      return Response.json(
        { error: "No hay cuentas contables activas para elaborar el resumen ejecutivo." },
        { status: 404 }
      );
    }

    const accountIds = accounts.map((a) => a.id);

    const [periodAggregates, balanceAggregates] = await Promise.all([
      prisma.journalEntryDetail.groupBy({
        by: ["accountId"],
        where: {
          accountId: { in: accountIds },
          entry: { status: true, entryDate: { gte: fromUtc, lte: toUtc } },
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

    const summary = buildExecutiveSummary({
      year,
      from,
      to,
      accounts: executiveAccounts,
      companyName,
    });

    return Response.json(summary);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[api/executive-summary] prisma:", error.code, error.message);
    } else {
      console.error("[api/executive-summary] error:", error);
    }
    return Response.json(
      { error: "No se pudo generar el resumen ejecutivo." },
      { status: 500 }
    );
  }
}
