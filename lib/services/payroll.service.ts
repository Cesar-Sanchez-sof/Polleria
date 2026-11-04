import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/users.service";
import { fullName } from "@/lib/services/contracts.service";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import { ClosedPeriodError } from "@/lib/accounting/closing";
import { postPayrollJournalEntry, postPayrollPaymentJournalEntry } from "@/lib/services/accounting-posting.service";
import type { ContractKind, LaborRegime, PensionSystem } from "@/lib/hr/contracts";
import {
  calculatePayroll,
  isPayable,
  monthBounds,
  PAYROLL_PARAMETER_CODES,
  PAYROLL_PARAMETER_META,
  payrollIssues,
  resolveParams,
  round2,
  type ManualAmounts,
  type PayrollCalculation,
  type PayrollContract,
  type PayrollParameterCode,
  type PayrollParameterRow,
  type PayrollStatus,
} from "@/lib/hr/payroll";

export interface PayrollDto {
  payroll_id: number;
  employee_id: number;
  employee_name: string;
  employee_dni: string;
  position: string | null;
  contract_kind: ContractKind | null;
  regime: LaborRegime | null;
  month: number;
  year: number;
  base_salary: number;
  family_allowance: number;
  overtime_pay: number;
  bonus: number;
  absence_discount: number;
  gross_pay: number;
  pension_system: PensionSystem;
  pension_amount: number;
  advances: number;
  deductions: number;
  net_pay: number;
  employer_contribution: number;
  status: PayrollStatus;
  payment_date: string | null;
}

export interface PayrollParameterDto {
  parameter_id: number;
  code: PayrollParameterCode;
  label: string;
  unit: "amount" | "rate";
  value: number;
  effective_from: string;
  notes: string | null;
}

const payrollInclude = {
  employee: {
    select: { id: true, dni: true, position: true, firstName: true, middleName: true, paternalLastName: true, maternalLastName: true },
  },
  contract: { select: { kind: true, regime: true } },
} satisfies Prisma.PayrollInclude;

type PayrollRow = Prisma.PayrollGetPayload<{ include: typeof payrollInclude }>;

function mapPayroll(p: PayrollRow): PayrollDto {
  return {
    payroll_id: p.id,
    employee_id: p.employeeId,
    employee_name: fullName(p.employee),
    employee_dni: p.employee.dni,
    position: p.employee.position,
    contract_kind: p.contract?.kind ?? null,
    regime: p.contract?.regime ?? null,
    month: p.month,
    year: p.year,
    base_salary: Number(p.baseSalary),
    family_allowance: Number(p.familyAllowance),
    overtime_pay: Number(p.overtimePay),
    bonus: Number(p.bonus),
    absence_discount: Number(p.absenceDiscount),
    gross_pay: Number(p.grossPay),
    pension_system: p.pensionSystem,
    pension_amount: Number(p.pensionAmount),
    advances: Number(p.advances),
    deductions: Number(p.deductions),
    net_pay: Number(p.netPay),
    employer_contribution: Number(p.employerContribution),
    status: p.status,
    payment_date: p.paymentDate ? formatDateToIso(p.paymentDate) : null,
  };
}

function validatePeriod(year: unknown, month: unknown): { year: number; month: number } {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new UserError("El año no es válido");
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new UserError("El mes no es válido");
  return { year: y, month: m };
}

// ───────────────────────── Parámetros ─────────────────────────

export async function listPayrollParameters(): Promise<PayrollParameterDto[]> {
  const rows = await prisma.payrollParameter.findMany({ orderBy: [{ code: "asc" }, { effectiveFrom: "desc" }] });
  return rows
    .filter((r) => (PAYROLL_PARAMETER_CODES as readonly string[]).includes(r.code))
    .map((r) => {
      const code = r.code as PayrollParameterCode;
      return {
        parameter_id: r.id,
        code,
        label: PAYROLL_PARAMETER_META[code].label,
        unit: PAYROLL_PARAMETER_META[code].unit,
        value: Number(r.value),
        effective_from: formatDateToIso(r.effectiveFrom),
        notes: r.notes,
      };
    });
}

