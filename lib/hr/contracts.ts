/**
 * Reglas de los contratos laborales sin acceso a la base de datos ni al servidor: las usan el servicio,
 * la pantalla y las pruebas. Las fechas son "AAAA-MM-DD" (se comparan como texto).
 */

export const CONTRACT_KINDS = ["FixedTerm", "Indefinite", "Private", "Internship"] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

/** Solo plazo fijo e indeterminado crean vínculo laboral (régimen, pensiones, beneficios). */
export function hasLaborLink(kind: ContractKind): boolean {
  return kind === "FixedTerm" || kind === "Indefinite";
}

/** Convenio de prácticas (Ley 28518): modalidad formativa, no es un contrato de trabajo. */
export const INTERNSHIP_MODALITIES = ["PreProfessional", "Professional"] as const;
export type InternshipModality = (typeof INTERNSHIP_MODALITIES)[number];

export const INTERNSHIP_MODALITY_LABEL: Record<InternshipModality, string> = {
  PreProfessional: "Prácticas preprofesionales",
  Professional: "Prácticas profesionales",
};

/** Jornada semanal máxima del practicante: 6 h diarias / 30 semanales (preprofesional) u 8 / 48 (profesional). */
export const INTERNSHIP_MAX_WEEKLY_HOURS: Record<InternshipModality, number> = {
  PreProfessional: 30,
  Professional: 48,
};

/** Regímenes con vínculo laboral. El contrato privado no tiene régimen (`None`). */
export const LABOR_REGIMES = ["General", "Micro", "Small"] as const;
export type LaborRegime = (typeof LABOR_REGIMES)[number] | "None";

export const PENSION_SYSTEMS = ["ONP", "AFP"] as const;
export type PensionSystem = (typeof PENSION_SYSTEMS)[number] | "None";

export const CONTRACT_KIND_LABEL: Record<ContractKind, string> = {
  FixedTerm: "Plazo fijo",
  Indefinite: "Plazo indeterminado",
  Private: "Contrato privado",
  Internship: "Convenio de prácticas",
};

export const CONTRACT_KIND_HINT: Record<ContractKind, string> = {
  FixedTerm: "Tiempo determinado: tiene fecha de inicio y de fin.",
  Indefinite: "Sin fecha de fin.",
  Private: "Acuerdo civil (por ejemplo locación de servicios): no genera vínculo laboral ni beneficios.",
  Internship:
    "Practicante (Ley 28518): no es trabajador. Recibe una subvención, no remuneración; sin CTS, gratificación ni ONP/AFP.",
};

export const LABOR_REGIME_LABEL: Record<LaborRegime, string> = {
  General: "Régimen general",
  Micro: "Microempresa",
  Small: "Pequeña empresa",
  None: "No aplica",
};

export const PENSION_SYSTEM_LABEL: Record<PensionSystem, string> = {
  ONP: "ONP",
  AFP: "AFP",
  None: "No aplica",
};

export type ContractStatus = "upcoming" | "active" | "expiring" | "expired" | "terminated";

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  upcoming: "Por iniciar",
  active: "Vigente",
  expiring: "Por vencer",
  expired: "Vencido",
  terminated: "Rescindido",
};

/** Un contrato a plazo fijo se marca "por vencer" cuando faltan estos días o menos. */
export const EXPIRING_DAYS = 30;

/** Los contratos a plazo fijo no pueden pasar de cinco años. */
export const MAX_FIXED_TERM_YEARS = 5;

/** Jornada semanal máxima legal. */
export const MAX_WEEKLY_HOURS = 48;

/** Fecha que representa "sin fin" al comparar periodos. */
const NO_END = "9999-12-31";

/** Hoy en Lima (UTC-5) como "AAAA-MM-DD". */
export function limaToday(now: Date = new Date()): string {
  return new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Suma días a una fecha "AAAA-MM-DD". */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Días de `from` a `to` (negativo si `to` es anterior). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export interface ContractDates {
  startDate: string;
  endDate: string | null;
  terminatedAt: string | null;
}

/** Último día en que el contrato rige: la rescisión si la hubo, si no su fecha de fin (o sin fin). */
export function effectiveEnd(c: Pick<ContractDates, "endDate" | "terminatedAt">): string {
  return c.terminatedAt ?? c.endDate ?? NO_END;
}

export function contractStatus(c: ContractDates, today: string): ContractStatus {
  if (c.terminatedAt) return "terminated";
  if (c.startDate > today) return "upcoming";
  if (c.endDate) {
    if (c.endDate < today) return "expired";
    if (daysBetween(today, c.endDate) <= EXPIRING_DAYS) return "expiring";
  }
  return "active";
}

/** Vigente hoy o por iniciar: ocupa al empleado, y no hace falta darle otro contrato. */
export function isCurrentOrUpcoming(status: ContractStatus): boolean {
  return status === "active" || status === "expiring" || status === "upcoming";
}

/** Dos contratos del mismo empleado no pueden regir a la vez (los extremos cuentan). */
export function periodsOverlap(a: ContractDates, b: ContractDates): boolean {
  return a.startDate <= effectiveEnd(b) && b.startDate <= effectiveEnd(a);
}

/** Fecha de inicio sugerida para renovar: el día siguiente al fin del contrato anterior. */
export function suggestedRenewalStart(endDate: string | null, today: string = limaToday()): string {
  return endDate && endDate >= today ? addDays(endDate, 1) : today;
}
