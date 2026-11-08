import { Prisma } from "@prisma/client";
import { UserError } from "@/lib/services/security/users.service";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";

/** Hoy en Lima (UTC-5) como "YYYY-MM-DD". */
export function todayLimaIso(now: Date = new Date()): string {
  return new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Hoy en Lima como valor para columnas `@db.Date`. */
export function todayLimaDate(now: Date = new Date()): Date {
  return parseUtcDate(todayLimaIso(now));
}

/** "HH:MM" de una columna `@db.Time` (se guarda como 1970-01-01 en UTC). */
export function formatTime(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

export function toTimeColumn(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

export const RE_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Texto limpio (sin espacios repetidos) con largo máximo; `null` si viene vacío. */
export function text(value: unknown, field: string, max: number, required = false): string | null {
  const t = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!t) {
    if (required) throw new UserError(`${field} es obligatorio`);
    return null;
  }
  if (t.length > max) throw new UserError(`${field} no puede superar ${max} caracteres`);
  return t;
}

/** "YYYY-MM-DD" validado; `null` si viene vacío. */
export function isoDate(value: unknown, field: string, required = false): string | null {
  const t = typeof value === "string" ? value.trim() : "";
  if (!t) {
    if (required) throw new UserError(`${field} es obligatoria`);
    return null;
  }
  const d = /^\d{4}-\d{2}-\d{2}$/.test(t) ? parseUtcDate(t) : null;
  if (!d || Number.isNaN(d.getTime()) || formatDateToIso(d) !== t) {
    throw new UserError(`${field} no es una fecha válida`);
  }
  return t;
}

export function money(value: unknown, field: string, { min = 0, max = 99_999_999.99 } = {}): number {
  const n = value === "" || value == null ? NaN : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new UserError(`${field} debe ser un monto válido`);
  return Math.round(n * 100) / 100;
}

export function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new UserError(`${field} no es válido`);
  }
  return value as T;
}

export function positiveId(value: unknown, field = "El identificador"): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new UserError(`${field} no es válido`);
  return n;
}

export const dateOrNull = (d: Date | null | undefined) => (d ? formatDateToIso(d) : null);

export function fullName(e: {
  firstName: string;
  middleName?: string | null;
  paternalLastName: string;
  maternalLastName?: string | null;
}): string {
  return [e.firstName, e.middleName, e.paternalLastName, e.maternalLastName].filter(Boolean).join(" ");
}

export const shortName = (e: { firstName: string; paternalLastName: string }) => `${e.firstName} ${e.paternalLastName}`;

/** Filtro de contrato vigente que cubre la fecha indicada. */
export function contractCovering(date: Date): Prisma.EmploymentContractWhereInput {
  return {
    status: "Vigente",
    startDate: { lte: date },
    OR: [{ endDate: null }, { endDate: { gte: date } }],
  };
}

/** Filtro de licencias aprobadas que se cruzan con el rango [from, to]. */
export function approvedLeaveOverlapping(from: Date, to: Date): Prisma.LeaveRequestWhereInput {
  return { status: "Aprobada", startDate: { lte: to }, endDate: { gte: from } };
}

export type Tx = Prisma.TransactionClient;
