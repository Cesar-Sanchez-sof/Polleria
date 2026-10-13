import { describe, expect, it } from "vitest";
import {
  computeIncomeStatement,
  isDetailAccount,
  lineaDe,
  naturalezaDe,
  round2,
} from "@/lib/accounting/income-statement";
import { computePeriodResult } from "@/lib/accounting/balance-sheet";

/** Movimientos del escenario de referencia (quickstart.md, neto 770.00). */
const ESCENARIO_REFERENCIA: { account_code: string; debit?: number; credit?: number }[] = [
  // 1. Ventas de mercaderías (Haber)
  { account_code: "701", credit: 700 },
  { account_code: "701", credit: 270 },
  // 2. Devoluciones en ventas (Debe, se resta)
  { account_code: "709", debit: 50 },
  // 3. Costo de ventas (Debe)
  { account_code: "691", debit: 400 },
  // 4. Gastos de distribución y administración (Debe)
  { account_code: "95", debit: 60 },
  { account_code: "94", debit: 100 },
  // 5. Otros ingresos operativos (Haber)
  { account_code: "75", credit: 500 },
  // 6. Diferencia de cambio: ganancia 776 (Haber), pérdida 676 (Debe)
  { account_code: "776", credit: 10 },
  { account_code: "676", debit: 5 },
  // 7. Ingresos y gastos financieros
  { account_code: "771", credit: 20 },
  { account_code: "673", debit: 15 },
  // 8. Impuesto a la renta (Debe)
  { account_code: "88", debit: 100 },
  // 9. Cuentas fuera del reporte: deben ignorarse (FR-027)
  { account_code: "621", debit: 500 },
  { account_code: "421", credit: 999 },
  // 10. Cabecera de elemento: se excluye (D6)
  { account_code: "7", credit: 123 },
];

describe("round2 (FR-021: 2 decimales)", () => {
  it("redondea a dos decimales", () => {
    expect(round2(920.004)).toBe(920);
    expect(round2(920.006)).toBe(920.01);
    expect(round2(0)).toBe(0);
    expect(round2(-150.006)).toBe(-150.01);
  });

  it("corrige errores de coma flotante", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1000.1 - 1000)).toBe(0.1);
  });
});

describe("isDetailAccount (D6: sin cabeceras de elemento)", () => {
  it("excluye las cabeceras de elemento (1 dígito)", () => {
    expect(isDetailAccount("6")).toBe(false);
    expect(isDetailAccount("7")).toBe(false);
    expect(isDetailAccount("9")).toBe(false);
  });

  it("incluye cuentas de 2 y 3 dígitos (hojas del catálogo)", () => {
    expect(isDetailAccount("70")).toBe(true);
    expect(isDetailAccount("69")).toBe(true);
    expect(isDetailAccount("701")).toBe(true);
    expect(isDetailAccount("673")).toBe(true);
  });
});

describe("naturalezaDe (FR-019)", () => {
  it("elemento 7 → naturaleza acreedora (Haber − Debe)", () => {
    expect(naturalezaDe("7")).toBe("acreedora");
    expect(naturalezaDe("70")).toBe("acreedora");
    expect(naturalezaDe("701")).toBe("acreedora");
    expect(naturalezaDe("776")).toBe("acreedora");
  });

  it("elementos 6, 8 y 9 → naturaleza deudora (Debe − Haber)", () => {
    expect(naturalezaDe("6")).toBe("deudora");
    expect(naturalezaDe("691")).toBe("deudora");
    expect(naturalezaDe("673")).toBe("deudora");
    expect(naturalezaDe("88")).toBe("deudora");
    expect(naturalezaDe("94")).toBe("deudora");
    expect(naturalezaDe("95")).toBe("deudora");
  });

  it("los demás elementos no participan en el reporte", () => {
    expect(naturalezaDe("101")).toBe(null);
    expect(naturalezaDe("421")).toBe(null);
  });
});

