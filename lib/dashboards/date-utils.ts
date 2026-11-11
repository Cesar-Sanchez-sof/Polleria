/**
/**
 * Utilidades de cálculo y formateo de fechas en zona horaria America/Lima (UTC-5)
 * para el Constructor de Dashboards.
 * 
 * Regla de negocio: Toda agrupación y filtrado por defecto de fechas se calcula
 * estrictamente en zona horaria peruana, evitando cualquier desfase con toISOString().
 */

import type { WidgetDateRange, DatePreset } from "./widget-schema";

export interface LimaDateParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number;// 0-59
}

/**
 * Formatea una fecha UTC base a string 'YYYY-MM-DD'.
 */
function formatUtcYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Extrae los componentes de fecha y hora en America/Lima para una fecha dada (o ahora).
 */
export function getLimaDateParts(refDate: Date = new Date()): LimaDateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // El formato "en-CA" devuelve "YYYY-MM-DD, HH:MM" o "YYYY-MM-DD HH:MM"
  const formatted = formatter.format(refDate);
  const [datePart, timePart] = formatted.split(/[,\s]+/);
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart || "00:00").split(":").map(Number);

  return { year, month, day, hour, minute };
}

/**
 * Devuelve el rango del mes actual en formato ['YYYY-MM-DD', 'YYYY-MM-DD'] en hora de Lima.
 */
export function getLimaCurrentMonthRange(refDate: Date = new Date()): [string, string] {
  const { year, month } = getLimaDateParts(refDate);
  const yStr = String(year);
  const mStr = String(month).padStart(2, "0");

  const startDay = `${yStr}-${mStr}-01`;
  // Último día del mes (mes en Date constructor es 0-indexed, pasando mes siguiente con día 0 da el último día del mes)
  const lastDayNum = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDay = `${yStr}-${mStr}-${String(lastDayNum).padStart(2, "0")}`;

  return [startDay, endDay];
}

/**
 * Devuelve el rango de hoy en formato ['YYYY-MM-DD', 'YYYY-MM-DD'] en hora de Lima.
 */
export function getLimaTodayRange(refDate: Date = new Date()): [string, string] {
  const { year, month, day } = getLimaDateParts(refDate);
  const yStr = String(year);
  const mStr = String(month).padStart(2, "0");
  const dStr = String(day).padStart(2, "0");
  const todayStr = `${yStr}-${mStr}-${dStr}`;

  return [todayStr, todayStr];
}

/**
 * NOTA DE ARQUITECTURA: El endpoint público /share debe usar esta misma función en el servidor
 * para resolver dateRange dinámicamente según la hora de Lima antes de despachar consultas analíticas.
 *
 * Resuelve un WidgetDateRange con preset relativo a un rango concreto ['YYYY-MM-DD', 'YYYY-MM-DD']
 * estrictamente en zona horaria America/Lima (UTC-5), sin usar nunca toISOString().
 */
export function resolveDateRange(
  dateRange: WidgetDateRange,
  refDate: Date = new Date()
): [string, string] {
  const parts = getLimaDateParts(refDate);
  const todayUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const todayStr = formatUtcYmd(todayUtc);

  switch (dateRange.preset) {
    case "today": {
      return [todayStr, todayStr];
    }
    case "yesterday": {
      const yesterdayUtc = new Date(todayUtc.getTime() - 86400000);
      const yStr = formatUtcYmd(yesterdayUtc);
      return [yStr, yStr];
    }
    case "last7": {
      // Últimos 7 días inclusivos: hoy y 6 días previos
      const startUtc = new Date(todayUtc.getTime() - 6 * 86400000);
      return [formatUtcYmd(startUtc), todayStr];
    }
    case "last30": {
      // Últimos 30 días inclusivos: hoy y 29 días previos
      const startUtc = new Date(todayUtc.getTime() - 29 * 86400000);
      return [formatUtcYmd(startUtc), todayStr];
    }
    case "thisMonth": {
      return getLimaCurrentMonthRange(refDate);
    }
    case "lastMonth": {
      let prevYear = parts.year;
      let prevMonth = parts.month - 1;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
      }
      const yStr = String(prevYear);
      const mStr = String(prevMonth).padStart(2, "0");
      const startDay = `${yStr}-${mStr}-01`;
      const lastDayNum = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
      const endDay = `${yStr}-${mStr}-${String(lastDayNum).padStart(2, "0")}`;
      return [startDay, endDay];
    }
    case "thisYear": {
      const yStr = String(parts.year);
      return [`${yStr}-01-01`, `${yStr}-12-31`];
    }
    case "custom": {
      const from = dateRange.from?.trim() || todayStr;
      const to = dateRange.to?.trim() || todayStr;
      return [from, to];
    }
    default: {
      return [todayStr, todayStr];
    }
  }
}
