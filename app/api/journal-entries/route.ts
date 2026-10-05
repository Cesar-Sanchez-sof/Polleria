import type { NextRequest } from "next/server";
import { Prisma, type JournalEntry } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import { generateJournalEntryCode } from "@/lib/journal-entry-code";

export const dynamic = "force-dynamic";

export type JournalEntrySort = "fecha" | "numero" | "concepto" | "diario" | "estado" | "total";
export type SortDirection = "asc" | "desc";

const VALID_SORTS: JournalEntrySort[] = ["fecha", "numero", "concepto", "diario", "estado", "total"];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseInteger(value: string | null, defaultValue: number, min: number, max: number): number {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Builds Prisma where filter shared by count and listing queries.
 * Conditions are combined with AND.
 */
function buildFilter(searchParams: URLSearchParams): Prisma.JournalEntryWhereInput {
  const filter: Prisma.JournalEntryWhereInput = {};

  const fromDate = searchParams.get("desde");
  const toDate = searchParams.get("hasta");
  const book = searchParams.get("diario");
  const status = searchParams.get("estado");
  const search = (searchParams.get("q") ?? "").trim();

  const dateRange: Prisma.DateTimeFilter<"JournalEntry"> = {};
  if (fromDate && DATE_REGEX.test(fromDate)) dateRange.gte = parseUtcDate(fromDate);
  if (toDate && DATE_REGEX.test(toDate)) dateRange.lte = parseUtcDate(toDate);
  if (Object.keys(dateRange).length > 0) filter.entryDate = dateRange;

  if (book) filter.book = book;
  if (status === "registrado") filter.status = true;
  if (status === "anulado") filter.status = false;

  if (search) {
    filter.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      {
        entryDetails: {
          some: {
            account: {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      },
    ];
  }

  return filter;
}

/** Prisma order input corresponding to sort criteria. */
function getOrderBy(
  sortField: JournalEntrySort,
  direction: SortDirection
): Prisma.JournalEntryOrderByWithRelationInput {
  switch (sortField) {
    case "numero":
      return { code: direction };
    case "concepto":
      return { description: direction };
    case "diario":
      return { book: direction };
    case "estado":
      return { status: direction };
    case "total":
      return {};
    case "fecha":
    default:
      return { entryDate: direction };
  }
}

/** Sum of debit per journal entry ID. */
async function getTotalsByEntryId(entryIds: number[]): Promise<Map<number, number>> {
  const sums = await prisma.journalEntryDetail.groupBy({
    by: ["entryId"],
    where: { entryId: { in: entryIds } },
    _sum: { debit: true },
  });

  return new Map(sums.map((s) => [s.entryId, Number(s._sum.debit ?? 0)]));
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const page = parseInteger(searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = parseInteger(searchParams.get("pageSize"), 10, 1, 100);
    const sortParam = (searchParams.get("orden") ?? "fecha") as JournalEntrySort;
    const sort: JournalEntrySort = VALID_SORTS.includes(sortParam) ? sortParam : "fecha";
    const dir: SortDirection = searchParams.get("dir") === "asc" ? "asc" : "desc";

    const filter = buildFilter(searchParams);

    const [total, registered, annulled] = await Promise.all([
      prisma.journalEntry.count({ where: filter }),
      prisma.journalEntry.count({ where: { AND: [filter, { status: true }] } }),
      prisma.journalEntry.count({ where: { AND: [filter, { status: false }] } }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const effectivePage = Math.min(page, totalPages);
    const offset = (effectivePage - 1) * pageSize;

    let pageEntryIds: number[] | null = null;
    if (sort === "total") {
      const rows = await prisma.journalEntry.findMany({
        where: filter,
        select: { id: true },
      });
      const totalsMap = await getTotalsByEntryId(rows.map((r) => r.id));
      const sortedRows = rows
        .map((r) => ({ id: r.id, total: totalsMap.get(r.id) ?? 0 }))
        .sort((a, b) => (dir === "asc" ? a.total - b.total : b.total - a.total) || b.id - a.id);
      pageEntryIds = sortedRows.slice(offset, offset + pageSize).map((r) => r.id);
    }

    const pageFilter: Prisma.JournalEntryWhereInput = pageEntryIds
      ? { AND: [filter, { id: { in: pageEntryIds } }] }
      : filter;

    const records = await prisma.journalEntry.findMany({
      where: pageFilter,
      orderBy: pageEntryIds ? undefined : [getOrderBy(sort, dir), { id: "desc" }],
      skip: pageEntryIds ? undefined : offset,
      take: pageEntryIds ? undefined : pageSize,
      select: {
        id: true,
        code: true,
        entryDate: true,
        book: true,
        description: true,
        responsible: true,
        status: true,
        entryDetails: { select: { debit: true } },
      },
    });

    const data = records.map((entry) => ({
      id: entry.id,
      numero: entry.code,
      fecha: formatDateToIso(entry.entryDate),
      diario: entry.book,
      concepto: entry.description,
      responsable: entry.responsible,
      estado: entry.status ? ("Registrado" as const) : ("Anulado" as const),
      total: entry.entryDetails.reduce((sum, line) => sum + Number(line.debit), 0),
    }));

    if (pageEntryIds) {
      const positionMap = new Map(pageEntryIds.map((id, index) => [id, index]));
      data.sort((a, b) => (positionMap.get(a.id) ?? 0) - (positionMap.get(b.id) ?? 0));
    }

    return Response.json({
      data,
      meta: {
        total,
        registrados: registered,
        anulados: annulled,
        page: effectivePage,
        pageSize,
        totalPaginas: totalPages,
        orden: sort,
        dir,
      },
    });
  } catch (error) {
    console.error("[api/journal-entries] error al listar asientos:", error);
    return Response.json(
      { error: "No se pudo obtener el listado de asientos contables." },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Manual registration of a journal entry
// ---------------------------------------------------------------------------

interface ValidatedLine {
  accountId: number;
  description: string | null;
  debit: number;
  credit: number;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseAmount(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function isDuplicateCode(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { error: "El cuerpo de la petición no es un JSON válido." },
        { status: 400 }
      );
    }

    const errors: string[] = [];

    const dateStr = trimString(body.fecha);
    if (!DATE_REGEX.test(dateStr)) {
      errors.push("La fecha contable es obligatoria y debe tener el formato AAAA-MM-DD.");
    }

    const description = trimString(body.glosa);
    if (!description) errors.push("El concepto (glosa) del asiento es obligatorio.");
    else if (description.length > 200) errors.push("El concepto no puede superar los 200 caracteres.");

    const book = trimString(body.diario) || "Operaciones varias";
    if (book.length > 60) errors.push("El diario no puede superar los 60 caracteres.");

    const responsible = trimString(body.responsable);
    if (responsible.length > 100) {
      errors.push("El responsable no puede superar los 100 caracteres.");
    }

    const observation = trimString(body.observacion);
    if (observation.length > 200) {
      errors.push("La observación no puede superar los 200 caracteres.");
    }

    const status = typeof body.estado === "boolean" ? body.estado : true;

    const rawLines = Array.isArray(body.lineas) ? body.lineas : [];
    if (rawLines.length < 2) {
      errors.push("El asiento debe registrar al menos dos líneas (debe y haber).");
    } else if (rawLines.length > 100) {
      errors.push("El asiento no puede superar las 100 líneas.");
    }

    const validatedLines: ValidatedLine[] = [];
    rawLines.forEach((rawLine, index) => {
      const lineLabel = `Línea ${index + 1}:`;

      if (!rawLine || typeof rawLine !== "object") {
        errors.push(`${lineLabel} el formato de la línea no es válido.`);
        return;
      }

      const lineObj = rawLine as Record<string, unknown>;

      const accountId = Number(lineObj.idCuenta);
      if (!Number.isInteger(accountId) || accountId <= 0) {
        errors.push(`${lineLabel} falta la cuenta contable.`);
        return;
      }

      const lineDescription = trimString(lineObj.descripcion);
      if (lineDescription.length > 200) {
        errors.push(`${lineLabel} la descripción no puede superar los 200 caracteres.`);
      }

      const debit = parseAmount(lineObj.debe);
      const credit = parseAmount(lineObj.haber);
      if (debit === null || credit === null) {
        errors.push(`${lineLabel} los importes deben ser números válidos.`);
        return;
      }
      if (debit < 0 || credit < 0) {
        errors.push(`${lineLabel} los importes no pueden ser negativos.`);
        return;
      }
      if (debit > 0 && credit > 0) {
        errors.push(`${lineLabel} no puede tener importe en debe y en haber al mismo tiempo.`);
        return;
      }
      if (debit === 0 && credit === 0) {
        errors.push(`${lineLabel} debe tener un importe en debe o en haber.`);
        return;
      }

      validatedLines.push({
        accountId,
        description: lineDescription || null,
        debit: roundToTwo(debit),
        credit: roundToTwo(credit),
      });
    });

    const totalDebit = roundToTwo(validatedLines.reduce((sum, line) => sum + line.debit, 0));
    const totalCredit = roundToTwo(validatedLines.reduce((sum, line) => sum + line.credit, 0));
    if (validatedLines.length >= 2 && Math.abs(totalDebit - totalCredit) >= 0.005) {
      errors.push(
        `El asiento no cuadra: el debe (${totalDebit.toFixed(2)}) no coincide con el haber (${totalCredit.toFixed(2)}).`
      );
    }

    if (errors.length > 0) {
      return Response.json({ error: errors[0], errores: errors }, { status: 400 });
    }

    const uniqueAccountIds = [...new Set(validatedLines.map((line) => line.accountId))];
    const existingAccounts = await prisma.accountingAccount.findMany({
      where: { id: { in: uniqueAccountIds } },
      select: { id: true },
    });
    const foundAccountIds = new Set(existingAccounts.map((acc) => acc.id));
    if (uniqueAccountIds.some((id) => !foundAccountIds.has(id))) {
      return Response.json(
        { error: "Una o más cuentas contables del asiento no existen en el plan contable." },
        { status: 400 }
      );
    }

    const accountingDate = parseUtcDate(dateStr);

    let createdEntry: JournalEntry | null = null;
    for (let attempt = 0; attempt < 3 && !createdEntry; attempt++) {
      try {
        createdEntry = await prisma.journalEntry.create({
          data: {
            code: await generateJournalEntryCode(accountingDate),
            entryDate: accountingDate,
            description,
            book,
            responsible: responsible || null,
            observation: observation || null,
            status,
            entryDetails: {
              create: validatedLines.map((line) => ({
                accountId: line.accountId,
                description: line.description,
                debit: line.debit,
                credit: line.credit,
              })),
            },
          },
        });
      } catch (err) {
        if (!isDuplicateCode(err)) throw err;
      }
    }

    if (!createdEntry) {
      return Response.json(
        { error: "No se pudo asignar un número de asiento, intente nuevamente." },
        { status: 500 }
      );
    }

    return Response.json(
      {
        id: createdEntry.id,
        numero: createdEntry.code,
        fecha: dateStr,
        diario: createdEntry.book,
        concepto: createdEntry.description,
        responsable: createdEntry.responsible,
        estado: createdEntry.status ? "Registrado" : "Anulado",
        total: totalDebit,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/journal-entries] error al registrar el asiento:", error);
    return Response.json(
      { error: "No se pudo registrar el asiento contable." },
      { status: 500 }
    );
  }
}
