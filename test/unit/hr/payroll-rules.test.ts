import { describe, expect, it } from "vitest";
import {
  annualIncomeTax,
  calculatePayroll,
  contractDaysInMonth,
  familyAllowanceAmount,
  monthlyIncomeTax,
  overtimePay,
  pensionDeduction,
  UIT,
  type PayrollInput,
} from "@/lib/services/hr/payroll-rules";
import { accrualLines } from "@/lib/services/hr/payroll.service";

const base: PayrollInput = {
  contractType: "Indeterminado",
  regime: "General",
  baseSalary: 1500,
  familyAllowance: false,
  pensionSystem: "ONP",
  afpName: null,
  contractDays: 30,
  absenceDays: 0,
  unpaidLeaveDays: 0,
  lateMinutes: 0,
  dailyExtraMinutes: [],
  bonus: 0,
  otherDeductions: 0,
  advanceInstallments: [],
  insurancePremiums: 0,
};

describe("componentes de la planilla", () => {
  it("asignación familiar = 10 % de la RMV", () => {
    expect(familyAllowanceAmount()).toBe(113);
  });

  it("horas extra: 25 % las 2 primeras horas del día, 35 % las siguientes y nada bajo 30 min", () => {
    // hora = 1500/30/8 = 6.25 → 2 h × 7.8125 + 1 h × 8.4375 = 24.0625
    expect(overtimePay(1500, [180])).toEqual({ minutes: 180, amount: 24.06 });
    expect(overtimePay(1500, [20])).toEqual({ minutes: 0, amount: 0 });
  });

  it("ONP 13 % y AFP con aporte, prima y comisión", () => {
    expect(pensionDeduction(1000, "ONP", null).amount).toBe(130);
    const afp = pensionDeduction(1000, "AFP", "Integra");
    expect(afp.detail).toEqual({ afp_contribution: 100, afp_insurance: 13.7, afp_commission: 15.5 });
    expect(afp.amount).toBe(129.2);
  });

  it("renta de 5.ª: escala progresiva y sin retención bajo 7 UIT", () => {
    expect(annualIncomeTax(5 * UIT)).toBe(2140); // 26 750 × 8 %
    expect(monthlyIncomeTax({ fixedMonthly: 1500, variableThisMonth: 0, regime: "General", type: "Indeterminado" })).toBe(0);
    expect(monthlyIncomeTax({ fixedMonthly: 5000, variableThisMonth: 0, regime: "General", type: "Indeterminado" })).toBeGreaterThan(0);
  });

  it("días comerciales del contrato dentro del mes", () => {
    expect(contractDaysInMonth(2026, 10, "2025-01-01", null)).toBe(30);
    expect(contractDaysInMonth(2026, 10, "2026-10-21", null)).toBe(11);
    expect(contractDaysInMonth(2026, 10, "2025-01-01", "2026-10-10")).toBe(10);
    expect(contractDaysInMonth(2026, 10, "2026-11-01", null)).toBe(0);
  });
});

describe("calculatePayroll (boleta)", () => {
  it("mes completo con ONP y asignación familiar", () => {
    const r = calculatePayroll({ ...base, familyAllowance: true });
    expect(r).toMatchObject({ paid_days: 30, basic_pay: 1500, family_allowance: 113, gross_pay: 1613, pension_amount: 209.69, net_pay: 1403.31, essalud: 145.17 });
  });

  it("descuenta faltas, licencias sin goce y tardanzas", () => {
    const r = calculatePayroll({ ...base, absenceDays: 2, unpaidLeaveDays: 1, lateMinutes: 60 });
    // 27 días × 50 = 1350; tardanza 60 min × (1500/30/8/60) = 6.25
    expect(r).toMatchObject({ unpaid_days: 3, paid_days: 27, basic_pay: 1350, late_discount: 6.25, gross_pay: 1343.75 });
    expect(r.detail.warnings[0]).toMatch(/3 día/);
  });

  it("descuenta adelantos sin dejar el neto negativo", () => {
    const r = calculatePayroll({ ...base, advanceInstallments: [{ advance_id: 1, amount: 200 }, { advance_id: 2, amount: 2000 }] });
    expect(r.detail.advances[0]).toEqual({ advance_id: 1, amount: 200 });
    expect(r.net_pay).toBe(0);
    expect(r.detail.warnings.some((w) => w.includes("#2"))).toBe(true);
  });

  it("practicante: subvención sin pensión, EsSalud ni horas extra", () => {
    const r = calculatePayroll({ ...base, contractType: "Practicas", baseSalary: 1130, pensionSystem: "Ninguno", dailyExtraMinutes: [120] });
    expect(r).toMatchObject({ gross_pay: 1130, pension_amount: 0, essalud: 0, overtime_pay: 0, net_pay: 1130 });
  });

  it("EsSalud con base mínima de la RMV proporcional a los días", () => {
    const r = calculatePayroll({ ...base, baseSalary: 700, contractType: "TiempoParcial" });
    expect(r.essalud).toBe(101.7);
  });
});

describe("asiento de devengo de la planilla", () => {
  it("cuadra Debe = Haber con ONP, AFP, 5.ª, adelantos y seguros", () => {
    const onp = { ...calculatePayroll({ ...base, familyAllowance: true, insurancePremiums: 15, advanceInstallments: [{ advance_id: 1, amount: 100 }] }), pension_system: "ONP" };
    const afp = { ...calculatePayroll({ ...base, baseSalary: 6000, pensionSystem: "AFP", afpName: "Prima", bonus: 300 }), pension_system: "AFP Prima" };
    const lines = accrualLines([onp, afp] as never, "Octubre 2026");
    const debit = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const credit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    expect(Math.round(debit * 100)).toBe(Math.round(credit * 100));
    const byCode = Object.fromEntries(lines.map((l) => [l.accountCode, l.debit || l.credit]));
    expect(byCode["6211"]).toBeCloseTo(onp.gross_pay + afp.gross_pay, 2);
    expect(byCode["4032"]).toBeCloseTo(onp.pension_amount, 2);
    expect(byCode["407"]).toBeCloseTo(afp.pension_amount, 2);
    expect(byCode["4017"]).toBeGreaterThan(0);
    expect(byCode["141"]).toBe(100);
    expect(byCode["411"]).toBeCloseTo(onp.net_pay + afp.net_pay, 2);
  });
});
