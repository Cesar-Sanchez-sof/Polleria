/**
 * Validación y formateo de series y comprobantes de pago según la normativa SUNAT.
 *
 * En la normativa de comprobantes de pago electrónicos de SUNAT:
 * - Boleta de Venta Electrónica: Serie alfanumérica de 4 caracteres que inicia con 'B' seguida de 3 dígitos (B###, ej. B001, B002).
 * - Factura Electrónica: Serie alfanumérica de 4 caracteres que inicia con 'F' seguida de 3 dígitos (F###, ej. F001, F002).
 * - Correlativo: Número entero positivo secuencial formateado a 8 dígitos (ej. 00000001).
 */

export const BOLETA_SERIES_REGEX = /^B\d{3}$/;
export const FACTURA_SERIES_REGEX = /^F\d{3}$/;
export const TICKET_SERIES_REGEX = /^T\d{3}$/;

/**
 * Valida si una serie de comprobante cumple con el formato autorizado por SUNAT.
 *
 * @param series Serie a validar (ej: 'B001', 'B002', 'F001')
 * @param voucherType Tipo de comprobante opcional ('Boleta', 'Factura', 'Ticket')
 * @returns true si la serie es válida según el estándar SUNAT
 */
export function isValidVoucherSeries(
  series: unknown,
  voucherType?: "Boleta" | "Factura" | "Ticket" | string
): boolean {
  if (typeof series !== "string") return false;
  const cleanSeries = series.trim().toUpperCase();

  const type = voucherType?.toLowerCase();
  if (type === "boleta") {
    return BOLETA_SERIES_REGEX.test(cleanSeries);
  }
  if (type === "factura") {
    return FACTURA_SERIES_REGEX.test(cleanSeries);
  }
  if (type === "ticket") {
    return TICKET_SERIES_REGEX.test(cleanSeries) || /^[A-Z0-9]{4}$/.test(cleanSeries);
  }

  // Si no se especifica tipo, debe ser serie SUNAT válida (B### o F###)
  return BOLETA_SERIES_REGEX.test(cleanSeries) || FACTURA_SERIES_REGEX.test(cleanSeries);
}

/**
 * Formatea el código completo del comprobante (Serie-Correlativo de 8 dígitos SUNAT).
 * Ejemplo: formatVoucherCode('B002', 1) => 'B002-00000001'
 */
export function formatVoucherCode(series: string, number: number, padLength: number = 8): string {
  const cleanSeries = (series || "").trim().toUpperCase();
  const safeNumber = Math.max(0, Math.floor(Number(number) || 0));
  return `${cleanSeries}-${String(safeNumber).padStart(padLength, "0")}`;
}
