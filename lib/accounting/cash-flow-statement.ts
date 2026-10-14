/**
 * Estado de Flujos de Efectivo — Método Indirecto (NIC 7 / PCGE 2019).
 *
 * Cálculo puro, sin imports de Prisma: la ruta `app/api/cash-flow-statement` construye
 * los agregados y esta capa los transforma en el reporte. Ver
 * `specs/025-cash-flow-statement/` (research D1–D10, data-model.md).
 *
 * Convención de signos: entradas de efectivo positivas, salidas negativas.
 * Redondeo estricto a 2 decimales en cada línea y subtotal (FR-008).
 *
 * Regla crítica: NO se reimplementan reglas contables — se reutilizan `signedBalance`
 * y `round2` de `lib/accounting/balance-sheet.ts` (mismo reporte oficial, SC-002).
 */

import { round2, signedBalance } from "./balance-sheet";

/**
 * `round2` normalizado a 2 decimales que además elimina el cero negativo (`-0`),
 * para que importes sin movimiento se reporten exactamente como `0` (FR-007/FR-008).
 */
const r2 = (n: number): number => round2(n) || 0;

/* ------------------------------------------------------------------ *
 * Helpers de agregación (D5: Δ = saldoFinal − saldoInicial por prefijo)
 * ------------------------------------------------------------------ */

/** Suma de saldos firmados cuyo código PCGE empieza por alguno de los prefijos dados. */
function sumByPrefixes(balances: Record<string, number>, prefixes: string[]): number {
  let total = 0;
  for (const [code, value] of Object.entries(balances)) {
    if (prefixes.some((prefix) => code.startsWith(prefix))) {
      total += Number(value) || 0;
    }
  }
  return total;
}

/** Variación neta de efectivo (Δ) del conjunto de cuentas con esos prefijos. */
function delta(
  params: CashFlowStatementParams,
  prefixes: string[]
): number {
  return r2(
    sumByPrefixes(params.finalBalances, prefixes) - sumByPrefixes(params.initialBalances, prefixes)
  );
}

/** Prefijo PCGE → naturaleza de la cuenta cuando `accountType` no está presente. */
function natureOf(movement: PeriodMovement): string {
  if (movement.accountType) return movement.accountType;
  const head = movement.accountCode[0];
  if (head === "6") return "Gasto"; // deudora
  if (head === "7") return "Ingreso"; // acreedora
  if (head === "4" || head === "5") return "Pasivo"; // acreedora
  if (head === "8") return "Resultado"; // no P&L de período (se ignora arriba)
  return "Activo"; // 1, 2, 3 → deudora
}

/** ¿Es cuenta de resultados (Ingreso/Gasto/Costo) para el resultado del período (D3)? */
function isProfitAndLoss(movement: PeriodMovement): boolean {
  if (movement.accountType) {
    return movement.accountType === "Ingreso" || movement.accountType === "Gasto" || movement.accountType === "Costo";
  }
  const head = movement.accountCode[0];
  return head === "6" || head === "7";
}

/** Saldo firmado de las cuentas del período que cumplen `match` (usa `signedBalance`). */
function periodSigned(
  movements: PeriodMovement[],
  match: (movement: PeriodMovement) => boolean
): number {
  let total = 0;
  for (const movement of movements) {
    if (match(movement)) {
      total += signedBalance(natureOf(movement), movement.debit, movement.credit);
    }
  }
  return r2(total);
}

const matchesPrefix =
  (prefixes: string[]) =>
  (movement: PeriodMovement): boolean =>
    prefixes.some((prefix) => movement.accountCode.startsWith(prefix));

/** Movimiento agregado de una cuenta en el período. */
export interface PeriodMovement {
  accountCode: string;
  /**
   * Naturaleza de la cuenta (`Activo|Pasivo|Patrimonio|Ingreso|Gasto|Costo`).
   * Opcional: si falta, se infiere del prefijo PCGE (6 → deudora, 7 → acreedora, etc.).
   */
  accountType?: string;
  debit: number;
  credit: number;
}

/** Entrada del cálculo puro (data-model §CashFlowStatementParams). */
export interface CashFlowStatementParams {
  /** Inicio del período (YYYY-MM-DD, UTC). */
  startDate: string;
  /** Fin del período (YYYY-MM-DD, UTC). */
  endDate: string;
  /** Saldos firmados acumulados antes de `startDate`; cuenta ausente = 0.00. */
  initialBalances: Record<string, number>;
  /** Saldos firmados acumulados hasta `endDate`; cuenta ausente = 0.00. */
  finalBalances: Record<string, number>;
  /** Movimientos (débitos/créditos) en `[startDate, endDate]`; array vacío válido. */
  periodMovements: PeriodMovement[];
}

/** Salida — contrato snake_case (research D8 / contrato 200). */
export interface CashFlowStatementResult {
  period: { startDate: string; endDate: string };
  currency: "PEN";
  operating_activities: {
    net_profit: number;
    adjustments_non_cash: {
      depreciation: number;
      unrealized_exchange_difference: number;
      total: number;
    };
    working_capital_changes: {
      accounts_receivable: number;
      inventories: number;
      accounts_payable: number;
      payroll_payable: number;
      taxes_payable: number;
      total: number;
    };
    net_cash_operating: number;
  };
  investing_activities: {
    property_plant_equipment_purchases: number;
    asset_sales: number;
    net_cash_investing: number;
  };
  financing_activities: {
    capital_contributions: number;
    financial_obligations: number;
    dividends_paid: number;
    net_cash_financing: number;
  };
  net_cash_increase: number;
  cash_at_beginning: number;
  cash_at_end: number;
  is_reconciled: boolean;
  /** saldoReal(101|104) − cash_at_end (cuantifica la brecha de conciliación). */
  reconciliation_difference: number;
}

