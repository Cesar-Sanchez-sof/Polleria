/**
 * Derechos laborales de la planilla peruana (sin BD): gratificaciones, CTS, vacaciones
 * truncas/no gozadas, indemnización por despido arbitrario y liquidación de beneficios sociales.
 *
 *  - Gratificaciones (Ley 27735, Ley 30334): julio (ene–jun) y diciembre (jul–dic). Régimen general:
 *    1 remuneración; pequeña empresa: ½; microempresa: no corresponde. Se pagan por meses
 *    completos del semestre (n/6) más la bonificación extraordinaria del 9 % (EsSalud).
 *  - CTS (D. S. 001-97-TR, D. Leg. 1086): semestres mayo–octubre (depósito al 15-nov) y
 *    noviembre–abril (depósito al 15-may). General: remuneración computable (sueldo + asignación
 *    familiar + 1/6 de la última gratificación) / 12 por mes y /360 por día; pequeña empresa: 50 %;
 *    microempresa: no corresponde. Sin derecho: tiempo parcial (< 4 h), prácticas y locación.
 *  - Vacaciones (D. Leg. 713 / 1086): 30 días (general) o 15 (MYPE) por año. Al cese se pagan los
 *    días ganados no gozados y la parte trunca (proporcional) del año en curso.
 *  - Indemnización por despido arbitrario (D. S. 003-97-TR, D. Leg. 1086): solo si el cese es
 *    un despido sin causa justa, así que RR. HH. debe indicarlo expresamente.
 *
 * Las tasas y topes cambian por norma: actualízalos aquí.
 */
import {
  ESSALUD_RATE,
  addDaysIso,
  addMonthsIso,
  annualVacationDays,
  daysInclusive,
  fullMonthsBetween,
  type ContractTypeCode,
  type LaborRegimeCode,
  type PensionSystemCode,
} from "./labor-rules";
import { pensionDeduction } from "./payroll-rules";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Bonificación extraordinaria sobre la gratificación (Ley 30334): equivale al aporte a EsSalud. */
export const GRATIFICATION_BONUS_RATE = ESSALUD_RATE;

// ---------------------------------------------------------------------------
// Elegibilidad
// ---------------------------------------------------------------------------

/** Fracción de la remuneración que se paga como gratificación completa de un semestre. */
export function gratificationFactor(regime: LaborRegimeCode, type: ContractTypeCode): number {
  if (type === "Practicas" || type === "LocacionServicios") return 0;
  return regime === "General" ? 1 : regime === "Pequena" ? 0.5 : 0;
}

/** Fracción de la CTS: tiempo parcial (< 4 h), prácticas y locación no tienen CTS. */
export function ctsFactor(regime: LaborRegimeCode, type: ContractTypeCode): number {
  if (type === "Practicas" || type === "LocacionServicios" || type === "TiempoParcial") return 0;
  return regime === "General" ? 1 : regime === "Pequena" ? 0.5 : 0;
}

/** Remuneración computable: sueldo + asignación familiar + promedio variable (+ 1/6 de gratificación para CTS/vacaciones). */
export function computableRemuneration(p: {
  baseSalary: number;
  familyAllowance: number;
  variableAverage?: number;
  lastGratification?: number;
}): number {
  return r2(p.baseSalary + p.familyAllowance + (p.variableAverage ?? 0) + (p.lastGratification ?? 0) / 6);
}

// ---------------------------------------------------------------------------
// Periodos
// ---------------------------------------------------------------------------

export interface BenefitPeriod {
  from: string;
  to: string;
  label: string;
  /** Fecha límite de pago/depósito. */
  deadline: string;
}

