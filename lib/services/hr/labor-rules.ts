/**
 * Reglas laborales peruanas que usa Recursos Humanos. Todo es puro (sin BD) para poder
 * probarlo y reutilizarlo en el cliente: jornada, periodo de prueba, vacaciones,
 * estados de asistencia y límites de adelantos.
 *
 * Referencias: D. Leg. 728 (contratos y periodo de prueba), D. Leg. 854 (jornada máxima
 * de 48 h semanales), D. Leg. 713 y D. Leg. 1405 (vacaciones y su adelanto), D. Leg. 1086
 * (régimen MYPE: 15 días de vacaciones), Ley 28518 (prácticas: 6 h diarias, 30 semanales),
 * D. U. 044-2019 (Vida Ley desde el primer día).
 */

export type ContractTypeCode = "Indeterminado" | "PlazoFijo" | "TiempoParcial" | "Practicas" | "LocacionServicios";
export type LaborRegimeCode = "General" | "Pequena" | "Micro";
export type PensionSystemCode = "ONP" | "AFP" | "Ninguno";
export type LeaveTypeCode =
  | "Vacaciones"
  | "DescansoMedico"
  | "LicenciaMaternidad"
  | "LicenciaPaternidad"
  | "LicenciaFallecimiento"
  | "PermisoPersonal"
  | "LicenciaSinGoce";
export type InsuranceTypeCode = "EsSalud" | "EPS" | "SCTR" | "VidaLey" | "SeguroPrivado";
export type AdvanceStatusCode = "Pendiente" | "Aprobado" | "Rechazado" | "Pagado" | "Liquidado" | "Anulado";
export type RequestStatusCode = "Pendiente" | "Aprobada" | "Rechazada" | "Anulada";

export const CONTRACT_TYPE_LABEL: Record<ContractTypeCode, string> = {
  Indeterminado: "Plazo indeterminado",
  PlazoFijo: "Plazo fijo (sujeto a modalidad)",
  TiempoParcial: "Tiempo parcial",
  Practicas: "Convenio de prácticas",
  LocacionServicios: "Locación de servicios",
};

export const LABOR_REGIME_LABEL: Record<LaborRegimeCode, string> = {
  General: "Régimen general",
  Pequena: "MYPE – Pequeña empresa",
  Micro: "MYPE – Microempresa",
};

export const PENSION_SYSTEM_LABEL: Record<PensionSystemCode, string> = {
  ONP: "ONP (Sistema Nacional de Pensiones)",
  AFP: "AFP (Sistema Privado de Pensiones)",
  Ninguno: "No aplica",
};

export const AFP_NAMES = ["Habitat", "Integra", "Prima", "Profuturo"] as const;

export const LEAVE_TYPE_LABEL: Record<LeaveTypeCode, string> = {
  Vacaciones: "Vacaciones",
  DescansoMedico: "Descanso médico",
  LicenciaMaternidad: "Licencia por maternidad",
  LicenciaPaternidad: "Licencia por paternidad",
  LicenciaFallecimiento: "Licencia por fallecimiento de familiar",
  PermisoPersonal: "Permiso personal (con goce)",
  LicenciaSinGoce: "Licencia sin goce de haber",
};

export const INSURANCE_TYPE_LABEL: Record<InsuranceTypeCode, string> = {
  EsSalud: "EsSalud",
  EPS: "EPS (Entidad Prestadora de Salud)",
  SCTR: "SCTR (trabajo de riesgo)",
  VidaLey: "Seguro Vida Ley",
  SeguroPrivado: "Seguro privado",
};

export const ADVANCE_STATUS_LABEL: Record<AdvanceStatusCode, string> = {
  Pendiente: "Pendiente",
  Aprobado: "Aprobado",
  Rechazado: "Rechazado",
  Pagado: "Entregado",
  Liquidado: "Descontado",
  Anulado: "Anulado",
};

/** Remuneración mínima vital vigente (S/). Actualízala cuando cambie por decreto. */
export const MINIMUM_WAGE = 1130;
/** Aporte de EsSalud a cargo del empleador sobre la remuneración (mínimo sobre la RMV). */
export const ESSALUD_RATE = 0.09;
export const MAX_WEEKLY_HOURS = 48;
/** Tiempo parcial: menos de 4 h diarias en promedio (D. S. 001-96-TR, art. 12). */
export const PART_TIME_MAX_DAILY_AVG_HOURS = 4;
export const INTERN_MAX_DAILY_HOURS = 6;
export const INTERN_MAX_WEEKLY_HOURS = 30;
/** Minutos de tolerancia antes de considerar tardanza. */
export const LATE_TOLERANCE_MINUTES = 10;
/** Un adelanto no puede superar este porcentaje del sueldo básico. */
export const MAX_ADVANCE_RATIO = 0.5;
export const MAX_ADVANCE_INSTALLMENTS = 3;
/** Días antes del vencimiento de un contrato para alertar su renovación. */
export const CONTRACT_EXPIRY_ALERT_DAYS = 30;

