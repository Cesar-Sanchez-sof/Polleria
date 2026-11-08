import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/security/users.service";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import { approvedLeaveOverlapping, contractCovering, formatTime, todayLimaIso } from "@/lib/services/hr/common";
import { addDaysIso, weekdayOf } from "@/lib/services/hr/labor-rules";

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
        select: {
          id: true,
          dni: true,
          firstName: true,
          paternalLastName: true,
          active: true,
          contracts: { where: { status: "Vigente" }, select: { position: true }, orderBy: { startDate: "desc" }, take: 1 },
        },
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
      position: e.contracts[0]?.position ?? null,
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

/**
 * Solo se programa a quien ese día tiene contrato vigente y no está de vacaciones o licencia.
 * (Quienes ya estaban asignados se conservan aunque luego cambie su situación.)
 */
async function verifyAssignable(db: Prisma.TransactionClient, employeeIds: number[], date: Date) {
  if (employeeIds.length === 0) return;
  const found = await db.employee.findMany({
    where: { id: { in: employeeIds } },
    select: {
      id: true,
      firstName: true,
      paternalLastName: true,
      active: true,
      contracts: { where: contractCovering(date), select: { id: true }, take: 1 },
      leaveRequests: { where: approvedLeaveOverlapping(date, date), select: { type: true }, take: 1 },
    },
  });
  if (found.length !== employeeIds.length) throw new UserError("Algún empleado seleccionado no existe", 404);
  const day = formatDateToIso(date);
  for (const e of found) {
    const who = `${e.firstName} ${e.paternalLastName}`;
    if (!e.active) throw new UserError(`${who} está dado de baja y no se puede programar`);
    if (e.contracts.length === 0) throw new UserError(`${who} no tiene contrato vigente el ${day}`);
    if (e.leaveRequests.length > 0) throw new UserError(`${who} está de vacaciones o con licencia el ${day}`);
  }
}

/**
 * Un horario con el nombre de un turno base debe tener sus mismas horas: así lo programado
 * coincide con lo pactado en los contratos. Con otro nombre es un horario eventual.
 */
async function verifyMatchesTemplate(db: Prisma.TransactionClient, n: ReturnType<typeof normalizeSchedule>) {
  const t = await db.shiftTemplate.findFirst({ where: { name: { equals: n.name, mode: "insensitive" } } });
  if (!t) return;
  if (formatTime(t.startTime) !== formatTime(n.startTime) || formatTime(t.endTime) !== formatTime(n.endTime)) {
    throw new UserError(
      `«${t.name}» es un turno base de ${formatTime(t.startTime)}–${formatTime(t.endTime)}: usa esas horas o ponle otro nombre (horario eventual)`,
    );
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
    await verifyMatchesTemplate(tx, n);
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
    await verifyMatchesTemplate(tx, n);
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
      const current = await tx.employeeShift.findMany({ where: { shiftId: id }, select: { employeeId: true } });
      const already = new Set(current.map((c) => c.employeeId));
      await verifyAssignable(tx, ids.filter((x) => !already.has(x)), s.date);
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
export interface GenerateWeekResult {
  from: string;
  to: string;
  shifts_created: number;
  assignments: number;
  /** Asignaciones que no se hicieron (licencia, cruce con otro horario…). */
  skipped: Array<{ employee: string; date: string; shift: string; reason: string }>;
}

/**
 * Programa la semana a partir del horario pactado en cada contrato vigente: crea los horarios
 * del día que falten (por nombre de turno base) y asigna a cada trabajador a los suyos.
 * Es idempotente: volver a correrlo no duplica horarios ni asignaciones.
 */
export async function generateWeekFromContracts(monday: string): Promise<GenerateWeekResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(monday ?? "") || formatDateToIso(parseUtcDate(monday)) !== monday) {
    throw new UserError("La fecha de inicio de semana no es válida");
  }
  if (weekdayOf(monday) !== 0) throw new UserError("La semana debe empezar en lunes");
  const sunday = addDaysIso(monday, 6);
  if (sunday < todayLimaIso()) throw new UserError("No se puede programar una semana que ya pasó");
  return prisma.$transaction((tx) => syncScheduleFromContracts(tx, { from: monday, to: sunday }), { timeout: 30_000 });
}

/** Días que se programan por adelantado al guardar un contrato. */
export const SCHEDULE_AHEAD_DAYS = 14;

/**
 * Crea los horarios del día (por turno base) y asigna a cada trabajador según el horario pactado
 * en su contrato, entre `from` y `to` (nunca días pasados). Idempotente: no duplica horarios ni
 * asignaciones. Omite a quien tiene licencia aprobada o un cruce con otro horario.
 */
