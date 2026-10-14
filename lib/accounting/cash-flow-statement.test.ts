import { describe, expect, it } from "vitest";
import {
  buildCashFlowStatement,
  type CashFlowStatementParams,
  type CashFlowStatementResult,
} from "./cash-flow-statement";

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Recorre todos los importes numéricos del reporte (excluye booleanos). */
function amounts(result: CashFlowStatementResult): number[] {
  const {
    operating_activities: op,
    investing_activities: inv,
    financing_activities: fin,
    ...rest
  } = result;
  return [
    op.net_profit,
    op.adjustments_non_cash.depreciation,
    op.adjustments_non_cash.unrealized_exchange_difference,
    op.adjustments_non_cash.total,
    op.working_capital_changes.accounts_receivable,
    op.working_capital_changes.inventories,
    op.working_capital_changes.accounts_payable,
    op.working_capital_changes.payroll_payable,
    op.working_capital_changes.taxes_payable,
    op.working_capital_changes.total,
    op.net_cash_operating,
    inv.property_plant_equipment_purchases,
    inv.asset_sales,
    inv.net_cash_investing,
    fin.capital_contributions,
    fin.financial_obligations,
    fin.dividends_paid,
    fin.net_cash_financing,
    rest.net_cash_increase,
    rest.cash_at_beginning,
    rest.cash_at_end,
    rest.reconciliation_difference,
  ];
}

/** FR-008: cada importe del reporte tiene exactamente 2 decimales. */
function expectTwoDecimals(result: CashFlowStatementResult): void {
  for (const value of amounts(result)) {
    expect(Math.round(value * 100) / 100).toBe(value);
  }
}