/** Contratos que son relación laboral (no locación de servicios). */
export function isEmployment(type: ContractTypeCode): boolean {
  return type !== "LocacionServicios";
}

/** Los contratos a plazo fijo, de prácticas y de locación tienen fecha de término. */
export function requiresEndDate(type: ContractTypeCode): boolean {
  return type === "PlazoFijo" || type === "Practicas" || type === "LocacionServicios";
}

/** Periodo de prueba legal de 3 meses (solo contratos laborales de jornada completa). */
export function hasTrialPeriod(type: ContractTypeCode): boolean {
  return type === "Indeterminado" || type === "PlazoFijo";
}

/** Días de vacaciones por año completo de servicios. */
export function annualVacationDays(regime: LaborRegimeCode, type: ContractTypeCode): number {
  if (type === "LocacionServicios" || type === "TiempoParcial") return 0; // sin derecho a vacaciones
  if (type === "Practicas") return 15; // descanso de 15 días por año de convenio
  return regime === "General" ? 30 : 15;
}

// ---------------------------------------------------------------------------
// Fechas "YYYY-MM-DD" (UTC, sin desfases por zona horaria)
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const isoToMs = (iso: string) => Date.parse(`${iso}T00:00:00.000Z`);
const msToIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDaysIso(iso: string, days: number): string {
  return msToIso(isoToMs(iso) + days * DAY_MS);
}

/** Suma meses de calendario (31-ene + 1 mes = 28/29-feb). */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Días calendario entre dos fechas, ambas incluidas. */
export function daysInclusive(from: string, to: string): number {
  return Math.round((isoToMs(to) - isoToMs(from)) / DAY_MS) + 1;
}

/** Meses completos de servicio entre `from` y `to`. */
export function fullMonthsBetween(from: string, to: string): number {
  if (to < from) return 0;
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) months--;
  return Math.max(0, months);
}

/** Día de la semana con lunes = 0 … domingo = 6. */
export function weekdayOf(iso: string): number {
  return (new Date(isoToMs(iso)).getUTCDay() + 6) % 7;
}

/** Fin del periodo de prueba de 3 meses (el día anterior a cumplir los 3 meses). */
export function trialEndFor(startDate: string): string {
  return addDaysIso(addMonthsIso(startDate, 3), -1);
}

// ---------------------------------------------------------------------------
// Horario pactado
// ---------------------------------------------------------------------------

export const WEEKDAY_LABEL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

export interface TemplateTimes {
  id: number;
  name: string;
  /** "HH:MM" */
  start_time: string;
  /** "HH:MM"; menor que el inicio = termina al día siguiente. */
  end_time: string;
}

export interface ScheduleDayInput {
  weekday: number;
  template_ids: number[];
}