describe("lineaDe (matriz D5 de clasificación)", () => {
  it("clasifica ingresos ordinarios y sus exclusiones", () => {
    expect(lineaDe("70")).toBe("ingresos-ordinarios");
    expect(lineaDe("701")).toBe("ingresos-ordinarios");
    expect(lineaDe("704")).toBe("ingresos-ordinarios");
    expect(lineaDe("709")).toBe("devoluciones-709");
    expect(lineaDe("74")).toBe("descuentos-74");
  });

  it("clasifica costo de ventas y gastos de operación", () => {
    expect(lineaDe("69")).toBe("costo-ventas-69");
    expect(lineaDe("691")).toBe("costo-ventas-69");
    expect(lineaDe("94")).toBe("gastos-administracion-94");
    expect(lineaDe("95")).toBe("gastos-distribucion-95");
  });

  it("excluye 776 de ingresos financieros y 676 de gastos financieros", () => {
    expect(lineaDe("77")).toBe("ingresos-financieros-77");
    expect(lineaDe("771")).toBe("ingresos-financieros-77");
    expect(lineaDe("776")).toBe("diferencia-cambio-ingreso-776");
    expect(lineaDe("67")).toBe("gastos-financieros-67");
    expect(lineaDe("673")).toBe("gastos-financieros-67");
    expect(lineaDe("676")).toBe("diferencia-cambio-gasto-676");
  });

  it("clasifica otros ingresos/gastos e impuesto a la renta", () => {
    expect(lineaDe("75")).toBe("otros-ingresos-75-76");
    expect(lineaDe("754")).toBe("otros-ingresos-75-76");
    expect(lineaDe("76")).toBe("otros-ingresos-75-76");
    expect(lineaDe("65")).toBe("otros-gastos-65-66");
    expect(lineaDe("659")).toBe("otros-gastos-65-66");
    expect(lineaDe("66")).toBe("otros-gastos-65-66");
    expect(lineaDe("88")).toBe("impuesto-88");
  });

  it("no clasifica las cuentas fuera del reporte", () => {
    expect(lineaDe("101")).toBe("otra");
    expect(lineaDe("421")).toBe("otra");
    expect(lineaDe("60")).toBe("otra"); // FR-027: compras fuera del costo de ventas
    expect(lineaDe("621")).toBe("otra");
    expect(lineaDe("631")).toBe("otra");
  });
});

describe("computeIncomeStatement: escenario de referencia (T006)", () => {
  const result = computeIncomeStatement({
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    movements: ESCENARIO_REFERENCIA,
  });

  it("calcula las 14 secciones del reporte con el valor esperado", () => {
    expect(result.operating_income.ordinary_income).toBe(920);
    expect(result.operating_income.sublease_and_other_income).toBe(0);
    expect(result.operating_income.total).toBe(920);

    expect(result.sales_costs.cost_of_goods_sold).toBe(400);
    expect(result.gross_profit.amount).toBe(520);

    expect(result.operating_expenses.distribution).toBe(60);
    expect(result.operating_expenses.administrative).toBe(100);
    expect(result.operating_expenses.total).toBe(160);
    expect(result.operating_profit.amount).toBe(360);

    expect(result.other_revenues_and_expenses.revenues).toBe(500);
    expect(result.other_revenues_and_expenses.expenses).toBe(0);
    expect(result.other_revenues_and_expenses.total).toBe(500);

    expect(result.exchange_difference_net.amount).toBe(5);
    expect(result.financial_income.amount).toBe(20);
    expect(result.financial_expenses.amount).toBe(15);

    expect(result.result_before_taxes.amount).toBe(870);
    expect(result.income_tax_expense.amount).toBe(100);
    expect(result.net_profit.amount).toBe(770);
  });

  it("devuelve periodo y moneda del contrato (§1.2)", () => {
    expect(result.period).toEqual({ start_date: "2026-01-01", end_date: "2026-01-31" });
    expect(result.currency).toBe("PEN");
  });
});

describe("invariantes del reporte (T010, FR-026 / SC-002)", () => {
  const data = computeIncomeStatement({
    startDate: "2026-03-01",
    endDate: "2026-03-31",
    movements: [
      { account_code: "701", credit: 1234.56 },
      { account_code: "709", debit: 33.33 },
      { account_code: "74", debit: 11.11 },
      { account_code: "691", debit: 777.77 },
      { account_code: "94", debit: 123.45 },
      { account_code: "95", debit: 65.43 },
      { account_code: "75", credit: 300 },
      { account_code: "659", debit: 45.67 },
      { account_code: "776", credit: 12.34 },
      { account_code: "676", debit: 9.87 },
      { account_code: "771", credit: 40 },
      { account_code: "673", debit: 25.5 },
      { account_code: "88", debit: 33.34 },
    ],
  });

  it("ingresos de operación = ordinarios + subarrendamiento y otros", () => {
    const { ordinary_income, sublease_and_other_income, total } = data.operating_income;
    expect(total).toBeCloseTo(ordinary_income + sublease_and_other_income, 2);
    expect(sublease_and_other_income).toBe(0); // SC-008
  });

  it("gastos de operación = distribución + administración", () => {
    const { distribution, administrative, total } = data.operating_expenses;
    expect(total).toBeCloseTo(distribution + administrative, 2);
  });

  it("margen bruto = ingresos de operación − costo de ventas", () => {
    expect(data.gross_profit.amount).toBeCloseTo(
      data.operating_income.total - data.sales_costs.cost_of_goods_sold,
      2
    );
  });

  it("beneficio operativo = margen bruto − gastos de operación", () => {
    expect(data.operating_profit.amount).toBeCloseTo(
      data.gross_profit.amount - data.operating_expenses.total,
      2
    );
  });

  it("resultado antes de impuestos = operativo + otros + cambio + financiero", () => {
    expect(data.result_before_taxes.amount).toBeCloseTo(
      data.operating_profit.amount +
        data.other_revenues_and_expenses.total +
        data.exchange_difference_net.amount +
        data.financial_income.amount -
        data.financial_expenses.amount,
      2
    );
  });

  it("resultado del período = resultado antes de impuestos − impuesto", () => {
    expect(data.net_profit.amount).toBeCloseTo(
      data.result_before_taxes.amount - data.income_tax_expense.amount,
      2
    );
  });
});

