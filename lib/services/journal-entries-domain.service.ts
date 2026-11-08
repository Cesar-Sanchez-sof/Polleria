import { prisma } from "@/lib/prisma";
import { Prisma, type JournalEntry } from "@prisma/client";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import { generateJournalEntryCode } from "@/lib/journal-entry-code";
import { logAudit } from "@/lib/services/audit.service";
import { currentActor } from "@/lib/auth/audit-actor";
import { ValidationError, NotFoundError } from "@/lib/http/errors";

export class JournalEntryValidationError extends ValidationError {
  constructor(public errors: string[]) {
    super(errors[0], errors);
  }
}

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

interface ValidatedLine {
  accountId: number;
  description: string | null;
  debit: number;
  credit: number;
}

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

async function getTotalsByEntryId(entryIds: number[]): Promise<Map<number, number>> {
  const sums = await prisma.journalEntryDetail.groupBy({
    by: ["entryId"],
    where: { entryId: { in: entryIds } },
    _sum: { debit: true },
  });

  return new Map(sums.map((s) => [s.entryId, Number(s._sum.debit ?? 0)]));
}

/* ========================================================================== */
/* 1. CUENTAS PARA ASIENTOS MANUALES                                         */
/* ========================================================================== */
export async function getJournalAccountsDomain() {
  const accounts = await prisma.accountingAccount.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
    },
  });

  return {
    data: accounts.map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
    })),
  };
}

/* ========================================================================== */
/* 2. OPCIONES DE FILTRADO PARA ASIENTOS                                     */
/* ========================================================================== */
export async function getJournalOptionsDomain() {
  const [books, statuses] = await Promise.all([
    prisma.journalEntry.groupBy({
      by: ["book"],
      _count: { _all: true },
      orderBy: { book: "asc" },
    }),
    prisma.journalEntry.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const countByStatus = (statusValue: boolean): number =>
    statuses.find((s) => s.status === statusValue)?._count._all ?? 0;

  return {
    daily: books.map((b) => ({ name: b.book, total: b._count._all })),
    statuses: [
      { value: "registrado", label: "Registrado", total: countByStatus(true) },
      { value: "anulado", label: "Anulado", total: countByStatus(false) },
    ],
  };
}

/* ========================================================================== */
/* 3. LISTAR ASIENTOS CONTABLES                                              */
/* ========================================================================== */
export async function listJournalEntriesDomain(searchParams: URLSearchParams) {
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
      createdAt: true,
      entryDetails: { select: { debit: true } },
    },
  });

  const data = records.map((entry) => ({
    id: entry.id,
    number: entry.code,
    date: formatDateToIso(entry.entryDate),
    daily: entry.book,
    concept: entry.description,
    responsible: entry.responsible,
    status: entry.status ? ("Registrado" as const) : ("Anulado" as const),
    total: entry.entryDetails.reduce((sum, line) => sum + Number(line.debit), 0),
    ...(entry.createdAt ? { createdAt: entry.createdAt.toISOString() } : {}),
  }));

  if (pageEntryIds) {
    const positionMap = new Map(pageEntryIds.map((id, index) => [id, index]));
    data.sort((a, b) => (positionMap.get(a.id) ?? 0) - (positionMap.get(b.id) ?? 0));
  }

  return {
    data,
    meta: {
      total,
      registered,
      annulled,
      page: effectivePage,
      pageSize,
      totalPages,
      order: sort,
      dir,
    },
  };
}

