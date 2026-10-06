import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseInteger(value: string | null, defaultValue: number, min: number, max: number): number {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

/**
 * General Journal (Libro Diario): journal entries in reverse chronological order
 * with all their line items and totals.
 */
/**
 * @openapi
 * /api/daily-book:
 *   get:
 *     tags:
 *       - Accounts
 *     summary: Libro diario
 *     description: Obtiene entradas del libro diario con filtros de fecha y paginación.
 *     parameters:
 *       - in: query
 *         name: desde
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha inicial (AAAA-MM-DD).
 *       - in: query
 *         name: hasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha final (AAAA-MM-DD).
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Número de página.
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         description: Tamaño de página.
 *     responses:
 *       200:
 *         description: Lista de entradas del libro diario.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/JournalEntry'
 *                 meta:
 *                   type: object
 *       500:
 *         description: Error interno del servidor.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fromDate = (searchParams.get("desde") ?? "").trim();
    const toDate = (searchParams.get("hasta") ?? "").trim();

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

    const page = parseInteger(searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = parseInteger(searchParams.get("pageSize"), 10, 1, 100);

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
        cuentaCodigo: line.account.code,
        cuentaNombre: line.account.name,
        cuentaTipo: line.account.type,
        descripcion: line.description ?? "",
        debe: Number(line.debit),
        haber: Number(line.credit),
      }));

      const totalDebit = lines.reduce((sum, line) => sum + line.debe, 0);
      const totalCredit = lines.reduce((sum, line) => sum + line.haber, 0);

      return {
        id: entry.id,
        numero: entry.code,
        fecha: formatDateToIso(entry.entryDate),
        diario: entry.book,
        concepto: entry.description,
        responsable: entry.responsible,
        estado: entry.status ? ("Registrado" as const) : ("Anulado" as const),
        totales: { debe: totalDebit, haber: totalCredit },
        cuadrado: Math.abs(totalDebit - totalCredit) < 0.005,
        lineas: lines,
      };
    });

    return Response.json({
      data,
      meta: {
        total,
        page: effectivePage,
        pageSize,
        totalPaginas: totalPages,
        desde: fromDate,
        hasta: toDate,
      },
    });
  } catch (error) {
    console.error("[api/daily-book] error al obtener el libro diario:", error);
    return Response.json(
      { error: "No se pudo obtener el libro diario." },
      { status: 500 }
    );
  }
}