/** Semestre de gratificación: 1 = ene–jun (se paga el 15-jul), 2 = jul–dic (se paga el 15-dic). */
export function gratificationPeriod(year: number, half: 1 | 2): BenefitPeriod {
  return half === 1
    ? { from: `${year}-01-01`, to: `${year}-06-30`, label: `Gratificación de julio ${year}`, deadline: `${year}-07-15` }
    : { from: `${year}-07-01`, to: `${year}-12-31`, label: `Gratificación de diciembre ${year}`, deadline: `${year}-12-15` };
}

/** Semestre de CTS: 1 = nov(año-1)–abr (depósito 15-may), 2 = may–oct (depósito 15-nov). */
export function ctsPeriod(year: number, half: 1 | 2): BenefitPeriod {
  return half === 1
    ? { from: `${year - 1}-11-01`, to: `${year}-04-30`, label: `CTS de mayo ${year}`, deadline: `${year}-05-15` }
    : { from: `${year}-05-01`, to: `${year}-10-31`, label: `CTS de noviembre ${year}`, deadline: `${year}-11-15` };
}

/** Intersección del servicio del trabajador con un periodo; `null` si no se cruzan. */
function overlap(period: { from: string; to: string }, start: string, end: string | null) {
  const from = start > period.from ? start : period.from;
  const to = end && end < period.to ? end : period.to;
  return to < from ? null : { from, to };
}

/** Meses completos y días sueltos entre dos fechas inclusivas (base 30 días por mes). */
export function monthsAndDays(from: string, to: string): { months: number; days: number } {
  const exclusiveEnd = addDaysIso(to, 1);
  const months = fullMonthsBetween(from, exclusiveEnd);
  const days = Math.max(0, daysInclusive(addMonthsIso(from, months), to));
  return { months, days: Math.min(days, 29) };
}

// ---------------------------------------------------------------------------
// Gratificación
// ---------------------------------------------------------------------------

export interface GratificationInput {
  regime: LaborRegimeCode;
  type: ContractTypeCode;
  /** Remuneración computable (sueldo + asignación familiar + promedio variable). */
  computable: number;
  serviceStart: string;
  /** Último día de servicio (cese o fin de contrato); `null` = sigue vigente. */
  serviceEnd: string | null;
  period: { from: string; to: string };
  /** Faltas injustificadas dentro del semestre. */
  absenceDays?: number;
}

export interface GratificationResult {
  eligible: boolean;
  months: number;
  /** Gratificación completa del semestre (antes de proporcionar). */
  full_amount: number;
  absence_discount: number;
  amount: number;
  bonus: number;
  total: number;
  notes: string[];
}

export function calculateGratification(i: GratificationInput): GratificationResult {
  const notes: string[] = [];
  const factor = gratificationFactor(i.regime, i.type);
  const empty: GratificationResult = { eligible: false, months: 0, full_amount: 0, absence_discount: 0, amount: 0, bonus: 0, total: 0, notes };
  if (factor === 0) {
    notes.push("Este régimen o tipo de contrato no genera gratificación");
    return empty;
  }
  const span = overlap(i.period, i.serviceStart, i.serviceEnd);
  const months = span ? Math.min(6, fullMonthsBetween(span.from, addDaysIso(span.to, 1))) : 0;
  if (months === 0) {
    notes.push("Aún no completa un mes calendario en el semestre");
    return empty;
  }
  const full = r2(i.computable * factor);
  const gross = (full * months) / 6;
  // Cada falta injustificada resta 1/30 de la parte mensual (1/180 de la gratificación completa).
  const discount = Math.min(gross, (full / 180) * Math.max(0, i.absenceDays ?? 0));
  const amount = r2(gross - discount);
  const bonus = r2(amount * GRATIFICATION_BONUS_RATE);
  if (months < 6) notes.push(`Proporcional: ${months}/6 meses completos`);
  if (discount > 0) notes.push(`Descuento por ${i.absenceDays} falta(s) injustificada(s)`);
  return { eligible: true, months, full_amount: full, absence_discount: r2(discount), amount, bonus, total: r2(amount + bonus), notes };
}

