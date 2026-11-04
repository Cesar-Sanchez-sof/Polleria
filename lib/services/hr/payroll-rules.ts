/**
 * Cálculo de la planilla mensual (boleta de pago) según la normativa peruana, sin BD.
 *
 *  - Mes comercial de 30 días: sueldo diario = básico / 30; hora = diario / 8.
 *  - Faltas injustificadas y licencias sin goce no se remuneran.
 *  - Tardanzas: se descuenta el tiempo no laborado (minutos × valor minuto).
 *  - Horas extra (D. S. 007-2002-TR): primeras 2 h del día con 25 % y las siguientes con 35 %.
 *  - Asignación familiar (Ley 25129): 10 % de la RMV.
 *  - ONP 13 %; AFP: aporte 10 % + prima de seguro 1.37 % (hasta la remuneración máxima
 *    asegurable) + comisión sobre flujo de cada AFP.
 *  - Renta de 5.ª categoría: proyección anual (12 sueldos + 2 gratificaciones en régimen
 *    general/pequeña empresa) − 7 UIT, escala progresiva 8/14/17/20/30 %, retención = anual / 12
 *    (método simplificado; la planilla oficial aplica los divisores de SUNAT mes a mes).
 *  - EsSalud 9 % a cargo del empleador (base mínima RMV).
 *
 * Las tasas cambian por norma (RMV, UIT, comisiones SBS): actualízalas aquí.
 */
import { MINIMUM_WAGE, type ContractTypeCode, type LaborRegimeCode, type PensionSystemCode } from "./labor-rules";

/** Unidad Impositiva Tributaria vigente (S/). */
export const UIT = 5350;
export const FAMILY_ALLOWANCE_RATE = 0.1;
export const ONP_RATE = 0.13;
export const AFP_CONTRIBUTION_RATE = 0.1;
export const AFP_INSURANCE_RATE = 0.0137;
/** Remuneración máxima asegurable para la prima de seguro AFP. */
export const AFP_MAX_INSURABLE = 12234.11;
/** Comisión sobre la remuneración (flujo) de cada AFP. */
export const AFP_COMMISSION: Record<string, number> = { Habitat: 0.0147, Integra: 0.0155, Prima: 0.016, Profuturo: 0.0169 };
export const ESSALUD_RATE = 0.09;
export const OVERTIME_FIRST_RATE = 0.25;
export const OVERTIME_NEXT_RATE = 0.35;
/** Minutos extra diarios por debajo de este umbral no se pagan como sobretiempo. */
export const OVERTIME_MIN_MINUTES = 30;
const TAX_BRACKETS: Array<[limitUit: number, rate: number]> = [
  [5, 0.08],
  [20, 0.14],
  [35, 0.17],
  [45, 0.2],
  [Infinity, 0.3],
];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Contratos que van en la planilla (la locación se paga con recibo por honorarios). */
export function inPayroll(type: ContractTypeCode): boolean {
  return type !== "LocacionServicios";
}

export function familyAllowanceAmount(): number {
  return r2(MINIMUM_WAGE * FAMILY_ALLOWANCE_RATE);
}

/** Pago de horas extra a partir de los minutos extra de cada día. */
export function overtimePay(baseSalary: number, dailyExtraMinutes: number[]): { minutes: number; amount: number } {
  const hourly = baseSalary / 30 / 8;
  let minutes = 0;
  let amount = 0;
  for (const extra of dailyExtraMinutes) {
    if (extra < OVERTIME_MIN_MINUTES) continue;
    const first = Math.min(extra, 120);
    const rest = Math.max(0, extra - 120);
    minutes += extra;
    amount += (first / 60) * hourly * (1 + OVERTIME_FIRST_RATE) + (rest / 60) * hourly * (1 + OVERTIME_NEXT_RATE);
  }
  return { minutes, amount: r2(amount) };
}

