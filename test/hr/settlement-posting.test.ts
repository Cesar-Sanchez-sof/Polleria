import { describe, expect, it } from "vitest";
import { settlementAccrualLines } from "@/lib/services/hr/settlement-posting.service";
import { calculateSettlement } from "@/lib/services/hr/social-benefits-rules";

const base = calculateSettlement({
  regime: "General",
  type: "PlazoIndeterminado",
  baseSalary: 1500,
  familyAllowance: 0,
  serviceStart: "2025-03-01",
  cutoff: "2026-10-31",
  contractEnd: null,
  pensionSystem: "AFP",
  afpName: "Integra",
  usedVacationDays: 0,
  gratificationAbsences: 0,
  ctsAbsences: 0,
  pendingAdvances: 200,
  otherDeductions: 0,
  arbitraryDismissal: false,
} as never);

describe("asiento de liquidación", () => {
  const s = { ...base, pension_system: "AFP" } as never;
  const lines = settlementAccrualLines(s);
  const debit = lines.reduce((t, l) => t + (l.debit ?? 0), 0);
  const credit = lines.reduce((t, l) => t + (l.credit ?? 0), 0);

  it("cuadra: Debe = Haber", () => {
    expect(Math.abs(debit - credit)).toBeLessThan(0.01);
    expect(debit).toBeCloseTo(base.total_income, 2);
  });

  it("usa las cuentas de gasto y pasivo esperadas", () => {
    const get = (c: string) => lines.find((l) => l.accountCode === c);
    expect(get("6215")?.debit).toBe(base.vacations.total);
    expect(get("6214")?.debit).toBe(base.gratification.total);
    expect(get("6251")?.debit).toBe(base.cts.amount);
    expect(get("407")?.credit).toBe(base.pension_deduction);
    expect(get("141")?.credit).toBe(base.advance_deduction);
    expect(get("411")?.credit).toBeCloseTo(base.net_total, 2);
  });
});