// ---------------------------------------------------------------------------
// CTS
// ---------------------------------------------------------------------------

export interface CtsInput {
  regime: LaborRegimeCode;
  type: ContractTypeCode;
  /** Remuneración computable incluida la sexta parte de la última gratificación. */
  computable: number;
  serviceStart: string;
  serviceEnd: string | null;
  period: { from: string; to: string };
  absenceDays?: number;
}

export interface CtsResult {
  eligible: boolean;
  months: number;
  days: number;
  amount: number;
  notes: string[];
}

export function calculateCts(i: CtsInput): CtsResult {
  const notes: string[] = [];
  const factor = ctsFactor(i.regime, i.type);
  if (factor === 0) {
    notes.push("Este régimen o tipo de contrato no genera CTS");
    return { eligible: false, months: 0, days: 0, amount: 0, notes };
  }
  const span = overlap(i.period, i.serviceStart, i.serviceEnd);
  if (!span) return { eligible: false, months: 0, days: 0, amount: 0, notes: ["Sin servicios en el semestre"] };
  const { months, days } = monthsAndDays(span.from, span.to);
  const absences = Math.max(0, i.absenceDays ?? 0);
  const countedDays = Math.max(0, months * 30 + days - absences);
  if (absences > 0) notes.push(`Se descuentan ${absences} día(s) de faltas injustificadas`);
  if (i.regime === "Pequena") notes.push("Pequeña empresa: 15 remuneraciones diarias por año (50 % de la CTS general)");
  // computable/12 por mes y /360 por día = computable/360 por día de base 30.
  const amount = r2((i.computable / 360) * countedDays * factor);
  return { eligible: true, months, days, amount, notes };
}

// ---------------------------------------------------------------------------
// Vacaciones
// ---------------------------------------------------------------------------

export interface VacationPayInput {
  regime: LaborRegimeCode;
  type: ContractTypeCode;
  computable: number;
  serviceStart: string;
  /** Último día de servicio. */
  cutoff: string;
  /** Días de vacaciones ya tomados (aprobados) desde el inicio. */
  usedDays: number;
}

export interface VacationPayResult {
  eligible: boolean;
  annual_days: number;
  /** Días ganados por años completos y todavía no gozados. */
  unused_days: number;
  /** Días proporcionales del año en curso (fraccionados). */
  truncated_days: number;
  daily_value: number;
  unused_amount: number;
  truncated_amount: number;
  total: number;
  notes: string[];
}

export function calculateVacationPay(i: VacationPayInput): VacationPayResult {
  const annual = annualVacationDays(i.regime, i.type);
  const notes: string[] = [];
  const empty = { eligible: false, annual_days: 0, unused_days: 0, truncated_days: 0, daily_value: 0, unused_amount: 0, truncated_amount: 0, total: 0, notes };
  if (annual === 0) {
    notes.push("Este tipo de contrato no genera vacaciones");
    return empty;
  }
  const endExclusive = addDaysIso(i.cutoff, 1);
  const totalMonths = fullMonthsBetween(i.serviceStart, endExclusive);
  const years = Math.floor(totalMonths / 12);
  const rem = totalMonths % 12;
  const anniversary = addMonthsIso(i.serviceStart, years * 12 + rem);
  const extraDays = Math.min(29, Math.max(0, daysInclusive(anniversary, i.cutoff)));
  const accrued = (annual * (rem + extraDays / 30)) / 12;
  const earned = years * annual;
  const used = Math.max(0, i.usedDays);
  // Lo tomado por encima de lo ganado fue adelanto y se descuenta de la parte trunca.
  const unused = Math.max(0, earned - used);
  const truncated = Math.max(0, accrued - Math.max(0, used - earned));
  const daily = i.computable / 30;
  // Las vacaciones se pagan por la remuneración de los días de descanso (30 días = 1 remuneración).
  const unusedAmount = r2(daily * unused);
  const truncatedAmount = r2(daily * truncated);
  if (unused > 0) {
    notes.push(`${unused} día(s) ganados sin gozar: si el descanso ya venció (más de 1 año) puede corresponder el triple pago (D. Leg. 713, art. 23)`);
  }
  if (used > earned) notes.push(`Se gozaron ${used - earned} día(s) como adelanto: se descuentan de la parte trunca`);
  return {
    eligible: true,
    annual_days: annual,
    unused_days: unused,
    truncated_days: r2(truncated),
    daily_value: r2(daily),
    unused_amount: unusedAmount,
    truncated_amount: truncatedAmount,
    total: r2(unusedAmount + truncatedAmount),
    notes,
  };
}

