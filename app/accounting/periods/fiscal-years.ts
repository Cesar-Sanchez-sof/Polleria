/**
 * Utilidades para agrupar y filtrar períodos contables por **año fiscal**.
 *
 * En Perú el año fiscal coincide con el año calendario (enero – diciembre),
 * y los períodos contables se guardan con límites en UTC, por lo que el año
 * fiscal de un período se deriva siempre con `getUTCFullYear()` sobre su
 * `startDate`.
 */

export interface AccountingPeriod {
  id: number;
  startDate: string;
  endDate: string;
  status: string;
}

/** Resumen de todos los períodos que caen dentro de un mismo año fiscal. */
export interface FiscalYearGroup {
  /** Año fiscal (enero–diciembre). */
  year: number;
  /** Períodos del año, ordenados cronológicamente (enero → diciembre). */
  periods: AccountingPeriod[];
  /** Cantidad de períodos en estado `OPEN`. */
  open: number;
  /** Cantidad de períodos en estado `CLOSED`. */
  closed: number;
}

/** Año fiscal en curso (UTC). */
export function currentFiscalYear(now: Date = new Date()): number {
  return now.getUTCFullYear();
}

/** Año fiscal al que pertenece un período, a partir de su `startDate`. */
export function fiscalYearOf(startDate: string): number {
  const date = new Date(startDate);
  return Number.isNaN(date.getTime()) ? NaN : date.getUTCFullYear();
}

/** Etiqueta en español del estado de un período. */
export function statusLabel(status: string): string {
  if (status === "OPEN") return "Abierto";
  if (status === "CLOSED") return "Cerrado";
  return status;
}

/**
 * Filtra períodos por año fiscal. `null` o `NaN` devuelve la lista completa.
 */
export function filterByFiscalYear(
  periods: readonly AccountingPeriod[],
  year: number | null | undefined
): AccountingPeriod[] {
  if (year === null || year === undefined || Number.isNaN(year)) return [...periods];
  return periods.filter((p) => fiscalYearOf(p.startDate) === year);
}

/**
 * Agrupa los períodos por año fiscal, de más reciente a más antiguo.
 * Los períodos de cada grupo quedan ordenados por `startDate` ascendente.
 * Los períodos con fecha inválida se descartan.
 */
export function groupByFiscalYear(
  periods: readonly AccountingPeriod[]
): FiscalYearGroup[] {
  const groups = new Map<number, FiscalYearGroup>();

  for (const period of periods) {
    const year = fiscalYearOf(period.startDate);
    if (Number.isNaN(year)) continue;

    const group = groups.get(year) ?? { year, periods: [], open: 0, closed: 0 };
    group.periods.push(period);
    if (period.status === "OPEN") group.open += 1;
    else if (period.status === "CLOSED") group.closed += 1;
    groups.set(year, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      periods: [...group.periods].sort(
        (a, b) => Date.parse(a.startDate) - Date.parse(b.startDate)
      ),
    }))
    .sort((a, b) => b.year - a.year);
}

/**
 * Años fiscales disponibles para el selector de filtro, en orden descendente.
 * Siempre incluye el año en curso, aunque todavía no tenga períodos.
 */
export function availableFiscalYears(
  periods: readonly AccountingPeriod[],
  now: Date = new Date()
): number[] {
  const years = new Set<number>([currentFiscalYear(now)]);
  for (const period of periods) {
    const year = fiscalYearOf(period.startDate);
    if (!Number.isNaN(year)) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

/** Formatea una fecha ISO mostrando el día en UTC (coincide con el período real). */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("es-PE", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
