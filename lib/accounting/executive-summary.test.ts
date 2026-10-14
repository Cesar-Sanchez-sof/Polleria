import { describe, it, expect } from "vitest";
import {
  buildExecutiveSummary,
  type ExecutiveAccountInput,
} from "@/lib/accounting/executive-summary";

function account(
  code: string,
  type: string,
  amounts: Partial<Omit<ExecutiveAccountInput, "code" | "type">> = {}
): ExecutiveAccountInput {
  return {
    code,
    name: `Cuenta ${code}`,
    type,
    periodDebit: 0,
    periodCredit: 0,
    balanceDebit: 0,
    balanceCredit: 0,
    ...amounts,
  };
}

function metric(summary: ReturnType<typeof buildExecutiveSummary>, key: string) {
  for (const s of summary.sections) {
    const found = s.metrics.find((m) => m.key === key);
    if (found) return found;
  }
  throw new Error(`Métrica ${key} no encontrada`);
}

describe("buildExecutiveSummary", () => {
  it("presenta las cinco secciones esperadas en orden", () => {
    const summary = buildExecutiveSummary({
      year: 2026,
      from: "2026-01-01",
      to: "2026-12-31",
      accounts: [],
    });

    expect(summary.sections.map((s) => s.key)).toEqual([
      "efectivo",
      "rentabilidad",
      "balance",
      "rendimiento",
      "posicion",
    ]);
    expect(summary.year).toBe(2026);
    expect(summary.reportTitle).toBe("Resumen Ejecutivo");
  });

  it("calcula efectivo recibido, gastado, superávit y cierre", () => {
    const summary = buildExecutiveSummary({
      year: 2026,
      from: "2026-01-01",
      to: "2026-12-31",
      accounts: [
        // Efectivo: recibido 500, gastado 200 en el periodo; saldo acumulado 300.
        account("101", "Activo", { periodDebit: 500, periodCredit: 200, balanceDebit: 400, balanceCredit: 100 }),
        // Cuenta que no es efectivo (12xx) y no debe contar.
        account("121", "Activo", { periodDebit: 999, balanceDebit: 7 }),
      ],
    });

    expect(metric(summary, "cash-received").value).toBe(500);
    expect(metric(summary, "cash-spent").value).toBe(200);
    expect(metric(summary, "cash-surplus").value).toBe(300);
    // Solo el 101: 400 - 100 = 300 (el 121 no es efectivo).
    expect(metric(summary, "cash-closing").value).toBe(300);
  });

  it("calcula rentabilidad: ingreso, costo, gastos, bruta y neta", () => {
    const summary = buildExecutiveSummary({
      year: 2026,
      from: "2026-01-01",
      to: "2026-12-31",
      accounts: [
        account("701", "Ingreso", { periodCredit: 1000, periodDebit: 100 }), // neto 900
        account("691", "Costo", { periodDebit: 400, periodCredit: 0 }), // neto 400
        account("621", "Gasto", { periodDebit: 200, periodCredit: 0 }), // neto 200
      ],
    });

    expect(metric(summary, "income").value).toBe(900);
    expect(metric(summary, "cost-of-income").value).toBe(400);
    expect(metric(summary, "gross-profit").value).toBe(500); // 900 - 400
    expect(metric(summary, "expenses").value).toBe(200);
    expect(metric(summary, "net-profit").value).toBe(300); // 500 - 200
  });

  it("calcula el balance general con signos naturales", () => {
    const summary = buildExecutiveSummary({
      year: 2026,
      from: "2026-01-01",
      to: "2026-12-31",
      accounts: [
        account("121", "Activo", { balanceDebit: 7.08 }), // por cobrar 7,08
        account("421", "Pasivo", { balanceCredit: 50 }), // por pagar 50
        account("101", "Activo", { balanceDebit: 213.99, balanceCredit: 577.69 }), // activo -363,70
        account("401", "Pasivo", { balanceCredit: 17.4 }), // pasivo total 67,40
      ],
    });

    expect(metric(summary, "receivables").value).toBeCloseTo(7.08, 2);
    expect(metric(summary, "payables").value).toBe(50);
    // Activos netos = activos (213,99 − 577,69 + 7,08 = −356,62) − pasivos (50 + 17,40 = 67,40)
    expect(metric(summary, "net-assets").value).toBeCloseTo(-424.02, 2);
  });

  it("calcula rendimiento como porcentajes", () => {
    const summary = buildExecutiveSummary({
      year: 2026,
      from: "2026-01-01",
      to: "2026-12-31",
      accounts: [
        account("701", "Ingreso", { periodCredit: 1000 }), // ingreso 1000
        account("691", "Costo", { periodDebit: 400 }), // costo 400
        account("621", "Gasto", { periodDebit: 300 }), // gastos 300
        account("101", "Activo", { balanceDebit: 5000 }), // activos 5000
      ],
    });

    // Ganancia bruta 600, neta 300.
    expect(metric(summary, "gross-margin").value).toBeCloseTo(60, 1); // 600/1000
    expect(metric(summary, "net-margin").value).toBeCloseTo(30, 1); // 300/1000
    expect(metric(summary, "roi").value).toBeCloseTo(6, 1); // 300/5000
  });

  it("devuelve cero en los ratios cuando el denominador es cero (sin NaN)", () => {
    const summary = buildExecutiveSummary({
      year: 2026,
      from: "2026-01-01",
      to: "2026-12-31",
      accounts: [account("121", "Activo", { balanceDebit: 7.08 })],
    });

    // Sin ingresos ni costos: márgenes y periodos deben ser 0, no NaN/Infinity.
    expect(metric(summary, "gross-margin").value).toBe(0);
    expect(metric(summary, "net-margin").value).toBe(0);
    expect(metric(summary, "roi").value).toBe(0);
    expect(metric(summary, "avg-collection").value).toBe(0);
    expect(metric(summary, "avg-payment").value).toBe(0);
    expect(metric(summary, "current-vs-liabilities").value).toBe(0);
    expect(Object.is(metric(summary, "net-margin").value, NaN)).toBe(false);
  });

  it("calcula posición: periodos, pronóstico de efectivo y razón circulante", () => {
    const summary = buildExecutiveSummary({
      year: 2026,
      from: "2026-01-01",
      to: "2026-12-31",
      accounts: [
        account("701", "Ingreso", { periodCredit: 3650 }), // ingreso 3650
        account("121", "Activo", { balanceDebit: 365 }), // por cobrar 365
        account("421", "Pasivo", { balanceCredit: 0 }),
      ],
    });

    // Cobro: 365 / 3650 * 365 = 36,5 días.
    expect(metric(summary, "avg-collection").value).toBeCloseTo(36.5, 1);
    // Pronóstico: superávit (0) + por cobrar (365) − por pagar (0) = 365.
    expect(metric(summary, "cash-forecast").value).toBeCloseTo(365, 2);
  });

  it("la razón de circulante divide activo corriente entre pasivo corriente", () => {
    const summary = buildExecutiveSummary({
      year: 2026,
      from: "2026-01-01",
      to: "2026-12-31",
      accounts: [
        account("101", "Activo", { balanceDebit: 100 }), // activo corriente
        account("121", "Activo", { balanceDebit: 100 }), // activo corriente
        account("421", "Pasivo", { balanceCredit: 100 }), // pasivo corriente
      ],
    });

    // (100 + 100) / 100 = 2,0
    expect(metric(summary, "current-vs-liabilities").value).toBe(2);
  });

  it("los totales del reporte coinciden con las métricas calculadas", () => {
    const summary = buildExecutiveSummary({
      year: 2026,
      from: "2026-01-01",
      to: "2026-12-31",
      accounts: [
        account("101", "Activo", { periodDebit: 50, periodCredit: 20, balanceDebit: 30 }),
        account("701", "Ingreso", { periodCredit: 100 }),
        account("621", "Gasto", { periodDebit: 40 }),
      ],
    });

    expect(summary.totals.cashReceived).toBe(50);
    expect(summary.totals.cashSpent).toBe(20);
    expect(summary.totals.cashSurplus).toBe(30);
    expect(summary.totals.income).toBe(100);
    expect(summary.totals.expenses).toBe(40);
    expect(summary.totals.netProfit).toBe(60);
    expect(summary.totals.totalAssets).toBe(30);
  });
});
