/**
 * Estado de Resultados por Función (Income Statement) — PCGE 2019 / NIIF.
 *
 * Cálculo puro y determinista (sin acceso a base de datos): el orquestador que
 * consulta `journal_entry_detail` vive en `lib/services/income-statement.service.ts`.
 *
 * Ver `specs/021-generar-estado-resultados/contracts/income-statement.md` para el
 * contrato completo (entradas, salidas y errores) y `research.md` para las
 * decisiones D1-D11.
 */

import { formatDateToIso, parseUtcDate } from "@/lib/dates";

/** Movimiento contable en crudo (desde BD o precargado). */
export interface MovementInput {
  account_code: string;
  debit?: number | null;
  credit?: number | null;
  date?: string;
  status?: boolean;
}

/** Saldo agregado por cuenta (Debe/Haber) antes de clasificarlo en una línea. */
export interface AccountBalance {
  code: string;
  name?: string;
  debit: number;
  credit: number;
}

/** Entrada del servicio (contrato §1.1). */
export interface IncomeStatementInput {
  companyId?: string | number;
  startDate: string;
  endDate: string;
  movements?: MovementInput[];
}

/** Entrada del cálculo puro: ya normalizada a saldos por cuenta. */
export interface IncomeStatementComputeInput {
  startDate: string;
  endDate: string;
  /** Pre-agregado (la capa de datos agrupa por cuenta). Tiene prioridad sobre `movements`. */
  balances?: AccountBalance[];
  /** Movimientos en crudo: se agregan y filtran dentro del cálculo. */
  movements?: MovementInput[];
}

/** Línea de reporte a la que pertenece una cuenta (matriz D5). */
export type ReportLine =
  | "ingresos-ordinarios"
  | "devoluciones-709"
  | "descuentos-74"
  | "costo-ventas-69"
  | "gastos-distribucion-95"
  | "gastos-administracion-94"
  | "ingresos-financieros-77"
  | "diferencia-cambio-ingreso-776"
  | "gastos-financieros-67"
  | "diferencia-cambio-gasto-676"
  | "otros-ingresos-75-76"
  | "otros-gastos-65-66"
  | "impuesto-88"
  | "otra";

/** Naturaleza del saldo según el elemento PCGE (FR-019). */
export type Naturaleza = "acreedora" | "deudora";

/** Moneda fija del reporte (sin configuración multi-moneda). */
export const CURRENCY = "PEN" as const;

export interface IncomeStatementLineItem {
  /** Saldo final de la línea: `credit - debit` o `debit - credit` según naturaleza. */
  amount: number;
  /** Saldo Haber acumulado de las cuentas de la línea. */
  credit: number;
  /** Saldo Debe acumulado de las cuentas de la línea. */
  debit: number;
  /** Naturaleza usada para saldar la línea (FR-019). */
  nature: Naturaleza;
}

export interface OperatingIncome {
  ordinary_income: number;
  sublease_and_other_income: number;
  total: number;
}

export interface SalesCosts {
  cost_of_goods_sold: number;
}

export interface GrossProfit {
  amount: number;
}

export interface OperatingExpenses {
  distribution: number;
  administrative: number;
  total: number;
}

export interface OperatingProfit {
  amount: number;
}

export interface OtherRevenuesAndExpenses {
  expenses: number;
  revenues: number;
  total: number;
}

export interface ExchangeDifferenceNet {
  amount: number;
}

export interface FinancialIncome {
  amount: number;
}

export interface FinancialExpenses {
  amount: number;
}

export interface ResultBeforeTaxes {
  amount: number;
}

export interface IncomeTaxExpense {
  amount: number;
}

export interface NetProfit {
  amount: number;
}

export interface PeriodRange {
  start_date: string;
  end_date: string;
}

/** Salida exacta del servicio (contrato §1.2). */
export interface IncomeStatementResult {
  operating_income: OperatingIncome;
  sales_costs: SalesCosts;
  gross_profit: GrossProfit;
  operating_expenses: OperatingExpenses;
  operating_profit: OperatingProfit;
  other_revenues_and_expenses: OtherRevenuesAndExpenses;
  exchange_difference_net: ExchangeDifferenceNet;
  financial_income: FinancialIncome;
  financial_expenses: FinancialExpenses;
  result_before_taxes: ResultBeforeTaxes;
  income_tax_expense: IncomeTaxExpense;
  net_profit: NetProfit;
  period: PeriodRange;
  currency: string;
}

