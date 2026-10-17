/** Formatting helpers shared by every PLE book. Money is handled in integer cents. */

/** Converts a monetary amount to integer cents without floating point drift. */
export function toCents(amount: number | string | null | undefined): number {
  const value = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100 + Math.sign(value) * 1e-7);
}

/** Formats integer cents as "123.45" (dot decimal, two decimals, no thousands separator). */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const units = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}${units}.${rest}`;
}

export function formatMoney(amount: number | string | null | undefined): string {
  return formatCents(toCents(amount));
}

/** Exchange rate with three decimals (`#.###`). */
export function formatRate(rate: number): string {
  return rate.toFixed(3);
}

/** "2026-10-05" becomes "05/10/2026". Returns "" when the input is not an ISO date. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

/** Period field: YYYYMM00 (monthly books). */
export function formatPeriod(year: number, month: number): string {
  return `${year}${String(month).padStart(2, "0")}00`;
}

/** Whole calendar months from `fromIso` to `toIso`, ignoring the day. */
export function monthsBetween(fromIso: string, toIso: string): number {
  const [fy, fm] = fromIso.split("-").map(Number);
  const [ty, tm] = toIso.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export interface SanitizedText {
  text: string;
  truncated: boolean;
}

/**
 * Removes characters that break the PLE layout (pipe, ampersand, line breaks,
 * control characters), collapses whitespace and truncates to `maxLength`.
 */
export function sanitizeText(value: string, maxLength: number): SanitizedText {
  const cleaned = value
    .replace(/[|&]/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= maxLength) return { text: cleaned, truncated: false };
  return { text: cleaned.slice(0, maxLength).trim(), truncated: true };
}

/** Keeps only digits and left-pads with zeros up to `length`. */
export function padNumber(value: number | string, length: number): string {
  return String(value).replace(/\D/g, "").padStart(length, "0");
}

/** First and last calendar day of a month as ISO strings. */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

export function isoInMonth(iso: string, year: number, month: number): boolean {
  return iso.startsWith(`${year}-${String(month).padStart(2, "0")}-`);
}
