import { describe, expect, it } from "vitest";
import {
  calculateCts,
  calculateGratification,
  calculateSettlement,
  calculateVacationPay,
  computableRemuneration,
  ctsPeriod,
  dismissalIndemnity,
  gratificationPeriod,
  periodsAt,
} from "@/lib/services/hr/social-benefits-rules";

const r = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const jul = gratificationPeriod(2026, 1);
const dic = gratificationPeriod(2026, 2);

describe("gratificación (Ley 27735)", () => {
  it("régimen general con semestre completo: 1 sueldo + 9 % de bonificación", () => {
    const g = calculateGratification({ regime: "General", type: "Indeterminado", computable: 1500, serviceStart: "2025-01-10", serviceEnd: null, period: jul });
    expect(g).toMatchObject({ eligible: true, months: 6, amount: 1500, bonus: 135, total: 1635 });
  });

  it("ingresó el 15-mar: solo cuentan los meses calendario completos (abr-jun = 3)", () => {
    const g = calculateGratification({ regime: "General", type: "Indeterminado", computable: 1500, serviceStart: "2026-03-15", serviceEnd: null, period: jul });
    expect(g.months).toBe(3);
    expect(g.amount).toBe(750);
  });

  it("pequeña empresa recibe la mitad y la microempresa nada", () => {
    const pequena = calculateGratification({ regime: "Pequena", type: "Indeterminado", computable: 1200, serviceStart: "2025-01-01", serviceEnd: null, period: dic });
    expect(pequena.amount).toBe(600);
    const micro = calculateGratification({ regime: "Micro", type: "Indeterminado", computable: 1200, serviceStart: "2025-01-01", serviceEnd: null, period: dic });
    expect(micro.eligible).toBe(false);
  });

  it("las faltas injustificadas descuentan 1/180 de la gratificación por día", () => {
    const g = calculateGratification({ regime: "General", type: "Indeterminado", computable: 1800, serviceStart: "2025-01-01", serviceEnd: null, period: jul, absenceDays: 3 });
    expect(g.absence_discount).toBe(30);
    expect(g.amount).toBe(1770);
  });

  it("los practicantes no reciben gratificación", () => {
    expect(calculateGratification({ regime: "General", type: "Practicas", computable: 1130, serviceStart: "2025-01-01", serviceEnd: null, period: jul }).eligible).toBe(false);
  });
});

describe("CTS (D. S. 001-97-TR)", () => {
  it("la remuneración computable suma 1/6 de la última gratificación", () => {
    expect(computableRemuneration({ baseSalary: 1500, familyAllowance: 113, lastGratification: 1613 })).toBe(1881.83);
  });

  it("semestre completo = media remuneración computable", () => {
    const c = calculateCts({ regime: "General", type: "Indeterminado", computable: 1800, serviceStart: "2025-01-01", serviceEnd: null, period: ctsPeriod(2026, 2) });
    expect(c).toMatchObject({ months: 6, days: 0, amount: 900 });
  });

  it("meses y días sueltos: 4 meses y 11 días", () => {
    const c = calculateCts({ regime: "General", type: "Indeterminado", computable: 1800, serviceStart: "2026-06-21", serviceEnd: null, period: ctsPeriod(2026, 2) });
    expect(c.months).toBe(4);
    expect(c.days).toBe(11);
    expect(c.amount).toBe(r((1800 / 360) * 131));
  });

  it("pequeña empresa: 50 %; tiempo parcial y microempresa: sin CTS", () => {
    const base = { computable: 1800, serviceStart: "2025-01-01", serviceEnd: null, period: ctsPeriod(2026, 2) } as const;
    expect(calculateCts({ ...base, regime: "Pequena", type: "Indeterminado" }).amount).toBe(450);
    expect(calculateCts({ ...base, regime: "General", type: "TiempoParcial" }).eligible).toBe(false);
    expect(calculateCts({ ...base, regime: "Micro", type: "Indeterminado" }).eligible).toBe(false);
  });

  it("los semestres siguen el calendario legal", () => {
    expect(ctsPeriod(2026, 1)).toMatchObject({ from: "2025-11-01", to: "2026-04-30", deadline: "2026-05-15" });
    expect(periodsAt("2026-12-10").cts.from).toBe("2026-11-01");
    expect(periodsAt("2026-03-10").cts.from).toBe("2025-11-01");
    expect(periodsAt("2026-08-10").gratification.from).toBe("2026-07-01");
  });
});