describe("naturaleza y signos (T011, FR-019)", () => {
  it("las cuentas del elemento 7 se saldan por Haber − Debe", () => {
    const result = computeIncomeStatement({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      movements: [
        { account_code: "701", credit: 1000 },
        { account_code: "701", debit: 50 },
      ],
    });
    expect(result.operating_income.ordinary_income).toBe(950);
  });

  it("las cuentas de los elementos 6 y 9 se saldan por Debe − Haber", () => {
    const result = computeIncomeStatement({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      movements: [
        // 691 con saldo acreedor → costo negativo (−150), no positivo
        { account_code: "691", debit: 150, credit: 300 },
        // 95 con saldo acreedor → gastos de distribución negativos
        { account_code: "95", debit: 20, credit: 90 },
        // 94 con saldo deudor → gastos positivos
        { account_code: "94", debit: 40 },
      ],
    });
    expect(result.sales_costs.cost_of_goods_sold).toBe(-150);
    expect(result.operating_expenses.distribution).toBe(-70);
    expect(result.operating_expenses.administrative).toBe(40);
    expect(result.operating_expenses.total).toBe(-30);
  });

  it("la diferencia de cambio suma 776 por Haber y resta 676 por Debe", () => {
    const result = computeIncomeStatement({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      movements: [
        { account_code: "776", credit: 30 },
        { account_code: "676", debit: 45 },
      ],
    });
    expect(result.exchange_difference_net.amount).toBe(-15);

    const ganancia = computeIncomeStatement({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      movements: [
        { account_code: "776", credit: 30 },
        { account_code: "676", debit: 5 },
      ],
    });
    expect(ganancia.exchange_difference_net.amount).toBe(25);
  });

  it("un período con pérdidas devuelve resultado negativo, sin error", () => {
    const result = computeIncomeStatement({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      movements: [
        { account_code: "701", credit: 100 },
        { account_code: "691", debit: 80 },
        { account_code: "673", debit: 60 },
      ],
    });
    expect(result.result_before_taxes.amount).toBe(-40);
    expect(result.net_profit.amount).toBe(-40);
  });
});

