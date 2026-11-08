import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/security/users.service";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import {
  RE_TIME,
  approvedLeaveOverlapping,
  contractCovering,
  formatTime,
  fullName,
  isoDate,
  text,
  todayLimaIso,
} from "./common";
import { ensureDayScheduled } from "@/lib/services/hr/schedules.service";
import {
  LATE_TOLERANCE_MINUTES,
  LEAVE_TYPE_LABEL,
  addDaysIso,
  daysInclusive,
  evaluateDay,
  hhmm,
  instantAt,
  minutesSinceDayStart,
  shiftWindow,
  type AttendanceStatus,
  type LeaveTypeCode,
} from "./labor-rules";

/** Se puede marcar la entrada desde una hora antes del primer turno del día. */
export const EARLY_CHECK_IN_MINUTES = 60;
const MAX_RANGE_DAYS = 62;

export interface AttendanceRowDto {
  employee_id: number;
  full_name: string;
  dni: string;
  position: string | null;
  date: string;
  shifts: Array<{ shift_id: number; name: string; start_time: string; end_time: string }>;
  attendance_id: number | null;
  /** "HH:MM" en hora de Lima. */
  check_in: string | null;
  check_out: string | null;
  /** La salida fue al día siguiente (turnos nocturnos). */
  check_out_next_day: boolean;
  source: string | null;
  check_out_source: string | null;
  check_in_ip: string | null;
  check_out_ip: string | null;
  justified: boolean;
  justification: string | null;
  notes: string | null;
  leave: { leave_id: number; type: LeaveTypeCode; label: string } | null;
  status: AttendanceStatus;
  scheduled_minutes: number;
  late_minutes: number;
  worked_minutes: number;
  extra_minutes: number;
  expected_start: string | null;
  expected_end: string | null;
}

export interface AttendanceTotals {
  scheduled_days: number;
  present: number;
  on_time: number;
  late: number;
  absences: number;
  justified: number;
  on_leave: number;
  late_minutes: number;
  worked_minutes: number;
  extra_minutes: number;
}

export type MarkAction = "check_in" | "check_out";

function emptyTotals(): AttendanceTotals {
  return { scheduled_days: 0, present: 0, on_time: 0, late: 0, absences: 0, justified: 0, on_leave: 0, late_minutes: 0, worked_minutes: 0, extra_minutes: 0 };
}

export function addToTotals(t: AttendanceTotals, r: Pick<AttendanceRowDto, "status" | "shifts" | "late_minutes" | "worked_minutes" | "extra_minutes">) {
  if (r.shifts.length > 0) t.scheduled_days++;
  if (["Puntual", "Tardanza", "En turno", "Sin salida", "Extra"].includes(r.status)) t.present++;
  if (r.status === "Puntual") t.on_time++;
  if (r.status === "Tardanza") t.late++;
  if (r.status === "Falta") t.absences++;
  if (r.status === "Justificada") t.justified++;
  if (r.status === "Licencia") t.on_leave++;
  if (r.status === "Tardanza") t.late_minutes += r.late_minutes;
  t.worked_minutes += r.worked_minutes;
  t.extra_minutes += r.extra_minutes;
  return t;
}

const employeeSelect = (from: Date, to: Date) =>
  ({
    id: true,
    dni: true,
    firstName: true,
    middleName: true,
    paternalLastName: true,
    maternalLastName: true,
    contracts: {
      where: { status: "Vigente", startDate: { lte: to }, OR: [{ endDate: null }, { endDate: { gte: from } }] },
      select: { position: true, startDate: true, endDate: true },
    },
    shifts: { where: { shift: { date: { gte: from, lte: to } } }, select: { shift: true } },
    attendances: { where: { date: { gte: from, lte: to } } },
    leaveRequests: { where: approvedLeaveOverlapping(from, to), select: { id: true, type: true, startDate: true, endDate: true } },
  }) satisfies Prisma.EmployeeSelect;

type EmployeeDays = Prisma.EmployeeGetPayload<{ select: ReturnType<typeof employeeSelect> }>;