export interface PayrollParameterInput {
  code: string;
  value: number | string;
  /** "YYYY-MM-DD" */
  effective_from: string;
  notes?: string | null;
}

/** Carga un valor con su vigencia. Si ya había uno para ese código y fecha, lo reemplaza. */
export async function savePayrollParameter(input: PayrollParameterInput): Promise<PayrollParameterDto> {
  if (!(PAYROLL_PARAMETER_CODES as readonly string[]).includes(input.code)) throw new UserError("El parámetro no es válido");
  const code = input.code as PayrollParameterCode;
  const value = Number(input.value);
  if (input.value === "" || input.value == null || !Number.isFinite(value) || value < 0) {
    throw new UserError("El valor debe ser un número mayor o igual a 0");
  }
  const meta = PAYROLL_PARAMETER_META[code];
  if (meta.unit === "rate" && value > 1) throw new UserError("Las tasas se indican como fracción: 13% es 0.13");
  if (meta.unit === "amount" && value > 99_999) throw new UserError("El monto es demasiado alto");
  const date = typeof input.effective_from === "string" ? input.effective_from.trim() : "";
  const effectiveFrom = /^\d{4}-\d{2}-\d{2}$/.test(date) ? parseUtcDate(date) : null;
  if (!effectiveFrom || Number.isNaN(effectiveFrom.getTime()) || formatDateToIso(effectiveFrom) !== date) {
    throw new UserError("La fecha de vigencia no es válida");
  }
  const notes = typeof input.notes === "string" ? input.notes.trim().slice(0, 200) || null : null;

  const row = await prisma.payrollParameter.upsert({
    where: { code_effectiveFrom: { code, effectiveFrom } },
    update: { value, notes },
    create: { code, value, effectiveFrom, notes },
  });
  return {
    parameter_id: row.id,
    code,
    label: meta.label,
    unit: meta.unit,
    value: Number(row.value),
    effective_from: date,
    notes: row.notes,
  };
}

async function loadParameterRows(db: Prisma.TransactionClient | typeof prisma): Promise<PayrollParameterRow[]> {
  const rows = await db.payrollParameter.findMany();
  return rows.map((r) => ({ code: r.code, value: Number(r.value), effectiveFrom: formatDateToIso(r.effectiveFrom) }));
}

async function paramsForMonth(db: Prisma.TransactionClient | typeof prisma, year: number, month: number) {
  const { params, missing } = resolveParams(await loadParameterRows(db), monthBounds(year, month).end);
  if (missing.length > 0) {
    const names = missing.map((c) => PAYROLL_PARAMETER_META[c].label).join(", ");
    throw new UserError(`Faltan parámetros de planilla vigentes en ese mes: ${names}. Cárgalos en Parámetros.`, 409);
  }
  return params;
}

// ───────────────────────── Cálculo ─────────────────────────

type ContractRow = {
  id: number;
  kind: ContractKind;
  regime: LaborRegime;
  pensionSystem: PensionSystem;
  familyAllowance: boolean;
  monthlySalary: Prisma.Decimal;
  startDate: Date;
  endDate: Date | null;
  terminatedAt: Date | null;
};

function toPayrollContract(c: ContractRow): PayrollContract {
  return {
    kind: c.kind,
    regime: c.regime,
    pensionSystem: c.pensionSystem,
    familyAllowance: c.familyAllowance,
    monthlySalary: Number(c.monthlySalary),
    startDate: formatDateToIso(c.startDate),
    endDate: c.endDate ? formatDateToIso(c.endDate) : null,
    terminatedAt: c.terminatedAt ? formatDateToIso(c.terminatedAt) : null,
  };
}

