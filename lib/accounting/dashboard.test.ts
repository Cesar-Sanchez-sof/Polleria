import { describe, expect, it } from "vitest";
import {
  buildDashboard,
  buildDashboardKpis,
  buildExpenseBreakdown,
  buildMonthlySeries,
  buildTopAccounts,
  computeVariation,
  formatRangeLabel,
  resolveDefaultRange,
  resolvePreviousRange,
  validateRange,
  type AccountMovement,
  type DashboardInput,
  type MonthlyRow,
} from "./dashboard";

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

/** P&L del rango: ingresos 2000.50, gastos 900.50, utilidad 1100.00 */
const periodAccounts: AccountMovement[] = [
  { code: "701", name: "Ventas", type: "Ingreso", debit: 0, credit: 1200.5 },
  { code: "702", name: "Servicios de cocina", type: "Ingreso", debit: 0, credit: 800 },
  { code: "621", name: "Sueldos", type: "Gasto", debit: 400, credit: 0 },
  { code: "601", name: "Costo de ventas", type: "Costo", debit: 300, credit: 0 },
  { code: "631", name: "Servicios básicos", type: "Gasto", debit: 200.5, credit: 0 },
];

/** Saldos acumulados: caja 5500, por cobrar 500, por pagar 800 */
const balanceAccounts: AccountMovement[] = [
  { code: "101", name: "Caja", type: "Activo", debit: 5000, credit: 1000 },
  { code: "104", name: "Bancos", type: "Activo", debit: 2000, credit: 500 },
  { code: "121", name: "Clientes", type: "Activo", debit: 800, credit: 300 },
  { code: "421", name: "Proveedores", type: "Pasivo", debit: 100, credit: 900 },
  { code: "501", name: "Capital social", type: "Patrimonio", debit: 0, credit: 10000 },
];

const previousPeriodAccounts: AccountMovement[] = [
  { code: "701", name: "Ventas", type: "Ingreso", debit: 0, credit: 1000 },
  { code: "621", name: "Sueldos", type: "Gasto", debit: 1000, credit: 0 },
];

const previousBalanceAccounts: AccountMovement[] = [
  { code: "101", name: "Caja", type: "Activo", debit: 4000, credit: 0 },
  { code: "121", name: "Clientes", type: "Activo", debit: 0, credit: 0 },
  { code: "421", name: "Proveedores", type: "Pasivo", debit: 50, credit: 850 },
];

function baseInput(overrides: Partial<DashboardInput> = {}): DashboardInput {
  return {
    desde: "2026-03-01",
    hasta: "2026-03-31",
    periodAccounts,
    balanceAccounts,
    previous: null,
    monthlyRows: [],
    accountMovement: [...periodAccounts, ...balanceAccounts],
    entryCount: 12,
    ...overrides,
  };
}

function kpiValue(input: DashboardInput, key: string): number {
  const { kpis } = buildDashboardKpis(input);
  const kpi = kpis.find((k) => k.key === key);
  if (!kpi) throw new Error(`KPI ${key} no encontrado`);
  return kpi.value;
}

/* ------------------------------------------------------------------ *
 * T004 — KPIs del período
 * ------------------------------------------------------------------ */