describe("vacaciones al cese", () => {
  it("1 año y 6 meses en régimen general, sin goce: 30 días ganados + 15 truncos", () => {
    const v = calculateVacationPay({ regime: "General", type: "Indeterminado", computable: 3000, serviceStart: "2025-01-01", cutoff: "2026-06-30", usedDays: 0 });
    expect(v.unused_days).toBe(30);
    expect(v.truncated_days).toBe(15);
    expect(v.daily_value).toBe(100);
    expect(v.total).toBe(4500);
  });

  it("MYPE 15 días anuales y vacaciones ya gozadas", () => {
    const v = calculateVacationPay({ regime: "Pequena", type: "Indeterminado", computable: 1500, serviceStart: "2025-01-01", cutoff: "2026-06-30", usedDays: 15 });
    expect(v.unused_days).toBe(0);
    expect(v.truncated_days).toBe(7.5);
    expect(v.total).toBe(375);
  });

  it("el adelanto de vacaciones se descuenta de lo trunco", () => {
    const v = calculateVacationPay({ regime: "General", type: "Indeterminado", computable: 3000, serviceStart: "2026-01-01", cutoff: "2026-06-30", usedDays: 10 });
    expect(v.truncated_days).toBe(5);
  });

  it("tiempo parcial no genera vacaciones", () => {
    expect(calculateVacationPay({ regime: "General", type: "TiempoParcial", computable: 800, serviceStart: "2025-01-01", cutoff: "2026-06-30", usedDays: 0 }).eligible).toBe(false);
  });
});

describe("indemnización por despido arbitrario", () => {
  it("indeterminado: 1.5 sueldos por año con tope de 12", () => {
    expect(dismissalIndemnity({ regime: "General", type: "Indeterminado", monthlySalary: 1500, serviceStart: "2024-01-01", cutoff: "2025-12-31", contractEnd: null }).amount).toBe(4500);
    expect(dismissalIndemnity({ regime: "General", type: "Indeterminado", monthlySalary: 1500, serviceStart: "2000-01-01", cutoff: "2025-12-31", contractEnd: null }).amount).toBe(18000);
  });

  it("plazo fijo: 1.5 sueldos por cada mes que faltaba", () => {
    expect(dismissalIndemnity({ regime: "General", type: "PlazoFijo", monthlySalary: 1500, serviceStart: "2026-01-01", cutoff: "2026-06-30", contractEnd: "2026-12-31" }).amount).toBe(13500);
  });

  it("pequeña empresa: 20 remuneraciones diarias por año", () => {
    expect(dismissalIndemnity({ regime: "Pequena", type: "Indeterminado", monthlySalary: 1500, serviceStart: "2024-01-01", cutoff: "2025-12-31", contractEnd: null }).amount).toBe(2000);
  });
});

describe("liquidación de beneficios sociales", () => {
  const mozo = {
    regime: "General" as const,
    type: "Indeterminado" as const,
    baseSalary: 1130,
    familyAllowance: 0,
    serviceStart: "2025-03-01",
    cutoff: "2026-08-31",
    contractEnd: null,
    pensionSystem: "ONP" as const,
    afpName: null,
    usedVacationDays: 30,
  };

  it("junta CTS, gratificación y vacaciones; ONP solo sobre vacaciones", () => {
    const s = calculateSettlement(mozo);
    expect(s.gratification.months).toBe(2);
    expect(s.gratification.amount).toBe(376.67);
    expect(s.gratification.bonus).toBe(33.9);
    expect(s.cts.months).toBe(4);
    expect(s.cts.amount).toBe(r(((1130 + 1130 / 6) / 360) * 120));
    expect(s.vacations.truncated_days).toBe(15);
    expect(s.pension_deduction).toBe(r(s.vacations.total * 0.13));
    expect(s.net_total).toBe(r(s.total_income - s.pension_deduction));
  });

  it("descuenta adelantos pendientes y no deja neto negativo", () => {
    const s = calculateSettlement({ ...mozo, pendingAdvances: 100 });
    expect(s.advance_deduction).toBe(100);
    const deuda = calculateSettlement({ ...mozo, pendingAdvances: 99_999 });
    expect(deuda.net_total).toBe(0);
    expect(deuda.warnings.join(" ")).toMatch(/deuda pendiente/);
  });

  it("AFP aplica aporte, prima y comisión a las vacaciones", () => {
    const s = calculateSettlement({ ...mozo, pensionSystem: "AFP", afpName: "Habitat" });
    expect(Object.keys(s.pension_detail)).toEqual(["afp_contribution", "afp_insurance", "afp_commission"]);
  });

  it("despido arbitrario suma la indemnización", () => {
    const sin = calculateSettlement(mozo);
    const con = calculateSettlement({ ...mozo, arbitraryDismissal: true });
    expect(con.indemnity.amount).toBeGreaterThan(0);
    expect(con.total_income).toBe(r(sin.total_income + con.indemnity.amount));
  });
});