/** Contratos pagables que tocan el mes (los rescindidos antes del mes no entran). */
async function contractsTouchingMonth(db: Prisma.TransactionClient, year: number, month: number): Promise<Map<number, ContractRow[]>> {
  const { start, end } = monthBounds(year, month);
  const rows = await db.employmentContract.findMany({
    where: {
      kind: { not: "Private" },
      startDate: { lte: parseUtcDate(end) },
      AND: [
        { OR: [{ endDate: null }, { endDate: { gte: parseUtcDate(start) } }] },
        { OR: [{ terminatedAt: null }, { terminatedAt: { gte: parseUtcDate(start) } }] },
      ],
    },
    select: {
      id: true,
      employeeId: true,
      kind: true,
      regime: true,
      pensionSystem: true,
      familyAllowance: true,
      monthlySalary: true,
      startDate: true,
      endDate: true,
      terminatedAt: true,
    },
    orderBy: { startDate: "asc" },
  });
  const byEmployee = new Map<number, ContractRow[]>();
  for (const r of rows) {
    if (!isPayable(r.kind)) continue;
    byEmployee.set(r.employeeId, [...(byEmployee.get(r.employeeId) ?? []), r]);
  }
  return byEmployee;
}

function storedColumns(calc: PayrollCalculation) {
  return {
    baseSalary: calc.baseSalary,
    familyAllowance: calc.familyAllowance,
    overtimePay: calc.overtimePay,
    bonus: calc.bonus,
    absenceDiscount: calc.absenceDiscount,
    grossPay: calc.grossPay,
    pensionSystem: calc.pensionSystem,
    pensionAmount: calc.pensionAmount,
    advances: calc.advances,
    deductions: calc.deductions,
    netPay: calc.netPay,
    employerContribution: calc.employerContribution,
  };
}

export async function listPayroll(yearInput: unknown, monthInput: unknown): Promise<{ payrolls: PayrollDto[]; missing_parameters: string[] }> {
  const { year, month } = validatePeriod(yearInput, monthInput);
  const rows = await prisma.payroll.findMany({
    where: { year, month },
    include: payrollInclude,
    orderBy: [{ employee: { paternalLastName: "asc" } }, { employee: { firstName: "asc" } }],
  });
  const { missing } = resolveParams(await loadParameterRows(prisma), monthBounds(year, month).end);
  return { payrolls: rows.map(mapPayroll), missing_parameters: missing.map((c) => PAYROLL_PARAMETER_META[c].label) };
}

/**
 * Calcula (o recalcula) las boletas en borrador del mes para todos los empleados con contrato en él.
 * Las ya aprobadas o pagadas no se tocan; los montos manuales de un borrador se conservan.
 */
export async function calculatePayrollPeriod(
  yearInput: unknown,
  monthInput: unknown,
): Promise<{ created: number; updated: number; removed: number; locked: number; without_contract: number }> {
  const { year, month } = validatePeriod(yearInput, monthInput);
  return prisma.$transaction(async (tx) => {
    const params = await paramsForMonth(tx, year, month);
    const byEmployee = await contractsTouchingMonth(tx, year, month);
    const existing = await tx.payroll.findMany({ where: { year, month } });
    const existingByEmployee = new Map(existing.map((p) => [p.employeeId, p]));

    let created = 0;
    let updated = 0;
    let locked = 0;
    for (const [employeeId, contracts] of byEmployee) {
      const current = existingByEmployee.get(employeeId);
      if (current && current.status !== "Draft") {
        locked++;
        continue;
      }
      const manual: ManualAmounts = current
        ? {
            overtimePay: Number(current.overtimePay),
            bonus: Number(current.bonus),
            absenceDiscount: Number(current.absenceDiscount),
            advances: Number(current.advances),
          }
        : { overtimePay: 0, bonus: 0, absenceDiscount: 0, advances: 0 };
      const calc = calculatePayroll(contracts.map(toPayrollContract), year, month, params, manual);
      const issues = payrollIssues(calc);
      if (issues.length > 0) {
        const employee = await tx.employee.findUnique({
          where: { id: employeeId },
          select: { firstName: true, middleName: true, paternalLastName: true, maternalLastName: true },
        });
        throw new UserError(`${employee ? fullName(employee) : `Empleado ${employeeId}`}: ${issues[0]}`, 409);
      }
      const latest = contracts[contracts.length - 1];
      const data = { ...storedColumns(calc), contractId: latest.id };
      if (current) {
        await tx.payroll.update({ where: { id: current.id }, data });
        updated++;
      } else {
        await tx.payroll.create({ data: { employeeId, month, year, ...data } });
        created++;
      }
    }

    // Borradores de empleados que ya no tienen contrato en el mes: se quitan.
    const stale = existing.filter((p) => p.status === "Draft" && !byEmployee.has(p.employeeId)).map((p) => p.id);
    if (stale.length > 0) await tx.payroll.deleteMany({ where: { id: { in: stale } } });

    const employeesWithoutContract = await tx.employee.count({
      where: { active: true, id: { notIn: [...byEmployee.keys()] } },
    });
    return { created, updated, removed: stale.length, locked, without_contract: employeesWithoutContract };
  });
}