function buildRow(e: EmployeeDays, day: string, now: Date): AttendanceRowDto {
  const shifts = e.shifts
    .map((s) => s.shift)
    .filter((s) => formatDateToIso(s.date) === day)
    .map((s) => ({ shift_id: s.id, name: s.name, start_time: formatTime(s.startTime), end_time: formatTime(s.endTime) }))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const record = e.attendances.find((a) => formatDateToIso(a.date) === day) ?? null;
  const leave = e.leaveRequests.find((l) => formatDateToIso(l.startDate) <= day && day <= formatDateToIso(l.endDate)) ?? null;
  const ev = evaluateDay({
    date: day,
    shifts,
    checkIn: record?.checkIn ?? null,
    checkOut: record?.checkOut ?? null,
    justified: record?.justified ?? false,
    onLeave: leave != null,
    now,
  });
  const contract = e.contracts.find(
    (c) => formatDateToIso(c.startDate) <= day && (!c.endDate || formatDateToIso(c.endDate) >= day),
  );
  const outMin = record?.checkOut ? minutesSinceDayStart(day, record.checkOut) : null;
  return {
    employee_id: e.id,
    full_name: fullName(e),
    dni: e.dni,
    position: contract?.position ?? null,
    date: day,
    shifts,
    attendance_id: record?.id ?? null,
    check_in: record?.checkIn ? hhmm(minutesSinceDayStart(day, record.checkIn)) : null,
    check_out: outMin != null ? hhmm(outMin) : null,
    check_out_next_day: outMin != null && outMin >= 1440,
    source: record?.checkIn ? record.source : null,
    check_out_source: record?.checkOut ? record.checkOutSource ?? null : null,
    check_in_ip: record?.checkInIp ?? null,
    check_out_ip: record?.checkOutIp ?? null,
    justified: record?.justified ?? false,
    justification: record?.justification ?? null,
    notes: record?.notes ?? null,
    leave: leave ? { leave_id: leave.id, type: leave.type, label: LEAVE_TYPE_LABEL[leave.type] } : null,
    ...ev,
  };
}

/**
 * Tablero del día: todo el personal con contrato vigente, horario asignado o marcación ese día,
 * con su estado calculado (puntual, tardanza, falta, licencia…).
 */
export async function dailyAttendance(dateIso: string, now = new Date()) {
  const day = isoDate(dateIso, "La fecha", true)!;
  const date = parseUtcDate(day);
  // Hoy (y días futuros) se programan solos según los contratos si nadie lo hizo.
  await ensureDayScheduled(day);
  const employees = await prisma.employee.findMany({
    where: {
      OR: [
        { active: true, contracts: { some: contractCovering(date) } },
        { shifts: { some: { shift: { date } } } },
        { attendances: { some: { date } } },
      ],
    },
    select: employeeSelect(date, date),
    orderBy: [{ paternalLastName: "asc" }, { firstName: "asc" }],
  });
  const rows = employees.map((e) => buildRow(e, day, now));
  const totals = rows.reduce(addToTotals, emptyTotals());
  return { date: day, rows, totals };
}

/** Historial día por día de un empleado y sus totales (para su ficha y para la planilla). */
export async function employeeAttendance(employeeId: number, fromIso: string, toIso: string, now = new Date()) {
  const from = isoDate(fromIso, "La fecha inicial", true)!;
  const to = isoDate(toIso, "La fecha final", true)!;
  if (to < from) throw new UserError("La fecha final no puede ser anterior a la inicial");
  if (daysInclusive(from, to) > MAX_RANGE_DAYS) throw new UserError(`El rango no puede superar ${MAX_RANGE_DAYS} días`);
  const e = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: employeeSelect(parseUtcDate(from), parseUtcDate(to)),
  });
  if (!e) throw new UserError("Empleado no encontrado", 404);
  const days: AttendanceRowDto[] = [];
  for (let d = from; d <= to; d = addDaysIso(d, 1)) days.push(buildRow(e, d, now));
  return { employee_id: employeeId, from, to, days, totals: days.reduce(addToTotals, emptyTotals()) };
}

function nowMinutes(day: string, now: Date) {
  return minutesSinceDayStart(day, now);
}

async function shiftsOf(employeeId: number, day: string) {
  const rows = await prisma.employeeShift.findMany({
    where: { employeeId, shift: { date: parseUtcDate(day) } },
    select: { shift: true },
  });
  return rows.map((r) => shiftWindow(formatTime(r.shift.startTime), formatTime(r.shift.endTime)));
}

/** Origen de una marcación. */
export type MarkSource = "Manual" | "Autoservicio" | "InicioSesion" | "CierreSesion" | "Correccion";

