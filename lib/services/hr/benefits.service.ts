import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/security/users.service";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import { postSalaryAdvanceJournalEntry } from "@/lib/services/accounting/accounting-posting.service";
import { contractCovering, dateOrNull, enumValue, fullName, isoDate, money, text, todayLimaIso } from "./common";
import {
  ADVANCE_STATUS_LABEL,
  INSURANCE_TYPE_LABEL,
  MAX_ADVANCE_INSTALLMENTS,
  installmentAmount,
  maxAdvanceAmount,
  type AdvanceStatusCode,
  type InsuranceTypeCode,
} from "./labor-rules";

const INSURANCE_TYPES = Object.keys(INSURANCE_TYPE_LABEL) as InsuranceTypeCode[];
const employeeSelect = {
  select: { id: true, dni: true, firstName: true, middleName: true, paternalLastName: true, maternalLastName: true },
} as const;

// ===========================================================================
// Seguros
// ===========================================================================

export interface InsuranceData {
  employee_id?: number;
  type: string;
  provider: string;
  policy_number?: string | null;
  start_date: string;
  end_date?: string | null;
  monthly_cost?: number | string | null;
  covers_dependents?: boolean;
  notes?: string | null;
}

export interface InsuranceDto {
  insurance_id: number;
  employee_id: number;
  employee_name: string;
  employee_dni: string;
  type: InsuranceTypeCode;
  type_label: string;
  provider: string;
  policy_number: string | null;
  start_date: string;
  end_date: string | null;
  monthly_cost: number;
  covers_dependents: boolean;
  active: boolean;
  /** Vigente hoy, vencida o por vencer en 30 días. */
  validity: "Vigente" | "Por vencer" | "Vencida" | "Inactiva";
  notes: string | null;
}

const INS_INCLUDE = { employee: employeeSelect } satisfies Prisma.EmployeeInsuranceInclude;
type InsuranceRow = Prisma.EmployeeInsuranceGetPayload<{ include: typeof INS_INCLUDE }>;

function mapInsurance(i: InsuranceRow, today = todayLimaIso()): InsuranceDto {
  const end = dateOrNull(i.endDate);
  let validity: InsuranceDto["validity"] = "Vigente";
  if (!i.active) validity = "Inactiva";
  else if (end && end < today) validity = "Vencida";
  else if (end && Date.parse(end) - Date.parse(today) <= 30 * 86_400_000) validity = "Por vencer";
  return {
    insurance_id: i.id,
    employee_id: i.employeeId,
    employee_name: fullName(i.employee),
    employee_dni: i.employee.dni,
    type: i.type,
    type_label: INSURANCE_TYPE_LABEL[i.type],
    provider: i.provider,
    policy_number: i.policyNumber,
    start_date: formatDateToIso(i.startDate),
    end_date: end,
    monthly_cost: Number(i.monthlyCost),
    covers_dependents: i.coversDependents,
    active: i.active,
    validity,
    notes: i.notes,
  };
}

export function normalizeInsurance(data: InsuranceData) {
  const type = enumValue(data?.type, INSURANCE_TYPES, "El tipo de seguro");
  const start = isoDate(data.start_date, "La fecha de inicio de cobertura", true)!;
  const end = isoDate(data.end_date, "La fecha de fin de cobertura");
  if (end && end < start) throw new UserError("El fin de la cobertura no puede ser anterior al inicio");
  const policy = text(data.policy_number, "El número de póliza", 40);
  if ((type === "VidaLey" || type === "SCTR" || type === "EPS") && !policy) {
    throw new UserError(`Indica el número de póliza del ${INSURANCE_TYPE_LABEL[type]}`);
  }
  return {
    type,
    provider: text(data.provider, "La aseguradora", 80, true)!,
    policyNumber: policy,
    startDate: parseUtcDate(start),
    endDate: end ? parseUtcDate(end) : null,
    monthlyCost: data.monthly_cost === "" || data.monthly_cost == null ? 0 : money(data.monthly_cost, "El costo mensual"),
    coversDependents: Boolean(data.covers_dependents),
    notes: text(data.notes, "Las observaciones", 200),
  };
}