export interface PayrollManualInput {
  overtime_pay?: number | string | null;
  bonus?: number | string | null;
  absence_discount?: number | string | null;
  advances?: number | string | null;
}

function money(value: unknown, field: string): number {
  if (value === "" || value == null) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new UserError(`${field} debe ser un monto mayor o igual a 0`);
  if (n > 99_999.99) throw new UserError(`${field} es demasiado alto`);
  return round2(n);
}

/** Corrige los montos manuales de una boleta en borrador (horas extra, bonos, faltas y anticipos). */
export async function updatePayrollManual(id: number, input: PayrollManualInput): Promise<PayrollDto> {
  const manual: ManualAmounts = {
    overtimePay: money(input.overtime_pay, "Las horas extra"),
    bonus: money(input.bonus, "Los bonos"),
    absenceDiscount: money(input.absence_discount, "El descuento por faltas"),
    advances: money(input.advances, "Los anticipos"),
  };
  return prisma.$transaction(async (tx) => {
    const payroll = await tx.payroll.findUnique({ where: { id } });
    if (!payroll) throw new UserError("Boleta no encontrada", 404);
    if (payroll.status !== "Draft") throw new UserError("Solo se puede editar una boleta en borrador", 409);

    const params = await paramsForMonth(tx, payroll.year, payroll.month);
    const contracts = (await contractsTouchingMonth(tx, payroll.year, payroll.month)).get(payroll.employeeId);
    if (!contracts) throw new UserError("El empleado ya no tiene contrato en ese mes. Recalcula la planilla", 409);

    const calc = calculatePayroll(contracts.map(toPayrollContract), payroll.year, payroll.month, params, manual);
    const issues = payrollIssues(calc);
    if (issues.length > 0) throw new UserError(issues[0]);
    const updated = await tx.payroll.update({
      where: { id },
      data: { ...storedColumns(calc), contractId: contracts[contracts.length - 1].id },
      include: payrollInclude,
    });
    return mapPayroll(updated);
  });
}

// ───────────────────────── Aprobación y pago ─────────────────────────

function lastDayOf(year: number, month: number): Date {
  return parseUtcDate(monthBounds(year, month).end);
}

async function loadForTransition(tx: Prisma.TransactionClient, ids: number[], from: PayrollStatus) {
  if (ids.length === 0) throw new UserError("Elige al menos una boleta");
  const rows = await tx.payroll.findMany({ where: { id: { in: ids } }, include: payrollInclude });
  if (rows.length !== new Set(ids).size) throw new UserError("Alguna boleta no existe", 404);
  const wrong = rows.filter((r) => r.status !== from);
  if (wrong.length > 0) {
    throw new UserError(
      from === "Draft"
        ? `Ya está aprobada o pagada: ${wrong.map((r) => fullName(r.employee)).join(", ")}`
        : `Solo se pagan boletas aprobadas. No lo están: ${wrong.map((r) => fullName(r.employee)).join(", ")}`,
      409,
    );
  }
  return rows;
}