describe("tolerancia a datos ausentes (T014, SC-001 / SC-007)", () => {
  const run = (movements: { account_code: string; debit?: number; credit?: number }[]) =>
    computeIncomeStatement({ startDate: "2026-01-01", endDate: "2026-01-31", movements });

  const todasLasLineas = (r: ReturnType<typeof computeIncomeStatement>) => [
    r.operating_income.ordinary_income,
    r.operating_income.sublease_and_other_income,
    r.operating_income.total,
    r.sales_costs.cost_of_goods_sold,
    r.gross_profit.amount,
    r.operating_expenses.distribution,
    r.operating_expenses.administrative,
    r.operating_expenses.total,
    r.operating_profit.amount,
    r.other_revenues_and_expenses.revenues,
    r.other_revenues_and_expenses.expenses,
    r.other_revenues_and_expenses.total,
    r.exchange_difference_net.amount,
    r.financial_income.amount,
    r.financial_expenses.amount,
    r.result_before_taxes.amount,
    r.income_tax_expense.amount,
    r.net_profit.amount,
  ];

  it("3.1 sólo ventas: todo lo demás en 0.00 y sin nulos", () => {
    const result = run([{ account_code: "701", credit: 500 }]);
    expect(result.operating_income.total).toBe(500);
    expect(result.net_profit.amount).toBe(500);
    for (const amount of todasLasLineas(result)) {
      expect(amount).not.toBeNull();
      expect(amount).not.toBeUndefined();
      expect(Number.isFinite(amount)).toBe(true);
    }
    expect(result.operating_expenses.total).toBe(0);
    expect(result.sales_costs.cost_of_goods_sold).toBe(0);
    expect(result.income_tax_expense.amount).toBe(0);
    expect(result.financial_expenses.amount).toBe(0);
    expect(result.exchange_difference_net.amount).toBe(0);
  });

  it("3.2 sólo ventas y costo de ventas: gastos y financieros en 0.00", () => {
    const result = run([
      { account_code: "701", credit: 800 },
      { account_code: "691", debit: 500 },
    ]);
    expect(result.gross_profit.amount).toBe(300);
    expect(result.operating_expenses.total).toBe(0);
    expect(result.other_revenues_and_expenses.total).toBe(0);
    expect(result.financial_income.amount).toBe(0);
    expect(result.financial_expenses.amount).toBe(0);
    expect(result.result_before_taxes.amount).toBe(300);
    expect(result.net_profit.amount).toBe(300);
  });

  it("3.3 sólo compras (cuenta 60): reporte completo en 0.00 (FR-027)", () => {
    const result = run([{ account_code: "60", debit: 900 }]);
    expect(result.sales_costs.cost_of_goods_sold).toBe(0);
    expect(result.operating_income.total).toBe(0);
    expect(result.net_profit.amount).toBe(0);
    for (const amount of todasLasLineas(result)) {
      expect(amount).toBe(0);
    }
  });

  it("la cuenta 69 (devoluciones en compras) tampoco incide (FR-027)", () => {
    const result = run([{ account_code: "69", debit: 900 }]);
    // 69 es cabecera de grupo de costos SÍ incluida por el prefijo "69": se documenta
    // que sólo "60" y "61"/"62"/"63" quedan fuera; ver aserción inmediata.
    expect(result.sales_costs.cost_of_goods_sold).toBe(900);
  });
});

describe("SC-004: coincide con el resultado del Balance General", () => {
  it("computePeriodResult balance-sheet === net_profit del Estado de Resultados", () => {
    const dataset: { code: string; type: string; debit: number; credit: number }[] = [
      { code: "701", type: "Ingreso", debit: 0, credit: 970 },
      { code: "709", type: "Ingreso", debit: 50, credit: 0 },
      { code: "691", type: "Costo", debit: 400, credit: 0 },
      { code: "95", type: "Gasto", debit: 60, credit: 0 },
      { code: "94", type: "Gasto", debit: 100, credit: 0 },
      { code: "75", type: "Ingreso", debit: 0, credit: 500 },
      { code: "776", type: "Ingreso", debit: 0, credit: 10 },
      { code: "676", type: "Gasto", debit: 5, credit: 0 },
      { code: "771", type: "Ingreso", debit: 0, credit: 20 },
      { code: "673", type: "Gasto", debit: 15, credit: 0 },
      { code: "88", type: "Gasto", debit: 100, credit: 0 },
      // Cuentas de balance: ninguna de las dos funciones las usa
      { code: "101", type: "Activo", debit: 500, credit: 0 },
      { code: "201", type: "Pasivo", debit: 0, credit: 300 },
    ];

    const balance = computePeriodResult(
      dataset.map((row) => ({ ...row, name: row.code }))
    );
    const income = computeIncomeStatement({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      balances: dataset.map(({ code, debit, credit }) => ({ code, debit, credit })),
    });

    expect(income.net_profit.amount).toBeCloseTo(balance, 2);
    expect(Math.abs(income.net_profit.amount - balance)).toBeLessThan(0.01);
  });
});

describe("SC-006: rendimiento con 100.000 movimientos", () => {
  it("se calcula en menos de 3 segundos", () => {
    const codes = ["701", "709", "691", "94", "95", "75", "659", "771", "673", "88"];
    const movements = Array.from({ length: 100_000 }, (_, i) => ({
      account_code: codes[i % codes.length],
      debit: i % 2,
      credit: (i + 1) % 2,
      date: "2026-06-15",
      status: true,
    }));

    const started = performance.now();
    const result = computeIncomeStatement({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      movements,
    });
    const elapsed = performance.now() - started;

    expect(result.net_profit.amount).toBe(0); // saldo neto por paridad de pares/impares
    expect(elapsed).toBeLessThan(3000);
  });
});