/** Una sola cobertura activa por tipo (no hay dos Vida Ley a la vez). */
async function verifyUniqueType(db: Prisma.TransactionClient, employeeId: number, type: InsuranceTypeCode, excludeId?: number) {
  const dup = await db.employeeInsurance.findFirst({
    where: { employeeId, type, active: true, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  if (dup) throw new UserError(`El empleado ya tiene un ${INSURANCE_TYPE_LABEL[type]} activo: desactívalo o edítalo`, 409);
}

export async function listInsurances(f: { employee_id?: number | null; type?: string | null } = {}): Promise<InsuranceDto[]> {
  const rows = await prisma.employeeInsurance.findMany({
    where: {
      ...(f.employee_id ? { employeeId: f.employee_id } : {}),
      ...(f.type && (INSURANCE_TYPES as string[]).includes(f.type) ? { type: f.type as InsuranceTypeCode } : {}),
    },
    include: INS_INCLUDE,
    orderBy: [{ active: "desc" }, { employee: { paternalLastName: "asc" } }, { type: "asc" }],
  });
  const today = todayLimaIso();
  return rows.map((r) => mapInsurance(r, today));
}

export async function getInsurance(id: number): Promise<InsuranceDto> {
  const i = await prisma.employeeInsurance.findUnique({ where: { id }, include: INS_INCLUDE });
  if (!i) throw new UserError("Seguro no encontrado", 404);
  return mapInsurance(i);
}

export async function createInsurance(employeeId: number, data: InsuranceData): Promise<InsuranceDto> {
  const n = normalizeInsurance(data);
  return prisma.$transaction(async (tx) => {
    const e = await tx.employee.findUnique({ where: { id: employeeId }, select: { id: true, active: true } });
    if (!e) throw new UserError("Empleado no encontrado", 404);
    if (!e.active) throw new UserError("El empleado está dado de baja");
    await verifyUniqueType(tx, employeeId, n.type);
    const created = await tx.employeeInsurance.create({ data: { ...n, employeeId }, include: INS_INCLUDE });
    return mapInsurance(created);
  });
}

export async function updateInsurance(id: number, data: InsuranceData): Promise<InsuranceDto> {
  const n = normalizeInsurance(data);
  return prisma.$transaction(async (tx) => {
    const current = await tx.employeeInsurance.findUnique({ where: { id } });
    if (!current) throw new UserError("Seguro no encontrado", 404);
    if (current.active) await verifyUniqueType(tx, current.employeeId, n.type, id);
    const updated = await tx.employeeInsurance.update({ where: { id }, data: n, include: INS_INCLUDE });
    return mapInsurance(updated);
  });
}

export async function setInsuranceActive(id: number, active: boolean): Promise<InsuranceDto> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.employeeInsurance.findUnique({ where: { id } });
    if (!current) throw new UserError("Seguro no encontrado", 404);
    if (active) await verifyUniqueType(tx, current.employeeId, current.type, id);
    const updated = await tx.employeeInsurance.update({ where: { id }, data: { active }, include: INS_INCLUDE });
    return mapInsurance(updated);
  });
}

// ===========================================================================
// Adelantos de sueldo
// ===========================================================================

export interface AdvanceData {
  employee_id?: number;
  amount: number | string;
  installments?: number | string;
  reason: string;
}

export interface AdvanceDto {
  advance_id: number;
  employee_id: number;
  employee_name: string;
  employee_dni: string;
  amount: number;
  installments: number;
  installment_amount: number;
  deducted_amount: number;
  balance: number;
  request_date: string;
  reason: string;
  status: AdvanceStatusCode;
  status_label: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  paid_at: string | null;
  payment_method: string | null;
  journal_entry_id: number | null;
}

const ADV_INCLUDE = { employee: employeeSelect, reviewedBy: { select: { username: true } } } satisfies Prisma.SalaryAdvanceInclude;
type AdvanceRow = Prisma.SalaryAdvanceGetPayload<{ include: typeof ADV_INCLUDE }>;

/** Estados en los que el adelanto sigue abierto (aún no se terminó de descontar). */
const OPEN_STATUSES: AdvanceStatusCode[] = ["Pendiente", "Aprobado", "Pagado"];
export const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Yape", "Plin"] as const;

