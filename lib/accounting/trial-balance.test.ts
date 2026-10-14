import { describe, it, expect } from "vitest";
import {
  buildTrialBalance,
  formatPeriodLabel,
  type TrialBalanceAccountInput,
} from "@/lib/accounting/trial-balance";

function account(
  code: string,
  name: string,
  type: string,
  amounts: Partial<Omit<TrialBalanceAccountInput, "code" | "name" | "type">> = {}
): TrialBalanceAccountInput {
  return {
    code,
    name,
    type,
    initialDebit: 0,
    initialCredit: 0,
    periodDebit: 0,
    periodCredit: 0,
    ...amounts,
  };
}

describe("formatPeriodLabel", () => {
  it("resume un periodo dentro del mismo mes como 'mes año'", () => {
    expect(formatPeriodLabel("2026-10-01", "2026-10-31")).toBe("oct 2026");
    // es-PE usa "set" para septiembre (convención SUNAT).
    expect(formatPeriodLabel("2026-09-01", "2026-09-30")).toBe("set 2026");
  });

  it("muestra el rango completo cuando cruza meses", () => {
    expect(formatPeriodLabel("2026-09-15", "2026-10-14")).toBe("del 15/09/2026 al 14/10/2026");
  });
});

describe("buildTrialBalance", () => {
  it("agrupa por elemento y sub-elemento con inicial + movimiento = final", () => {
    const statement = buildTrialBalance({
      from: "2026-10-01",
      to: "2026-10-31",
      accounts: [
        account("101", "Caja", "Activo", { initialDebit: 100, periodDebit: 50, periodCredit: 20 }),
        account("104", "Bancos", "Activo", { initialDebit: 200, initialCredit: 30 }),
        account("401", "IGV por pagar", "Pasivo", { initialCredit: 180, periodCredit: 20 }),
      ],
    });

    const group1 = statement.lines.find((l) => l.kind === "group" && l.code === "1");
    const sub10 = statement.lines.find((l) => l.kind === "subgroup" && l.code === "10");
    expect(group1?.amounts).toEqual({
      initialDebit: 300,
      initialCredit: 30,
      periodDebit: 50,
      periodCredit: 20,
      finalDebit: 350,
      finalCredit: 50,
    });
    expect(sub10?.amounts.finalDebit).toBe(350);

    // La cuenta 101 se lista bajo el sub-elemento 10.
    const idxSub10 = statement.lines.findIndex((l) => l.key === "subgroup-10");
    const idxCaja = statement.lines.findIndex((l) => l.key === "account-101");
    expect(idxCaja).toBeGreaterThan(idxSub10);
  });

  it("cuando el periodo cuadra, Debe final = Haber final", () => {
    const statement = buildTrialBalance({
      from: "2026-10-01",
      to: "2026-10-31",
      accounts: [
        account("101", "Caja", "Activo", { periodDebit: 500 }),
        account("701", "Ventas", "Ingreso", { periodCredit: 500 }),
      ],
    });

    expect(statement.totals.finalDebit).toBe(500);
    expect(statement.totals.finalCredit).toBe(500);
    expect(statement.balanced).toBe(true);
    expect(statement.difference).toBe(0);
    expect(statement.accountCount).toBe(2);
  });

  it("reporta descuadre cuando la diferencia supera 0,005", () => {
    const statement = buildTrialBalance({
      from: "2026-10-01",
      to: "2026-10-31",
      accounts: [account("101", "Caja", "Activo", { periodDebit: 100.02 })],
    });

    expect(statement.balanced).toBe(false);
    expect(statement.difference).toBe(100.02);
  });

  it("omite cuentas sin saldo ni movimiento", () => {
    const statement = buildTrialBalance({
      from: "2026-10-01",
      to: "2026-10-31",
      accounts: [
        account("101", "Caja", "Activo", { periodDebit: 10 }),
        account("421", "Proveedores", "Pasivo"),
      ],
    });

    expect(statement.lines.some((l) => l.code === "421")).toBe(false);
    expect(statement.accountCount).toBe(1);
  });

  it("coloca los códigos sin elemento bajo '(Sin grupo)'", () => {
    const statement = buildTrialBalance({
      from: "2026-10-01",
      to: "2026-10-31",
      accounts: [
        account("101", "Caja", "Activo", { periodDebit: 10 }),
        account("AJUSTE-01", "Ajuste manual", "Activo", { periodDebit: 5 }),
      ],
    });

    const sinGrupo = statement.lines.find((l) => l.label === "(Sin grupo)");
    expect(sinGrupo?.kind).toBe("group");
    expect(sinGrupo?.code).toBeNull();
    expect(sinGrupo?.amounts.finalDebit).toBe(5);
    // "(Sin grupo)" se lista después de los elementos numéricos.
    expect(statement.lines.at(-1)?.code).toBe("AJUSTE-01");
  });

  it("usa el tipo predominante cuando el nombre de la cabecera no coincide", () => {
    // Caso real del plan: la cabecera "4" se llama "Ingresos" pero sus hijos
    // (40..46) son Pasivo; la etiqueta debe seguir a las cuentas del grupo.
    const statement = buildTrialBalance({
      from: "2026-10-01",
      to: "2026-10-31",
      accounts: [
        account("4", "Ingresos", "Ingreso"),
        account("401", "IGV por pagar", "Pasivo", { initialCredit: 180 }),
        account("421", "Proveedores", "Pasivo", { periodCredit: 650 }),
      ],
    });

    const group4 = statement.lines.find((l) => l.kind === "group" && l.code === "4");
    expect(group4?.label).toBe("Pasivo");
    expect(group4?.amounts.finalCredit).toBe(830);
  });

  it("suma las cuentas cabecera de 2 dígitos en su sub-elemento sin duplicar filas", () => {
    const statement = buildTrialBalance({
      from: "2026-10-01",
      to: "2026-10-31",
      accounts: [
        account("10", "Efectivo y equivalentes de efectivo", "Activo", { initialDebit: 206.91 }),
        account("101", "Caja", "Activo", { initialDebit: 100 }),
      ],
    });

    const sub10 = statement.lines.find((l) => l.kind === "subgroup" && l.code === "10");
    expect(sub10?.amounts.initialDebit).toBe(306.91);
    // No se duplica una fila de cuenta "10" además del sub-elemento.
    expect(statement.lines.filter((l) => l.code === "10")).toHaveLength(1);
  });

  it("los totales son la suma de todas las cuentas mostradas", () => {
    const statement = buildTrialBalance({
      from: "2026-10-01",
      to: "2026-10-31",
      accounts: [
        account("101", "Caja", "Activo", { initialDebit: 213.99, periodDebit: 40 }),
        account("121", "Clientes", "Activo", { initialDebit: 7.08 }),
        account("401", "IGV por pagar", "Pasivo", { initialCredit: 17.4 }),
        account("591", "Resultados acumulados", "Patrimonio", { initialDebit: 381.1 }),
      ],
    });

    expect(statement.totals.initialDebit).toBe(602.17);
    expect(statement.totals.initialCredit).toBe(17.4);
    expect(statement.totals.finalDebit).toBe(642.17);
    expect(statement.totals.finalCredit).toBe(17.4);
    expect(statement.periodLabel).toBe("oct 2026");
    expect(statement.balanced).toBe(false);
  });
});
