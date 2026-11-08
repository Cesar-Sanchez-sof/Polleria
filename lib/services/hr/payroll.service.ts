import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/security/users.service";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import {
  BOOK_PAYROLL,
  PAYROLL_ACCOUNTS,
  paymentAccountCode,
  postJournalEntryLines,
  voidJournalEntries,
  type JournalLineInput,
} from "@/lib/services/accounting/accounting-posting.service";
import { fullName, money, text, todayLimaIso } from "./common";
import { CONTRACT_TYPE_LABEL, installmentAmount, type ContractTypeCode } from "./labor-rules";
import { calculatePayroll, contractDaysInMonth, type PayrollResult } from "./payroll-rules";
import { employeeAttendance } from "./attendance.service";

export const PAYROLL_PAYMENT_METHODS = ["Transferencia", "Efectivo", "Yape", "Plin"] as const;

export interface PayrollLineDto extends PayrollResult {
  payroll_id: number;
  employee_id: number;
  employee_name: string;
  employee_dni: string;
  position: string | null;
  contract_type: string | null;
  contract_type_label: string | null;
  pension_system: string | null;
  base_salary: number;
  notes: string | null;
  payment_date: string | null;
}

export interface PayrollPeriodDto {
  period_id: number;
  year: number;
  month: number;
  label: string;
  status: "Borrador" | "Aprobada" | "Pagada";
  total_gross: number;
  total_deductions: number;
  total_net: number;
  total_employer: number;
  workers: number;
  calculated_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
  payment_method: string | null;
  journal_entries: Array<{ id: number; code: string; description: string; status: boolean; total: number }>;
  lines: PayrollLineDto[];
}

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const n = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0);
const r2 = (x: number) => Math.round(x * 100) / 100;

const INCLUDE = {
  approvedBy: { select: { username: true } },
  paidBy: { select: { username: true } },
  lines: {
    include: {
      employee: {
        select: {
          id: true,
          dni: true,
          firstName: true,
          middleName: true,
          paternalLastName: true,
          maternalLastName: true,
          contracts: { select: { id: true, position: true, contractType: true } },
        },
      },
    },
    orderBy: [{ employee: { paternalLastName: "asc" } }, { employee: { firstName: "asc" } }],
  },
  journalEntries: { include: { entryDetails: { select: { debit: true } } }, orderBy: { id: "asc" } },
} satisfies Prisma.PayrollPeriodInclude;

type PeriodRow = Prisma.PayrollPeriodGetPayload<{ include: typeof INCLUDE }>;
type LineRow = PeriodRow["lines"][number];

function mapLine(l: LineRow): PayrollLineDto {
  const contract = l.employee.contracts.find((c) => c.id === l.contractId) ?? null;
  const detail = (l.detail ?? {}) as Partial<PayrollResult["detail"]>;
  return {
    payroll_id: l.id,
    employee_id: l.employeeId,
    employee_name: fullName(l.employee),
    employee_dni: l.employee.dni,
    position: contract?.position ?? null,
    contract_type: contract?.contractType ?? null,
    contract_type_label: contract ? CONTRACT_TYPE_LABEL[contract.contractType] : null,
    pension_system: l.pensionSystem,
    base_salary: n(l.baseSalary),
    notes: l.notes,
    payment_date: l.paymentDate ? formatDateToIso(l.paymentDate) : null,
    contract_days: l.contractDays,
    unpaid_days: l.unpaidDays,
    paid_days: l.paidDays,
    late_minutes: l.lateMinutes,
    overtime_minutes: l.overtimeMinutes,
    basic_pay: n(l.basicPay),
    family_allowance: n(l.familyAllowance),
    overtime_pay: n(l.overtimePay),
    bonus: n(l.bonus),
    late_discount: n(l.lateDiscount),
    gross_pay: n(l.grossPay),
    pension_amount: n(l.pensionAmount),
    income_tax: n(l.incomeTax),
    advance_deduction: n(l.advanceDeduction),
    other_deductions: n(l.otherDeductions),
    deductions: n(l.deductions),
    net_pay: n(l.netPay),
    essalud: n(l.essalud),
    insurance_cost: n(l.insuranceCost),
    employer_cost: r2(n(l.grossPay) + n(l.essalud) + n(l.insuranceCost)),
    detail: {
      daily_wage: detail.daily_wage ?? 0,
      minute_wage: detail.minute_wage ?? 0,
      pension: detail.pension ?? {},
      advances: detail.advances ?? [],
      warnings: detail.warnings ?? [],
    },
  };
}