// ---------------------------------------------------------------------------
// Indemnización por despido arbitrario
// ---------------------------------------------------------------------------

export interface DismissalInput {
  regime: LaborRegimeCode;
  type: ContractTypeCode;
  /** Sueldo mensual (remuneración ordinaria). */
  monthlySalary: number;
  serviceStart: string;
  cutoff: string;
  /** Fin pactado del contrato a plazo fijo. */
  contractEnd: string | null;
}

export function dismissalIndemnity(i: DismissalInput): { amount: number; notes: string[] } {
  const notes: string[] = [];
  if (i.type === "Practicas" || i.type === "LocacionServicios") {
    return { amount: 0, notes: ["No corresponde indemnización laboral en este tipo de contrato"] };
  }
  const { months, days } = monthsAndDays(i.serviceStart, i.cutoff);
  const yearsOfService = months / 12 + days / 360;
  const daily = i.monthlySalary / 30;
  if (i.regime === "General") {
    if (i.type === "PlazoFijo" && i.contractEnd && i.contractEnd > i.cutoff) {
      const remaining = monthsAndDays(addDaysIso(i.cutoff, 1), i.contractEnd);
      const amount = Math.min(12 * i.monthlySalary, 1.5 * i.monthlySalary * (remaining.months + remaining.days / 30));
      notes.push("Plazo fijo: 1.5 remuneraciones por cada mes que faltaba hasta el término (tope 12)");
      return { amount: r2(amount), notes };
    }
    const amount = Math.min(12 * i.monthlySalary, 1.5 * i.monthlySalary * yearsOfService);
    notes.push("Plazo indeterminado: 1.5 remuneraciones por año de servicio (tope 12). Tras el periodo de prueba");
    return { amount: r2(amount), notes };
  }
  const perYear = i.regime === "Pequena" ? 20 : 10;
  const cap = i.regime === "Pequena" ? 120 : 90;
  notes.push(`MYPE: ${perYear} remuneraciones diarias por año de servicio (tope ${cap})`);
  return { amount: r2(Math.min(cap, perYear * yearsOfService) * daily), notes };
}

// ---------------------------------------------------------------------------
// Liquidación de beneficios sociales
// ---------------------------------------------------------------------------

export interface SettlementInput {
  regime: LaborRegimeCode;
  type: ContractTypeCode;
  baseSalary: number;
  familyAllowance: number;
  serviceStart: string;
  /** Último día de labores. */
  cutoff: string;
  contractEnd: string | null;
  pensionSystem: PensionSystemCode;
  afpName: string | null;
  usedVacationDays: number;
  /** Faltas injustificadas del semestre de gratificación y del de CTS en curso. */
  gratificationAbsences?: number;
  ctsAbsences?: number;
  /** Saldo pendiente de adelantos de sueldo (se descuenta de la liquidación). */
  pendingAdvances?: number;
  otherDeductions?: number;
  /** Cese por despido arbitrario: suma la indemnización. */
  arbitraryDismissal?: boolean;
}

