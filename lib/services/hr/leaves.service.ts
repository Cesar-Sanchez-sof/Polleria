import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/users.service";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import { contractCovering, enumValue, fullName, isoDate, text, todayLimaIso, type Tx } from "./common";
import {
  LEAVE_TYPE_LABEL,
  annualVacationDays,
  checkVacationRequest,
  daysInclusive,
  vacationBalance,
  type LeaveTypeCode,
  type RequestStatusCode,
  type VacationBalance,
} from "./labor-rules";

const LEAVE_TYPES = Object.keys(LEAVE_TYPE_LABEL) as LeaveTypeCode[];
/** Licencias que requieren sustento documentario (CITT, certificado, partida…). */
const NEEDS_DOCUMENT: LeaveTypeCode[] = ["DescansoMedico", "LicenciaMaternidad", "LicenciaPaternidad", "LicenciaFallecimiento"];
const MAX_LEAVE_DAYS = 366;

export interface LeaveData {
  employee_id?: number;
  type: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
  document_ref?: string | null;
  /** El trabajador acepta que parte de las vacaciones sea adelanto. */
  advance?: boolean;
  /** Solo RR. HH.: registrar ya aprobada (p. ej. un descanso médico presentado después). */
  approve?: boolean;
}

export interface LeaveDto {
  leave_id: number;
  employee_id: number;
  employee_name: string;
  employee_dni: string;
  type: LeaveTypeCode;
  type_label: string;
  start_date: string;
  end_date: string;
  days: number;
  is_advance: boolean;
  paid: boolean;
  reason: string | null;
  document_ref: string | null;
  status: RequestStatusCode;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

const INCLUDE = {
  employee: { select: { id: true, dni: true, firstName: true, middleName: true, paternalLastName: true, maternalLastName: true } },
  reviewedBy: { select: { username: true } },
} satisfies Prisma.LeaveRequestInclude;

type LeaveRow = Prisma.LeaveRequestGetPayload<{ include: typeof INCLUDE }>;

function mapLeave(l: LeaveRow): LeaveDto {
  return {
    leave_id: l.id,
    employee_id: l.employeeId,
    employee_name: fullName(l.employee),
    employee_dni: l.employee.dni,
    type: l.type,
    type_label: LEAVE_TYPE_LABEL[l.type],
    start_date: formatDateToIso(l.startDate),
    end_date: formatDateToIso(l.endDate),
    days: l.days,
    is_advance: l.isAdvance,
    paid: l.paid,
    reason: l.reason,
    document_ref: l.documentRef,
    status: l.status,
    reviewed_by: l.reviewedBy?.username ?? null,
    reviewed_at: l.reviewedAt?.toISOString() ?? null,
    review_note: l.reviewNote,
    created_at: l.createdAt.toISOString(),
  };
}

/** Saldo de vacaciones a la fecha, según el contrato vigente y la fecha de ingreso. */
export async function vacationBalanceOf(
  db: Tx | typeof prisma,
  employeeId: number,
  today = todayLimaIso(),
  excludeLeaveId?: number,
): Promise<VacationBalance & { contract_type: string | null }> {
  const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { id: true, hireDate: true } });
  if (!employee) throw new UserError("Empleado no encontrado", 404);
  const contract = await db.employmentContract.findFirst({
    where: { employeeId, status: "Vigente" },
    orderBy: { startDate: "desc" },
    select: { contractType: true, laborRegime: true },
  });
  const used = await db.leaveRequest.aggregate({
    where: {
      employeeId,
      type: "Vacaciones",
      status: { in: ["Pendiente", "Aprobada"] },
      startDate: { gte: employee.hireDate },
      ...(excludeLeaveId ? { NOT: { id: excludeLeaveId } } : {}),
    },
    _sum: { days: true },
  });
  const balance = vacationBalance({
    annualDays: contract ? annualVacationDays(contract.laborRegime, contract.contractType) : 0,
    serviceStart: formatDateToIso(employee.hireDate),
    today,
    usedDays: used._sum.days ?? 0,
  });
  return { ...balance, contract_type: contract?.contractType ?? null };
}