function mapPeriod(p: PeriodRow): PayrollPeriodDto {
  return {
    period_id: p.id,
    year: p.year,
    month: p.month,
    label: `${MONTHS[p.month - 1]} ${p.year}`,
    status: p.status,
    total_gross: n(p.totalGross),
    total_deductions: n(p.totalDeductions),
    total_net: n(p.totalNet),
    total_employer: n(p.totalEmployer),
    workers: p.lines.length,
    calculated_at: p.calculatedAt?.toISOString() ?? null,
    approved_at: p.approvedAt?.toISOString() ?? null,
    approved_by: p.approvedBy?.username ?? null,
    paid_at: p.paidAt?.toISOString() ?? null,
    paid_by: p.paidBy?.username ?? null,
    payment_method: p.paymentMethod,
    journal_entries: p.journalEntries.map((j) => ({
      id: j.id,
      code: j.code,
      description: j.description,
      status: j.status,
      total: r2(j.entryDetails.reduce((s, d) => s + n(d.debit), 0)),
    })),
    lines: p.lines.map(mapLine),
  };
}

function validMonth(year: unknown, month: unknown) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12) {
    throw new UserError("Indica un año y mes válidos");
  }
  return { y, m };
}

function monthBounds(y: number, m: number) {
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from, to: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}

/**
 * Calcula (o recalcula) la planilla del mes en Borrador a partir de contratos, asistencia,
 * licencias, seguros y adelantos. Conserva los bonos y descuentos que RR. HH. ya ingresó.
 */
