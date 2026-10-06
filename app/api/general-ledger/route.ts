import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";

export const dynamic = "force-dynamic";
/**
 * @openapi
 * /api/general-ledger:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Obtener libro mayor (General Ledger)
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Reference of the originating operation, if registered. */
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

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * General Ledger (Libro Mayor): account movements in chronological order
 * with running balance and period totals.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = (searchParams.get("codigo") ?? "").trim();
    const fromDate = (searchParams.get("desde") ?? "").trim();
    const toDate = (searchParams.get("hasta") ?? "").trim();

    if (!code) {
      return Response.json(
        { error: "Debe indicar la cuenta contable a consultar." },
        { status: 400 }
      );
    }
    if (fromDate && !DATE_REGEX.test(fromDate)) {
      return Response.json(
        { error: "La fecha inicial debe tener el formato AAAA-MM-DD." },
        { status: 400 }
      );
    }
    if (toDate && !DATE_REGEX.test(toDate)) {
      return Response.json(
        { error: "La fecha final debe tener el formato AAAA-MM-DD." },
        { status: 400 }
      );
    }
    if (fromDate && toDate && fromDate > toDate) {
      return Response.json(
        { error: "La fecha inicial no puede ser posterior a la fecha final." },
        { status: 400 }
      );
    }

    const account = await prisma.accountingAccount.findUnique({ where: { code } });
    if (!account) {
      return Response.json({ error: "Cuenta contable no encontrada." }, { status: 404 });
    }

    const dateRange: Prisma.DateTimeFilter<"JournalEntry"> = {};
    if (fromDate) dateRange.gte = parseUtcDate(fromDate);
    if (toDate) dateRange.lte = parseUtcDate(toDate);

    let priorBalance = 0;
    if (fromDate) {
      const priorAgg = await prisma.journalEntryDetail.aggregate({
        _sum: { debit: true, credit: true },
        where: {
          accountId: account.id,
          entry: { entryDate: { lt: parseUtcDate(fromDate) } },
        },
      });
      priorBalance =
        Number(priorAgg._sum.debit ?? 0) - Number(priorAgg._sum.credit ?? 0);
    }

    const whereFilter: Prisma.JournalEntryDetailWhereInput = {
      accountId: account.id,
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
        idAsiento: entry.id,
        numero: entry.code,
        fecha: formatDateToIso(entry.entryDate),
        glosa: entry.description,
        descripcion: detail.description ?? "",
        modulo: entry.book,
        referencia: getEntryReference(entry),
        estado: entry.status ? ("Registrado" as const) : ("Anulado" as const),
        debe: debit,
        haber: credit,
        saldo: currentBalance,
        tipoSaldo: currentBalance > 0.004 ? ("deudor" as const) : currentBalance < -0.004 ? ("acreedor" as const) : null,
      };
    });

    const totalDebit = roundToTwo(movements.reduce((sum, m) => sum + m.debe, 0));
    const totalCredit = roundToTwo(movements.reduce((sum, m) => sum + m.haber, 0));
    const finalBalance = roundToTwo(priorBalance + totalDebit - totalCredit);

    return Response.json({
      cuenta: {
        codigo: account.code,
        nombre: account.name,
        tipo: account.type,
      },
      saldoAnterior: roundToTwo(priorBalance),
      saldoFinal: finalBalance,
      totales: { debe: totalDebit, haber: totalCredit, movimientos: movements.length },
      movimientos: movements,
    });
  } catch (error) {
    console.error("[api/general-ledger] error al obtener el libro mayor:", error);
    return Response.json(
      { error: "No se pudo obtener el libro mayor." },
      { status: 500 }
    );
  }
}