export function pensionDeduction(gross: number, system: PensionSystemCode, afpName: string | null): { amount: number; detail: Record<string, number> } {
  if (system === "ONP") return { amount: r2(gross * ONP_RATE), detail: { onp: r2(gross * ONP_RATE) } };
  if (system === "AFP") {
    const contribution = r2(gross * AFP_CONTRIBUTION_RATE);
    const insurance = r2(Math.min(gross, AFP_MAX_INSURABLE) * AFP_INSURANCE_RATE);
    const commission = r2(gross * (AFP_COMMISSION[afpName ?? ""] ?? AFP_COMMISSION.Integra));
    return { amount: r2(contribution + insurance + commission), detail: { afp_contribution: contribution, afp_insurance: insurance, afp_commission: commission } };
  }
  return { amount: 0, detail: {} };
}

/** Impuesto anual de 5.ª categoría sobre la renta neta (después de las 7 UIT). */
export function annualIncomeTax(netAnnual: number): number {
  let remaining = Math.max(0, netAnnual);
  let lower = 0;
  let tax = 0;
  for (const [limitUit, rate] of TAX_BRACKETS) {
    const upper = limitUit * UIT;
    const slice = Math.min(remaining, upper - lower);
    if (slice <= 0) break;
    tax += slice * rate;
    remaining -= slice;
    lower = upper;
  }
  return r2(tax);
}

/** Retención mensual de 5.ª categoría (proyección simplificada). */
export function monthlyIncomeTax(params: {
  fixedMonthly: number;
  variableThisMonth: number;
  regime: LaborRegimeCode;
  type: ContractTypeCode;
}): number {
  if (params.type === "Practicas") return 0;
  const gratifications = params.regime === "Micro" ? 0 : 2 * params.fixedMonthly * (1 + ESSALUD_RATE); // + bonificación extraordinaria 9 %
  const projected = params.fixedMonthly * 12 + gratifications + params.variableThisMonth;
  const net = projected - 7 * UIT;
  return net > 0 ? r2(annualIncomeTax(net) / 12) : 0;
}

export interface PayrollInput {
  contractType: ContractTypeCode;
  regime: LaborRegimeCode;
  baseSalary: number;
  familyAllowance: boolean;
  pensionSystem: PensionSystemCode;
  afpName: string | null;
  /** Días del mes que cubre el contrato (mes comercial, máx. 30). */
  contractDays: number;
  /** Faltas injustificadas (días). */
  absenceDays: number;
  /** Días de licencia sin goce. */
  unpaidLeaveDays: number;
  /** Minutos de tardanza no justificada. */
  lateMinutes: number;
  /** Minutos extra por día (de la asistencia). */
  dailyExtraMinutes: number[];
  bonus: number;
  otherDeductions: number;
  /** Cuotas de adelantos pendientes de descontar este mes. */
  advanceInstallments: Array<{ advance_id: number; amount: number }>;
  /** Primas mensuales de seguros a cargo del empleador (sin EsSalud). */
  insurancePremiums: number;
}

export interface PayrollResult {
  contract_days: number;
  unpaid_days: number;
  paid_days: number;
  late_minutes: number;
  overtime_minutes: number;
  basic_pay: number;
  family_allowance: number;
  overtime_pay: number;
  bonus: number;
  late_discount: number;
  gross_pay: number;
  pension_amount: number;
  income_tax: number;
  advance_deduction: number;
  other_deductions: number;
  deductions: number;
  net_pay: number;
  essalud: number;
  insurance_cost: number;
  employer_cost: number;
  detail: {
    daily_wage: number;
    minute_wage: number;
    pension: Record<string, number>;
    advances: Array<{ advance_id: number; amount: number }>;
    warnings: string[];
  };
}