export async function calculatePayrollPeriod(year: unknown, month: unknown, now = new Date()): Promise<PayrollPeriodDto> {
  const { y, m } = validMonth(year, month);
  const { from, to } = monthBounds(y, m);
  const today = todayLimaIso(now);
  if (from > today) throw new UserError("No se puede calcular la planilla de un mes que aún no empieza");

  const existing = await prisma.payrollPeriod.findUnique({ where: { year_month: { year: y, month: m } }, include: { lines: true } });
  if (existing && existing.status !== "Borrador") {
    throw new UserError(`La planilla de ${MONTHS[m - 1]} ${y} ya está ${existing.status.toLowerCase()}: anula la aprobación para recalcular`);
  }
  const manual = new Map((existing?.lines ?? []).map((l) => [l.employeeId, { bonus: n(l.bonus), other: n(l.otherDeductions), notes: l.notes }]));

  const contracts = await prisma.employmentContract.findMany({
    where: {
      contractType: { not: "LocacionServicios" },
      startDate: { lte: parseUtcDate(to) },
      OR: [{ endDate: null }, { endDate: { gte: parseUtcDate(from) } }],
    },
    orderBy: { startDate: "desc" },
    include: {
      employee: {
        select: {
          id: true,
          insurances: { where: { active: true, type: { not: "EsSalud" } }, select: { monthlyCost: true, startDate: true, endDate: true } },
          salaryAdvances: { where: { status: "Pagado" }, select: { id: true, amount: true, installments: true, deductedAmount: true }, orderBy: { id: "asc" } },
          leaveRequests: {
            where: { status: "Aprobada", type: "LicenciaSinGoce", startDate: { lte: parseUtcDate(to) }, endDate: { gte: parseUtcDate(from) } },
            select: { startDate: true, endDate: true },
          },
        },
      },
    },
  });

  // Un trabajador puede tener dos contratos en el mes (renovación): se toma el más reciente,
  // sumando los días cubiertos por todos.
  const byEmployee = new Map<number, typeof contracts>();
  for (const c of contracts) byEmployee.set(c.employeeId, [...(byEmployee.get(c.employeeId) ?? []), c]);

  const results: Array<{ employeeId: number; contractId: number; base: number; pension: string; r: PayrollResult; notes: string | null }> = [];
  for (const [employeeId, list] of byEmployee) {
    const c = list[0];
    // Contratos sin sueldo (p. ej. migrados del usuario administrador) no generan boleta.
    if (n(c.baseSalary) <= 0) continue;
    const contractDays = Math.min(
      30,
      list.reduce((s, x) => {
        const end = x.terminationDate ?? x.endDate;
        return s + contractDaysInMonth(y, m, formatDateToIso(x.startDate), end ? formatDateToIso(end) : null);
      }, 0),
    );
    if (contractDays === 0) continue;

    const attendance = await employeeAttendance(employeeId, from, to, now);
    const absences = attendance.days.filter((d) => d.status === "Falta").length;
    const lateMinutes = attendance.days.filter((d) => d.status === "Tardanza").reduce((s, d) => s + d.late_minutes, 0);
    const extras = attendance.days.filter((d) => d.shifts.length > 0 && d.extra_minutes > 0).map((d) => d.extra_minutes);
    const unpaidLeaveDays = c.employee.leaveRequests.reduce((s, l) => {
      const a = formatDateToIso(l.startDate) > from ? formatDateToIso(l.startDate) : from;
      const b = formatDateToIso(l.endDate) < to ? formatDateToIso(l.endDate) : to;
      return s + Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1);
    }, 0);
    const premiums = c.employee.insurances
      .filter((i) => formatDateToIso(i.startDate) <= to && (!i.endDate || formatDateToIso(i.endDate) >= from))
      .reduce((s, i) => s + n(i.monthlyCost), 0);
    const installments = c.employee.salaryAdvances
      .map((a) => {
        const balance = r2(n(a.amount) - n(a.deductedAmount));
        return { advance_id: a.id, amount: Math.min(balance, installmentAmount(n(a.amount), a.installments)) };
      })
      .filter((a) => a.amount > 0);

    const man = manual.get(employeeId);
    const r = calculatePayroll({
      contractType: c.contractType as ContractTypeCode,
      regime: c.laborRegime,
      baseSalary: n(c.baseSalary),
      familyAllowance: c.familyAllowance,
      pensionSystem: c.pensionSystem,
      afpName: c.afpName,
      contractDays,
      absenceDays: absences,
      unpaidLeaveDays,
      lateMinutes,
      dailyExtraMinutes: extras,
      bonus: man?.bonus ?? 0,
      otherDeductions: man?.other ?? 0,
      advanceInstallments: installments,
      insurancePremiums: premiums,
    });
    results.push({
      employeeId,
      contractId: c.id,
      base: n(c.baseSalary),
      pension: c.pensionSystem === "AFP" ? `AFP ${c.afpName ?? ""}`.trim() : c.pensionSystem,
      r,
      notes: man?.notes ?? null,
    });
  }

  const totals = results.reduce(
    (t, x) => ({
      gross: t.gross + x.r.gross_pay,
      deductions: t.deductions + x.r.deductions,
      net: t.net + x.r.net_pay,
      employer: t.employer + x.r.essalud + x.r.insurance_cost,
    }),
    { gross: 0, deductions: 0, net: 0, employer: 0 },
  );

  const id = await prisma.$transaction(
    async (tx) => {
      const period = existing
        ? await tx.payrollPeriod.update({ where: { id: existing.id }, data: { calculatedAt: new Date() } })
        : await tx.payrollPeriod.create({ data: { year: y, month: m, calculatedAt: new Date() } });
      // Los asientos (anulados al reabrir) se conservan enlazados a la planilla mensual, no a la boleta que se reemplaza.
      await tx.journalEntry.updateMany({ where: { payroll: { periodId: period.id } }, data: { payrollId: null, payrollPeriodId: period.id } });
      await tx.payroll.deleteMany({ where: { periodId: period.id } });
      // Líneas antiguas sin periodo (modelo anterior) del mismo mes se reemplazan.
      await tx.payroll.deleteMany({ where: { year: y, month: m, periodId: null, journalEntries: { none: {} } } });
      for (const x of results) {
        const r = x.r;
        await tx.payroll.create({
          data: {
            employeeId: x.employeeId,
            periodId: period.id,
            contractId: x.contractId,
            month: m,
            year: y,
            baseSalary: x.base,
            contractDays: r.contract_days,
            unpaidDays: r.unpaid_days,
            paidDays: r.paid_days,
            lateMinutes: r.late_minutes,
            overtimeMinutes: r.overtime_minutes,
            basicPay: r.basic_pay,
            familyAllowance: r.family_allowance,
            overtimePay: r.overtime_pay,
            bonus: r.bonus,
            lateDiscount: r.late_discount,
            grossPay: r.gross_pay,
            pensionSystem: x.pension,
            pensionAmount: r.pension_amount,
            incomeTax: r.income_tax,
            advanceDeduction: r.advance_deduction,
            otherDeductions: r.other_deductions,
            deductions: r.deductions,
            netPay: r.net_pay,
            essalud: r.essalud,
            insuranceCost: r.insurance_cost,
            detail: r.detail as unknown as Prisma.InputJsonValue,
            notes: x.notes,
          },
        });
      }
      await tx.payrollPeriod.update({
        where: { id: period.id },
        data: { totalGross: r2(totals.gross), totalDeductions: r2(totals.deductions), totalNet: r2(totals.net), totalEmployer: r2(totals.employer) },
      });
      return period.id;
    },
    { timeout: 30_000 },
  );
  return getPayrollPeriod(id);
}

