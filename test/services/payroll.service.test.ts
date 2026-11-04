import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClosedPeriodError } from "@/lib/accounting/closing";

const m = vi.hoisted(() => ({
  paramFindMany: vi.fn(),
  paramUpsert: vi.fn(),
  contractFindMany: vi.fn(),
  payrollFindMany: vi.fn(),
  payrollFindUnique: vi.fn(),
  payrollCreate: vi.fn(),
  payrollUpdate: vi.fn(),
  payrollDeleteMany: vi.fn(),
  payrollDelete: vi.fn(),
  employeeCount: vi.fn(),
  employeeFindUnique: vi.fn(),
  postPayroll: vi.fn(),
  postPayment: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const db = {
    payrollParameter: { findMany: m.paramFindMany, upsert: m.paramUpsert },
    employmentContract: { findMany: m.contractFindMany },
    payroll: {
      findMany: m.payrollFindMany,
      findUnique: m.payrollFindUnique,
      create: m.payrollCreate,
      update: m.payrollUpdate,
      deleteMany: m.payrollDeleteMany,
      delete: m.payrollDelete,
    },
    employee: { count: m.employeeCount, findUnique: m.employeeFindUnique },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { prisma: db };
});

vi.mock("@/lib/services/accounting-posting.service", () => ({
  postPayrollJournalEntry: m.postPayroll,
  postPayrollPaymentJournalEntry: m.postPayment,
}));

import {
  approvePayrolls,
  calculatePayrollPeriod,
  deleteDraftPayroll,
  payPayrolls,
  savePayrollParameter,
  updatePayrollManual,
} from "@/lib/services/payroll.service";

const date = (iso: string) => new Date(`${iso}T00:00:00Z`);

const PARAM_ROWS = [
  ["RMV", 1130],
  ["FAMILY_ALLOWANCE_RATE", 0.1],
  ["ONP_RATE", 0.13],
  ["AFP_PENSION_RATE", 0.1],
  ["AFP_INSURANCE_RATE", 0.0137],
  ["AFP_COMMISSION_RATE", 0.0155],
  ["ESSALUD_RATE", 0.09],
  ["MICRO_HEALTH_MONTHLY", 15],
].map(([code, value]) => ({ code, value, effectiveFrom: date("2020-01-01") }));

const employee = { id: 7, dni: "12345678", position: "Cajera", firstName: "Ana", middleName: null, paternalLastName: "Pérez", maternalLastName: null };

function contract(over: Record<string, unknown> = {}) {
  return {
    id: 3,
    employeeId: 7,
    kind: "Indefinite",
    regime: "General",
    pensionSystem: "ONP",
    familyAllowance: false,
    monthlySalary: 2000,
    startDate: date("2026-01-01"),
    endDate: null,
    terminatedAt: null,
    ...over,
  };
}

function payrollRow(over: Record<string, unknown> = {}) {
  return {
    id: 10,
    employeeId: 7,
    contractId: 3,
    month: 11,
    year: 2026,
    baseSalary: 2000,
    familyAllowance: 0,
    overtimePay: 0,
    bonus: 0,
    absenceDiscount: 0,
    grossPay: 2000,
    pensionSystem: "ONP",
    pensionAmount: 260,
    advances: 0,
    deductions: 260,
    netPay: 1740,
    employerContribution: 180,
    status: "Draft",
    approvedAt: null,
    paymentDate: null,
    employee,
    contract: { kind: "Indefinite", regime: "General" },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.paramFindMany.mockResolvedValue(PARAM_ROWS);
  m.contractFindMany.mockResolvedValue([contract()]);
  m.payrollFindMany.mockResolvedValue([]);
  m.payrollCreate.mockResolvedValue({});
  m.payrollUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => payrollRow(data));
  m.employeeCount.mockResolvedValue(0);
  m.postPayroll.mockResolvedValue(1);
  m.postPayment.mockResolvedValue(2);
});

describe("savePayrollParameter", () => {
  it("guarda un valor con su vigencia", async () => {
    m.paramUpsert.mockResolvedValue({ id: 1, value: 0.13, notes: null });
    const saved = await savePayrollParameter({ code: "ONP_RATE", value: 0.13, effective_from: "2026-11-01" });
    expect(saved).toMatchObject({ code: "ONP_RATE", value: 0.13, unit: "rate", effective_from: "2026-11-01" });
  });

  it("rechaza códigos, valores y fechas inválidos", async () => {
    await expect(savePayrollParameter({ code: "X", value: 1, effective_from: "2026-11-01" })).rejects.toThrow(/parámetro/);
    await expect(savePayrollParameter({ code: "RMV", value: "", effective_from: "2026-11-01" })).rejects.toThrow(/valor/);
    await expect(savePayrollParameter({ code: "RMV", value: -1, effective_from: "2026-11-01" })).rejects.toThrow(/valor/);
    await expect(savePayrollParameter({ code: "ONP_RATE", value: 13, effective_from: "2026-11-01" })).rejects.toThrow(/fracción/);
    await expect(savePayrollParameter({ code: "RMV", value: 1230, effective_from: "2026-02-30" })).rejects.toThrow(/fecha/);
  });
});

describe("calculatePayrollPeriod", () => {
  it("exige que estén cargados los parámetros vigentes", async () => {
    m.paramFindMany.mockResolvedValue(PARAM_ROWS.filter((p) => p.code !== "ONP_RATE"));
    await expect(calculatePayrollPeriod(2026, 11)).rejects.toThrow(/Faltan parámetros.*ONP/);
  });

  it("valida el mes y el año", async () => {
    await expect(calculatePayrollPeriod(2026, 13)).rejects.toThrow(/mes/);
    await expect(calculatePayrollPeriod("x", 5)).rejects.toThrow(/año/);
  });

  it("crea el borrador de cada empleado con contrato y deja fuera el contrato privado", async () => {
    m.contractFindMany.mockResolvedValue([contract(), contract({ id: 4, employeeId: 8, kind: "Private" })]);
    const r = await calculatePayrollPeriod(2026, 11);
    expect(r).toMatchObject({ created: 1, updated: 0, locked: 0 });
    expect(m.payrollCreate).toHaveBeenCalledTimes(1);
    expect(m.payrollCreate.mock.calls[0][0].data).toMatchObject({
      employeeId: 7,
      contractId: 3,
      baseSalary: 2000,
      pensionAmount: 260,
      netPay: 1740,
      employerContribution: 180,
    });
  });

  it("al recalcular un borrador conserva los montos manuales", async () => {
    m.payrollFindMany.mockResolvedValue([payrollRow({ overtimePay: 100, advances: 50 })]);
    const r = await calculatePayrollPeriod(2026, 11);
    expect(r).toMatchObject({ created: 0, updated: 1 });
    expect(m.payrollUpdate.mock.calls[0][0].data).toMatchObject({ overtimePay: 100, advances: 50, grossPay: 2100 });
  });

  it("no toca las boletas aprobadas y quita los borradores sin contrato", async () => {
    m.payrollFindMany.mockResolvedValue([
      payrollRow({ status: "Approved" }),
      payrollRow({ id: 11, employeeId: 99, status: "Draft" }),
    ]);
    const r = await calculatePayrollPeriod(2026, 11);
    expect(r).toMatchObject({ locked: 1, removed: 1, created: 0, updated: 0 });
    expect(m.payrollDeleteMany).toHaveBeenCalledWith({ where: { id: { in: [11] } } });
  });
});

describe("updatePayrollManual", () => {
  it("solo edita borradores", async () => {
    m.payrollFindUnique.mockResolvedValue(payrollRow({ status: "Approved" }));
    await expect(updatePayrollManual(10, { bonus: 10 })).rejects.toThrow(/borrador/);
  });

  it("recalcula la boleta con los montos nuevos", async () => {
    m.payrollFindUnique.mockResolvedValue(payrollRow());
    await updatePayrollManual(10, { bonus: 200, advances: 100 });
    expect(m.payrollUpdate.mock.calls[0][0].data).toMatchObject({ bonus: 200, grossPay: 2200, pensionAmount: 286, advances: 100, netPay: 1814 });
  });

  it("rechaza montos negativos y anticipos que superan lo ganado", async () => {
    m.payrollFindUnique.mockResolvedValue(payrollRow());
    await expect(updatePayrollManual(10, { bonus: -1 })).rejects.toThrow(/mayor o igual a 0/);
    await expect(updatePayrollManual(10, { advances: 5000 })).rejects.toThrow(/superan lo ganado/);
  });
});

describe("approvePayrolls", () => {
  it("registra el asiento de cada boleta y la deja aprobada", async () => {
    m.payrollFindMany.mockResolvedValue([payrollRow()]);
    const rows = await approvePayrolls([10], "admin");
    expect(m.postPayroll).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ payrollId: 10, grossPay: 2000, pensionAmount: 260, netPay: 1740, employerContribution: 180, responsible: "admin" }),
    );
    expect(m.payrollUpdate.mock.calls[0][0].data).toMatchObject({ status: "Approved" });
    expect(rows).toHaveLength(1);
  });

  it("no aprueba lo que ya está aprobado ni lo que no existe", async () => {
    m.payrollFindMany.mockResolvedValue([payrollRow({ status: "Approved" })]);
    await expect(approvePayrolls([10])).rejects.toThrow(/Ya está aprobada/);
    m.payrollFindMany.mockResolvedValue([]);
    await expect(approvePayrolls([10])).rejects.toThrow(/no existe/);
    await expect(approvePayrolls([])).rejects.toThrow(/al menos una/);
  });

  it("convierte un mes contable cerrado en un error 409", async () => {
    m.payrollFindMany.mockResolvedValue([payrollRow()]);
    m.postPayroll.mockRejectedValue(new ClosedPeriodError());
    await expect(approvePayrolls([10])).rejects.toMatchObject({ status: 409 });
  });
});