/* ========================================================================== */
/* 4. CREAR ASIENTO CONTABLE MANUAL                                          */
/* ========================================================================== */
export async function createJournalEntryDomain(body: unknown, ipAddress?: string) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("El cuerpo de la petición no es un JSON válido.");
  }

  const raw = body as Record<string, unknown>;
  const errors: string[] = [];

  const dateStr = trimString(raw.date);
  if (!DATE_REGEX.test(dateStr)) {
    errors.push("La fecha contable es obligatoria y debe tener el formato AAAA-MM-DD.");
  }

  const description = trimString(raw.description);
  if (!description) errors.push("El concepto (glosa) del asiento es obligatorio.");
  else if (description.length > 200) errors.push("El concepto no puede superar los 200 caracteres.");

  const book = trimString(raw.daily) || "Operaciones varias";
  if (book.length > 60) errors.push("El diario no puede superar los 60 caracteres.");

  const responsible = trimString(raw.responsible);
  if (responsible.length > 100) {
    errors.push("El responsable no puede superar los 100 caracteres.");
  }

  const observation = trimString(raw.observation);
  if (observation.length > 200) {
    errors.push("La observación no puede superar los 200 caracteres.");
  }

  const status = typeof raw.status === "boolean" ? raw.status : true;

  const rawLines = Array.isArray(raw.lines) ? raw.lines : [];
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

    const accountId = Number(lineObj.accountId);
    if (!Number.isInteger(accountId) || accountId <= 0) {
      errors.push(`${lineLabel} falta la cuenta contable.`);
      return;
    }

    const lineDescription = trimString(lineObj.description);
    if (lineDescription.length > 200) {
      errors.push(`${lineLabel} la descripción no puede superar los 200 caracteres.`);
    }

    const debit = parseAmount(lineObj.debit);
    const credit = parseAmount(lineObj.credit);
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
    throw new JournalEntryValidationError(errors);
  }

  const uniqueAccountIds = [...new Set(validatedLines.map((line) => line.accountId))];
  const existingAccounts = await prisma.accountingAccount.findMany({
    where: { id: { in: uniqueAccountIds } },
    select: { id: true },
  });
  const foundAccountIds = new Set(existingAccounts.map((acc) => acc.id));
  if (uniqueAccountIds.some((id) => !foundAccountIds.has(id))) {
    throw new ValidationError("Una o más cuentas contables del asiento no existen en el plan contable.");
  }

  const accountingDate = parseUtcDate(dateStr);
  const period = await prisma.accountingPeriod.findFirst({
    where: {
      startDate: { lte: accountingDate },
      endDate: { gte: accountingDate },
    },
  });
  if (!period) {
    throw new ValidationError("No accounting period found for the given date.");
  }
  if (period.status === "CLOSED") {
    throw new ValidationError("Cannot register entries in a closed accounting period.");
  }

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
          periodId: period.id,
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
      if (!isDuplicateCode(err)) {
        console.error("[lib/services/journal-entries] error al crear el asiento:", err);
        throw new Error("No se pudo asignar un número de asiento, intente nuevamente.");
      }
    }
  }

  if (!createdEntry) {
    throw new Error("No se pudo asignar un número de asiento, intente nuevamente.");
  }

  await logAudit({
    actor: await currentActor(),
    action: "CREATE",
    module: "Contabilidad",
    entity: "Asiento contable",
    entityId: createdEntry.id,
    description: `Registró el asiento ${createdEntry.code}`,
    details: { after: { code: createdEntry.code, daily: createdEntry.book, concept: createdEntry.description } },
    ipAddress,
  });

  return {
    id: createdEntry.id,
    number: createdEntry.code,
    date: dateStr,
    daily: createdEntry.book,
    concept: createdEntry.description,
    responsible: createdEntry.responsible,
    status: createdEntry.status ? "Registrado" : "Anulado",
    total: totalDebit,
  };
}

/* ========================================================================== */
/* 5. OBTENER DETALLE DE ASIENTO CONTABLE                                    */
/* ========================================================================== */
export async function getJournalEntryByIdDomain(idParam: string) {
  const entryId = Number.parseInt(idParam, 10);
  if (Number.isNaN(entryId)) {
    throw new ValidationError("Identificador de asiento inválido.");
  }

  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: {
      entryDetails: {
        orderBy: { id: "asc" },
        include: { account: true },
      },
    },
  });

  if (!entry) {
    throw new NotFoundError("Asiento contable no encontrado.");
  }

  const lines = entry.entryDetails.map((line) => ({
    id: line.id,
    accountCode: line.account.code,
    accountName: line.account.name,
    accountType: line.account.type,
    description: line.description ?? "",
    debit: Number(line.debit),
    credit: Number(line.credit),
  }));

  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

  return {
    id: entry.id,
    number: entry.code,
    date: formatDateToIso(entry.entryDate),
    daily: entry.book,
    concept: entry.description,
    status: entry.status ? "Registrado" : "Anulado",
    responsible: entry.responsible ?? "",
    observation: entry.observation ?? "",
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    total: totalDebit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.005,
    totals: { debit: totalDebit, credit: totalCredit },
    lines,
  };
}