export async function getPayrollPeriod(id: number): Promise<PayrollPeriodDto> {
  const p = await prisma.payrollPeriod.findUnique({ where: { id }, include: INCLUDE });
  if (!p) throw new UserError("Planilla no encontrada", 404);
  return mapPeriod(p);
}

export async function findPayrollPeriod(year: unknown, month: unknown): Promise<PayrollPeriodDto | null> {
  const { y, m } = validMonth(year, month);
  const p = await prisma.payrollPeriod.findUnique({ where: { year_month: { year: y, month: m } }, include: INCLUDE });
  return p ? mapPeriod(p) : null;
}

export async function listPayrollPeriods() {
  const rows = await prisma.payrollPeriod.findMany({ include: INCLUDE, orderBy: [{ year: "desc" }, { month: "desc" }], take: 24 });
  return rows.map((p) => {
    const dto = mapPeriod(p);
    return { ...dto, lines: [] as PayrollLineDto[] };
  });
}

/** Ajuste manual de una línea en Borrador (bonos, otros descuentos, observaciones) y recálculo. */
export async function updatePayrollLine(payrollId: number, data: { bonus?: unknown; other_deductions?: unknown; notes?: unknown }) {
  const line = await prisma.payroll.findUnique({ where: { id: payrollId }, include: { period: true } });
  if (!line?.period) throw new UserError("Línea de planilla no encontrada", 404);
  if (line.period.status !== "Borrador") throw new UserError("Solo se ajusta una planilla en borrador");
  await prisma.payroll.update({
    where: { id: payrollId },
    data: {
      bonus: data.bonus === undefined ? undefined : money(data.bonus === "" ? 0 : data.bonus, "El bono"),
      otherDeductions: data.other_deductions === undefined ? undefined : money(data.other_deductions === "" ? 0 : data.other_deductions, "Otros descuentos"),
      notes: data.notes === undefined ? undefined : text(data.notes, "La observación", 200),
    },
  });
  return calculatePayrollPeriod(line.period.year, line.period.month);
}

