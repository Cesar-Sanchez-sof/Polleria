import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/users.service";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import { formatTime } from "@/lib/services/employees.service";

export interface ScheduleData {
  name: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  start_time: string;
  /** "HH:MM"; si es menor que el inicio, el turno termina al día siguiente. */
  end_time: string;
}

export interface ScheduleDto {
  shift_id: number;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  overnight: boolean;
  hours: number;
  employees: Array<{ employee_id: number; full_name: string; dni: string; position: string | null; active: boolean }>;
}

export interface ScheduleFilters {
  from?: string | null;
  to?: string | null;
}

const INCLUDE = {
  employees: {
    select: {
      employee: {
        select: { id: true, dni: true, firstName: true, paternalLastName: true, position: true, active: true },
      },
    },
    orderBy: [{ employee: { paternalLastName: "asc" } }, { employee: { firstName: "asc" } }],
  },
} satisfies Prisma.ShiftInclude;

type ScheduleRow = Prisma.ShiftGetPayload<{ include: typeof INCLUDE }>;

const RE_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function toTimeColumn(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Duración en horas; los turnos que cruzan la medianoche cuentan hasta el día siguiente. */
export function shiftHours(start: string, end: string): number {
  const diff = toMinutes(end) - toMinutes(start);
  const minutes = diff > 0 ? diff : diff + 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
}

function mapSchedule(s: ScheduleRow): ScheduleDto {
  const start = formatTime(s.startTime);
  const end = formatTime(s.endTime);
  return {
    shift_id: s.id,
    name: s.name,
    date: formatDateToIso(s.date),
    start_time: start,
    end_time: end,
    overnight: toMinutes(end) < toMinutes(start),
    hours: shiftHours(start, end),
    employees: s.employees.map(({ employee: e }) => ({
      employee_id: e.id,
      full_name: `${e.firstName} ${e.paternalLastName}`,
      dni: e.dni,
      position: e.position,
      active: e.active,
    })),
  };
}

export function normalizeSchedule(data: ScheduleData) {
  const name = typeof data.name === "string" ? data.name.trim().replace(/\s+/g, " ") : "";
  if (!name) throw new UserError("El nombre del horario es obligatorio");
  if (name.length > 30) throw new UserError("El nombre del horario no puede superar 30 caracteres");

  const date = typeof data.date === "string" ? data.date.trim() : "";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? parseUtcDate(date) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || formatDateToIso(parsed) !== date) {
    throw new UserError("La fecha no es válida");
  }

  if (!RE_TIME.test(data.start_time ?? "") || !RE_TIME.test(data.end_time ?? "")) {
    throw new UserError("La hora de inicio y de fin deben tener el formato HH:MM");
  }
  if (data.start_time === data.end_time) {
    throw new UserError("La hora de fin debe ser distinta de la hora de inicio");
  }

  return { name, date: parsed, startTime: toTimeColumn(data.start_time), endTime: toTimeColumn(data.end_time) };
}

export async function listSchedules(filters: ScheduleFilters = {}): Promise<ScheduleDto[]> {
  const range: Prisma.DateTimeFilter = {};
  if (filters.from) range.gte = parseUtcDate(filters.from);
  if (filters.to) range.lte = parseUtcDate(filters.to);
  const rows = await prisma.shift.findMany({
    where: Object.keys(range).length ? { date: range } : {},
    include: INCLUDE,
    orderBy: [{ date: "desc" }, { startTime: "asc" }, { id: "asc" }],
  });
  return rows.map(mapSchedule);
}

export async function getSchedule(id: number): Promise<ScheduleDto> {
  const s = await prisma.shift.findUnique({ where: { id }, include: INCLUDE });
  if (!s) throw new UserError("Horario no encontrado", 404);
  return mapSchedule(s);
}

const DAY_MS = 86_400_000;

interface ShiftTimes {
  id: number;
  name?: string;
  date: Date;
  startTime: Date;
  endTime: Date;
}

/** Intervalo en minutos absolutos; un turno nocturno sigue hasta el día siguiente. */
function interval(s: Pick<ShiftTimes, "date" | "startTime" | "endTime">) {
  const base = Math.floor(s.date.getTime() / DAY_MS) * 1440;
  const start = s.startTime.getUTCHours() * 60 + s.startTime.getUTCMinutes();
  const end = s.endTime.getUTCHours() * 60 + s.endTime.getUTCMinutes();
  return { from: base + start, to: base + end + (end < start ? 1440 : 0) };
}

/**
 * Un empleado puede tener varios horarios, pero no dos que se crucen (tocarse en el borde,
 * como Atención 18:00–23:30 y Cierre 23:30–00:30, sí está permitido). Se revisan también
 * los turnos del día anterior y del siguiente por los nocturnos.
 */