/** Calcula la boleta de un trabajador. Nunca deja un neto negativo: recorta los adelantos primero. */
export function calculatePayroll(i: PayrollInput): PayrollResult {
  const isIntern = i.contractType === "Practicas";
  const warnings: string[] = [];
  const contractDays = Math.max(0, Math.min(30, i.contractDays));
  const unpaid = Math.min(contractDays, Math.max(0, i.absenceDays) + Math.max(0, i.unpaidLeaveDays));
  const paidDays = contractDays - unpaid;
  const daily = i.baseSalary / 30;
  const minuteWage = daily / 8 / 60;

  const basicPay = r2(daily * paidDays);
  const familyAllowance = i.familyAllowance && !isIntern && contractDays > 0 ? r2((familyAllowanceAmount() * contractDays) / 30) : 0;
  const overtime = isIntern ? { minutes: 0, amount: 0 } : overtimePay(i.baseSalary, i.dailyExtraMinutes);
  const lateDiscount = r2(Math.max(0, i.lateMinutes) * minuteWage);
  const bonus = r2(Math.max(0, i.bonus));
  const gross = r2(Math.max(0, basicPay + familyAllowance + overtime.amount + bonus - lateDiscount));

  const pension = isIntern ? { amount: 0, detail: {} } : pensionDeduction(gross, i.pensionSystem, i.afpName);
  const incomeTax = monthlyIncomeTax({
    fixedMonthly: i.baseSalary + (i.familyAllowance ? familyAllowanceAmount() : 0),
    variableThisMonth: overtime.amount + bonus,
    regime: i.regime,
    type: i.contractType,
  });
  const room = Math.max(0, gross - pension.amount - incomeTax);
  const otherDeductions = r2(Math.min(Math.max(0, i.otherDeductions), room));
  if (otherDeductions < i.otherDeductions) warnings.push("Otros descuentos recortados: no pueden superar el neto del mes");

  // Los adelantos se descuentan hasta donde alcance el neto (el saldo queda para el mes siguiente).
  let available = r2(gross - pension.amount - incomeTax - otherDeductions);
  const advances: Array<{ advance_id: number; amount: number }> = [];
  for (const a of i.advanceInstallments) {
    const take = r2(Math.max(0, Math.min(a.amount, available)));
    if (take < a.amount) warnings.push(`El adelanto #${a.advance_id} solo se descuenta S/ ${take.toFixed(2)} por falta de neto`);
    if (take > 0) advances.push({ advance_id: a.advance_id, amount: take });
    available = r2(available - take);
  }
  const advanceDeduction = r2(advances.reduce((s, a) => s + a.amount, 0));
  const deductions = r2(pension.amount + incomeTax + advanceDeduction + otherDeductions);
  if (gross - deductions < 0) warnings.push("Los descuentos superan los ingresos del mes");
  const net = r2(Math.max(0, gross - deductions));

  const essalud = isIntern || contractDays === 0 ? 0 : r2(Math.max(gross, (MINIMUM_WAGE * contractDays) / 30) * ESSALUD_RATE);
  const insurance = r2(Math.max(0, i.insurancePremiums));
  if (unpaid > 0) warnings.push(`${unpaid} día(s) no remunerado(s) por faltas o licencia sin goce`);

  return {
    contract_days: contractDays,
    unpaid_days: unpaid,
    paid_days: paidDays,
    late_minutes: Math.max(0, i.lateMinutes),
    overtime_minutes: overtime.minutes,
    basic_pay: basicPay,
    family_allowance: familyAllowance,
    overtime_pay: overtime.amount,
    bonus,
    late_discount: lateDiscount,
    gross_pay: gross,
    pension_amount: pension.amount,
    income_tax: incomeTax,
    advance_deduction: advanceDeduction,
    other_deductions: otherDeductions,
    deductions,
    net_pay: net,
    essalud,
    insurance_cost: insurance,
    employer_cost: r2(gross + essalud + insurance),
    detail: { daily_wage: r2(daily), minute_wage: Math.round(minuteWage * 10000) / 10000, pension: pension.detail, advances, warnings },
  };
}

/** Días comerciales (máx. 30) que un contrato cubre dentro del mes. */
export function contractDaysInMonth(year: number, month: number, start: string, end: string | null): number {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const from = start > monthStart ? start : monthStart;
  const to = end && end < monthEnd ? end : monthEnd;
  if (to < from) return 0;
  if (from === monthStart && to === monthEnd) return 30; // mes completo = 30 días comerciales
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  return Math.min(30, days);
}