export const MARK_SOURCE_LABEL: Record<MarkSource, string> = {
  InicioSesion: "Inicio de sesión",
  CierreSesion: "Cierre de sesión",
  Autoservicio: "Autoservicio",
  Manual: "Registrada por RR. HH.",
  Correccion: "Corrección de RR. HH.",
};

export interface MarkOptions {
  actorUserId: number | null;
  /** Usuario que hace la marcación (para la bitácora). */
  actorUsername?: string | null;
  /**
   * Manual: RR. HH. (puede indicar fecha y hora). Autoservicio, InicioSesion y CierreSesion: el
   * propio trabajador, solo hoy y con la hora real del servidor.
   */
  source: Exclude<MarkSource, "Correccion">;
  ip?: string | null;
  userAgent?: string | null;
  /** "YYYY-MM-DD"; por defecto hoy (o el turno abierto para la salida). */
  date?: string | null;
  /** "HH:MM" (solo registro manual); por defecto la hora actual. */
  time?: string | null;
  now?: Date;
}

/**
 * Registra la entrada o la salida. El autoservicio exige tener turno hoy, no antes de una hora
 * del inicio; la salida de un turno nocturno se asigna al día en que empezó.
 */
export async function markAttendance(employeeId: number, action: MarkAction, opts: MarkOptions) {
  if (action !== "check_in" && action !== "check_out") throw new UserError("Acción de marcación no válida");
  const now = opts.now ?? new Date();
  const today = todayLimaIso(now);
  const manual = opts.source === "Manual";

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, active: true, firstName: true, paternalLastName: true } });
  if (!employee) throw new UserError("Empleado no encontrado", 404);
  if (!employee.active) throw new UserError("El empleado está dado de baja");

  let day = manual ? isoDate(opts.date, "La fecha") ?? today : today;
  if (day > today) throw new UserError("No se puede registrar asistencia de una fecha futura");

  if (action === "check_out" && !opts.date) {
    // Turno nocturno: si hoy no hay entrada abierta, se busca la de ayer.
    const open = await prisma.attendance.findFirst({
      where: { employeeId, checkIn: { not: null }, checkOut: null, date: { in: [parseUtcDate(today), parseUtcDate(addDaysIso(today, -1))] } },
      orderBy: { date: "desc" },
    });
    if (open) day = formatDateToIso(open.date);
  }

  // Sin hora explícita se usa la hora actual: solo tiene sentido hoy (o la salida de un turno nocturno de ayer).
  if (manual && !opts.time && day < today && !(action === "check_out" && day === addDaysIso(today, -1))) {
    throw new UserError("Para un día pasado indica la hora de la marcación (usa Corregir)");
  }

  let instant = now;
  if (manual && opts.time) {
    if (!RE_TIME.test(opts.time)) throw new UserError("La hora debe tener el formato HH:MM");
    let minutes = Number(opts.time.slice(0, 2)) * 60 + Number(opts.time.slice(3));
    if (action === "check_out") {
      const rec = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId, date: parseUtcDate(day) } } });
      // Una salida "más temprana" que la entrada es del día siguiente (turno nocturno).
      if (rec?.checkIn && minutes <= minutesSinceDayStart(day, rec.checkIn)) minutes += 1440;
    }
    instant = instantAt(day, minutes);
    if (instant > now) throw new UserError("La hora no puede ser posterior a la hora actual");
  }

  const contract = await prisma.employmentContract.findFirst({ where: { employeeId, ...contractCovering(parseUtcDate(day)) }, select: { id: true } });
  if (!contract) throw new UserError(`${employee.firstName} ${employee.paternalLastName} no tiene contrato vigente el ${day}`);

  const leave = await prisma.leaveRequest.findFirst({ where: { employeeId, ...approvedLeaveOverlapping(parseUtcDate(day), parseUtcDate(day)) }, select: { type: true } });
  if (leave) throw new UserError(`Ese día está registrado como ${LEAVE_TYPE_LABEL[leave.type].toLowerCase()}`);

  const date = parseUtcDate(day);
  const existing = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId, date } } });

  if (action === "check_in") {
    if (existing?.checkIn) throw new UserError(`La entrada ya fue registrada a las ${hhmm(minutesSinceDayStart(day, existing.checkIn))}`);
    if (!manual) {
      await ensureDayScheduled(day, [employeeId]);
      const windows = await shiftsOf(employeeId, day);
      if (windows.length === 0) throw new UserError("Hoy no tienes un horario asignado. Consulta con Recursos Humanos");
      const first = Math.min(...windows.map((w) => w.from));
      if (nowMinutes(day, now) < first - EARLY_CHECK_IN_MINUTES) {
        throw new UserError(`Puedes marcar tu entrada desde las ${hhmm(first - EARLY_CHECK_IN_MINUTES)}`);
      }
    }
    const values = { checkIn: instant, source: opts.source, checkInIp: opts.ip?.slice(0, 45) ?? null, registeredById: opts.actorUserId };
    const saved = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: { employeeId, date, ...values },
      update: values,
    });
    await logMark({ attendanceId: saved.id, employeeId, kind: "Entrada", markedAt: instant, source: opts.source, opts });
    return { attendance_id: saved.id, date: day, action, time: hhmm(minutesSinceDayStart(day, instant)) };
  }

  if (!existing?.checkIn) throw new UserError("Primero debe registrarse la entrada");
  if (existing.checkOut) throw new UserError(`La salida ya fue registrada a las ${hhmm(minutesSinceDayStart(day, existing.checkOut))}`);
  if (instant <= existing.checkIn) throw new UserError("La salida debe ser posterior a la entrada");
  const saved = await prisma.attendance.update({
    where: { id: existing.id },
    data: { checkOut: instant, checkOutSource: opts.source, checkOutIp: opts.ip?.slice(0, 45) ?? null, registeredById: opts.actorUserId },
  });
  await logMark({ attendanceId: saved.id, employeeId, kind: "Salida", markedAt: instant, source: opts.source, opts });
  return { attendance_id: saved.id, date: day, action, time: hhmm(minutesSinceDayStart(day, instant)) };
}