describe("buildDashboardKpis", () => {
  it("calcula los 7 KPI con valor, etiqueta y tipo correctos", () => {
    const { kpis, previousPeriod } = buildDashboardKpis(baseInput());

    expect(kpis.map((k) => k.key)).toEqual([
      "ingresos",
      "gastos",
      "utilidad",
      "caja_bancos",
      "por_cobrar",
      "por_pagar",
      "asientos",
    ]);
    expect(kpis.find((k) => k.key === "ingresos")?.value).toBe(2000.5);
    expect(kpis.find((k) => k.key === "gastos")?.value).toBe(900.5);
    expect(kpis.find((k) => k.key === "utilidad")?.value).toBe(1100);
    expect(kpis.find((k) => k.key === "caja_bancos")?.value).toBe(5500);
    expect(kpis.find((k) => k.key === "por_cobrar")?.value).toBe(500);
    expect(kpis.find((k) => k.key === "por_pagar")?.value).toBe(800);

    const asientos = kpis.find((k) => k.key === "asientos");
    expect(asientos?.value).toBe(12);
    expect(asientos?.kind).toBe("count");
    expect(kpis.filter((k) => k.kind === "currency")).toHaveLength(6);
    expect(previousPeriod).toBeNull();
  });

  it("marca utilidad negativa como pérdida (ingresos < gastos)", () => {
    const input = baseInput({
      periodAccounts: [
        { code: "701", name: "Ventas", type: "Ingreso", debit: 0, credit: 300 },
        { code: "621", name: "Sueldos", type: "Gasto", debit: 450, credit: 0 },
      ],
    });
    expect(kpiValue(input, "utilidad")).toBe(-150);
  });

  it("todas las variaciones son null sin período anterior", () => {
    const { kpis, previousPeriod } = buildDashboardKpis(baseInput());
    expect(previousPeriod).toBeNull();
    expect(kpis.every((k) => k.variation === null)).toBe(true);
  });

  it("variaciones correctas con período anterior: up/flat y null cuando |anterior| < 0.005", () => {
    const { kpis, previousPeriod } = buildDashboardKpis(
      baseInput({
        previous: {
          desde: "2026-02-01",
          hasta: "2026-02-28",
          periodAccounts: previousPeriodAccounts,
          balanceAccounts: previousBalanceAccounts,
          entryCount: 10,
        },
      })
    );

    expect(previousPeriod).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });

    const byKey = new Map(kpis.map((k) => [k.key, k]));
    // ingresos 2000.5 vs 1000 → +100.1% up (redondeo 1 decimal)
    expect(byKey.get("ingresos")?.variation).toEqual({ percent: 100.1, direction: "up" });
    // utilidad 1100 vs 0 → |anterior| < 0.005 → null
    expect(byKey.get("utilidad")?.variation).toBeNull();
    // caja 5500 vs 4000 → +37.5% up
    expect(byKey.get("caja_bancos")?.variation).toEqual({ percent: 37.5, direction: "up" });
    // por cobrar 500 vs 0 → null
    expect(byKey.get("por_cobrar")?.variation).toBeNull();
    // por pagar 800 vs 800 → 0% flat
    expect(byKey.get("por_pagar")?.variation).toEqual({ percent: 0, direction: "flat" });
    // asientos 12 vs 10 → +20% up
    expect(byKey.get("asientos")?.variation).toEqual({ percent: 20, direction: "up" });
  });

  it("redondea los valores a 2 decimales (round2)", () => {
    const input = baseInput({
      periodAccounts: [{ code: "701", name: "Ventas", type: "Ingreso", debit: 0, credit: 100.456 }],
    });
    expect(kpiValue(input, "ingresos")).toBe(100.46);
  });

  it("rango sin datos → KPIs en 0 y meta.empty = true", () => {
    const input = baseInput({
      periodAccounts: [],
      balanceAccounts: [],
      accountMovement: [],
      entryCount: 0,
    });
    const payload = buildDashboard(input);
    expect(payload.kpis.every((k) => k.value === 0)).toBe(true);
    expect(payload.meta.empty).toBe(true);
    expect(payload.previousPeriod).toBeNull();
  });

  it("con datos → meta.empty = false", () => {
    const payload = buildDashboard(baseInput());
    expect(payload.meta.empty).toBe(false);
    expect(payload.meta.currency).toBe("PEN");
  });

  it("el payload incluye period con label de rango visible (FR-008)", () => {
    const payload = buildDashboard(baseInput());
    expect(payload.period).toEqual({
      desde: "2026-03-01",
      hasta: "2026-03-31",
      label: "01 de marzo — 31 de marzo de 2026",
    });
  });
});

/* ------------------------------------------------------------------ *
 * T003 — helpers puros
 * ------------------------------------------------------------------ */

describe("validateRange", () => {
  it("acepta un rango válido", () => {
    expect(validateRange("2026-01-01", "2026-01-31")).toBeNull();
  });

  it("rechaza fechas ausentes o mal formadas", () => {
    expect(validateRange(undefined, "2026-01-31")).toBe(
      "Las fechas deben tener el formato YYYY-MM-DD."
    );
    expect(validateRange("31/01/2026", "2026-01-31")).toBe(
      "Las fechas deben tener el formato YYYY-MM-DD."
    );
  });

  it("rechaza rangos invertidos", () => {
    expect(validateRange("2026-02-01", "2026-01-31")).toBe(
      "Las fechas deben tener el formato YYYY-MM-DD y desde no puede ser posterior a hasta."
    );
  });
});