async function verifyNoOverlap(db: Tx, employeeId: number, start: Date, end: Date, excludeId?: number) {
  const clash = await db.leaveRequest.findFirst({
    where: {
      employeeId,
      status: { in: ["Pendiente", "Aprobada"] },
      startDate: { lte: end },
      endDate: { gte: start },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { type: true, startDate: true, endDate: true },
  });
  if (clash) {
    throw new UserError(
      `Se cruza con ${LEAVE_TYPE_LABEL[clash.type].toLowerCase()} del ${formatDateToIso(clash.startDate)} al ${formatDateToIso(clash.endDate)}`,
      409,
    );
  }
}

/** Al aprobar, el trabajador sale de los horarios programados en esas fechas. */
async function releaseShifts(db: Tx, employeeId: number, start: Date, end: Date): Promise<number> {
  const res = await db.employeeShift.deleteMany({ where: { employeeId, shift: { date: { gte: start, lte: end } } } });
  return res.count;
}

export interface LeaveActor {
  userId: number | null;
  /** El propio trabajador (autoservicio): solo fechas futuras y siempre queda pendiente. */
  selfService: boolean;
}

export async function requestLeave(employeeId: number, data: LeaveData, actor: LeaveActor) {
  const type = enumValue(data?.type, LEAVE_TYPES, "El tipo de licencia");
  const startIso = isoDate(data.start_date, "La fecha de inicio", true)!;
  const endIso = isoDate(data.end_date, "La fecha de fin", true)!;
  if (endIso < startIso) throw new UserError("La fecha de fin no puede ser anterior a la de inicio");
  const days = daysInclusive(startIso, endIso);
  if (days > MAX_LEAVE_DAYS) throw new UserError(`Una solicitud no puede superar ${MAX_LEAVE_DAYS} días`);
  const today = todayLimaIso();
  if (actor.selfService && startIso < today) throw new UserError("Las solicitudes deben empezar hoy o después");
  const reason = text(data.reason, "El motivo", 255);
  const documentRef = text(data.document_ref, "El documento de sustento", 60);
  if (type === "PermisoPersonal" || type === "LicenciaSinGoce") {
    if (!reason) throw new UserError("Indica el motivo del permiso");
  }
  const approve = !actor.selfService && Boolean(data.approve);
  if (approve && NEEDS_DOCUMENT.includes(type) && !documentRef) {
    throw new UserError(`Para registrar ${LEAVE_TYPE_LABEL[type].toLowerCase()} como aprobada indica el documento de sustento`);
  }

  return prisma.$transaction(async (tx) => {
    const start = parseUtcDate(startIso);
    const end = parseUtcDate(endIso);
    const employee = await tx.employee.findUnique({ where: { id: employeeId }, select: { id: true, active: true } });
    if (!employee) throw new UserError("Empleado no encontrado", 404);
    if (!employee.active) throw new UserError("El empleado está dado de baja");
    const contract = await tx.employmentContract.findFirst({ where: { employeeId, ...contractCovering(start) }, select: { endDate: true } });
    if (!contract) throw new UserError("El empleado no tiene contrato vigente en la fecha de inicio");
    if (contract.endDate && end > contract.endDate) {
      throw new UserError(`La solicitud no puede pasar del fin del contrato (${formatDateToIso(contract.endDate)})`);
    }
    await verifyNoOverlap(tx, employeeId, start, end);

    let isAdvance = false;
    if (type === "Vacaciones") {
      const balance = await vacationBalanceOf(tx, employeeId, today);
      const check = checkVacationRequest(balance, days, Boolean(data.advance));
      if (!check.ok) throw new UserError(check.error);
      isAdvance = check.isAdvance;
    }

    const created = await tx.leaveRequest.create({
      data: {
        employeeId,
        type,
        startDate: start,
        endDate: end,
        days,
        isAdvance,
        paid: type !== "LicenciaSinGoce",
        reason,
        documentRef,
        status: approve ? "Aprobada" : "Pendiente",
        ...(approve ? { reviewedById: actor.userId, reviewedAt: new Date(), reviewNote: "Registrada y aprobada por RR. HH." } : {}),
      },
      include: INCLUDE,
    });
    const shiftsReleased = approve ? await releaseShifts(tx, employeeId, start, end) : 0;
    return { leave: mapLeave(created), shifts_released: shiftsReleased };
  });
}

export async function reviewLeave(id: number, decision: "approve" | "reject", note: unknown, actorUserId: number | null) {
  if (decision !== "approve" && decision !== "reject") throw new UserError("Decisión no válida");
  const reviewNote = text(note, "La observación", 255);
  if (decision === "reject" && !reviewNote) throw new UserError("Indica el motivo del rechazo");

  return prisma.$transaction(async (tx) => {
    const l = await tx.leaveRequest.findUnique({ where: { id } });
    if (!l) throw new UserError("Solicitud no encontrada", 404);
    if (l.status !== "Pendiente") throw new UserError("La solicitud ya fue revisada");
    if (decision === "approve" && l.type === "Vacaciones") {
      // El saldo pudo cambiar desde que se pidió (otras solicitudes aprobadas).
      const balance = await vacationBalanceOf(tx, l.employeeId, todayLimaIso(), l.id);
      const check = checkVacationRequest(balance, l.days, true);
      if (!check.ok) throw new UserError(check.error);
    }
    const updated = await tx.leaveRequest.update({
      where: { id },
      data: { status: decision === "approve" ? "Aprobada" : "Rechazada", reviewedById: actorUserId, reviewedAt: new Date(), reviewNote },
      include: INCLUDE,
    });
    const shiftsReleased = decision === "approve" ? await releaseShifts(tx, l.employeeId, l.startDate, l.endDate) : 0;
    return { leave: mapLeave(updated), shifts_released: shiftsReleased };
  });
}

/** Anula una solicitud pendiente, o una aprobada que todavía no empieza. */
export async function cancelLeave(id: number, actor: LeaveActor & { employeeId?: number | null }) {
  return prisma.$transaction(async (tx) => {
    const l = await tx.leaveRequest.findUnique({ where: { id } });
    if (!l) throw new UserError("Solicitud no encontrada", 404);
    if (actor.selfService && l.employeeId !== actor.employeeId) throw new UserError("Solicitud no encontrada", 404);
    const startIso = formatDateToIso(l.startDate);
    if (l.status === "Aprobada") {
      if (actor.selfService) throw new UserError("Una solicitud aprobada solo la puede anular Recursos Humanos");
      if (startIso <= todayLimaIso()) throw new UserError("No se puede anular una licencia que ya empezó");
    } else if (l.status !== "Pendiente") {
      throw new UserError("Solo se anulan solicitudes pendientes o aprobadas que aún no empiezan");
    }
    const updated = await tx.leaveRequest.update({
      where: { id },
      data: { status: "Anulada", reviewedById: actor.userId, reviewedAt: new Date() },
      include: INCLUDE,
    });
    return mapLeave(updated);
  });
}

export interface LeaveFilters {
  employee_id?: number | null;
  status?: string | null;
  type?: string | null;
  from?: string | null;
  to?: string | null;
}

export async function listLeaves(f: LeaveFilters = {}): Promise<LeaveDto[]> {
  const from = isoDate(f.from, "La fecha inicial");
  const to = isoDate(f.to, "La fecha final");
  const rows = await prisma.leaveRequest.findMany({
    where: {
      ...(f.employee_id ? { employeeId: f.employee_id } : {}),
      ...(f.status && ["Pendiente", "Aprobada", "Rechazada", "Anulada"].includes(f.status) ? { status: f.status as RequestStatusCode } : {}),
      ...(f.type && (LEAVE_TYPES as string[]).includes(f.type) ? { type: f.type as LeaveTypeCode } : {}),
      ...(to ? { startDate: { lte: parseUtcDate(to) } } : {}),
      ...(from ? { endDate: { gte: parseUtcDate(from) } } : {}),
    },
    include: INCLUDE,
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
    take: 500,
  });
  return rows.map(mapLeave);
}

export async function getLeave(id: number): Promise<LeaveDto> {
  const l = await prisma.leaveRequest.findUnique({ where: { id }, include: INCLUDE });
  if (!l) throw new UserError("Solicitud no encontrada", 404);
  return mapLeave(l);
}