export interface ScheduleSummary {
  weekly_hours: number;
  working_days: number;
  /** Horas por día de la semana (lunes primero). */
  daily_hours: number[];
  warnings: string[];
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Intervalo del turno en minutos desde el inicio del día; los nocturnos pasan de 1440. */
export function shiftWindow(start: string, end: string): { from: number; to: number } {
  const from = toMinutes(start);
  let to = toMinutes(end);
  if (to <= from) to += 1440;
  return { from, to };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Valida el horario semanal pactado contra el tipo de contrato y devuelve su resumen.
 * Lanza `Error` con un mensaje claro si incumple la ley.
 */
export function evaluateSchedule(
  type: ContractTypeCode,
  days: ScheduleDayInput[],
  templates: ReadonlyMap<number, TemplateTimes>,
): ScheduleSummary {
  const daily = Array<number>(7).fill(0);
  const seen = new Set<number>();
  for (const day of days) {
    if (!Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6) {
      throw new Error("Día de la semana inválido en el horario");
    }
    if (seen.has(day.weekday)) throw new Error(`${WEEKDAY_LABEL[day.weekday]} está repetido en el horario`);
    seen.add(day.weekday);

    const windows = [...new Set(day.template_ids)].map((id) => {
      const t = templates.get(id);
      if (!t) throw new Error("Algún turno base del horario no existe o está inactivo");
      return { name: t.name, ...shiftWindow(t.start_time, t.end_time) };
    });
    windows.sort((a, b) => a.from - b.from);
    for (let i = 1; i < windows.length; i++) {
      if (windows[i].from < windows[i - 1].to) {
        throw new Error(`${WEEKDAY_LABEL[day.weekday]}: «${windows[i - 1].name}» y «${windows[i].name}» se cruzan`);
      }
    }
    daily[day.weekday] = round2(windows.reduce((sum, w) => sum + (w.to - w.from) / 60, 0));
  }

  const workingDays = daily.filter((h) => h > 0).length;
  const weekly = round2(daily.reduce((a, b) => a + b, 0));
  const warnings: string[] = [];

  if (workingDays === 0) throw new Error("El horario debe tener al menos un día de trabajo");
  if (isEmployment(type) && workingDays === 7) {
    throw new Error("El horario debe dejar al menos un día de descanso semanal obligatorio (24 h)");
  }
  if (weekly > MAX_WEEKLY_HOURS) {
    throw new Error(`La jornada semanal (${weekly} h) supera el máximo legal de ${MAX_WEEKLY_HOURS} h`);
  }
  if (type === "TiempoParcial" && weekly / workingDays >= PART_TIME_MAX_DAILY_AVG_HOURS) {
    throw new Error(
      `Un contrato a tiempo parcial debe promediar menos de ${PART_TIME_MAX_DAILY_AVG_HOURS} h diarias ` +
        `(este horario promedia ${round2(weekly / workingDays)} h)`,
    );
  }
  if (type === "Practicas") {
    const over = daily.findIndex((h) => h > INTERN_MAX_DAILY_HOURS);
    if (over >= 0) throw new Error(`Prácticas: ${WEEKDAY_LABEL[over]} supera las ${INTERN_MAX_DAILY_HOURS} h diarias`);
    if (weekly > INTERN_MAX_WEEKLY_HOURS) {
      throw new Error(`Prácticas: la jornada semanal (${weekly} h) supera las ${INTERN_MAX_WEEKLY_HOURS} h`);
    }
  }
  daily.forEach((h, i) => {
    if (h > 8) warnings.push(`${WEEKDAY_LABEL[i]} tiene ${h} h: compénsalo para no pasar de 48 h semanales`);
  });
  return { weekly_hours: weekly, working_days: workingDays, daily_hours: daily, warnings };
}

// ---------------------------------------------------------------------------
// Vacaciones
// ---------------------------------------------------------------------------

export interface VacationBalance {
  annual_days: number;
  months_of_service: number;
  completed_years: number;
  /** Días ganados por años completos (récord vacacional cumplido). */
  earned_days: number;
  /** Días proporcionales del año en curso (solo se pueden tomar como adelanto). */
  accrued_current_year: number;
  /** Días ya tomados o solicitados (pendientes y aprobados). */
  used_days: number;
  /** Días que se pueden gozar sin adelanto. */
  available_days: number;
  /** Máximo que se puede pedir sumando el adelanto. */
  max_with_advance: number;
}

export function vacationBalance(params: {
  annualDays: number;
  serviceStart: string;
  today: string;
  usedDays: number;
}): VacationBalance {
  const months = fullMonthsBetween(params.serviceStart, params.today);
  const years = Math.floor(months / 12);
  const earned = years * params.annualDays;
  const accrued = Math.floor(((months % 12) * params.annualDays) / 12);
  return {
    annual_days: params.annualDays,
    months_of_service: months,
    completed_years: years,
    earned_days: earned,
    accrued_current_year: accrued,
    used_days: params.usedDays,
    available_days: Math.max(0, earned - params.usedDays),
    max_with_advance: Math.max(0, earned + accrued - params.usedDays),
  };
}

export type VacationCheck = { ok: true; isAdvance: boolean } | { ok: false; error: string };

/** ¿Se pueden pedir `days` días de vacaciones con este saldo? (`allowAdvance` = el trabajador acepta el adelanto). */
export function checkVacationRequest(balance: VacationBalance, days: number, allowAdvance: boolean): VacationCheck {
  if (balance.annual_days === 0) return { ok: false, error: "Este tipo de contrato no genera derecho a vacaciones" };
  if (days <= balance.available_days) return { ok: true, isAdvance: false };
  if (days > balance.max_with_advance) {
    return {
      ok: false,
      error:
        `Solo puede pedir hasta ${balance.max_with_advance} día(s): ${balance.available_days} ganado(s) ` +
        `y ${balance.max_with_advance - balance.available_days} de adelanto proporcional`,
    };
  }
  if (!allowAdvance) {
    return {
      ok: false,
      error:
        `Tiene ${balance.available_days} día(s) ganado(s). Los ${days - balance.available_days} restantes serían ` +
        "adelanto de vacaciones: marca la opción de adelanto para solicitarlo",
    };
  }
  return { ok: true, isAdvance: true };
}

// ---------------------------------------------------------------------------
// Asistencia
// ---------------------------------------------------------------------------

export type AttendanceStatus =
  | "Descanso"
  | "Licencia"
  | "Programado"
  | "Sin marcar"
  | "En turno"
  | "Puntual"
  | "Tardanza"
  | "Falta"
  | "Justificada"
  | "Sin salida"
  | "Extra";

export interface DayEvaluation {
  status: AttendanceStatus;
  scheduled_minutes: number;
  late_minutes: number;
  worked_minutes: number;
  extra_minutes: number;
  /** "HH:MM" de la primera entrada programada y la última salida (puede ser del día siguiente). */
  expected_start: string | null;
  expected_end: string | null;
}

/** Lima es UTC-5 todo el año. */
const LIMA_OFFSET_MIN = 5 * 60;

/** Minutos de `ts` contados desde la medianoche (hora de Lima) de `date`. */
export function minutesSinceDayStart(date: string, ts: Date): number {
  return Math.floor((ts.getTime() - isoToMs(date)) / 60_000) - LIMA_OFFSET_MIN;
}

/** Instante (UTC) que corresponde a `minutes` desde la medianoche de Lima de `date`. */
export function instantAt(date: string, minutes: number): Date {
  return new Date(isoToMs(date) + (minutes + LIMA_OFFSET_MIN) * 60_000);
}

export function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Estado del día de un empleado comparando su marcación con los turnos asignados.
 * `now` decide si un turno sin marcar todavía está por empezar o ya es falta.
 */
export function evaluateDay(params: {
  date: string;
  shifts: Array<{ start_time: string; end_time: string }>;
  checkIn: Date | null;
  checkOut: Date | null;
  justified: boolean;
  onLeave: boolean;
  now: Date;
}): DayEvaluation {
  const windows = params.shifts.map((s) => shiftWindow(s.start_time, s.end_time)).sort((a, b) => a.from - b.from);
  const scheduled = windows.reduce((sum, w) => sum + (w.to - w.from), 0);
  const first = windows[0]?.from ?? null;
  const last = windows.length ? Math.max(...windows.map((w) => w.to)) : null;
  const nowMin = minutesSinceDayStart(params.date, params.now);
  const inMin = params.checkIn ? minutesSinceDayStart(params.date, params.checkIn) : null;
  const outMin = params.checkOut ? minutesSinceDayStart(params.date, params.checkOut) : null;
  const worked = inMin != null && outMin != null ? Math.max(0, outMin - inMin) : 0;
  const late = first != null && inMin != null ? Math.max(0, inMin - first) : 0;

  const base = {
    scheduled_minutes: scheduled,
    late_minutes: late,
    worked_minutes: worked,
    extra_minutes: scheduled > 0 ? Math.max(0, worked - scheduled) : worked,
    expected_start: first != null ? hhmm(first) : null,
    expected_end: last != null ? hhmm(last) : null,
  };

  if (params.onLeave) return { ...base, status: "Licencia", late_minutes: 0 };
  if (first == null || last == null) {
    return { ...base, status: inMin != null ? "Extra" : "Descanso" };
  }
  if (inMin == null) {
    if (nowMin >= last) return { ...base, status: params.justified ? "Justificada" : "Falta" };
    if (nowMin > first + LATE_TOLERANCE_MINUTES) return { ...base, status: "Sin marcar" };
    return { ...base, status: "Programado" };
  }
  const isLate = late > LATE_TOLERANCE_MINUTES;
  if (outMin == null) {
    // Dos horas de gracia tras el fin del turno para marcar la salida.
    if (nowMin >= last + 120) return { ...base, status: "Sin salida" };
    return { ...base, status: "En turno" };
  }
  if (isLate) return { ...base, status: params.justified ? "Justificada" : "Tardanza" };
  return { ...base, status: "Puntual" };
}

// ---------------------------------------------------------------------------
// Adelantos de sueldo
// ---------------------------------------------------------------------------

export function maxAdvanceAmount(baseSalary: number): number {
  return Math.floor(baseSalary * MAX_ADVANCE_RATIO * 100) / 100;
}

export function installmentAmount(amount: number, installments: number): number {
  return Math.round((amount / installments) * 100) / 100;
}

/** Aporte mensual de EsSalud del empleador (9 % con base mínima de la RMV). */
export function essaludContribution(baseSalary: number): number {
  return Math.round(Math.max(baseSalary, MINIMUM_WAGE) * ESSALUD_RATE * 100) / 100;
}