describe("resolvePreviousRange", () => {
  it("devuelve el período anterior de igual duración en días", () => {
    expect(resolvePreviousRange("2026-03-01", "2026-03-31")).toEqual({
      desde: "2026-01-29",
      hasta: "2026-02-28",
    });
  });

  it("cruza de año y respeta años bisiestos", () => {
    expect(resolvePreviousRange("2024-01-01", "2024-01-31")).toEqual({
      desde: "2023-12-01",
      hasta: "2023-12-31",
    });
    // 2024 es bisiesto: 2024-03-01 − 1 día = 2024-02-29
    expect(resolvePreviousRange("2024-03-01", "2024-03-31")).toEqual({
      desde: "2024-01-30",
      hasta: "2024-02-29",
    });
  });

  it("devuelve null con un rango inválido", () => {
    expect(resolvePreviousRange("01/03/2026", "2026-03-31")).toBeNull();
  });
});

describe("computeVariation", () => {
  it("calcula el porcentaje con 1 decimal y la dirección", () => {
    expect(computeVariation(150, 100)).toEqual({ percent: 50, direction: "up" });
    expect(computeVariation(90, 100)).toEqual({ percent: -10, direction: "down" });
    expect(computeVariation(100, 100)).toEqual({ percent: 0, direction: "flat" });
    expect(computeVariation(100.5, 300)).toEqual({ percent: -66.5, direction: "down" });
  });

  it("retorna null sin período anterior o con |anterior| < 0.005", () => {
    expect(computeVariation(100, null)).toBeNull();
    expect(computeVariation(100, undefined)).toBeNull();
    expect(computeVariation(100, 0)).toBeNull();
    expect(computeVariation(100, 0.004)).toBeNull();
  });
});

describe("formatRangeLabel", () => {
  it("usa el año final cuando inicia en otro año", () => {
    expect(formatRangeLabel("2025-12-01", "2026-01-15")).toBe(
      "01 de diciembre de 2025 — 15 de enero de 2026"
    );
  });
});

/* ------------------------------------------------------------------ *
 * T012 — US2: serie mensual, distribución de gastos y top cuentas
 * ------------------------------------------------------------------ */

describe("buildMonthlySeries", () => {
  const rows: MonthlyRow[] = [
    { month: "2025-12", type: "Ingreso", debit: 0, credit: 1000 },
    { month: "2025-12", type: "Gasto", debit: 700, credit: 0 },
    { month: "2026-01", type: "Ingreso", debit: 0, credit: 1500 },
    { month: "2026-01", type: "Costo", debit: 400, credit: 0 },
  ];

  it("rellena los meses sin datos en 0 y calcula utilidad por punto", () => {
    const series = buildMonthlySeries("2025-12-01", "2026-01-31", rows);
    expect(series.map((p) => p.month)).toEqual(["2025-12", "2026-01"]);
    expect(series[0]).toMatchObject({ ingresos: 1000, gastos: 700, utilidad: 300 });
    expect(series[1]).toMatchObject({ ingresos: 1500, gastos: 400, utilidad: 1100 });
    expect(series[0].label).toContain("2025");
  });

  it("incluye meses vacíos intermedios en 0", () => {
    const series = buildMonthlySeries("2025-11-01", "2026-01-31", rows);
    expect(series.map((p) => p.month)).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(series[0]).toMatchObject({ ingresos: 0, gastos: 0, utilidad: 0 });
  });

  it("limita la serie a los últimos 12 meses terminados en hasta", () => {
    const series = buildMonthlySeries("2020-01-01", "2026-01-31", []);
    expect(series).toHaveLength(12);
    expect(series[0].month).toBe("2025-02");
    expect(series[11].month).toBe("2026-01");
  });

  it("representa la pérdida (utilidad negativa) sin errores", () => {
    const loss: MonthlyRow[] = [
      { month: "2026-01", type: "Ingreso", debit: 0, credit: 300 },
      { month: "2026-01", type: "Gasto", debit: 450, credit: 0 },
    ];
    const series = buildMonthlySeries("2026-01-01", "2026-01-31", loss);
    expect(series[0].utilidad).toBe(-150);
  });

  it("devuelve [] con rango inválido", () => {
    expect(buildMonthlySeries("31/01/2026", "2026-01-31", [])).toEqual([]);
    expect(buildMonthlySeries("2026-02-01", "2026-01-31", [])).toEqual([]);
  });
});

