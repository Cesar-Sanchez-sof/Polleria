import { describe, expect, it } from "vitest";
import {
  calculatePayroll,
  coveredDays,
  daysInMonth,
  isPayable,
  monthBounds,
  payrollIssues,
  resolveParams,
  type PayrollContract,
  type PayrollParams,
} from "@/lib/hr/payroll";

const PARAMS: PayrollParams = {
  RMV: 1130,
  FAMILY_ALLOWANCE_RATE: 0.1,
  ONP_RATE: 0.13,
  AFP_PENSION_RATE: 0.1,
  AFP_INSURANCE_RATE: 0.0137,
  AFP_COMMISSION_RATE: 0.0155,
  ESSALUD_RATE: 0.09,
  MICRO_HEALTH_MONTHLY: 15,
};

const general: PayrollContract = {
  kind: "Indefinite",
  regime: "General",
  pensionSystem: "ONP",
  familyAllowance: false,
  monthlySalary: 2000,
  startDate: "2026-01-01",
  endDate: null,
  terminatedAt: null,
};

describe("meses y días cubiertos", () => {
  it("calcula los límites del mes", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(monthBounds(2026, 11)).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });

  it("cuenta los días del contrato dentro del mes, con los extremos", () => {
    expect(coveredDays(general, 2026, 11)).toBe(30);
    expect(coveredDays({ ...general, startDate: "2026-11-21" }, 2026, 11)).toBe(10);
    expect(coveredDays({ ...general, terminatedAt: "2026-11-10" }, 2026, 11)).toBe(10);
    expect(coveredDays({ ...general, endDate: "2026-10-31" }, 2026, 11)).toBe(0);
    expect(coveredDays({ ...general, startDate: "2026-12-01" }, 2026, 11)).toBe(0);
  });

  it("el contrato privado no entra en planilla", () => {
    expect(isPayable("Private")).toBe(false);
    expect(isPayable("Internship")).toBe(true);
    expect(isPayable("FixedTerm")).toBe(true);
  });
});

describe("calculatePayroll", () => {
  it("régimen general con ONP: bruto, pensión, neto y EsSalud", () => {
    const r = calculatePayroll([general], 2026, 11, PARAMS);
    expect(r).toMatchObject({
      baseSalary: 2000,
      familyAllowance: 0,
      grossPay: 2000,
      pensionSystem: "ONP",
      pensionAmount: 260,
      deductions: 260,
      netPay: 1740,
      employerContribution: 180,
    });
  });

  it("AFP suma aporte, prima y comisión", () => {
    const r = calculatePayroll([{ ...general, pensionSystem: "AFP" }], 2026, 11, PARAMS);
    expect(r.pensionAmount).toBe(258.4); // 2000 x 12.92%
    expect(r.netPay).toBe(1741.6);
  });

  it("la asignación familiar es el 10% de la RMV y entra en lo afecto a pensión", () => {
    const r = calculatePayroll([{ ...general, familyAllowance: true }], 2026, 11, PARAMS);
    expect(r.familyAllowance).toBe(113);
    expect(r.grossPay).toBe(2113);
    expect(r.pensionAmount).toBe(274.69);
  });

  it("prorratea por días si el contrato empieza a mitad de mes", () => {
    const r = calculatePayroll([{ ...general, startDate: "2026-11-16" }], 2026, 11, PARAMS);
    expect(r.baseSalary).toBe(1000); // 15 de 30 días
  });

  it("suma los dos contratos cuando hay una renovación dentro del mes", () => {
    const first = { ...general, kind: "FixedTerm" as const, startDate: "2026-01-01", endDate: "2026-11-15", monthlySalary: 1500 };
    const second = { ...general, startDate: "2026-11-16", monthlySalary: 2000 };
    const r = calculatePayroll([first, second], 2026, 11, PARAMS);
    expect(r.baseSalary).toBe(1750); // 15/30 x 1500 + 15/30 x 2000
  });

  it("horas extra y bonos suman; el descuento por faltas resta", () => {
    const r = calculatePayroll([general], 2026, 11, PARAMS, { overtimePay: 100, bonus: 50, absenceDiscount: 200, advances: 0 });
    expect(r.grossPay).toBe(1950);
    expect(r.pensionAmount).toBe(253.5);
  });

  it("los anticipos se descuentan del neto pero no cambian la pensión", () => {
    const r = calculatePayroll([general], 2026, 11, PARAMS, { overtimePay: 0, bonus: 0, absenceDiscount: 0, advances: 300 });
    expect(r.deductions).toBe(560);
    expect(r.netPay).toBe(1440);
  });

  it("la microempresa paga un monto fijo de seguro de salud, no el 9%", () => {
    const r = calculatePayroll([{ ...general, regime: "Micro" }], 2026, 11, PARAMS);
    expect(r.employerContribution).toBe(15);
  });

  it("el convenio de prácticas no aporta a pensiones ni recibe asignación familiar, pero el empleador paga EsSalud", () => {
    const intern: PayrollContract = {
      ...general,
      kind: "Internship",
      regime: "None",
      pensionSystem: "None",
      familyAllowance: true,
      monthlySalary: 1230,
      endDate: "2026-12-31",
    };
    const r = calculatePayroll([intern], 2026, 11, PARAMS);
    expect(r).toMatchObject({
      grossPay: 1230,
      familyAllowance: 0,
      pensionSystem: "None",
      pensionAmount: 0,
      netPay: 1230,
      employerContribution: 110.7,
    });
  });

  it("falla si el empleado no tiene contrato en el mes", () => {
    expect(() => calculatePayroll([{ ...general, endDate: "2026-10-31" }], 2026, 11, PARAMS)).toThrow(/no tiene contrato/);
  });
});

describe("payrollIssues", () => {
  it("avisa si los descuentos superan lo ganado", () => {
    const r = calculatePayroll([general], 2026, 11, PARAMS, { overtimePay: 0, bonus: 0, absenceDiscount: 0, advances: 5000 });
    expect(payrollIssues(r).join(" ")).toMatch(/superan lo ganado/);
    expect(payrollIssues(calculatePayroll([general], 2026, 11, PARAMS))).toEqual([]);
  });
});

describe("resolveParams", () => {
  const rows = [
    { code: "RMV", value: 1130, effectiveFrom: "2022-05-01" },
    { code: "RMV", value: 1230, effectiveFrom: "2026-10-01" },
    { code: "ONP_RATE", value: 0.13, effectiveFrom: "2020-01-01" },
  ];

  it("usa el valor con la vigencia más reciente que no pase de la fecha", () => {
    expect(resolveParams(rows, "2026-09-30").params.RMV).toBe(1130);
    expect(resolveParams(rows, "2026-10-31").params.RMV).toBe(1230);
  });

  it("informa los parámetros que faltan", () => {
    const { missing } = resolveParams(rows, "2026-10-31");
    expect(missing).toContain("ESSALUD_RATE");
    expect(missing).not.toContain("RMV");
    expect(resolveParams(rows, "2020-06-01").missing).toContain("RMV");
  });
});