describe("payPayrolls", () => {
  it("paga las aprobadas y registra la salida de caja o bancos", async () => {
    m.payrollFindMany.mockResolvedValue([payrollRow({ status: "Approved" })]);
    await payPayrolls([10], { method: "Efectivo", payment_date: "2026-12-05" }, "admin");
    expect(m.postPayment).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ amount: 1740, method: "Efectivo" }));
    expect(m.payrollUpdate.mock.calls[0][0].data).toMatchObject({ status: "Paid" });
  });

  it("solo paga boletas aprobadas y valida medio y fecha", async () => {
    m.payrollFindMany.mockResolvedValue([payrollRow()]);
    await expect(payPayrolls([10], { method: "Efectivo", payment_date: "2026-12-05" })).rejects.toThrow(/aprobadas/);
    await expect(payPayrolls([10], { method: "", payment_date: "2026-12-05" })).rejects.toThrow(/medio de pago/);
    await expect(payPayrolls([10], { method: "Efectivo", payment_date: "2026-13-01" })).rejects.toThrow(/fecha/);
  });

  it("no permite pagar antes del mes de la planilla", async () => {
    m.payrollFindMany.mockResolvedValue([payrollRow({ status: "Approved" })]);
    await expect(payPayrolls([10], { method: "Efectivo", payment_date: "2026-10-30" })).rejects.toThrow(/anterior al mes/);
  });
});

describe("deleteDraftPayroll", () => {
  it("quita borradores y rechaza lo ya aprobado", async () => {
    m.payrollFindUnique.mockResolvedValue({ status: "Draft" });
    await deleteDraftPayroll(10);
    expect(m.payrollDelete).toHaveBeenCalledWith({ where: { id: 10 } });
    m.payrollFindUnique.mockResolvedValue({ status: "Approved" });
    await expect(deleteDraftPayroll(10)).rejects.toThrow(/borrador/);
    m.payrollFindUnique.mockResolvedValue(null);
    await expect(deleteDraftPayroll(10)).rejects.toMatchObject({ status: 404 });
  });
});
