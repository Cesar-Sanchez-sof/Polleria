/**
 * Reglas de cierre contable, sin acceso a la base de datos para que se puedan probar solas.
 *
 * - Un periodo cerrado no admite asientos nuevos, ni manuales ni automáticos.
 * - Antes de cerrar se revisa que ningún asiento vigente esté descuadrado ni vacío.
 * - Al cerrar el último periodo del año (diciembre) se traslada el resultado a Resultados acumulados
 *   con un asiento de cierre. No hay asiento de apertura: los saldos del balance se arrastran solos
 *   porque cada reporte suma todos los asientos hasta su fecha de corte.
 */

/** Libro (diario) en el que se registra el asiento de cierre del ejercicio. */
export const CLOSING_BOOK = "Cierre del ejercicio";

/** Cuenta que recibe el resultado del ejercicio al cerrar el año. */
export const RETAINED_EARNINGS_CODE = "591";

const PROFIT_AND_LOSS_TYPES = ["Ingreso", "Gasto", "Costo"];

const CENT = 0.005;

/** Se lanza al intentar registrar un asiento en un periodo cerrado. */
export class ClosedPeriodError extends Error {
  constructor(message = "El período contable de esa fecha está cerrado. Reábrelo para registrar movimientos.") {
    super(message);
    this.name = "ClosedPeriodError";
  }
}

/** Se lanza cuando un periodo no puede cerrarse porque tiene asientos con problemas. */
export class PeriodClosingError extends Error {
  constructor(public readonly issues: string[]) {
    super(`No se puede cerrar el período: ${issues.join(" ")}`);
    this.name = "PeriodClosingError";
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** El último periodo del año (el que termina en diciembre) es el que cierra el ejercicio. */
export function isYearEndPeriod(endDate: Date): boolean {
  return endDate.getUTCMonth() === 11;
}

export interface EntryTotals {
  code: string;
  debit: number;
  credit: number;
}

/** Problemas de los asientos vigentes de un periodo: descuadrados o sin líneas. */
export function findEntryIssues(entries: readonly EntryTotals[], emptyEntryCodes: readonly string[] = []): string[] {
  const issues: string[] = [];
  const unbalanced = entries.filter((e) => Math.abs(round2(e.debit) - round2(e.credit)) > CENT);
  if (unbalanced.length > 0) {
    issues.push(`Hay ${unbalanced.length} asiento(s) descuadrado(s): ${listCodes(unbalanced.map((e) => e.code))}.`);
  }
  if (emptyEntryCodes.length > 0) {
    issues.push(`Hay ${emptyEntryCodes.length} asiento(s) sin líneas: ${listCodes(emptyEntryCodes)}.`);
  }
  return issues;
}

function listCodes(codes: readonly string[]): string {
  const shown = codes.slice(0, 5).join(", ");
  return codes.length > 5 ? `${shown} y ${codes.length - 5} más` : shown;
}

export interface AccountBalanceRow {
  accountId: number;
  type: string;
  debit: number;
  credit: number;
}

export interface ClosingLine {
  accountId: number;
  debit: number;
  credit: number;
  description: string;
}

/**
 * Líneas del asiento de cierre: cada cuenta de ingreso, gasto o costo con saldo se lleva a cero y la
 * diferencia (utilidad o pérdida) va a Resultados acumulados. Devuelve `null` si no hay nada que cerrar.
 */
export function buildClosingLines(
  rows: readonly AccountBalanceRow[],
  retainedEarningsAccountId: number,
): { lines: ClosingLine[]; result: number } | null {
  const lines: ClosingLine[] = [];
  let result = 0;

  for (const row of rows) {
    if (!PROFIT_AND_LOSS_TYPES.includes(row.type)) continue;
    const net = round2(row.credit - row.debit); // > 0 saldo acreedor (ingreso), < 0 saldo deudor
    if (Math.abs(net) < CENT) continue;
    result = round2(result + net);
    lines.push(
      net > 0
        ? { accountId: row.accountId, debit: net, credit: 0, description: "Cierre de cuenta de ingresos" }
        : { accountId: row.accountId, debit: 0, credit: -net, description: "Cierre de cuenta de gastos y costos" },
    );
  }

  if (lines.length === 0) return null;

  if (Math.abs(result) >= CENT) {
    lines.push(
      result > 0
        ? { accountId: retainedEarningsAccountId, debit: 0, credit: result, description: "Utilidad del ejercicio" }
        : { accountId: retainedEarningsAccountId, debit: -result, credit: 0, description: "Pérdida del ejercicio" },
    );
  }
  return { lines, result };
}