/**
 * Asiento de devengo (fin de mes):
 *   DEBE 6211 remuneraciones · 6271 EsSalud · 6273/6274 seguros
 *   HABER 4031 EsSalud · 4032 ONP · 407 AFP · 4017 renta 5.ª · 141 adelantos · 461 aseguradoras · 411 neto
 */
export function accrualLines(lines: PayrollLineDto[], label: string): JournalLineInput[] {
  const sum = (f: (l: PayrollLineDto) => number) => r2(lines.reduce((s, l) => s + f(l), 0));
  const onp = sum((l) => (l.pension_system === "ONP" ? l.pension_amount : 0));
  const afp = sum((l) => (l.pension_system?.startsWith("AFP") ? l.pension_amount : 0));
  return [
    { accountCode: PAYROLL_ACCOUNTS.salaries, debit: sum((l) => l.gross_pay), description: `Remuneraciones ${label}` },
    { accountCode: PAYROLL_ACCOUNTS.essaludExpense, debit: sum((l) => l.essalud), description: `Aporte EsSalud 9 % ${label}` },
    { accountCode: PAYROLL_ACCOUNTS.lifeInsuranceExpense, debit: sum((l) => l.insurance_cost), description: `Seguros del personal ${label}` },
    { accountCode: PAYROLL_ACCOUNTS.essalud, credit: sum((l) => l.essalud), description: "EsSalud por pagar" },
    { accountCode: PAYROLL_ACCOUNTS.onp, credit: onp, description: "ONP retenida por pagar" },
    { accountCode: PAYROLL_ACCOUNTS.afp, credit: afp, description: "AFP retenida por pagar" },
    { accountCode: PAYROLL_ACCOUNTS.incomeTax, credit: sum((l) => l.income_tax), description: "Renta de 5.ª categoría retenida" },
    { accountCode: PAYROLL_ACCOUNTS.advances, credit: sum((l) => l.advance_deduction), description: "Descuento de adelantos de sueldo" },
    { accountCode: PAYROLL_ACCOUNTS.insurersPayable, credit: sum((l) => l.insurance_cost + l.other_deductions), description: "Primas de seguros y otros descuentos por pagar" },
    { accountCode: PAYROLL_ACCOUNTS.salariesPayable, credit: sum((l) => l.net_pay), description: `Remuneraciones netas por pagar ${label}` },
  ];
}

/** Aprueba la planilla y registra el asiento de devengo con fecha del último día del mes. */
export async function approvePayrollPeriod(id: number, actor: { userId: number; username: string }) {
  const dto = await getPayrollPeriod(id);
  if (dto.status !== "Borrador") throw new UserError("Solo se aprueba una planilla en borrador");
  if (dto.lines.length === 0) throw new UserError("La planilla no tiene trabajadores");
  const { to } = monthBounds(dto.year, dto.month);
  if (to > todayLimaIso()) throw new UserError("La planilla se aprueba al cierre del mes (después del último día)");

  await prisma.$transaction(async (tx) => {
    try {
      await postJournalEntryLines(tx, {
        date: parseUtcDate(to),
        description: `Planilla de remuneraciones ${dto.label}`,
        book: BOOK_PAYROLL,
        responsible: actor.username,
        observation: `Devengo de planilla ${dto.label} (${dto.workers} trabajadores)`,
        payrollPeriodId: id,
        lines: accrualLines(dto.lines, dto.label),
      });
    } catch (e) {
      throw new UserError(e instanceof Error ? e.message : "No se pudo registrar el asiento de la planilla");
    }
    await tx.payrollPeriod.update({ where: { id }, data: { status: "Aprobada", approvedAt: new Date(), approvedById: actor.userId } });
  });
  return getPayrollPeriod(id);
}

/**
 * Pago de la planilla: asiento 411 Remuneraciones por pagar (DEBE) / 10 Caja-Bancos (HABER),
 * fecha de pago en cada boleta y descuento de las cuotas de adelantos (saldo y estado).
 */