export interface SettlementResult {
  computable: number;
  computable_with_gratification: number;
  cts: CtsResult & { period: BenefitPeriod };
  gratification: GratificationResult & { period: BenefitPeriod };
  vacations: VacationPayResult;
  indemnity: { amount: number; notes: string[] };
  total_income: number;
  pension_deduction: number;
  pension_detail: Record<string, number>;
  advance_deduction: number;
  other_deductions: number;
  total_deductions: number;
  net_total: number;
  warnings: string[];
}

/** Semestre de gratificación y de CTS al que pertenece la fecha de cese. */
export function periodsAt(date: string): { gratification: BenefitPeriod; cts: BenefitPeriod } {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const gratification = gratificationPeriod(year, month <= 6 ? 1 : 2);
  // CTS: nov–abr → semestre 1 del año siguiente si la fecha es noviembre/diciembre.
  const cts = month >= 11 ? ctsPeriod(year + 1, 1) : month <= 4 ? ctsPeriod(year, 1) : ctsPeriod(year, 2);
  return { gratification, cts };
}

export function calculateSettlement(i: SettlementInput): SettlementResult {
  const warnings: string[] = [];
  const periods = periodsAt(i.cutoff);
  const computable = computableRemuneration({ baseSalary: i.baseSalary, familyAllowance: i.familyAllowance });
  // Estimación de la última gratificación: la completa del régimen (a falta de la boleta de gratificación).
  const lastGratification = computable * gratificationFactor(i.regime, i.type);
  const withGrat = computableRemuneration({ baseSalary: i.baseSalary, familyAllowance: i.familyAllowance, lastGratification });

  const gratification = {
    ...calculateGratification({
      regime: i.regime,
      type: i.type,
      computable,
      serviceStart: i.serviceStart,
      serviceEnd: i.cutoff,
      period: periods.gratification,
      absenceDays: i.gratificationAbsences,
    }),
    period: periods.gratification,
  };
  const cts = {
    ...calculateCts({
      regime: i.regime,
      type: i.type,
      computable: withGrat,
      serviceStart: i.serviceStart,
      serviceEnd: i.cutoff,
      period: periods.cts,
      absenceDays: i.ctsAbsences,
    }),
    period: periods.cts,
  };
  const vacations = calculateVacationPay({
    regime: i.regime,
    type: i.type,
    computable: withGrat,
    serviceStart: i.serviceStart,
    cutoff: i.cutoff,
    usedDays: i.usedVacationDays,
  });
  const indemnity = i.arbitraryDismissal
    ? dismissalIndemnity({ regime: i.regime, type: i.type, monthlySalary: computable, serviceStart: i.serviceStart, cutoff: i.cutoff, contractEnd: i.contractEnd })
    : { amount: 0, notes: [] as string[] };

  const totalIncome = r2(cts.amount + gratification.total + vacations.total + indemnity.amount);
  // Solo las vacaciones son remuneración afecta a ONP/AFP; CTS, gratificación e indemnización no.
  const pension = i.type === "Practicas" ? { amount: 0, detail: {} } : pensionDeduction(vacations.total, i.pensionSystem, i.afpName);
  const advances = r2(Math.min(Math.max(0, i.pendingAdvances ?? 0), totalIncome - pension.amount));
  if ((i.pendingAdvances ?? 0) > advances) warnings.push("El saldo de adelantos supera la liquidación: queda deuda pendiente del trabajador");
  const other = r2(Math.max(0, i.otherDeductions ?? 0));
  const deductions = r2(pension.amount + advances + other);
  if (i.pensionSystem === "AFP" && !i.afpName) warnings.push("El contrato está en AFP sin nombre de AFP: se aplicó la comisión por defecto");
  return {
    computable,
    computable_with_gratification: withGrat,
    cts,
    gratification,
    vacations,
    indemnity,
    total_income: totalIncome,
    pension_deduction: pension.amount,
    pension_detail: pension.detail,
    advance_deduction: advances,
    other_deductions: other,
    total_deductions: deductions,
    net_total: r2(Math.max(0, totalIncome - deductions)),
    warnings,
  };
}
