/**
 * Date utilities for the accounting journal entries API and database operations.
 *
 * `entryDate` (`fecha_contable`) is a `@db.Date` column: it is stored as a pure
 * date, so it must be read and written in UTC to prevent timezone day shifts.
 *
 * Zona horaria oficial para Trujillo, La Libertad y todo el territorio de Perú:
 * `America/Lima` (UTC-5 sin horario de verano).
 */

export const PERU_TIMEZONE = "America/Lima";

/** Converts "YYYY-MM-DD" to a `Date` at midnight UTC. */
export function parseUtcDate(isoString: string): Date {
  const [year, month, day] = isoString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Returns "YYYY-MM-DD" from a date stored as `@db.Date`, without timezone shifts. */
export function formatDateToIso(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Retorna la fecha y hora actual convertida a la zona horaria oficial de Perú (Trujillo, La Libertad / America/Lima, UTC-5).
 */
export function nowInPeru(): Date {
  const now = new Date();
  const peruString = now.toLocaleString("en-US", { timeZone: PERU_TIMEZONE });
  return new Date(peruString);
}

/**
 * Formatea una fecha a cadena estándar peruana (DD/MM/YYYY HH:mm:ss).
 */
export function formatPeruDateTime(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: PERU_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}