export async function syncScheduleFromContracts(
  tx: Prisma.TransactionClient,
  opts: { from: string; to: string; employeeIds?: number[] },
): Promise<GenerateWeekResult> {
  const today = todayLimaIso();
  const fromIso = opts.from < today ? today : opts.from;
  const result: GenerateWeekResult = { from: fromIso, to: opts.to, shifts_created: 0, assignments: 0, skipped: [] };
  if (opts.to < fromIso) return result;
  const from = parseUtcDate(fromIso);
  const to = parseUtcDate(opts.to);
  const contracts = await tx.employmentContract.findMany({
    where: {
      status: "Vigente",
      startDate: { lte: to },
      OR: [{ endDate: null }, { endDate: { gte: from } }],
      employee: { active: true },
      schedule: { some: {} },
      ...(opts.employeeIds ? { employeeId: { in: opts.employeeIds } } : {}),
    },
    include: {
      schedule: { include: { shiftTemplate: true } },
      employee: {
        select: {
          firstName: true,
          paternalLastName: true,
          leaveRequests: { where: approvedLeaveOverlapping(from, to), select: { startDate: true, endDate: true } },
        },
      },
    },
  });

  const shiftCache = new Map<string, ShiftTimes>();
  for (let day = fromIso; day <= opts.to; day = addDaysIso(day, 1)) {
    const date = parseUtcDate(day);
    const weekday = weekdayOf(day);
    for (const c of contracts) {
      const startIso = formatDateToIso(c.startDate);
      const endIso = c.endDate ? formatDateToIso(c.endDate) : null;
      if (day < startIso || (endIso && day > endIso)) continue;
      const who = `${c.employee.firstName} ${c.employee.paternalLastName}`;
      const onLeave = c.employee.leaveRequests.some(
        (l) => formatDateToIso(l.startDate) <= day && day <= formatDateToIso(l.endDate),
      );
      for (const d of c.schedule.filter((x) => x.weekday === weekday)) {
        const t = d.shiftTemplate;
        if (onLeave) {
          result.skipped.push({ employee: who, date: day, shift: t.name, reason: "Vacaciones o licencia aprobada" });
          continue;
        }
        const key = `${t.name.toLowerCase()}|${day}`;
        let shift = shiftCache.get(key);
        if (!shift) {
          shift = (await tx.shift.findFirst({ where: { name: { equals: t.name, mode: "insensitive" }, date } })) ?? undefined;
          if (!shift) {
            shift = await tx.shift.create({ data: { name: t.name, date, startTime: t.startTime, endTime: t.endTime } });
            result.shifts_created++;
          }
          shiftCache.set(key, shift);
        }
        if (formatTime(shift.startTime) !== formatTime(t.startTime) || formatTime(shift.endTime) !== formatTime(t.endTime)) {
          result.skipped.push({
            employee: who,
            date: day,
            shift: t.name,
            reason: `Ya existe un horario «${t.name}» ese día con otras horas (${formatTime(shift.startTime)}–${formatTime(shift.endTime)}): corrígelo`,
          });
          continue;
        }
        const exists = await tx.employeeShift.findFirst({ where: { employeeId: c.employeeId, shiftId: shift.id }, select: { id: true } });
        if (exists) continue;
        try {
          await verifyNoOverlap(tx, shift, [c.employeeId]);
        } catch (e) {
          result.skipped.push({ employee: who, date: day, shift: t.name, reason: e instanceof Error ? e.message : "Se cruza con otro horario" });
          continue;
        }
        await tx.employeeShift.create({ data: { employeeId: c.employeeId, shiftId: shift.id } });
        result.assignments++;
      }
    }
  }
  return result;
}

/**
 * Programa al trabajador las próximas 2 semanas según su contrato. Con `resync` (adenda o
 * renovación) primero lo retira de los turnos base programados desde mañana, para que lo
 * programado coincida con el nuevo horario pactado. Hoy no se toca (pudo marcar ya).
 */
export async function scheduleEmployeeAhead(tx: Prisma.TransactionClient, employeeId: number, resync = false) {
  const today = todayLimaIso();
  if (resync) {
    const templates = await tx.shiftTemplate.findMany({ select: { name: true } });
    await tx.employeeShift.deleteMany({
      where: {
        employeeId,
        shift: { date: { gt: parseUtcDate(today) }, name: { in: templates.map((t) => t.name) } },
      },
    });
  }
  return syncScheduleFromContracts(tx, { from: today, to: addDaysIso(today, SCHEDULE_AHEAD_DAYS - 1), employeeIds: [employeeId] });
}

/** Asegura que el día (hoy o futuro) esté programado según los contratos. Nunca lanza. */
export async function ensureDayScheduled(dateIso: string, employeeIds?: number[]): Promise<void> {
  if (dateIso < todayLimaIso()) return;
  try {
    await prisma.$transaction((tx) => syncScheduleFromContracts(tx, { from: dateIso, to: dateIso, employeeIds }), { timeout: 20_000 });
  } catch (e) {
    console.error("[horarios] no se pudo programar el día desde los contratos:", e);
  }
}