/** Aprueba boletas en borrador y registra su asiento contable. Si el mes contable está cerrado no aprueba ninguna. */
export async function approvePayrolls(ids: number[], responsible?: string): Promise<PayrollDto[]> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const rows = await loadForTransition(tx, ids, "Draft");
        const out: PayrollDto[] = [];
        for (const r of rows) {
          const calc = {
            baseSalary: Number(r.baseSalary),
            grossPay: Number(r.grossPay),
            pensionAmount: Number(r.pensionAmount),
            advances: Number(r.advances),
            netPay: Number(r.netPay),
          };
          if (calc.netPay < 0 || calc.grossPay <= 0) {
            throw new UserError(`La boleta de ${fullName(r.employee)} no tiene un neto válido`, 409);
          }
          await postPayrollJournalEntry(tx, {
            payrollId: r.id,
            employeeName: fullName(r.employee),
            month: r.month,
            year: r.year,
            grossPay: calc.grossPay,
            pensionSystem: r.pensionSystem,
            pensionAmount: calc.pensionAmount,
            advances: calc.advances,
            netPay: calc.netPay,
            employerContribution: Number(r.employerContribution),
            entryDate: lastDayOf(r.year, r.month),
            responsible,
          });
          const updated = await tx.payroll.update({
            where: { id: r.id },
            data: { status: "Approved", approvedAt: new Date() },
            include: payrollInclude,
          });
          out.push(mapPayroll(updated));
        }
        return out;
      },
      { timeout: 30_000 },
    );
  } catch (e) {
    if (e instanceof ClosedPeriodError) throw new UserError(e.message, 409);
    throw e;
  }
}

/** Registra el pago del neto de boletas aprobadas (caja si es efectivo, bancos en otro caso). */
export async function payPayrolls(
  ids: number[],
  input: { method?: string | null; payment_date?: string | null },
  responsible?: string,
): Promise<PayrollDto[]> {
  const method = typeof input.method === "string" ? input.method.trim() : "";
  if (!method) throw new UserError("Elige el medio de pago");
  const date = typeof input.payment_date === "string" ? input.payment_date.trim() : "";
  const paymentDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? parseUtcDate(date) : null;
  if (!paymentDate || Number.isNaN(paymentDate.getTime()) || formatDateToIso(paymentDate) !== date) {
    throw new UserError("La fecha de pago no es válida");
  }
  try {
    return await prisma.$transaction(
      async (tx) => {
        const rows = await loadForTransition(tx, ids, "Approved");
        const out: PayrollDto[] = [];
        for (const r of rows) {
          if (date < monthBounds(r.year, r.month).start) {
            throw new UserError("La fecha de pago no puede ser anterior al mes de la planilla");
          }
          await postPayrollPaymentJournalEntry(tx, {
            payrollId: r.id,
            employeeName: fullName(r.employee),
            month: r.month,
            year: r.year,
            amount: Number(r.netPay),
            method,
            entryDate: paymentDate,
            responsible,
          });
          const updated = await tx.payroll.update({
            where: { id: r.id },
            data: { status: "Paid", paymentDate },
            include: payrollInclude,
          });
          out.push(mapPayroll(updated));
        }
        return out;
      },
      { timeout: 30_000 },
    );
  } catch (e) {
    if (e instanceof ClosedPeriodError) throw new UserError(e.message, 409);
    throw e;
  }
}

/** Quita una boleta en borrador. Una aprobada ya tiene asiento y no se borra. */
export async function deleteDraftPayroll(id: number): Promise<void> {
  const payroll = await prisma.payroll.findUnique({ where: { id }, select: { status: true } });
  if (!payroll) throw new UserError("Boleta no encontrada", 404);
  if (payroll.status !== "Draft") throw new UserError("Solo se puede quitar una boleta en borrador", 409);
  await prisma.payroll.delete({ where: { id } });
}