function mapAdvance(a: AdvanceRow): AdvanceDto {
  const amount = Number(a.amount);
  const deducted = Number(a.deductedAmount);
  return {
    advance_id: a.id,
    employee_id: a.employeeId,
    employee_name: fullName(a.employee),
    employee_dni: a.employee.dni,
    amount,
    installments: a.installments,
    installment_amount: installmentAmount(amount, a.installments),
    deducted_amount: deducted,
    balance: Math.round((amount - deducted) * 100) / 100,
    request_date: formatDateToIso(a.requestDate),
    reason: a.reason,
    status: a.status,
    status_label: ADVANCE_STATUS_LABEL[a.status],
    reviewed_by: a.reviewedBy?.username ?? null,
    reviewed_at: a.reviewedAt?.toISOString() ?? null,
    review_note: a.reviewNote,
    paid_at: a.paidAt?.toISOString() ?? null,
    payment_method: a.paymentMethod,
    journal_entry_id: a.journalEntryId,
  };
}

/**
 * Política de adelantos: solo con contrato laboral vigente, hasta el 50 % del sueldo básico,
 * de 1 a 3 cuotas y uno abierto a la vez.
 */
export async function requestAdvance(employeeId: number, data: AdvanceData): Promise<AdvanceDto> {
  const amount = money(data?.amount, "El monto", { min: 1 });
  const installments = data.installments == null || data.installments === "" ? 1 : Number(data.installments);
  if (!Number.isInteger(installments) || installments < 1 || installments > MAX_ADVANCE_INSTALLMENTS) {
    throw new UserError(`Las cuotas deben ser entre 1 y ${MAX_ADVANCE_INSTALLMENTS}`);
  }
  const reason = text(data.reason, "El motivo", 200, true)!;
  const today = todayLimaIso();

  return prisma.$transaction(async (tx) => {
    const contract = await tx.employmentContract.findFirst({
      where: { employeeId, ...contractCovering(parseUtcDate(today)), employee: { active: true } },
      select: { contractType: true, baseSalary: true, endDate: true },
    });
    if (!contract) throw new UserError("Solo se otorgan adelantos a trabajadores con contrato vigente");
    if (contract.contractType === "LocacionServicios") throw new UserError("Los locadores de servicios no reciben adelantos de sueldo");
    const max = maxAdvanceAmount(Number(contract.baseSalary));
    if (amount > max) throw new UserError(`El adelanto no puede superar S/ ${max.toFixed(2)} (50 % del sueldo básico)`);
    if (contract.endDate) {
      const monthsLeft = Math.floor((Date.parse(formatDateToIso(contract.endDate)) - Date.parse(today)) / (30 * 86_400_000));
      if (installments > Math.max(1, monthsLeft)) {
        throw new UserError("Las cuotas no pueden ir más allá del fin del contrato");
      }
    }
    const open = await tx.salaryAdvance.findFirst({ where: { employeeId, status: { in: OPEN_STATUSES } }, select: { id: true } });
    if (open) throw new UserError("El trabajador ya tiene un adelanto en curso: debe terminar de descontarse antes de pedir otro", 409);

    const created = await tx.salaryAdvance.create({
      data: { employeeId, amount, installments, reason, requestDate: parseUtcDate(today) },
      include: ADV_INCLUDE,
    });
    return mapAdvance(created);
  });
}

export type AdvanceAction =
  | { action: "approve"; note?: string | null }
  | { action: "reject"; note: string }
  | { action: "pay"; payment_method: string }
  | { action: "deduct"; amount: number | string }
  | { action: "cancel"; note?: string | null };