async function logMark(m: {
  attendanceId: number | null;
  employeeId: number;
  kind: "Entrada" | "Salida";
  markedAt: Date | null;
  source: MarkSource;
  opts: { actorUserId: number | null; actorUsername?: string | null; ip?: string | null; userAgent?: string | null };
  note?: string | null;
}) {
  await prisma.attendanceMark.create({
    data: {
      attendanceId: m.attendanceId,
      employeeId: m.employeeId,
      kind: m.kind,
      markedAt: m.markedAt,
      source: m.source,
      userId: m.opts.actorUserId,
      username: m.opts.actorUsername?.slice(0, 50) ?? null,
      ipAddress: m.opts.ip?.slice(0, 45) ?? null,
      userAgent: m.opts.userAgent?.slice(0, 200) ?? null,
      note: m.note?.slice(0, 200) ?? null,
    },
  });
}

export type LoginMarkResult =
  | { status: "marked"; message: string; time: string }
  | { status: "already" | "early" | "late" | "no_shift" | "on_leave" | "not_employee" | "no_contract"; message: string };

/**
 * Marcación automática al iniciar sesión con credenciales. Registra la entrada solo si el
 * trabajador tiene turno hoy y está dentro de la ventana (desde 1 h antes del inicio hasta el
 * fin del turno). Nunca lanza: el inicio de sesión no debe fallar por la asistencia.
 */
