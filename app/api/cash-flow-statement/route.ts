import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseUtcDate } from "@/lib/dates";
import { signedBalance } from "@/lib/accounting/balance-sheet";
import {
  buildCashFlowStatement,
  type PeriodMovement,
} from "@/lib/accounting/cash-flow-statement";

export const dynamic = "force-dynamic";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @openapi
 * /api/cash-flow-statement:
 *   get:
 *     tags:
 *       - Cash Flow Statement
 *     summary: Obtener estado de flujos de efectivo
 *     description: Genera el Estado de Flujos de Efectivo (método indirecto, NIC 7 / PCGE 2019) para un período.
 *     parameters:
 *       - in: query
 *         name: desde
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Inicio del período (YYYY-MM-DD, inclusive).
 *       - in: query
 *         name: hasta
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Fin del período (YYYY-MM-DD, inclusive).
 *     responses:
 *       200:
 *         description: Estado de flujos de efectivo generado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Parámetros de fecha inválidos o ventana invertida.
 *       404:
 *         description: No hay cuentas contables activas.
 *       500:
 *         description: Error interno al generar el estado.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const desde = (params.get("desde") ?? "").trim();
    const hasta = (params.get("hasta") ?? "").trim();

    if (!DATE_REGEX.test(desde)) {
      return Response.json(
        { error: "El parámetro 'desde' debe tener el formato YYYY-MM-DD." },
        { status: 400 }
      );
    }
    if (!DATE_REGEX.test(hasta)) {
      return Response.json(
        { error: "El parámetro 'hasta' debe tener el formato YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const startDate = parseUtcDate(desde);
    const endDate = parseUtcDate(hasta);

    if (startDate.getTime() > endDate.getTime()) {
      return Response.json(
        { error: "El parámetro 'desde' no puede ser posterior a 'hasta'." },
        { status: 400 }
      );
    }

    const accounts = await prisma.accountingAccount.findMany({
      where: { active: true },
      select: { id: true, code: true, type: true },
      orderBy: { code: "asc" },
    });

    if (accounts.length === 0) {
      return Response.json(
        { error: "No hay cuentas contables activas para elaborar el estado de flujos de efectivo." },
        { status: 404 }
      );
    }

    const accountIds = accounts.map((a) => a.id);

    // Tres agregados de la misma ventana (research D2 / data-model §CashFlowStatementParams):
    // saldo inicial (< desde), saldo final (<= hasta) y movimientos de la ventana [desde, hasta].
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
          entry: { status: true, entryDate: { gte: startDate, lte: endDate } },
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

    const statement = buildCashFlowStatement({
      startDate: desde,
      endDate: hasta,
      initialBalances: balancesOf(initialAggregates),
      finalBalances: balancesOf(finalAggregates),
      periodMovements,
    });

    return Response.json(statement);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[api/cash-flow-statement] prisma:", error.code, error.message);
    } else {
      console.error("[api/cash-flow-statement] error:", error);
    }
    return Response.json(
      { error: "No se pudo generar el Estado de Flujos de Efectivo." },
      { status: 500 }
    );
  }
}