export async function payPayrollPeriod(id: number, data: { payment_method?: unknown; payment_date?: unknown }, actor: { userId: number; username: string }) {
  const method = typeof data.payment_method === "string" && (PAYROLL_PAYMENT_METHODS as readonly string[]).includes(data.payment_method) ? data.payment_method : null;
  if (!method) throw new UserError("Selecciona el medio de pago");
  const date = typeof data.payment_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.payment_date) ? data.payment_date : todayLimaIso();
  if (date > todayLimaIso()) throw new UserError("La fecha de pago no puede ser futura");

  const dto = await getPayrollPeriod(id);
  if (dto.status !== "Aprobada") throw new UserError("Primero aprueba la planilla");
  const { to } = monthBounds(dto.year, dto.month);
  if (date < to) throw new UserError("El pago no puede ser anterior al cierre del mes");

  await prisma.$transaction(async (tx) => {
    try {
      await postJournalEntryLines(tx, {
        date: parseUtcDate(date),
        description: `Pago de planilla ${dto.label}`,
        book: "Caja y bancos",
        responsible: actor.username,
        observation: `Pago de remuneraciones netas ${dto.label} (${method})`,
        payrollPeriodId: id,
        lines: [
          { accountCode: PAYROLL_ACCOUNTS.salariesPayable, debit: dto.total_net, description: `Cancelación de remuneraciones ${dto.label}` },
          { accountCode: paymentAccountCode(method), credit: dto.total_net, description: `Pago por ${method}` },
        ],
      });
    } catch (e) {
      throw new UserError(e instanceof Error ? e.message : "No se pudo registrar el asiento de pago");
    }
    for (const line of dto.lines) {
      for (const a of line.detail.advances) {
        const adv = await tx.salaryAdvance.findUnique({ where: { id: a.advance_id } });
        if (!adv) continue;
        const deducted = r2(n(adv.deductedAmount) + a.amount);
        await tx.salaryAdvance.update({
          where: { id: adv.id },
          data: { deductedAmount: deducted, ...(deducted >= n(adv.amount) ? { status: "Liquidado" } : {}) },
        });
      }
    }
    await tx.payroll.updateMany({ where: { periodId: id }, data: { paymentDate: parseUtcDate(date) } });
    await tx.payrollPeriod.update({ where: { id }, data: { status: "Pagada", paidAt: new Date(), paidById: actor.userId, paymentMethod: method } });
  });
  return getPayrollPeriod(id);
}

/** Revierte la aprobación (solo si aún no se pagó): anula el asiento de devengo y vuelve a Borrador. */
export async function reopenPayrollPeriod(id: number, reason: unknown) {
  const why = text(reason, "El motivo", 150, true)!;
  const dto = await getPayrollPeriod(id);
  if (dto.status === "Pagada") throw new UserError("Una planilla pagada no se reabre: registra los ajustes en la planilla del mes siguiente");
  if (dto.status !== "Aprobada") throw new UserError("La planilla no está aprobada");
  await prisma.$transaction(async (tx) => {
    await voidJournalEntries(
      tx,
      dto.journal_entries.filter((j) => j.status).map((j) => j.id),
      why,
    );
    await tx.payrollPeriod.update({ where: { id }, data: { status: "Borrador", approvedAt: null, approvedById: null } });
  });
  return getPayrollPeriod(id);
}

/** Boletas de un trabajador (autoservicio y ficha). */
export async function payslipsOf(employeeId: number) {
  const rows = await prisma.payroll.findMany({
    where: { employeeId, period: { status: { in: ["Aprobada", "Pagada"] } } },
    include: { period: { include: INCLUDE } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 12,
  });
  return rows.map((r) => {
    const period = mapPeriod(r.period!);
    const line = period.lines.find((l) => l.payroll_id === r.id)!;
    return { ...line, period_label: period.label, status: period.status, year: r.year, month: r.month };
  });
}