describe("buildExpenseBreakdown", () => {
  it("agrupa gastos por categoría PCGE y los percent suman 100", () => {
    const accounts: AccountMovement[] = [
      { code: "621", name: "Sueldos", type: "Gasto", debit: 600, credit: 0 },
      { code: "622", name: "Beneficios sociales", type: "Gasto", debit: 120, credit: 0 },
      { code: "631", name: "Servicios básicos", type: "Gasto", debit: 180, credit: 0 },
      { code: "671", name: "Intereses", type: "Gasto", debit: 100, credit: 0 },
      { code: "601", name: "Costo de ventas", type: "Costo", debit: 500, credit: 0 },
    ];
    const breakdown = buildExpenseBreakdown(accounts);

    expect(breakdown.map((b) => b.category)).toEqual([
      "Costo de ventas",
      "Gastos de personal",
      "Servicios",
      "Gastos financieros",
    ]);
    expect(breakdown[1].amount).toBe(720); // 621 + 622
    const totalPercent = breakdown.reduce((acc, b) => acc + b.percent, 0);
    expect(totalPercent).toBe(100);
    expect(breakdown[0].percent).toBeCloseTo((500 / 1500) * 100, 1);
  });

  it("clasifica en Otros las cuentas de gasto sin prefijo conocido", () => {
    const accounts: AccountMovement[] = [
      { code: "631", name: "Servicios", type: "Gasto", debit: 50, credit: 0 },
      { code: "6X9", name: "Gasto atípico", type: "Gasto", debit: 50, credit: 0 },
    ];
    const breakdown = buildExpenseBreakdown(accounts);
    expect(breakdown.map((b) => b.category)).toEqual(["Servicios", "Otros"]);
    expect(breakdown.reduce((acc, b) => acc + b.percent, 0)).toBe(100);
  });

  it("devuelve [] sin cuentas de gasto", () => {
    expect(buildExpenseBreakdown(periodAccounts.slice(0, 2))).toEqual([]); // solo Ingreso
  });
});

describe("buildTopAccounts", () => {
  it("ordena por abs(debit − credit) descendente y descarta montos < 0.005", () => {
    const accounts: AccountMovement[] = [
      { code: "101", name: "Caja", type: "Activo", debit: 500, credit: 100 },
      { code: "621", name: "Sueldos", type: "Gasto", debit: 400, credit: 0 },
      { code: "701", name: "Ventas", type: "Ingreso", debit: 0, credit: 1200.5 },
      { code: "999", name: "Sin movimiento", type: "Activo", debit: 0, credit: 0 },
    ];
    const top = buildTopAccounts(accounts);
    expect(top.map((t) => t.code)).toEqual(["701", "101", "621"]);
    expect(top[0]).toEqual({ code: "701", name: "Ventas", amount: 1200.5 });
  });

  it("limita a 8 cuentas (top N)", () => {
    const accounts: AccountMovement[] = Array.from({ length: 12 }, (_, i) => ({
      code: `63${i}`,
      name: `Cuenta ${i}`,
      type: "Gasto",
      debit: 100 + i,
      credit: 0,
    }));
    expect(buildTopAccounts(accounts)).toHaveLength(8);
  });
});

/* ------------------------------------------------------------------ *
 * T018 — US3: rango por defecto
 * ------------------------------------------------------------------ */

describe("resolveDefaultRange", () => {
  it("usa el periodo contable abierto cuando existe", () => {
    expect(
      resolveDefaultRange(
        { startDate: "2026-03-01", endDate: "2026-03-31" },
        "2026-03-15"
      )
    ).toEqual({ desde: "2026-03-01", hasta: "2026-03-31" });
  });

  it("usa los últimos 12 meses cuando no hay periodo abierto", () => {
    expect(resolveDefaultRange(null, "2026-03-15")).toEqual({
      desde: "2025-03-15",
      hasta: "2026-03-15",
    });
  });

  it("ignora un periodo abierto con fechas inválidas", () => {
    expect(
      resolveDefaultRange({ startDate: "31/03/2026", endDate: "2026-03-31" }, "2026-03-15")
    ).toEqual({ desde: "2025-03-15", hasta: "2026-03-15" });
  });
});