async function verifyNoOverlap(db: Prisma.TransactionClient, shift: ShiftTimes, employeeIds: number[]) {
  if (employeeIds.length === 0) return;
  const mine = interval(shift);
  const neighbours = await db.shift.findMany({
    where: {
      id: { not: shift.id },
      date: { gte: new Date(shift.date.getTime() - DAY_MS), lte: new Date(shift.date.getTime() + DAY_MS) },
      employees: { some: { employeeId: { in: employeeIds } } },
    },
    include: {
      employees: {
        where: { employeeId: { in: employeeIds } },
        select: { employee: { select: { firstName: true, paternalLastName: true } } },
      },
    },
  });
  for (const other of neighbours) {
    const o = interval(other);
    if (mine.from < o.to && o.from < mine.to) {
      const who = other.employees[0].employee;
      throw new UserError(
        `${who.firstName} ${who.paternalLastName} ya está asignado a «${other.name}» ` +
          `(${formatTime(other.startTime)}–${formatTime(other.endTime)}, ${formatDateToIso(other.date)}), que se cruza con este horario`,
        409,
      );
    }
  }
}

/** Dos horarios del mismo nombre y fecha serían indistinguibles en pantalla. */
async function verifyDuplicate(
  db: Prisma.TransactionClient,
  n: ReturnType<typeof normalizeSchedule>,
  excludeId?: number,
) {
  const dup = await db.shift.findFirst({
    where: {
      name: { equals: n.name, mode: "insensitive" },
      date: n.date,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (dup) throw new UserError("Ya existe un horario con ese nombre en esa fecha", 409);
}

export async function createSchedule(data: ScheduleData): Promise<ScheduleDto> {
  const n = normalizeSchedule(data);
  return prisma.$transaction(async (tx) => {
    await verifyDuplicate(tx, n);
    const s = await tx.shift.create({ data: n, include: INCLUDE });
    return mapSchedule(s);
  });
}

export async function updateSchedule(id: number, data: ScheduleData): Promise<ScheduleDto> {
  const n = normalizeSchedule(data);
  return prisma.$transaction(async (tx) => {
    const current = await tx.shift.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new UserError("Horario no encontrado", 404);
    await verifyDuplicate(tx, n, id);
    // Cambiar la fecha u hora no debe dejar al personal ya asignado en dos turnos a la vez.
    const assigned = await tx.employeeShift.findMany({ where: { shiftId: id }, select: { employeeId: true } });
    await verifyNoOverlap(tx, { id, ...n }, assigned.map((a) => a.employeeId));
    const s = await tx.shift.update({ where: { id }, data: n, include: INCLUDE });
    return mapSchedule(s);
  });
}

/** Elimina el horario y sus asignaciones (cascada); los empleados conservan sus otros horarios. */
export async function deleteSchedule(id: number): Promise<{ schedule: ScheduleDto }> {
  return prisma.$transaction(async (tx) => {
    const s = await tx.shift.findUnique({ where: { id }, include: INCLUDE });
    if (!s) throw new UserError("Horario no encontrado", 404);
    await tx.shift.delete({ where: { id } });
    return { schedule: mapSchedule(s) };
  });
}

/**
 * Reemplaza la lista de empleados del horario. Un empleado puede estar en varios horarios
 * siempre que no se crucen; quitarlo de aquí no lo afecta en los demás.
 */
export async function setScheduleEmployees(id: number, employeeIds: unknown): Promise<ScheduleDto> {
  if (!Array.isArray(employeeIds) || employeeIds.some((x) => !Number.isInteger(x) || x <= 0)) {
    throw new UserError("La lista de empleados no es válida");
  }
  const ids = [...new Set(employeeIds as number[])];
  return prisma.$transaction(async (tx) => {
    const s = await tx.shift.findUnique({ where: { id }, select: { id: true, date: true, startTime: true, endTime: true } });
    if (!s) throw new UserError("Horario no encontrado", 404);

    if (ids.length > 0) {
      const found = await tx.employee.findMany({ where: { id: { in: ids } }, select: { id: true, active: true } });
      if (found.length !== ids.length) throw new UserError("Algún empleado seleccionado no existe", 404);
      if (found.some((e) => !e.active)) throw new UserError("No se puede asignar un empleado dado de baja");
      await verifyNoOverlap(tx, s, ids);
    }

    await tx.employeeShift.deleteMany({ where: { shiftId: id, employeeId: { notIn: ids } } });
    if (ids.length > 0) {
      await tx.employeeShift.createMany({ data: ids.map((employeeId) => ({ employeeId, shiftId: id })), skipDuplicates: true });
    }

    const updated = await tx.shift.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    return mapSchedule(updated);
  });
}