/**
 * Redondea a 2 decimales de forma determinista (FR-021): usa aritmética decimal
 * aproximada con redondeo "half away from zero" en centavos, evitando el
 * `Number.EPSILON` que redondea mal en valores negativos (ver `research.md` D7).
 */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const cents = value * 100;
  const rounded = Math.sign(cents) * Math.round(Math.abs(cents) + 1e-9);
  return rounded / 100;
}

/**
 * Indica si el código representa una cuenta imputable (excluye cabeceras de
 * elemento, longitud 1). Los códigos de 2 dígitos sí son hojas en este catálogo
 * (`prisma/seed-accounts.ts`: todas las cuentas cuelgan directamente del
 * elemento), por lo que se incluyen para no perder "70", "69", "94", "95" u "88".
 */
export function isDetailAccount(code: string): boolean {
  return code.length >= 2;
}

/**
 * Valida que `value` sea una fecha real en formato estricto `AAAA-MM-DD`
 * (FR-003 / FR-004). `parseUtcDate` solo descompone, así que se exige que el
 * ciclo de ida y vuelta reproduzca exactamente la cadena ("2026-02-31" falla).
 */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return formatDateToIso(parseUtcDate(value)) === value;
}

/**
 * Naturaleza del saldo según el elemento PCGE (FR-019):
 * elemento 7 acreedora; elementos 6, 8 y 9 deudoras; el resto no participa.
 */
export function naturalezaDe(code: string): Naturaleza | null {
  switch (code.charAt(0)) {
    case "7":
      return "acreedora";
    case "6":
    case "8":
    case "9":
      return "deudora";
    default:
      return null;
  }
}

/**
 * Clasifica una cuenta en la línea del reporte según su código (matriz D5,
 * decisión D5: se clasifica por código, nunca por el campo `type` de la BD).
 */
export function lineaDe(code: string): ReportLine {
  if (code.startsWith("709")) return "devoluciones-709";
  if (code.startsWith("70")) return "ingresos-ordinarios";
  if (code.startsWith("74")) return "descuentos-74";
  if (code.startsWith("776")) return "diferencia-cambio-ingreso-776";
  if (code.startsWith("77")) return "ingresos-financieros-77";
  if (code.startsWith("75") || code.startsWith("76")) return "otros-ingresos-75-76";
  if (code.startsWith("69")) return "costo-ventas-69";
  if (code.startsWith("676")) return "diferencia-cambio-gasto-676";
  if (code.startsWith("67")) return "gastos-financieros-67";
  if (code.startsWith("65") || code.startsWith("66")) return "otros-gastos-65-66";
  if (code.startsWith("94")) return "gastos-administracion-94";
  if (code.startsWith("95")) return "gastos-distribucion-95";
  if (code.startsWith("88")) return "impuesto-88";
  return "otra";
}

/**
 * Agrupa movimientos en crudo por cuenta sumando Debe/Haber.
 *
 * Excluye los asientos anulados (`status === false`, FR-024) y los movimientos
 * fuera del periodo (FR-025) cuando traen fecha. Los importes `null`/`undefined`
 * se tratan como `0.00` (FR-020).
 */
export function aggregateMovements(
  movements: MovementInput[],
  startDate?: string,
  endDate?: string
): AccountBalance[] {
  const byCode = new Map<string, AccountBalance>();

  for (const movement of movements) {
    if (!movement) continue;
    if (movement.status === false) continue;
    if (movement.date && startDate && endDate && (movement.date < startDate || movement.date > endDate)) {
      continue;
    }

    const code = String(movement.account_code ?? "").trim();
    if (!code) continue;

    const debit = Number(movement.debit ?? 0) || 0;
    const credit = Number(movement.credit ?? 0) || 0;
    const current = byCode.get(code) ?? { code, debit: 0, credit: 0 };
    current.debit += debit;
    current.credit += credit;
    byCode.set(code, current);
  }

  return [...byCode.values()];
}

type Acumulado = { debit: number; credit: number };

