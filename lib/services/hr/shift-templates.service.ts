import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/users.service";
import { RE_TIME, formatTime, text, toTimeColumn, type Tx } from "./common";
import { shiftWindow, type TemplateTimes } from "./labor-rules";

export interface ShiftTemplateData {
  name: string;
  start_time: string;
  end_time: string;
}

export interface ShiftTemplateDto extends TemplateTimes {
  hours: number;
  overnight: boolean;
  active: boolean;
  /** Contratos vigentes que usan este turno en su horario. */
  contracts_in_use: number;
}

type Row = Prisma.ShiftTemplateGetPayload<{ include: { contractDays: { select: { contractId: true } } } }>;

function mapTemplate(t: Row): ShiftTemplateDto {
  const start = formatTime(t.startTime);
  const end = formatTime(t.endTime);
  const w = shiftWindow(start, end);
  return {
    id: t.id,
    name: t.name,
    start_time: start,
    end_time: end,
    hours: Math.round(((w.to - w.from) / 60) * 100) / 100,
    overnight: w.to > 1440,
    active: t.active,
    contracts_in_use: new Set(t.contractDays.map((d) => d.contractId)).size,
  };
}

const include = (): Prisma.ShiftTemplateInclude => ({
  contractDays: { where: { contract: { status: "Vigente" } }, select: { contractId: true } },
});

export function normalizeTemplate(data: ShiftTemplateData) {
  const name = text(data.name, "El nombre del turno", 30, true)!;
  if (!RE_TIME.test(data.start_time ?? "") || !RE_TIME.test(data.end_time ?? "")) {
    throw new UserError("La hora de inicio y de fin deben tener el formato HH:MM");
  }
  if (data.start_time === data.end_time) throw new UserError("La hora de fin debe ser distinta de la de inicio");
  return { name, startTime: toTimeColumn(data.start_time), endTime: toTimeColumn(data.end_time) };
}

export async function listShiftTemplates(onlyActive = false): Promise<ShiftTemplateDto[]> {
  const rows = await prisma.shiftTemplate.findMany({
    where: onlyActive ? { active: true } : {},
    include: include(),
    orderBy: [{ startTime: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => mapTemplate(r as Row));
}

/** Turnos base activos indexados por id (para validar horarios de contratos). */
export async function templateMap(db: Tx | typeof prisma, ids: number[]): Promise<Map<number, TemplateTimes>> {
  const rows = await db.shiftTemplate.findMany({ where: { id: { in: ids }, active: true } });
  return new Map(rows.map((t) => [t.id, { id: t.id, name: t.name, start_time: formatTime(t.startTime), end_time: formatTime(t.endTime) }]));
}

function translate(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new UserError("Ya existe un turno base con ese nombre", 409);
  }
  throw e;
}

export async function createShiftTemplate(data: ShiftTemplateData): Promise<ShiftTemplateDto> {
  const n = normalizeTemplate(data);
  try {
    const t = await prisma.shiftTemplate.create({ data: n, include: include() });
    return mapTemplate(t as Row);
  } catch (e) {
    return translate(e);
  }
}

/**
 * Cambiar las horas de un turno que ya usan contratos vigentes alteraría la jornada pactada
 * sin adenda: solo se permite renombrarlo. Para otro horario, crea un turno nuevo.
 */
export async function updateShiftTemplate(id: number, data: ShiftTemplateData): Promise<ShiftTemplateDto> {
  const n = normalizeTemplate(data);
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.shiftTemplate.findUnique({ where: { id }, include: include() });
      if (!current) throw new UserError("Turno base no encontrado", 404);
      const timesChanged =
        formatTime(current.startTime) !== formatTime(n.startTime) || formatTime(current.endTime) !== formatTime(n.endTime);
      if (timesChanged && (current as Row).contractDays.length > 0) {
        throw new UserError(
          "Este turno está pactado en contratos vigentes: no se pueden cambiar sus horas. Crea un turno nuevo y actualiza los contratos",
          409,
        );
      }
      const t = await tx.shiftTemplate.update({ where: { id }, data: n, include: include() });
      return mapTemplate(t as Row);
    });
  } catch (e) {
    return translate(e);
  }
}

export async function setShiftTemplateActive(id: number, active: boolean): Promise<ShiftTemplateDto> {
  const current = await prisma.shiftTemplate.findUnique({ where: { id }, include: include() });
  if (!current) throw new UserError("Turno base no encontrado", 404);
  if (!active && (current as Row).contractDays.length > 0) {
    throw new UserError("No se puede desactivar: hay contratos vigentes que lo usan en su horario", 409);
  }
  const t = await prisma.shiftTemplate.update({ where: { id }, data: { active }, include: include() });
  return mapTemplate(t as Row);
}
