/**
 * Cálculo de la planilla mensual sin acceso a la base de datos: lo usan el servicio, la pantalla y las pruebas.
 * Las fechas son "AAAA-MM-DD". Los montos se redondean a céntimos en cada concepto.
 *
 * Alcance de esta versión: sueldo (o subvención) prorrateado por días, asignación familiar, aporte del trabajador
 * a ONP/AFP, aporte del empleador (EsSalud/SIS), anticipos y descuentos manuales. No incluye gratificaciones,
 * CTS, vacaciones ni renta de quinta categoría.
 */
import { effectiveEnd, hasLaborLink, type ContractKind, type LaborRegime, type PensionSystem } from "./contracts";

/** Parámetros que usa el cálculo. Los valores viven en la tabla `payroll_parameter`, con vigencia por fecha. */
export const PAYROLL_PARAMETER_CODES = [
  "RMV",
  "FAMILY_ALLOWANCE_RATE",
  "ONP_RATE",
  "AFP_PENSION_RATE",
  "AFP_INSURANCE_RATE",
  "AFP_COMMISSION_RATE",
  "ESSALUD_RATE",
  "MICRO_HEALTH_MONTHLY",
] as const;
export type PayrollParameterCode = (typeof PAYROLL_PARAMETER_CODES)[number];

export const PAYROLL_PARAMETER_META: Record<PayrollParameterCode, { label: string; unit: "amount" | "rate"; hint: string }> = {
  RMV: { label: "Remuneración mínima vital", unit: "amount", hint: "S/ al mes" },
  FAMILY_ALLOWANCE_RATE: { label: "Asignación familiar", unit: "rate", hint: "% de la RMV" },
  ONP_RATE: { label: "ONP (trabajador)", unit: "rate", hint: "% de la remuneración" },
  AFP_PENSION_RATE: { label: "AFP: aporte al fondo", unit: "rate", hint: "% de la remuneración" },
  AFP_INSURANCE_RATE: { label: "AFP: prima de seguro", unit: "rate", hint: "% de la remuneración" },
  AFP_COMMISSION_RATE: { label: "AFP: comisión por flujo", unit: "rate", hint: "% de la remuneración (varía por AFP)" },
  ESSALUD_RATE: { label: "EsSalud (empleador)", unit: "rate", hint: "% de la remuneración" },
  MICRO_HEALTH_MONTHLY: { label: "SIS microempresa (empleador)", unit: "amount", hint: "S/ por trabajador al mes" },
};

export type PayrollParams = Record<PayrollParameterCode, number>;

export type PayrollStatus = "Draft" | "Approved" | "Paid";

export const PAYROLL_STATUS_LABEL: Record<PayrollStatus, string> = {
  Draft: "Borrador",
  Approved: "Aprobada",
  Paid: "Pagada",
};

export const MONTH_LABEL = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