export async function checkInOnLogin(
  userId: number,
  ctx: { username: string; ip?: string | null; userAgent?: string | null; now?: Date },
): Promise<LoginMarkResult> {
  try {
    const now = ctx.now ?? new Date();
    const today = todayLimaIso(now);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true, employee: { select: { active: true } } } });
    if (!user?.employee?.active) return { status: "not_employee", message: "" };
    const employeeId = user.employeeId;
    const date = parseUtcDate(today);

    const contract = await prisma.employmentContract.findFirst({ where: { employeeId, ...contractCovering(date) }, select: { id: true } });
    if (!contract) return { status: "no_contract", message: "" };
    const leave = await prisma.leaveRequest.findFirst({ where: { employeeId, ...approvedLeaveOverlapping(date, date) }, select: { type: true } });
    if (leave) return { status: "on_leave", message: `Hoy figuras con ${LEAVE_TYPE_LABEL[leave.type].toLowerCase()}: no se registró asistencia` };

    const existing = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId, date } } });
    if (existing?.checkIn) {
      return { status: "already", message: `Tu entrada de hoy ya está registrada a las ${hhmm(minutesSinceDayStart(today, existing.checkIn))}` };
    }
    // Si el día aún no estaba programado, se programa desde el horario pactado en su contrato.
    await ensureDayScheduled(today, [employeeId]);
    const windows = await shiftsOf(employeeId, today);
    if (windows.length === 0) return { status: "no_shift", message: "Hoy no tienes turno programado: no se registró asistencia" };
    const first = Math.min(...windows.map((w) => w.from));
    const last = Math.max(...windows.map((w) => w.to));
    const nowMin = nowMinutes(today, now);
    if (nowMin < first - EARLY_CHECK_IN_MINUTES) {
      return {
        status: "early",
        message: `Tu turno empieza a las ${hhmm(first)}. La entrada se registra desde las ${hhmm(first - EARLY_CHECK_IN_MINUTES)} (vuelve a iniciar sesión o márcala en «Mi horario»)`,
      };
    }
    if (nowMin >= last) return { status: "late", message: "Tu turno de hoy ya terminó: no se registró la entrada" };

    const r = await markAttendance(employeeId, "check_in", {
      actorUserId: userId,
      actorUsername: ctx.username,
      source: "InicioSesion",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      now,
    });
    const late = r && nowMin > first + LATE_TOLERANCE_MINUTES ? ` (${nowMin - first} min de tardanza)` : "";
    return { status: "marked", time: r.time, message: `Entrada registrada a las ${r.time}${late}` };
  } catch (e) {
    console.error("[asistencia] no se pudo marcar al iniciar sesión:", e);
    return { status: "no_shift", message: "" };
  }
}

/** Entrada sin salida de hoy o de ayer (turno nocturno), para ofrecer marcar la salida al cerrar sesión. */
export async function openAttendanceOf(employeeId: number, now = new Date()) {
  const today = todayLimaIso(now);
  const open = await prisma.attendance.findFirst({
    where: { employeeId, checkIn: { not: null }, checkOut: null, date: { in: [parseUtcDate(today), parseUtcDate(addDaysIso(today, -1))] } },
    orderBy: { date: "desc" },
  });
  if (!open?.checkIn) return null;
  const day = formatDateToIso(open.date);
  const windows = await shiftsOf(employeeId, day);
  const last = windows.length ? Math.max(...windows.map((w) => w.to)) : null;
  return {
    date: day,
    check_in: hhmm(minutesSinceDayStart(day, open.checkIn)),
    expected_end: last != null ? hhmm(last) : null,
    /** Minutos que faltan para el fin del turno (negativo si ya terminó). */
    minutes_to_end: last != null ? last - minutesSinceDayStart(day, now) : null,
  };
}

export interface AttendanceMarkDto {
  mark_id: number;
  employee_id: number;
  employee_name: string;
  kind: string;
  marked_at: string | null;
  /** "HH:MM" en Lima. */
  time: string | null;
  source: MarkSource;
  source_label: string;
  username: string | null;
  ip: string | null;
  device: string | null;
  note: string | null;
  created_at: string;
}

/** Resume el user-agent en algo legible ("Chrome · Windows", "Safari · iPhone"). */
export function deviceLabel(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "otro";
  return `${browser} · ${os}`;
}

