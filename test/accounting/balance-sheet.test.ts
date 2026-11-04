import { describe, it, expect } from "vitest";
import {
  buildBalanceSheet,
  computePeriodResult,
  signedBalance,
  type AccountBalanceInput,
} from "@/lib/accounting/balance-sheet";

describe("signedBalance", () => {
  it("usa naturaleza deudora para activo, gasto y costo", () => {
    expect(signedBalance("Activo", 100, 20)).toBe(80);
    expect(signedBalance("Gasto", 50, 0)).toBe(50);
    expect(signedBalance("Costo", 40, 5)).toBe(35);
  });

  it("usa naturaleza acreedora para pasivo, patrimonio e ingreso", () => {
    expect(signedBalance("Pasivo", 10, 90)).toBe(80);
    expect(signedBalance("Patrimonio", 0, 1000)).toBe(1000);
    expect(signedBalance("Ingreso", 0, 200)).toBe(200);
  });
});

describe("computePeriodResult", () => {
  it("calcula utilidad = ingresos - gastos - costos", () => {
    const accounts: AccountBalanceInput[] = [
      { code: "701", name: "Ventas", type: "Ingreso", debit: 0, credit: 1180 },
      { code: "691", name: "Costo de ventas", type: "Costo", debit: 400, credit: 0 },
      { code: "621", name: "Personal", type: "Gasto", debit: 200, credit: 0 },
      { code: "1", name: "Activo", type: "Activo", debit: 0, credit: 0 },
    ];
    expect(computePeriodResult(accounts)).toBe(580);
  });

  it("puede resultar en pérdida", () => {
    const accounts: AccountBalanceInput[] = [
      { code: "701", name: "Ventas", type: "Ingreso", debit: 0, credit: 100 },
      { code: "691", name: "Costo", type: "Costo", debit: 250, credit: 0 },
    ];
    expect(computePeriodResult(accounts)).toBe(-150);
  });
});

describe("buildBalanceSheet (SUNAT / PCGE)", () => {
  const baseAccounts: AccountBalanceInput[] = [
    { code: "101", name: "Caja", type: "Activo", debit: 500, credit: 0 },
    { code: "104", name: "Bancos", type: "Activo", debit: 1500, credit: 200 },
    { code: "121", name: "Cuentas por cobrar", type: "Activo", debit: 300, credit: 0 },
    { code: "201", name: "Mercaderías", type: "Activo", debit: 800, credit: 100 },
    { code: "241", name: "Materias primas", type: "Activo", debit: 400, credit: 0 },
    { code: "331", name: "Maquinaria", type: "Activo", debit: 10000, credit: 0 },
    { code: "395", name: "Depreciación acumulada", type: "Activo", debit: 0, credit: 2000 },
    { code: "401", name: "IGV por pagar", type: "Pasivo", debit: 0, credit: 180 },
    { code: "421", name: "Proveedores", type: "Pasivo", debit: 50, credit: 650 },
    { code: "501", name: "Capital", type: "Patrimonio", debit: 0, credit: 8850 },
    { code: "591", name: "Resultados acumulados", type: "Patrimonio", debit: 0, credit: 500 },
    { code: "701", name: "Ventas", type: "Ingreso", debit: 0, credit: 2000 },
    { code: "691", name: "Costo de ventas", type: "Costo", debit: 700, credit: 0 },
    { code: "621", name: "Gastos de personal", type: "Gasto", debit: 230, credit: 0 },
  ];

  it("cumple Activo = Pasivo + Patrimonio incluyendo resultado del ejercicio", () => {
    const statement = buildBalanceSheet({
      asOf: "2026-03-31",
      accounts: baseAccounts,
      companyName: "Pollería Demo S.A.C.",
    });

    // Activo corriente: 500 + 1300 + 300 + 700 + 400 = 3200
    expect(statement.totals.currentAssets).toBe(3200);
    // Activo no corriente: 10000 - 2000 = 8000
    expect(statement.totals.nonCurrentAssets).toBe(8000);
    expect(statement.totals.totalAssets).toBe(11200);

    // Pasivo: 180 + 600 = 780
    expect(statement.totals.totalLiabilities).toBe(780);

    // Patrimonio antes de resultado: 8850 + 500 = 9350
    expect(statement.totals.equityBeforeResult).toBe(9350);
    // Resultado: 2000 - 700 - 230 = 1070
    expect(statement.totals.periodResult).toBe(1070);
    expect(statement.totals.totalEquity).toBe(10420);

    expect(statement.totals.totalLiabilitiesAndEquity).toBe(11200);
    expect(statement.balanced).toBe(true);
    expect(statement.difference).toBe(0);
    expect(statement.reportTitle).toBe("Estado de Situación Financiera");
    expect(statement.currency).toBe("PEN");
  });

  it("incluye secciones normativas de activo corriente/no corriente y pasivo/patrimonio", () => {
    const statement = buildBalanceSheet({ asOf: "2026-12-31", accounts: baseAccounts });
    const labels = statement.lines.map((l) => l.label);

    expect(labels).toContain("ACTIVO");
    expect(labels).toContain("Activo corriente");
    expect(labels).toContain("Activo no corriente");
    expect(labels).toContain("PASIVO");
    expect(labels).toContain("Pasivo corriente");
    expect(labels).toContain("PATRIMONIO");
    expect(labels).toContain("Resultado del ejercicio");
    expect(labels).toContain("TOTAL ACTIVO");
    expect(labels).toContain("TOTAL PASIVO Y PATRIMONIO");
  });

  it("detecta descuadre si faltan movimientos", () => {
    const unbalanced: AccountBalanceInput[] = [
      { code: "101", name: "Caja", type: "Activo", debit: 100, credit: 0 },
      { code: "501", name: "Capital", type: "Patrimonio", debit: 0, credit: 50 },
    ];
    const statement = buildBalanceSheet({ asOf: "2026-01-31", accounts: unbalanced });
    expect(statement.balanced).toBe(false);
    expect(statement.difference).toBe(50);
  });
});