function base(overrides: Partial<CashFlowStatementParams> = {}): CashFlowStatementParams {
  return {
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    initialBalances: {},
    finalBalances: {},
    periodMovements: [],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ *
 * SC-003 — batería de escenarios
 * ------------------------------------------------------------------ */

describe("buildCashFlowStatement — US1: generación del período", () => {
  it("1) período completo con conciliación exitosa (operación + capital de trabajo)", () => {
    const result = buildCashFlowStatement(
      base({
        initialBalances: { "101": 5000, "121": 1000, "421": 500 },
        finalBalances: { "101": 7200, "121": 500, "421": 1000 },
        periodMovements: [
          { accountCode: "101", accountType: "Activo", debit: 2200, credit: 0 },
          { accountCode: "701", accountType: "Ingreso", debit: 0, credit: 2000 },
          { accountCode: "631", accountType: "Gasto", debit: 800, credit: 0 },
          { accountCode: "121", accountType: "Activo", debit: 0, credit: 500 },
          { accountCode: "421", accountType: "Pasivo", debit: 0, credit: 500 },
        ],
      })
    );

    expect(result.period).toEqual({ startDate: "2026-01-01", endDate: "2026-01-31" });
    expect(result.currency).toBe("PEN");

    const op = result.operating_activities;
    expect(op.net_profit).toBe(1200);
    expect(op.adjustments_non_cash).toEqual({
      depreciation: 0,
      unrealized_exchange_difference: 0,
      total: 0,
    });
    // −Δ(12) = −(500 − 1000) = +500 ; +Δ(42) = 1000 − 500 = +500
    expect(op.working_capital_changes).toEqual({
      accounts_receivable: 500,
      inventories: 0,
      accounts_payable: 500,
      payroll_payable: 0,
      taxes_payable: 0,
      total: 1000,
    });
    expect(op.net_cash_operating).toBe(2200);
    expect(result.investing_activities.net_cash_investing).toBe(0);
    expect(result.financing_activities.net_cash_financing).toBe(0);
    expect(result.net_cash_increase).toBe(2200);
    expect(result.cash_at_beginning).toBe(5000);
    expect(result.cash_at_end).toBe(7200);
    expect(result.is_reconciled).toBe(true);
    expect(result.reconciliation_difference).toBe(0);
    expectTwoDecimals(result);
  });

  it("2) período vacío: todo en 0.00 y conciliación exitosa (SC-004)", () => {
    const result = buildCashFlowStatement(base());
    expect(result.operating_activities.net_profit).toBe(0);
    expect(result.operating_activities.net_cash_operating).toBe(0);
    expect(result.investing_activities.net_cash_investing).toBe(0);
    expect(result.financing_activities.net_cash_financing).toBe(0);
    expect(result.net_cash_increase).toBe(0);
    expect(result.cash_at_beginning).toBe(0);
    expect(result.cash_at_end).toBe(0);
    expect(result.is_reconciled).toBe(true);
    expect(result.reconciliation_difference).toBe(0);
    expectTwoDecimals(result);
  });

  it("3) pérdida neta: utilidad negativa y operación negativa", () => {
    const result = buildCashFlowStatement(
      base({
        initialBalances: { "101": 5000 },
        finalBalances: { "101": 3000 },
        periodMovements: [
          { accountCode: "701", accountType: "Ingreso", debit: 0, credit: 1000 },
          { accountCode: "631", accountType: "Gasto", debit: 3000, credit: 0 },
          { accountCode: "101", accountType: "Activo", debit: 0, credit: 2000 },
        ],
      })
    );
    expect(result.operating_activities.net_profit).toBe(-2000);
    expect(result.operating_activities.net_cash_operating).toBe(-2000);
    expect(result.net_cash_increase).toBe(-2000);
    expect(result.cash_at_end).toBe(3000);
    expect(result.is_reconciled).toBe(true);
  });

  it("4) cuenta ausente en los agregados = 0.00 sin error (FR-007)", () => {
    const result = buildCashFlowStatement(
      base({
        initialBalances: { "101": 100 },
        finalBalances: { "101": 100 },
      })
    );
    const op = result.operating_activities;
    expect(op.working_capital_changes.accounts_receivable).toBe(0);
    expect(op.working_capital_changes.inventories).toBe(0);
    expect(op.working_capital_changes.accounts_payable).toBe(0);
    expect(op.adjustments_non_cash.depreciation).toBe(0);
    expect(result.financing_activities.dividends_paid).toBe(0);
    expect(result.cash_at_beginning).toBe(100);
    expect(result.cash_at_end).toBe(100);
    expect(result.is_reconciled).toBe(true);
    expectTwoDecimals(result);
  });

  it("5) redondeo estricto: depreciación 0.10 + diferencia de cambio 0.20 = 0.30", () => {
    const result = buildCashFlowStatement(
      base({
        initialBalances: { "101": 10, "421": 0.1 },
        finalBalances: { "101": 10.9, "421": 0.3 },
        periodMovements: [
          { accountCode: "681", accountType: "Gasto", debit: 0.1, credit: 0 },
          { accountCode: "6761", accountType: "Gasto", debit: 0.2, credit: 0 },
          { accountCode: "701", accountType: "Ingreso", debit: 0, credit: 1.0 },
          { accountCode: "631", accountType: "Gasto", debit: 0.3, credit: 0 },
        ],
      })
    );
    // Ingresos 1.00 − gastos (0.30 + 0.10 + 0.20) = 0.40 (68 y 676 también son P&L)
    expect(result.operating_activities.net_profit).toBe(0.4);
    expect(result.operating_activities.adjustments_non_cash.depreciation).toBe(0.1);
    expect(result.operating_activities.adjustments_non_cash.unrealized_exchange_difference).toBe(0.2);
    expect(result.operating_activities.adjustments_non_cash.total).toBe(0.3); // 0.1 + 0.2
    expect(result.operating_activities.working_capital_changes.accounts_payable).toBe(0.2);
    expect(result.operating_activities.net_cash_operating).toBe(0.9); // 0.4 + 0.3 + 0.2
    expect(result.cash_at_end).toBe(10.9);
    expect(result.is_reconciled).toBe(true);
    expectTwoDecimals(result);
  });
});

describe("buildCashFlowStatement — US2: conciliación con la Cuenta 10 (FR-006)", () => {
  it("6) el efectivo excluye 107 (fondos restringidos) y concilia con 101|104", () => {
    const result = buildCashFlowStatement(
      base({
        initialBalances: { "101": 1000, "104": 500, "1071": 5000 },
        finalBalances: { "101": 1200, "104": 600, "1071": 5000, "451": 300 },
        periodMovements: [{ accountCode: "451", accountType: "Pasivo", debit: 0, credit: 300 }],
      })
    );
    expect(result.cash_at_beginning).toBe(1500); // 101 + 104, sin 107
    expect(result.financing_activities.financial_obligations).toBe(300);
    expect(result.net_cash_increase).toBe(300);
    expect(result.cash_at_end).toBe(1800);
    expect(result.is_reconciled).toBe(true);
    expect(result.reconciliation_difference).toBe(0);
  });

  it("7) descuadre detectado: is_reconciled false y diferencia con signo (saldo real − calculado)", () => {
    const result = buildCashFlowStatement(
      base({
        initialBalances: { "101": 5000 },
        finalBalances: { "101": 5200 },
      })
    );
    expect(result.cash_at_end).toBe(5000);
    expect(result.is_reconciled).toBe(false);
    expect(result.reconciliation_difference).toBe(200);
    expectTwoDecimals(result);
  });

  it("8) ajustes no monetarios compensan al resultado: depreciación y diferencia de cambio", () => {
    const result = buildCashFlowStatement(
      base({
        initialBalances: { "101": 5000 },
        finalBalances: { "101": 5000 },
        periodMovements: [
          { accountCode: "681", accountType: "Gasto", debit: 850, credit: 0 }, // depreciación
          { accountCode: "6761", accountType: "Gasto", debit: 100, credit: 0 }, // pérdida cambio
          { accountCode: "7761", accountType: "Ingreso", debit: 0, credit: 50 }, // ganancia cambio
        ],
      })
    );
    const op = result.operating_activities;
    expect(op.net_profit).toBe(-900); // −850 −100 +50
    expect(op.adjustments_non_cash.depreciation).toBe(850);
    expect(op.adjustments_non_cash.unrealized_exchange_difference).toBe(50); // 100 − 50
    expect(op.adjustments_non_cash.total).toBe(900);
    expect(op.net_cash_operating).toBe(0);
    expect(result.is_reconciled).toBe(true);
  });

  it("9) variaciones de capital de trabajo en ambos sentidos (FR-003)", () => {
    // Activo que SUBE → reduce el flujo
    const increase = buildCashFlowStatement(
      base({
        initialBalances: { "101": 5000, "121": 1000 },
        finalBalances: { "101": 4500, "121": 1500 },
      })
    );
    expect(increase.operating_activities.working_capital_changes.accounts_receivable).toBe(-500);
    expect(increase.operating_activities.net_cash_operating).toBe(-500);
    expect(increase.is_reconciled).toBe(true);

    // Pasivo que BAJA → reduce el flujo
    const decrease = buildCashFlowStatement(
      base({
        initialBalances: { "101": 5000, "401": 800 },
        finalBalances: { "101": 4600, "401": 400 },
      })
    );
    expect(decrease.operating_activities.working_capital_changes.taxes_payable).toBe(-400);
    expect(decrease.operating_activities.net_cash_operating).toBe(-400);
    expect(decrease.is_reconciled).toBe(true);

    // Existencias que BAJAN → aumenta el flujo
    const inventories = buildCashFlowStatement(
      base({
        initialBalances: { "101": 5000, "201": 1000 },
        finalBalances: { "101": 5300, "201": 700 },
      })
    );
    expect(inventories.operating_activities.working_capital_changes.inventories).toBe(300);
    expect(inventories.is_reconciled).toBe(true);
  });

  it("10) identidades de cierre: net_cash_increase = op + inv + fin y cash_at_end = inicio + aumento", () => {
    // Efectivo real menor al calculado (préstamo capturado sin contrapartida de efectivo)
    const result = buildCashFlowStatement(
      base({
        initialBalances: { "101": 3000, "451": 5000 },
        finalBalances: { "101": 2600, "451": 6000 },
      })
    );

    expect(result.net_cash_increase).toBe(
      result.operating_activities.net_cash_operating +
        result.investing_activities.net_cash_investing +
        result.financing_activities.net_cash_financing
    );
    expect(result.net_cash_increase).toBe(1000); // +Δ45
    expect(result.cash_at_end).toBe(result.cash_at_beginning + result.net_cash_increase);
    expect(result.cash_at_end).toBe(4000);

    // Descuadre en NEGATIVO: el saldo real (2600) es menor que el calculado (4000)
    expect(result.is_reconciled).toBe(false);
    expect(result.reconciliation_difference).toBe(-1400);
  });
});

describe("buildCashFlowStatement — inversión y financiamiento", () => {
  it("10) adquisición de activo descontando obligaciones pendientes 465 (FR-004)", () => {
    const result = buildCashFlowStatement(
      base({
        initialBalances: { "101": 5000, "331": 10000, "4651": 1000 },
        finalBalances: { "101": 3000, "331": 13000, "4651": 2000 },
      })
    );
    expect(result.investing_activities.property_plant_equipment_purchases).toBe(-2000); // −(3000 − 1000)
    expect(result.investing_activities.asset_sales).toBe(0);
    expect(result.investing_activities.net_cash_investing).toBe(-2000);
    expect(result.cash_at_end).toBe(3000);
    expect(result.is_reconciled).toBe(true);
  });

  it("11) ventas/desinversiones de activos (33 y 30) como entradas de efectivo", () => {
    const result = buildCashFlowStatement(
      base({
        initialBalances: { "101": 5000, "331": 10000, "301": 2000 },
        finalBalances: { "101": 6500, "331": 9000, "301": 1500 },
      })
    );
    expect(result.investing_activities.property_plant_equipment_purchases).toBe(0);
    expect(result.investing_activities.asset_sales).toBe(1500); // 1000 (33) + 500 (30)
    expect(result.cash_at_end).toBe(6500);
    expect(result.is_reconciled).toBe(true);
  });

  it("12) préstamo y amortización netos de obligaciones financieras (45)", () => {
    const borrowed = buildCashFlowStatement(
      base({
        initialBalances: { "101": 5000, "451": 10000 },
        finalBalances: { "101": 7000, "451": 12000 },
      })
    );
    expect(borrowed.financing_activities.financial_obligations).toBe(2000);
    expect(borrowed.net_cash_increase).toBe(2000);
    expect(borrowed.is_reconciled).toBe(true);

    const amortized = buildCashFlowStatement(
      base({
        initialBalances: { "101": 7000, "451": 12000 },
        finalBalances: { "101": 5000, "451": 10000 },
      })
    );
    expect(amortized.financing_activities.financial_obligations).toBe(-2000);
    expect(amortized.is_reconciled).toBe(true);
  });

  it("13) dividendos = débitos del período en 407; las declaraciones (créditos) no cuentan", () => {
    const result = buildCashFlowStatement(
      base({
        initialBalances: { "101": 5000, "4071": 0 },
        finalBalances: { "101": 4500, "4071": 0 },
        periodMovements: [
          { accountCode: "4071", accountType: "Pasivo", debit: 500, credit: 0 }, // pago
          { accountCode: "4071", accountType: "Pasivo", debit: 0, credit: 300 }, // declaración (no monetaria)
        ],
      })
    );
    expect(result.financing_activities.dividends_paid).toBe(-500);
    expect(result.financing_activities.net_cash_financing).toBe(-500);
    expect(result.cash_at_end).toBe(4500);
    expect(result.is_reconciled).toBe(true);
  });

  it("14) aportes de capital (50) como entrada de efectivo", () => {
    const result = buildCashFlowStatement(
      base({
        initialBalances: { "101": 5000, "501": 10000 },
        finalBalances: { "101": 8000, "501": 13000 },
      })
    );
    expect(result.financing_activities.capital_contributions).toBe(3000);
    expect(result.net_cash_increase).toBe(3000);
    expect(result.cash_at_end).toBe(8000);
    expect(result.is_reconciled).toBe(true);
  });

  it("15) infiere la naturaleza de la cuenta por prefijo PCGE cuando falta accountType", () => {
    const result = buildCashFlowStatement(
      base({
        initialBalances: { "101": 1000 },
        finalBalances: { "101": 1600 },
        periodMovements: [
          { accountCode: "701", debit: 0, credit: 1000 }, // 7 → acreedora (ingreso)
          { accountCode: "631", debit: 400, credit: 0 }, // 6 → deudora (gasto)
        ],
      })
    );
    expect(result.operating_activities.net_profit).toBe(600);
    expect(result.operating_activities.net_cash_operating).toBe(600);
    expect(result.is_reconciled).toBe(true);
  });
});

describe("buildCashFlowStatement — US3: datos incompletos y precisión monetaria", () => {
  it("16) solo un grupo de cuentas con datos: el resto del reporte en 0.00 exacto (FR-007/SC-004)", () => {
    const result = buildCashFlowStatement(
      base({
        initialBalances: { "101": 250.5 },
        finalBalances: { "101": 300.25 },
      })
    );

    expect(result.operating_activities.net_profit).toBe(0);
    expect(result.operating_activities.adjustments_non_cash).toEqual({
      depreciation: 0,
      unrealized_exchange_difference: 0,
      total: 0,
    });
    expect(result.operating_activities.working_capital_changes).toEqual({
      accounts_receivable: 0,
      inventories: 0,
      accounts_payable: 0,
      payroll_payable: 0,
      taxes_payable: 0,
      total: 0,
    });
    expect(result.operating_activities.net_cash_operating).toBe(0);
    expect(result.investing_activities).toEqual({
      property_plant_equipment_purchases: 0,
      asset_sales: 0,
      net_cash_investing: 0,
    });
    expect(result.financing_activities).toEqual({
      capital_contributions: 0,
      financial_obligations: 0,
      dividends_paid: 0,
      net_cash_financing: 0,
    });

    // Sin movimientos que expliquen la subida de caja → descuadre cuantificado
    expect(result.cash_at_beginning).toBe(250.5);
    expect(result.cash_at_end).toBe(250.5);
    expect(result.is_reconciled).toBe(false);
    expect(result.reconciliation_difference).toBe(49.75); // 300.25 − 250.50
    expectTwoDecimals(result); // FR-008: 2 decimales en TODOS los importes
  });
});