/* ------------------------------------------------------------------ *
 * Cálculo del reporte (método indirecto — NIC 7 / PCGE 2019)
 * ------------------------------------------------------------------ */

/** Cuentas de efectivo: 101 y 104 explícitos — nunca `10` genérico (excluye 107, FR-006). */
const CASH_PREFIXES = ["101", "104"];

/**
 * Construye el Estado de Flujos de Efectivo de un período.
 *
 * - Flujos por sección = fórmulas de research.md D6 (Δ por prefijo PCGE).
 * - `net_profit` = resultado del período de las cuentas P&L (D3).
 * - Efectivo = cuentas `101|104` (FR-006), conciliado con tolerancia 0.005.
 * - Cada línea y subtotal pasa por `round2` (FR-008); cuentas ausentes = 0.00 (FR-007).
 */
export function buildCashFlowStatement(params: CashFlowStatementParams): CashFlowStatementResult {
  const movements = params.periodMovements ?? [];
  const hasData = (value: number): number => (Number.isFinite(value) ? value : 0);

  /* --- Actividades de operación ------------------------------------ */

  // Resultado neto del período: ingresos (acreedora) − gastos/costos (deudora).
  const netProfit = r2(
    movements
      .filter(isProfitAndLoss)
      .reduce((sum, movement) => {
        const signed = signedBalance(natureOf(movement), movement.debit, movement.credit);
        return sum + (natureOf(movement) === "Ingreso" ? signed : -signed);
      }, 0)
  );

  // Ajustes por partidas que no afectan el efectivo (FR-002).
  const depreciation = periodSigned(movements, matchesPrefix(["68"]));
  const unrealizedExchangeDifference = r2(
    periodSigned(movements, matchesPrefix(["676"])) - periodSigned(movements, matchesPrefix(["776"]))
  );
  const adjustmentsTotal = r2(depreciation + unrealizedExchangeDifference);

  // Capital de trabajo — convención de signos FR-003.
  const accountsReceivable = r2(-delta(params, ["12"]));
  const inventories = r2(-delta(params, ["20", "24", "25"]));
  const accountsPayable = delta(params, ["42"]);
  const payrollPayable = delta(params, ["41"]);
  const taxesPayable = delta(params, ["40"]);
  const workingCapitalTotal = r2(
    accountsReceivable + inventories + accountsPayable + payrollPayable + taxesPayable
  );

  const netCashOperating = r2(netProfit + adjustmentsTotal + workingCapitalTotal);

  /* --- Actividades de inversión ------------------------------------ */

  // Compras de PP.EE.: Δ(33) descontando las obligaciones aún pendientes Δ(465) (D6.5).
  const propertyPlantEquipmentPurchases = r2(-Math.max(0, delta(params, ["33"]) - delta(params, ["465"])));
  // Ventas/desinversiones: caídas de activos fijos (33) e inversiones (30) (D6.6).
  const assetSales = r2(Math.max(0, -delta(params, ["33"])) + Math.max(0, -delta(params, ["30"])));
  const netCashInvesting = r2(propertyPlantEquipmentPurchases + assetSales);

  /* --- Actividades de financiamiento ------------------------------- */

  const capitalContributions = delta(params, ["50"]);
  const financialObligations = delta(params, ["45"]);
  // Dividendos pagados = débitos del período en 407 (los créditos = declaración, no monetaria) (D6.7).
  const dividendsPaid = r2(
    -movements
      .filter(matchesPrefix(["407"]))
      .reduce((sum, movement) => sum + (Number(movement.debit) || 0), 0)
  );
  const netCashFinancing = r2(capitalContributions + financialObligations + dividendsPaid);

  /* --- Conciliación del efectivo (FR-006 / SC-005) ------------------ */

  const netCashIncrease = r2(netCashOperating + netCashInvesting + netCashFinancing);
  const cashAtBeginning = r2(sumByPrefixes(params.initialBalances, CASH_PREFIXES));
  const cashAtEnd = r2(cashAtBeginning + netCashIncrease);
  const realCashAtEnd = r2(sumByPrefixes(params.finalBalances, CASH_PREFIXES));
  const reconciliationDifference = r2(realCashAtEnd - cashAtEnd);

  return {
    period: { startDate: params.startDate, endDate: params.endDate },
    currency: "PEN",
    operating_activities: {
      net_profit: hasData(netProfit),
      adjustments_non_cash: {
        depreciation,
        unrealized_exchange_difference: unrealizedExchangeDifference,
        total: adjustmentsTotal,
      },
      working_capital_changes: {
        accounts_receivable: accountsReceivable,
        inventories,
        accounts_payable: accountsPayable,
        payroll_payable: payrollPayable,
        taxes_payable: taxesPayable,
        total: workingCapitalTotal,
      },
      net_cash_operating: netCashOperating,
    },
    investing_activities: {
      property_plant_equipment_purchases: propertyPlantEquipmentPurchases,
      asset_sales: assetSales,
      net_cash_investing: netCashInvesting,
    },
    financing_activities: {
      capital_contributions: capitalContributions,
      financial_obligations: financialObligations,
      dividends_paid: dividendsPaid,
      net_cash_financing: netCashFinancing,
    },
    net_cash_increase: netCashIncrease,
    cash_at_beginning: cashAtBeginning,
    cash_at_end: cashAtEnd,
    is_reconciled: Math.abs(reconciliationDifference) < 0.005,
    reconciliation_difference: reconciliationDifference,
  };
}