/** Flujo: Pendiente → Aprobado → Entregado → (descuentos en planilla) → Descontado. */
export async function updateAdvance(
  id: number,
  input: AdvanceAction,
  actorUserId: number | null,
  actorEmployeeId: number | null = null,
) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.salaryAdvance.findUnique({ where: { id } });
    if (!a) throw new UserError("Adelanto no encontrado", 404);
    // Segregación de funciones: nadie aprueba ni se entrega su propio adelanto.
    if (actorEmployeeId === a.employeeId && ["approve", "reject", "pay"].includes(input?.action)) {
      throw new UserError("No puedes revisar ni entregar tu propio adelanto", 403);
    }
    const before = a.status;
    let data: Prisma.SalaryAdvanceUpdateInput;

    switch (input?.action) {
      case "approve":
        if (a.status !== "Pendiente") throw new UserError("Solo se aprueba un adelanto pendiente");
        data = { status: "Aprobado", reviewedBy: actorUserId ? { connect: { id: actorUserId } } : undefined, reviewedAt: new Date(), reviewNote: text(input.note, "La observación", 255) };
        break;
      case "reject": {
        if (a.status !== "Pendiente") throw new UserError("Solo se rechaza un adelanto pendiente");
        const note = text(input.note, "El motivo del rechazo", 255, true);
        data = { status: "Rechazado", reviewedBy: actorUserId ? { connect: { id: actorUserId } } : undefined, reviewedAt: new Date(), reviewNote: note };
        break;
      }
      case "pay": {
        if (a.status !== "Aprobado") throw new UserError("Solo se entrega un adelanto aprobado");
        const method = enumValue(input.payment_method, PAYMENT_METHODS, "El medio de pago");
        data = { status: "Pagado", paidAt: new Date(), paymentMethod: method };
        break;
      }
      case "deduct": {
        if (a.status !== "Pagado") throw new UserError("Solo se descuenta un adelanto ya entregado");
        const amount = money(input.amount, "El monto descontado", { min: 0.01 });
        const balance = Math.round((Number(a.amount) - Number(a.deductedAmount)) * 100) / 100;
        if (amount > balance) throw new UserError(`El descuento no puede superar el saldo pendiente (S/ ${balance.toFixed(2)})`);
        const deducted = Math.round((Number(a.deductedAmount) + amount) * 100) / 100;
        data = { deductedAmount: deducted, ...(deducted >= Number(a.amount) ? { status: "Liquidado" } : {}) };
        break;
      }
      case "cancel":
        if (a.status !== "Pendiente" && a.status !== "Aprobado") throw new UserError("Solo se anula un adelanto que aún no se entregó");
        data = { status: "Anulado", reviewNote: text(input.note, "La observación", 255) ?? a.reviewNote };
        break;
      default:
        throw new UserError("Acción no válida");
    }
    let updated = await tx.salaryAdvance.update({ where: { id }, data, include: ADV_INCLUDE });
    if (input.action === "pay") {
      // Impacto contable de la entrega: 141 Adelantos al personal / Caja, billetera o bancos.
      let entryId: number;
      try {
        entryId = await postSalaryAdvanceJournalEntry(tx, {
          advanceId: id,
          employeeName: fullName(updated.employee),
          amount: Number(updated.amount),
          paymentMethodName: updated.paymentMethod ?? "Efectivo",
          responsible: updated.reviewedBy?.username ?? "Recursos Humanos",
        });
      } catch (e) {
        throw new UserError(e instanceof Error ? e.message : "No se pudo registrar el asiento del adelanto");
      }
      updated = await tx.salaryAdvance.update({ where: { id }, data: { journalEntryId: entryId }, include: ADV_INCLUDE });
    }
    return { advance: mapAdvance(updated), before };
  });
}

export async function listAdvances(f: { employee_id?: number | null; status?: string | null } = {}): Promise<AdvanceDto[]> {
  const rows = await prisma.salaryAdvance.findMany({
    where: {
      ...(f.employee_id ? { employeeId: f.employee_id } : {}),
      ...(f.status && f.status in ADVANCE_STATUS_LABEL ? { status: f.status as AdvanceStatusCode } : {}),
    },
    include: ADV_INCLUDE,
    orderBy: [{ requestDate: "desc" }, { id: "desc" }],
    take: 500,
  });
  return rows.map(mapAdvance);
}

/** Tope de adelanto del trabajador hoy (para mostrarlo al solicitar). */
export async function advanceLimitOf(employeeId: number) {
  const contract = await prisma.employmentContract.findFirst({
    where: { employeeId, ...contractCovering(parseUtcDate(todayLimaIso())) },
    select: { baseSalary: true, contractType: true },
  });
  const open = await prisma.salaryAdvance.findFirst({ where: { employeeId, status: { in: OPEN_STATUSES } }, select: { id: true } });
  if (!contract || contract.contractType === "LocacionServicios") return { eligible: false, max_amount: 0, has_open: Boolean(open) };
  return { eligible: !open, max_amount: maxAdvanceAmount(Number(contract.baseSalary)), has_open: Boolean(open) };
}
