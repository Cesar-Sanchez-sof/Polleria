import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/security/users.service";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import { fullName, isoDate, todayLimaIso } from "./common";
import { MINIMUM_WAGE, type ContractTypeCode } from "./labor-rules";
import { employeeAttendance } from "./attendance.service";
import { familyAllowanceAmount } from "./payroll-rules";
import {
  calculateCts,
  calculateGratification,
  calculateSettlement,
  computableRemuneration,
  ctsPeriod,
  gratificationFactor,
  gratificationPeriod,
  periodsAt,
  type BenefitPeriod,
  type SettlementResult,
} from "./social-benefits-rules";

const n = (d: { toString(): string } | null | undefined) => Number(d?.toString() ?? 0);
const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

export type BenefitKind = "gratificacion" | "cts";

export interface BenefitLineDto {
  employee_id: number;
  employee_name: string;
  employee_dni: string;
  contract_id: number;
  regime: string;
  contract_type: string;
  base_salary: number;
  computable: number;
  months: number;
  days: number;
  absence_days: number;
  amount: number;
  bonus: number;
  total: number;
  notes: string[];
}

export interface BenefitListDto {
  kind: BenefitKind;
  year: number;
  half: 1 | 2;
  period: BenefitPeriod;
  workers: number;
  total_amount: number;
  total_bonus: number;
  total: number;
  lines: BenefitLineDto[];
}

