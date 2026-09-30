/**
 * Date utilities for the accounting journal entries API.
 *
 * `entryDate` (`fecha_contable`) is a `@db.Date` column: it is stored as a pure
 * date, so it must be read and written in UTC to prevent timezone day shifts.
 */

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

// Backward-compatibility aliases
export const fechaUTC = parseUtcDate;
export const fechaAISO = formatDateToIso;