/** Bitácora de marcaciones de un día (o de un empleado en un rango). */
export async function listMarks(f: { date?: string | null; employee_id?: number | null; from?: string | null; to?: string | null }) {
  const day = isoDate(f.date, "La fecha");
  const from = isoDate(f.from, "La fecha inicial") ?? day ?? todayLimaIso();
  const to = isoDate(f.to, "La fecha final") ?? day ?? from;
  // El día de Lima va de 05:00 UTC a 05:00 UTC del día siguiente.
  const start = instantAt(from, 0);
  const end = instantAt(addDaysIso(to, 1), 0);
  const rows = await prisma.attendanceMark.findMany({
    where: { createdAt: { gte: start, lt: end }, ...(f.employee_id ? { employeeId: f.employee_id } : {}) },
    include: { employee: { select: { firstName: true, middleName: true, paternalLastName: true, maternalLastName: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return rows.map(
    (r): AttendanceMarkDto => ({
      mark_id: r.id,
      employee_id: r.employeeId,
      employee_name: fullName(r.employee),
      kind: r.kind,
      marked_at: r.markedAt?.toISOString() ?? null,
      time: r.markedAt ? hhmm(minutesSinceDayStart(todayLimaIso(r.markedAt), r.markedAt)) : null,
      source: r.source as MarkSource,
      source_label: MARK_SOURCE_LABEL[r.source as MarkSource] ?? r.source,
      username: r.username,
      ip: r.ipAddress,
      device: deviceLabel(r.userAgent),
      note: r.note,
      created_at: r.createdAt.toISOString(),
    }),
  );
}

export interface AttendanceCorrection {
  employee_id: number;
  date: string;
  /** "HH:MM" o null para borrar. */
  check_in?: string | null;
  /** "HH:MM"; si es menor o igual que la entrada se toma del día siguiente. */
  check_out?: string | null;
  justified?: boolean;
  justification?: string | null;
  notes?: string | null;
}

/**
 * Corrección o justificación por RR. HH. (olvido de marcación, descanso médico sin sustento
 * previo, tardanza justificada…). Toda justificación debe llevar su motivo.
 */
export async function correctAttendance(
  data: AttendanceCorrection,
  actorUserId: number | null,
  now = new Date(),
  actorUsername?: string | null,
) {
  const employeeId = Number(data?.employee_id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) throw new UserError("Empleado no válido");
  const day = isoDate(data.date, "La fecha", true)!;
  if (day > todayLimaIso(now)) throw new UserError("No se puede registrar asistencia de una fecha futura");

  const parse = (v: unknown, field: string) => {
    if (v == null || v === "") return null;
    if (typeof v !== "string" || !RE_TIME.test(v)) throw new UserError(`${field} debe tener el formato HH:MM`);
    return Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  };
  const inMin = parse(data.check_in, "La hora de entrada");
  let outMin = parse(data.check_out, "La hora de salida");
  if (outMin != null && inMin == null) throw new UserError("No se puede registrar la salida sin la entrada");
  if (outMin != null && inMin != null && outMin <= inMin) outMin += 1440;
  const checkIn = inMin != null ? instantAt(day, inMin) : null;
  const checkOut = outMin != null ? instantAt(day, outMin) : null;
  if ((checkIn && checkIn > now) || (checkOut && checkOut > now)) throw new UserError("Las horas no pueden ser posteriores a la hora actual");

  const justified = Boolean(data.justified);
  const justification = text(data.justification, "El motivo de la justificación", 200);
  if (justified && !justification) throw new UserError("Indica el motivo de la justificación");

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) throw new UserError("Empleado no encontrado", 404);
  const date = parseUtcDate(day);
  const before = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId, date } } });
  const values = {
    checkIn,
    checkOut,
    justified,
    justification: justified ? justification : null,
    notes: text(data.notes, "Las observaciones", 200),
    registeredById: actorUserId,
  };
  const saved = await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    create: { employeeId, date, ...values, checkOutSource: checkOut ? "Correccion" : null },
    update: {
      ...values,
      // La corrección conserva el origen de la marca que no cambió.
      source: before?.checkIn?.getTime() === checkIn?.getTime() ? before?.source ?? "Correccion" : "Correccion",
      checkOutSource: before?.checkOut?.getTime() === checkOut?.getTime() ? before?.checkOutSource ?? null : checkOut ? "Correccion" : null,
    },
  });
  const time = (d: Date | null | undefined) => (d ? hhmm(minutesSinceDayStart(day, d)) : null);
  const opts = { actorUserId, actorUsername: actorUsername ?? null };
  const note = [justified ? `Justificada: ${justification}` : null, values.notes].filter(Boolean).join(" · ") || "Corrección de RR. HH.";
  if (before?.checkIn?.getTime() !== checkIn?.getTime() || (!before && checkIn)) {
    await logMark({ attendanceId: saved.id, employeeId, kind: "Entrada", markedAt: checkIn, source: "Correccion", opts, note });
  }
  if (before?.checkOut?.getTime() !== checkOut?.getTime()) {
    await logMark({ attendanceId: saved.id, employeeId, kind: "Salida", markedAt: checkOut, source: "Correccion", opts, note });
  }
  return {
    attendance_id: saved.id,
    before: before ? { check_in: time(before.checkIn), check_out: time(before.checkOut), justified: before.justified } : null,
    after: { check_in: time(saved.checkIn), check_out: time(saved.checkOut), justified: saved.justified },
  };
}