/**
 * Ejecuta el cálculo puro del Estado de Resultados por Función (PCGE 2019).
 *
 * - Sólo se imputan cuentas de detalle (`isDetailAccount`) clasificadas por su
 *   código en la matriz D5; cualquier otra cuenta se ignora.
 * - Cada línea se salda por su naturaleza (FR-019) y se redondea a 2 decimales
 *   (FR-021); los campos sin datos devuelven `0.00`,
 *   nunca `null` (FR-020).
 */
export function computeIncomeStatement(input: IncomeStatementComputeInput): IncomeStatementResult {
  const balances =
    input.balances ??
    aggregateMovements(input.movements ?? [], input.startDate, input.endDate);

  const acumulado = new Map<ReportLine, Acumulado>();

  for (const balance of balances) {
    if (!balance || typeof balance.code !== "string") continue;
    if (!isDetailAccount(balance.code)) continue;

    const line = lineaDe(balance.code);
    if (line === "otra") continue;

    const entry = acumulado.get(line) ?? { debit: 0, credit: 0 };
    entry.debit += Number(balance.debit ?? 0) || 0;
    entry.credit += Number(balance.credit ?? 0) || 0;
    acumulado.set(line, entry);
  }

  const get = (line: ReportLine): Acumulado =>
    acumulado.get(line) ?? { debit: 0, credit: 0 };

  /** Salda una línea: acreedora por Haber − Debe, deudora por Debe − Haber. */
  const saldar = (line: ReportLine, nature: Naturaleza): number => {
    const { debit, credit } = get(line);
    return nature === "acreedora" ? credit - debit : debit - credit;
  };

  // Cuenta 70 (ingresos ordinarios) menos las cuentas deudoras 709 y 74.
  const ordinaryIncome =
    saldar("ingresos-ordinarios", "acreedora") -
    saldar("devoluciones-709", "deudora") -
    saldar("descuentos-74", "deudora");

  const subleaseAndOtherIncome = 0; // Clarificación Q2: la 75 completa va a "otros ingresos y gastos".
  const operatingIncome = round2(ordinaryIncome + subleaseAndOtherIncome);

  const salesCosts = round2(saldar("costo-ventas-69", "deudora"));
  const grossProfit = round2(operatingIncome - salesCosts);

  const distribution = round2(saldar("gastos-distribucion-95", "deudora"));
  const administrative = round2(saldar("gastos-administracion-94", "deudora"));
  const operatingExpenses = round2(distribution + administrative);
  const operatingProfit = round2(grossProfit - operatingExpenses);

  const otherRevenues = round2(saldar("otros-ingresos-75-76", "acreedora"));
  const otherExpenses = round2(saldar("otros-gastos-65-66", "deudora"));
  const otherRevenuesAndExpenses = round2(otherRevenues - otherExpenses);

  const exchangeGain = saldar("diferencia-cambio-ingreso-776", "acreedora");
  const exchangeLoss = saldar("diferencia-cambio-gasto-676", "deudora");
  const exchangeDifferenceNet = round2(exchangeGain - exchangeLoss);

  const financialIncome = round2(saldar("ingresos-financieros-77", "acreedora"));
  const financialExpenses = round2(saldar("gastos-financieros-67", "deudora"));

  const resultBeforeTaxes = round2(
    operatingProfit + otherRevenuesAndExpenses + exchangeDifferenceNet + financialIncome - financialExpenses
  );
  const incomeTax = round2(saldar("impuesto-88", "deudora"));
  const netProfit = round2(resultBeforeTaxes - incomeTax);

  return {
    operating_income: {
      ordinary_income: round2(ordinaryIncome),
      sublease_and_other_income: subleaseAndOtherIncome,
      total: operatingIncome,
    },
    sales_costs: { cost_of_goods_sold: salesCosts },
    gross_profit: { amount: grossProfit },
    operating_expenses: { distribution, administrative, total: operatingExpenses },
    operating_profit: { amount: operatingProfit },
    other_revenues_and_expenses: {
      revenues: otherRevenues,
      expenses: otherExpenses,
      total: otherRevenuesAndExpenses,
    },
    exchange_difference_net: { amount: exchangeDifferenceNet },
    financial_income: { amount: financialIncome },
    financial_expenses: { amount: financialExpenses },
    result_before_taxes: { amount: resultBeforeTaxes },
    income_tax_expense: { amount: incomeTax },
    net_profit: { amount: netProfit },
    period: { start_date: input.startDate, end_date: input.endDate },
    currency: CURRENCY,
  };
}
