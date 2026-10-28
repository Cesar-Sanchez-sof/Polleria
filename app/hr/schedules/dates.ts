/** Utilidades de fechas "YYYY-MM-DD" para el calendario semanal (siempre en UTC, sin desfases por zona horaria). */

export const DAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
const DAYS_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;
const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/** Hoy en Lima (UTC-5). */
export function todayLima(): string {
  return toIso(new Date(Date.now() - 5 * 60 * 60 * 1000));
}

export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** Lunes de la semana que contiene la fecha. */
export function mondayOf(iso: string): string {
  const weekday = (toDate(iso).getUTCDay() + 6) % 7; // lunes = 0
  return addDays(iso, -weekday);
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Ej.: "lunes 2 de noviembre". */
export function formatLong(iso: string): string {
  const d = toDate(iso);
  return `${DAYS_LONG[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} de ${MONTHS_LONG[d.getUTCMonth()]}`;
}

/** Igual que `formatLong` con la primera letra en mayúscula: "Lunes 2 de noviembre". */
export function formatLongCap(iso: string): string {
  const t = formatLong(iso);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Ej.: "2 – 8 nov 2026" o "28 oct – 3 nov 2026". */
export function formatWeekRange(monday: string): string {
  const a = toDate(monday);
  const b = toDate(addDays(monday, 6));
  const left = a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}` : `${a.getUTCDate()} ${MONTHS_SHORT[a.getUTCMonth()]}`;
  return `${left} – ${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}

export function dayNumber(iso: string): number {
  return toDate(iso).getUTCDate();
}