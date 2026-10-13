import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseUtcDate } from "@/lib/dates";
import {
  buildDashboard,
  resolvePreviousRange,
  validateRange,
  type AccountMovement,
  type MonthlyRow,
  type PreviousAggregates,
} from "@/lib/accounting/dashboard";

export const dynamic = "force-dynamic";

/** Convierte los agregados `groupBy` de Prisma a `AccountMovement` usando el catálogo. */
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

/**
 * GET /api/accounting/dashboard?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 *
 * Dashboard contable: KPIs del período con variación vs el período anterior,
 * serie mensual (12 meses), distribución de gastos por categoría PCGE y
 * cuentas con mayor movimiento. Usa los mismos criterios que
 * `/api/balance-sheet` (cuentas activas, asientos vigentes, `signedBalance`,
 * redondeo a 2 decimales) para coincidir exactamente con los reportes
 * oficiales (SC-002/FR-009).
 */
/**
 * @openapi
 * /api/accounting/dashboard:
 *   get:
 *     tags:
 *       - Accounting Dashboard
 *     summary: Obtener el dashboard contable de un rango de fechas
 *     description: >
 *       Devuelve los KPIs del período (ingresos, gastos, utilidad neta, caja y
 *       bancos, cuentas por cobrar y por pagar, nº de asientos) con su variación
 *       respecto del período anterior de igual duración.
 *     parameters:
 *       - in: query
 *         name: desde
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: Inicio del rango (YYYY-MM-DD).
 *       - in: query
 *         name: hasta
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: Fin del rango inclusive (YYYY-MM-DD).
 *     responses:
 *       200:
 *         description: Dashboard generado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardPayload'
 *       400:
 *         description: Parámetros de fecha inválidos o rango invertido.
 *       404:
 *         description: No hay cuentas contables activas.
 *       500:
 *         description: Error interno al generar el dashboard.
 */
export async function GET(request: NextRequest) {
  try {
    const desde = (request.nextUrl.searchParams.get("desde") ?? "").trim();
    const hasta = (request.nextUrl.searchParams.get("hasta") ?? "").trim();

    const rangeError = validateRange(desde, hasta);
    if (rangeError) {
      return Response.json({ error: rangeError }, { status: 400 });
    }

    const desdeDate = parseUtcDate(desde);
    const hastaDate = parseUtcDate(hasta);

    const accounts = await prisma.accountingAccount.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, type: true },
      orderBy: { code: "asc" },
    });

    if (accounts.length === 0) {
      return Response.json(
        { error: "No hay cuentas contables activas para elaborar el dashboard." },
        { status: 404 }
      );
    }

    const accountsById = new Map<number, AccountMovement>(
      accounts.map((a) => [a.id, { code: a.code, name: a.name, type: a.type, debit: 0, credit: 0 }])
    );
    const accountIds = accounts.map((a) => a.id);

    const previous = resolvePreviousRange(desde, hasta);

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
            entry: { status: true, entryDate: { gte: desdeDate, lte: hastaDate } },
          },
          _sum: { debit: true, credit: true },
        }),
        prisma.journalEntryDetail.groupBy({
          by: ["accountId"],
          where: {
            accountId: { in: accountIds },
            entry: { status: true, entryDate: { lte: hastaDate } },
          },
          _sum: { debit: true, credit: true },
        }),
        prisma.journalEntry.count({
          where: { status: true, entryDate: { gte: desdeDate, lte: hastaDate } },
        }),
        previous
          ? prisma.journalEntryDetail.groupBy({
              by: ["accountId"],
              where: {
                accountId: { in: accountIds },
                entry: {
                  status: true,
                  entryDate: { gte: parseUtcDate(previous.desde), lte: parseUtcDate(previous.hasta) },
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
                entry: { status: true, entryDate: { lte: parseUtcDate(previous.hasta) } },
              },
              _sum: { debit: true, credit: true },
            })
          : Promise.resolve([]),
        previous
          ? prisma.journalEntry.count({
              where: {
                status: true,
                entryDate: { gte: parseUtcDate(previous.desde), lte: parseUtcDate(previous.hasta) },
              },
            })
          : Promise.resolve(0),
        // Serie mensual P&L (research R3): una sola consulta con date_trunc.
        prisma.$queryRaw<Array<{ mes: Date; tipo: string; debit: unknown; credit: unknown }>>`
          SELECT date_trunc('month', e.entry_date) AS mes,
                 a.type AS tipo,
                 COALESCE(SUM(d.debit), 0)  AS debit,
                 COALESCE(SUM(d.credit), 0) AS credit
          FROM journal_entry_detail d
          JOIN journal_entry e ON e.id = d.entry_id AND e.status = TRUE
          JOIN accounting_account a ON a.id = d.account_id AND a.active = TRUE
          WHERE e.entry_date BETWEEN ${desdeDate} AND ${hastaDate}
            AND a.type IN ('Ingreso','Gasto','Costo')
          GROUP BY 1, 2
          ORDER BY 1
        `,
      ]);

    // `mes` llega como timestamp UTC a medianoche (date_trunc sobre @db.Date).
    const monthlyRows: MonthlyRow[] = monthlyAgg.map((row) => ({
      month: `${row.mes.getUTCFullYear()}-${String(row.mes.getUTCMonth() + 1).padStart(2, "0")}`,
      type: row.tipo,
      debit: Number(row.debit ?? 0),
      credit: Number(row.credit ?? 0),
    }));

    const periodMovements = toMovements(periodAgg, accountsById);
    const balanceMovements = toMovements(balanceAgg, accountsById);

    const previousAggregates: PreviousAggregates | null = previous
      ? {
          desde: previous.desde,
          hasta: previous.hasta,
          periodAccounts: toMovements(prevPeriodAgg, accountsById).filter(isPnl),
          balanceAccounts: toMovements(prevBalanceAgg, accountsById).filter(isBalance),
          entryCount: prevEntryCount,
        }
      : null;

    const payload = buildDashboard({
      desde,
      hasta,
      periodAccounts: periodMovements.filter(isPnl),
      balanceAccounts: balanceMovements.filter(isBalance),
      previous: previousAggregates,
      monthlyRows,
      accountMovement: periodMovements,
      entryCount,
    });

    return Response.json(payload);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[api/accounting/dashboard] prisma:", error.code, error.message);
    } else {
      console.error("[api/accounting/dashboard] error:", error);
    }
    return Response.json(
      { error: "No se pudo generar el Dashboard Contable." },
      { status: 500 }
    );
  }
}