/** Tope de cada monto de la planilla (columnas decimales de 7 enteros y 2 decimales). */
export const MAX_PAYROLL_AMOUNT = 99_999.99;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Primer y último día del mes como "AAAA-MM-DD". */
export function monthBounds(year: number, month: number): { start: string; end: string } {
  const mm = String(month).padStart(2, "0");
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(daysInMonth(year, month)).padStart(2, "0")}` };
}

export interface PayrollContract {
  kind: ContractKind;
  regime: LaborRegime;
  pensionSystem: PensionSystem;
  familyAllowance: boolean;
  monthlySalary: number;
  startDate: string;
  endDate: string | null;
  terminatedAt: string | null;
}

/** Días del mes que cubre el contrato (cuenta los extremos). */
export function coveredDays(c: Pick<PayrollContract, "startDate" | "endDate" | "terminatedAt">, year: number, month: number): number {
  const { start, end } = monthBounds(year, month);
  const from = c.startDate > start ? c.startDate : start;
  const endOfContract = effectiveEnd(c);
  const to = endOfContract < end ? endOfContract : end;
  if (to < from) return 0;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Contratos que dan derecho a planilla: los de vínculo laboral y los convenios de prácticas (no el contrato privado). */
export function isPayable(kind: ContractKind): boolean {
  return kind !== "Private";
}

export interface ManualAmounts {
  overtimePay: number;
  bonus: number;
  absenceDiscount: number;
  advances: number;
}

export const NO_MANUAL_AMOUNTS: ManualAmounts = { overtimePay: 0, bonus: 0, absenceDiscount: 0, advances: 0 };

export interface PayrollCalculation {
  baseSalary: number;
  familyAllowance: number;
  overtimePay: number;
  bonus: number;
  absenceDiscount: number;
  grossPay: number;
  pensionSystem: PensionSystem;
  pensionAmount: number;
  advances: number;
  deductions: number;
  netPay: number;
  employerContribution: number;
}

/** Tasa total que el trabajador aporta a su sistema de pensiones. */
export function pensionRate(system: PensionSystem, p: PayrollParams): number {
  if (system === "ONP") return p.ONP_RATE;
  if (system === "AFP") return p.AFP_PENSION_RATE + p.AFP_INSURANCE_RATE + p.AFP_COMMISSION_RATE;
  return 0;
}

/**
 * Calcula la boleta de un empleado para el mes. `contracts` son los contratos que tocan el mes (de tipo pagable);
 * el último por fecha de inicio manda para el régimen y las pensiones, y el sueldo se suma por los días de cada uno.
 */
export function calculatePayroll(
  contracts: readonly PayrollContract[],
  year: number,
  month: number,
  params: PayrollParams,
  manual: ManualAmounts = NO_MANUAL_AMOUNTS,
): PayrollCalculation {
  const dim = daysInMonth(year, month);
  const inMonth = contracts.filter((c) => coveredDays(c, year, month) > 0);
  if (inMonth.length === 0) throw new Error("El empleado no tiene contrato en el mes");
  const current = [...inMonth].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

  const fraction = Math.min(1, inMonth.reduce((sum, c) => sum + coveredDays(c, year, month), 0) / dim);
  const baseSalary = round2(inMonth.reduce((sum, c) => sum + (c.monthlySalary * coveredDays(c, year, month)) / dim, 0));

  const laborLink = hasLaborLink(current.kind);
  const familyAllowance =
    laborLink && current.familyAllowance ? round2(params.RMV * params.FAMILY_ALLOWANCE_RATE * fraction) : 0;

  const overtimePay = round2(manual.overtimePay);
  const bonus = round2(manual.bonus);
  const absenceDiscount = round2(manual.absenceDiscount);
  const grossPay = round2(baseSalary + familyAllowance + overtimePay + bonus - absenceDiscount);

  // Sin vínculo laboral (convenio de prácticas) el practicante no aporta a ONP ni AFP.
  const pensionSystem: PensionSystem = laborLink ? current.pensionSystem : "None";
  const pensionAmount = round2(grossPay * pensionRate(pensionSystem, params));
  const advances = round2(manual.advances);
  const deductions = round2(pensionAmount + advances);
  const netPay = round2(grossPay - deductions);

  let employerContribution: number;
  if (current.kind === "Internship") employerContribution = round2(grossPay * params.ESSALUD_RATE);
  else if (!laborLink) employerContribution = 0;
  else if (current.regime === "Micro") employerContribution = round2(params.MICRO_HEALTH_MONTHLY * fraction);
  else employerContribution = round2(grossPay * params.ESSALUD_RATE);

  return {
    baseSalary,
    familyAllowance,
    overtimePay,
    bonus,
    absenceDiscount,
    grossPay,
    pensionSystem,
    pensionAmount,
    advances,
    deductions,
    netPay,
    employerContribution,
  };
}

/** Mensajes de problemas de una boleta ya calculada (vacío si está bien). */
export function payrollIssues(c: PayrollCalculation): string[] {
  const issues: string[] = [];
  if (c.grossPay < 0) issues.push("El descuento por faltas supera lo ganado");
  if (c.netPay < 0) issues.push("Los descuentos (pensión y anticipos) superan lo ganado");
  for (const [name, value] of Object.entries({ sueldo: c.baseSalary, bruto: c.grossPay, neto: c.netPay })) {
    if (value > MAX_PAYROLL_AMOUNT) issues.push(`El ${name} supera el máximo permitido (S/ ${MAX_PAYROLL_AMOUNT.toLocaleString("es-PE")})`);
  }
  return issues;
}

export interface PayrollParameterRow {
  code: string;
  value: number;
  /** "AAAA-MM-DD" */
  effectiveFrom: string;
}

/** Parámetros vigentes en `date`: de cada código, el valor con la vigencia más reciente que no pase de esa fecha. */
export function resolveParams(rows: readonly PayrollParameterRow[], date: string): { params: PayrollParams; missing: PayrollParameterCode[] } {
  const params = {} as PayrollParams;
  const missing: PayrollParameterCode[] = [];
  for (const code of PAYROLL_PARAMETER_CODES) {
    const valid = rows.filter((r) => r.code === code && r.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    if (valid.length === 0) missing.push(code);
    else params[code] = valid[0].value;
  }
  return { params, missing };
}