function validPeriod(kindRaw: unknown, yearRaw: unknown, halfRaw: unknown) {
  if (kindRaw !== "gratificacion" && kindRaw !== "cts") throw new UserError("El tipo debe ser «gratificacion» o «cts»");
  const year = Number(yearRaw);
  const half = Number(halfRaw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new UserError("El año no es válido");
  if (half !== 1 && half !== 2) throw new UserError("El semestre debe ser 1 o 2");
  return { kind: kindRaw as BenefitKind, year, half: half as 1 | 2 };
}

/** Faltas injustificadas de un trabajador en un rango (hasta hoy como máximo). */
async function absencesIn(employeeId: number, from: string, to: string, today: string): Promise<number> {
  const end = to < today ? to : today;
  if (end < from) return 0;
  const attendance = await employeeAttendance(employeeId, from, end);
  return attendance.days.filter((d) => d.status === "Falta").length;
}

async function usedVacationDays(employeeId: number): Promise<number> {
  const agg = await prisma.leaveRequest.aggregate({
    where: { employeeId, type: "Vacaciones", status: "Aprobada" },
    _sum: { days: true },
  });
  return agg._sum.days ?? 0;
}

/**
 * Gratificaciones o CTS de un semestre: cuánto se debe pagar/depositar a cada trabajador
 * con contrato en planilla durante el periodo (sirve de provisión y de reporte para el pago).
 */
export async function listSocialBenefits(kindRaw: unknown, yearRaw: unknown, halfRaw: unknown, now = new Date()): Promise<BenefitListDto> {
  const { kind, year, half } = validPeriod(kindRaw, yearRaw, halfRaw);
  const period = kind === "gratificacion" ? gratificationPeriod(year, half) : ctsPeriod(year, half);
  const today = todayLimaIso(now);

  const contracts = await prisma.employmentContract.findMany({
    where: {
      contractType: { not: "LocacionServicios" },
      startDate: { lte: parseUtcDate(period.to) },
      OR: [{ endDate: null }, { endDate: { gte: parseUtcDate(period.from) } }],
    },
    orderBy: [{ startDate: "desc" }],
    include: { employee: { select: { id: true, dni: true, firstName: true, middleName: true, paternalLastName: true, maternalLastName: true } } },
  });

  // Un trabajador con renovación aparece una vez: el servicio corre desde su primer contrato.
  const byEmployee = new Map<number, typeof contracts>();
  for (const c of contracts) byEmployee.set(c.employeeId, [...(byEmployee.get(c.employeeId) ?? []), c]);

  const lines: BenefitLineDto[] = [];
  for (const [employeeId, list] of byEmployee) {
    const c = list[0];
    const base = n(c.baseSalary);
    if (base <= 0) continue;
    const start = formatDateToIso(list[list.length - 1].startDate);
    const endDate = c.terminationDate ?? c.endDate;
    const end = endDate ? formatDateToIso(endDate) : null;
    const familyAllowance = c.familyAllowance ? familyAllowanceAmount() : 0;
    const absenceDays = await absencesIn(employeeId, period.from > start ? period.from : start, period.to, today);
    const type = c.contractType as ContractTypeCode;

    let line: Omit<BenefitLineDto, "employee_id" | "employee_name" | "employee_dni" | "contract_id" | "regime" | "contract_type" | "base_salary" | "absence_days">;
    if (kind === "gratificacion") {
      const computable = computableRemuneration({ baseSalary: base, familyAllowance });
      const g = calculateGratification({ regime: c.laborRegime, type, computable, serviceStart: start, serviceEnd: end, period, absenceDays });
      line = { computable, months: g.months, days: 0, amount: g.amount, bonus: g.bonus, total: g.total, notes: g.notes };
    } else {
      const lastGratification = computableRemuneration({ baseSalary: base, familyAllowance }) * gratificationFactor(c.laborRegime, type);
      const computable = computableRemuneration({ baseSalary: base, familyAllowance, lastGratification });
      const t = calculateCts({ regime: c.laborRegime, type, computable, serviceStart: start, serviceEnd: end, period, absenceDays });
      line = { computable, months: t.months, days: t.days, amount: t.amount, bonus: 0, total: t.amount, notes: t.notes };
    }
    if (!line.total && line.notes.length === 0) continue;
    lines.push({
      employee_id: employeeId,
      employee_name: fullName(c.employee),
      employee_dni: c.employee.dni,
      contract_id: c.id,
      regime: c.laborRegime,
      contract_type: c.contractType,
      base_salary: base,
      absence_days: absenceDays,
      ...line,
    });
  }
  lines.sort((a, b) => a.employee_name.localeCompare(b.employee_name, "es"));
  const totalAmount = r2(lines.reduce((s, l) => s + l.amount, 0));
  const totalBonus = r2(lines.reduce((s, l) => s + l.bonus, 0));
  return {
    kind,
    year,
    half,
    period,
    workers: lines.filter((l) => l.total > 0).length,
    total_amount: totalAmount,
    total_bonus: totalBonus,
    total: r2(totalAmount + totalBonus),
    lines,
  };
}

export interface SettlementOptions {
  /** Último día de labores; por defecto la fecha de cese registrada o, si sigue vigente, hoy. */
  cutoff?: unknown;
  arbitrary_dismissal?: unknown;
  other_deductions?: unknown;
}

export interface SettlementDto extends SettlementResult {
  contract_id: number;
  employee_id: number;
  employee_name: string;
  employee_dni: string;
  regime: string;
  contract_type: string;
  contract_status: string;
  base_salary: number;
  service_start: string;
  cutoff: string;
  /** `true` si el contrato sigue vigente: es una simulación, no la liquidación definitiva. */
  simulated: boolean;
  pension_system: string;
}

/** Liquidación de beneficios sociales de un contrato (al cese o simulada a una fecha). */
export async function contractSettlement(contractId: number, opts: SettlementOptions = {}, now = new Date()): Promise<SettlementDto> {
  const contract = await prisma.employmentContract.findUnique({
    where: { id: contractId },
    include: { employee: { select: { id: true, dni: true, firstName: true, middleName: true, paternalLastName: true, maternalLastName: true } } },
  });
  if (!contract) throw new UserError("Contrato no encontrado", 404);
  if (contract.contractType === "LocacionServicios") throw new UserError("La locación de servicios no genera beneficios sociales");

  const today = todayLimaIso(now);
  const registered = contract.terminationDate ? formatDateToIso(contract.terminationDate) : null;
  const cutoff = isoDate(opts.cutoff, "La fecha de cese") ?? registered ?? today;
  const start = formatDateToIso(contract.startDate);
  if (cutoff < start) throw new UserError("La fecha de cese no puede ser anterior al inicio del contrato");

  // El servicio continuo se cuenta desde el primer contrato de la cadena de renovaciones.
  let serviceStart = start;
  let prevId = contract.renewedFromId;
  while (prevId) {
    const prev = await prisma.employmentContract.findUnique({ where: { id: prevId }, select: { startDate: true, renewedFromId: true } });
    if (!prev) break;
    serviceStart = formatDateToIso(prev.startDate);
    prevId = prev.renewedFromId;
  }

  const sixthStart = (p: BenefitPeriod) => (p.from > serviceStart ? p.from : serviceStart);
  const periods = periodsAt(cutoff);

  const [gratAbs, ctsAbs, used, advances] = await Promise.all([
    absencesIn(contract.employeeId, sixthStart(periods.gratification), cutoff, today),
    absencesIn(contract.employeeId, sixthStart(periods.cts), cutoff, today),
    usedVacationDays(contract.employeeId),
    prisma.salaryAdvance.findMany({ where: { employeeId: contract.employeeId, status: "Pagado" }, select: { amount: true, deductedAmount: true } }),
  ]);
  const pendingAdvances = r2(advances.reduce((s, a) => s + Math.max(0, n(a.amount) - n(a.deductedAmount)), 0));
  const other = Number(opts.other_deductions ?? 0);
  if (!Number.isFinite(other) || other < 0) throw new UserError("Otros descuentos debe ser un monto válido");

  const result = calculateSettlement({
    regime: contract.laborRegime,
    type: contract.contractType as ContractTypeCode,
    baseSalary: n(contract.baseSalary),
    familyAllowance: contract.familyAllowance ? familyAllowanceAmount() : 0,
    serviceStart,
    cutoff,
    contractEnd: contract.endDate ? formatDateToIso(contract.endDate) : null,
    pensionSystem: contract.pensionSystem,
    afpName: contract.afpName,
    usedVacationDays: used,
    gratificationAbsences: gratAbs,
    ctsAbsences: ctsAbs,
    pendingAdvances,
    otherDeductions: other,
    arbitraryDismissal: opts.arbitrary_dismissal === true || opts.arbitrary_dismissal === "true",
  });
  if (n(contract.baseSalary) < MINIMUM_WAGE && contract.contractType !== "Practicas") {
    result.warnings.push(`El sueldo está por debajo de la RMV (S/ ${MINIMUM_WAGE.toFixed(2)})`);
  }

  return {
    ...result,
    contract_id: contract.id,
    employee_id: contract.employeeId,
    employee_name: fullName(contract.employee),
    employee_dni: contract.employee.dni,
    regime: contract.laborRegime,
    contract_type: contract.contractType,
    contract_status: contract.status,
    base_salary: n(contract.baseSalary),
    service_start: serviceStart,
    cutoff,
    simulated: contract.status === "Vigente",
    pension_system: contract.pensionSystem,
  };
}
