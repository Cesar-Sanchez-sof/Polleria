import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/users.service";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import {
  contractCovering,
  dateOrNull,
  enumValue,
  formatTime,
  fullName,
  isoDate,
  money,
  text,
  todayLimaIso,
  type Tx,
} from "./common";
import {
  AFP_NAMES,
  CONTRACT_EXPIRY_ALERT_DAYS,
  CONTRACT_TYPE_LABEL,
  LABOR_REGIME_LABEL,
  MINIMUM_WAGE,
  INTERN_MAX_WEEKLY_HOURS,
  addDaysIso,
  addMonthsIso,
  daysInclusive,
  essaludContribution,
  evaluateSchedule,
  hasTrialPeriod,
  isEmployment,
  requiresEndDate,
  trialEndFor,
  type ContractTypeCode,
  type LaborRegimeCode,
  type PensionSystemCode,
  type ScheduleDayInput,
  type TemplateTimes,
} from "./labor-rules";
import { templateMap } from "./shift-templates.service";
import { scheduleEmployeeAhead } from "@/lib/services/schedules.service";

const CONTRACT_TYPES = Object.keys(CONTRACT_TYPE_LABEL) as ContractTypeCode[];
const LABOR_REGIMES = Object.keys(LABOR_REGIME_LABEL) as LaborRegimeCode[];
const PENSION_SYSTEMS: PensionSystemCode[] = ["ONP", "AFP", "Ninguno"];

export interface ContractData {
  contract_type: string;
  labor_regime: string;
  position: string;
  area: string;
  /** "YYYY-MM-DD" */
  start_date: string;
  end_date?: string | null;
  trial_end_date?: string | null;
  base_salary: number | string;
  family_allowance?: boolean;
  pension_system: string;
  afp_name?: string | null;
  cuspp?: string | null;
  notes?: string | null;
  /** Horario pactado: turnos base por día de la semana (0 = lunes). */
  schedule: ScheduleDayInput[];
}

export interface TerminationData {
  /** "YYYY-MM-DD": último día de labores. */
  termination_date: string;
  reason: string;
  /** Finalizado = término normal o renuncia; Rescindido = despido o resolución anticipada. */
  kind: "Finalizado" | "Rescindido";
}

export type ContractPhase = "Programado" | "Vigente" | "Por vencer" | "Vencido" | "Finalizado" | "Rescindido";

export interface ContractScheduleDto {
  weekday: number;
  shifts: Array<{ template_id: number; name: string; start_time: string; end_time: string }>;
}

export interface ContractDto {
  contract_id: number;
  employee_id: number;
  employee_name: string;
  employee_dni: string;
  contract_type: ContractTypeCode;
  contract_type_label: string;
  labor_regime: LaborRegimeCode;
  labor_regime_label: string;
  position: string;
  area: string;
  start_date: string;
  end_date: string | null;
  trial_end_date: string | null;
  in_trial: boolean;
  base_salary: number;
  family_allowance: boolean;
  pension_system: PensionSystemCode;
  afp_name: string | null;
  cuspp: string | null;
  status: "Vigente" | "Finalizado" | "Rescindido";
  phase: ContractPhase;
  /** Días que faltan para el vencimiento (negativo si ya venció); null si es indeterminado. */
  days_to_expiry: number | null;
  termination_date: string | null;
  termination_reason: string | null;
  notes: string | null;
  renewed_from_id: number | null;
  renewed_by_id: number | null;
  created_at: string;
  schedule: ContractScheduleDto[];
  weekly_hours: number;
  working_days: number;
}

const INCLUDE = {
  employee: { select: { id: true, dni: true, firstName: true, middleName: true, paternalLastName: true, maternalLastName: true } },
  schedule: { include: { shiftTemplate: true }, orderBy: [{ weekday: "asc" }, { shiftTemplate: { startTime: "asc" } }] },
  renewedBy: { select: { id: true } },
} satisfies Prisma.EmploymentContractInclude;

type ContractRow = Prisma.EmploymentContractGetPayload<{ include: typeof INCLUDE }>;

export function contractPhase(
  c: { status: string; startDate: string; endDate: string | null },
  today: string,
): ContractPhase {
  if (c.status === "Finalizado" || c.status === "Rescindido") return c.status;
  if (c.startDate > today) return "Programado";
  if (c.endDate && c.endDate < today) return "Vencido";
  if (c.endDate && daysInclusive(today, c.endDate) - 1 <= CONTRACT_EXPIRY_ALERT_DAYS) return "Por vencer";
  return "Vigente";
}

export function mapContract(c: ContractRow, today = todayLimaIso()): ContractDto {
  const start = formatDateToIso(c.startDate);
  const end = dateOrNull(c.endDate);
  const trialEnd = dateOrNull(c.trialEndDate);
  const byDay = new Map<number, ContractScheduleDto>();
  let minutes = 0;
  for (const d of c.schedule) {
    const s = formatTime(d.shiftTemplate.startTime);
    const e = formatTime(d.shiftTemplate.endTime);
    const day = byDay.get(d.weekday) ?? { weekday: d.weekday, shifts: [] };
    day.shifts.push({ template_id: d.shiftTemplateId, name: d.shiftTemplate.name, start_time: s, end_time: e });
    byDay.set(d.weekday, day);
    const [sh, sm] = s.split(":").map(Number);
    const [eh, em] = e.split(":").map(Number);
    const diff = eh * 60 + em - (sh * 60 + sm);
    minutes += diff > 0 ? diff : diff + 1440;
  }
  return {
    contract_id: c.id,
    employee_id: c.employeeId,
    employee_name: fullName(c.employee),
    employee_dni: c.employee.dni,
    contract_type: c.contractType,
    contract_type_label: CONTRACT_TYPE_LABEL[c.contractType],
    labor_regime: c.laborRegime,
    labor_regime_label: LABOR_REGIME_LABEL[c.laborRegime],
    position: c.position,
    area: c.area,
    start_date: start,
    end_date: end,
    trial_end_date: trialEnd,
    in_trial: c.status === "Vigente" && trialEnd != null && start <= today && today <= trialEnd,
    base_salary: Number(c.baseSalary),
    family_allowance: c.familyAllowance,
    pension_system: c.pensionSystem,
    afp_name: c.afpName,
    cuspp: c.cuspp,
    status: c.status,
    phase: contractPhase({ status: c.status, startDate: start, endDate: end }, today),
    days_to_expiry: end && c.status === "Vigente" ? daysInclusive(today, end) - 1 : null,
    termination_date: dateOrNull(c.terminationDate),
    termination_reason: c.terminationReason,
    notes: c.notes,
    renewed_from_id: c.renewedFromId,
    renewed_by_id: c.renewedBy?.id ?? null,
    created_at: c.createdAt.toISOString(),
    schedule: [...byDay.values()],
    weekly_hours: Math.round((minutes / 60) * 100) / 100,
    working_days: byDay.size,
  };
}

/**
 * Valida un contrato con las reglas laborales (fechas, periodo de prueba, sueldo mínimo,
 * sistema de pensiones y jornada del horario pactado) y lo deja listo para guardar.
 */
export function normalizeContract(data: ContractData, templates: ReadonlyMap<number, TemplateTimes>) {
  const type = enumValue(data.contract_type, CONTRACT_TYPES, "El tipo de contrato");
  const regime = enumValue(data.labor_regime, LABOR_REGIMES, "El régimen laboral");
  const position = text(data.position, "El cargo", 40, true)!;
  const area = text(data.area, "El área", 30, true)!;
  const start = isoDate(data.start_date, "La fecha de inicio", true)!;
  const end = isoDate(data.end_date, "La fecha de término");

  if (requiresEndDate(type) && !end) {
    throw new UserError(`Un contrato de ${CONTRACT_TYPE_LABEL[type].toLowerCase()} debe tener fecha de término`);
  }
  if (type === "Indeterminado" && end) throw new UserError("Un contrato a plazo indeterminado no lleva fecha de término");
  if (end && end <= start) throw new UserError("La fecha de término debe ser posterior a la de inicio");
  if (type === "PlazoFijo" && end && end >= addMonthsIso(start, 60)) {
    throw new UserError("Un contrato a plazo fijo no puede superar los 5 años");
  }

  let trialEnd: string | null = null;
  if (hasTrialPeriod(type)) {
    trialEnd = isoDate(data.trial_end_date, "El fin del periodo de prueba") ?? trialEndFor(start);
    if (trialEnd < start) throw new UserError("El periodo de prueba no puede terminar antes del inicio del contrato");
    // 3 meses por ley; hasta 6 (confianza) o 12 (dirección) si se pacta por escrito.
    if (trialEnd >= addMonthsIso(start, 12)) throw new UserError("El periodo de prueba no puede superar los 12 meses");
    if (end && trialEnd > end) trialEnd = end;
  }

  const schedule = (Array.isArray(data.schedule) ? data.schedule : [])
    .map((d) => ({ weekday: Number(d?.weekday), template_ids: Array.isArray(d?.template_ids) ? d.template_ids.map(Number) : [] }))
    .filter((d) => d.template_ids.length > 0);
  let summary;
  try {
    summary = evaluateSchedule(type, schedule, templates);
  } catch (e) {
    throw new UserError(e instanceof Error ? e.message : "El horario no es válido");
  }

  const salary = money(data.base_salary, "El sueldo", { min: 0.01 });
  if ((type === "Indeterminado" || type === "PlazoFijo") && salary < MINIMUM_WAGE) {
    throw new UserError(`El sueldo de jornada completa no puede ser menor a la remuneración mínima (S/ ${MINIMUM_WAGE})`);
  }
  if (type === "Practicas") {
    const min = Math.round(MINIMUM_WAGE * Math.min(1, summary.weekly_hours / INTERN_MAX_WEEKLY_HOURS) * 100) / 100;
    if (salary < min) throw new UserError(`La subvención de prácticas para esa jornada no puede ser menor a S/ ${min}`);
  }

  let pension = enumValue(data.pension_system, PENSION_SYSTEMS, "El sistema de pensiones");
  let afpName = text(data.afp_name, "La AFP", 30);
  let cuspp = text(data.cuspp, "El CUSPP", 12);
  if (!isEmployment(type) || type === "Practicas") {
    pension = "Ninguno"; // no hay aportes obligatorios en locación ni en prácticas
    afpName = null;
    cuspp = null;
  } else if (pension === "Ninguno") {
    throw new UserError("Todo trabajador en planilla debe estar afiliado a la ONP o a una AFP");
  }
  if (pension === "AFP") {
    if (!afpName || !(AFP_NAMES as readonly string[]).includes(afpName)) throw new UserError("Selecciona la AFP del trabajador");
    if (cuspp && !/^[A-Z0-9]{12}$/i.test(cuspp)) throw new UserError("El CUSPP debe tener 12 caracteres alfanuméricos");
  } else {
    afpName = null;
    cuspp = null;
  }

  return {
    data: {
      contractType: type,
      laborRegime: regime,
      position,
      area,
      startDate: parseUtcDate(start),
      endDate: end ? parseUtcDate(end) : null,
      trialEndDate: trialEnd ? parseUtcDate(trialEnd) : null,
      baseSalary: salary,
      familyAllowance: isEmployment(type) && type !== "Practicas" ? Boolean(data.family_allowance) : false,
      pensionSystem: pension,
      afpName,
      cuspp: cuspp?.toUpperCase() ?? null,
      notes: text(data.notes, "Las observaciones", 255),
    },
    schedule,
    summary,
  };
}

async function prepare(db: Tx, data: ContractData) {
  const ids = (Array.isArray(data?.schedule) ? data.schedule : []).flatMap((d) =>
    Array.isArray(d?.template_ids) ? d.template_ids.map(Number).filter(Number.isInteger) : [],
  );
  return normalizeContract(data, await templateMap(db, [...new Set(ids)]));
}

function scheduleRows(schedule: ScheduleDayInput[]) {
  return schedule.flatMap((d) => [...new Set(d.template_ids)].map((shiftTemplateId) => ({ weekday: d.weekday, shiftTemplateId })));
}

/** Ningún contrato vigente del empleado puede cruzarse con el periodo del nuevo. */
async function verifyNoOverlappingContract(db: Tx, employeeId: number, start: Date, end: Date | null, excludeId?: number) {
  const clash = await db.employmentContract.findFirst({
    where: {
      employeeId,
      status: "Vigente",
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      startDate: end ? { lte: end } : undefined,
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
    select: { id: true },
  });
  if (clash) {
    throw new UserError("El empleado ya tiene un contrato vigente en ese periodo: renuévalo o finalízalo primero", 409);
  }
}

/** EsSalud es obligatorio para todo trabajador en planilla: se registra al contratar. */
async function ensureEssalud(db: Tx, employeeId: number, start: Date, salary: number) {
  const has = await db.employeeInsurance.findFirst({ where: { employeeId, type: "EsSalud", active: true }, select: { id: true } });
  if (has) return;
  await db.employeeInsurance.create({
    data: {
      employeeId,
      type: "EsSalud",
      provider: "EsSalud",
      startDate: start,
      monthlyCost: essaludContribution(salary),
      notes: "Registrado automáticamente al contratar (aporte del empleador: 9 %)",
    },
  });
}

/** Crea el contrato con su horario. Si el empleado estaba cesado, empieza una nueva relación laboral. */
export async function createContractTx(
  tx: Tx,
  employeeId: number,
  data: ContractData,
  actorUserId: number | null,
  renewedFromId: number | null = null,
): Promise<ContractDto> {
  const n = await prepare(tx, data);
  const employee = await tx.employee.findUnique({ where: { id: employeeId }, select: { id: true, active: true } });
  if (!employee) throw new UserError("Empleado no encontrado", 404);
  await verifyNoOverlappingContract(tx, employeeId, n.data.startDate, n.data.endDate);

  const created = await tx.employmentContract.create({
    data: {
      ...n.data,
      // La renovación de un trabajador ya contratado no reinicia el periodo de prueba.
      ...(renewedFromId ? { trialEndDate: null } : {}),
      employeeId,
      renewedFromId,
      createdById: actorUserId,
      schedule: { create: scheduleRows(n.schedule) },
    },
    include: INCLUDE,
  });

  if (!renewedFromId) {
    // Nueva relación laboral (alta o reingreso): la fecha de ingreso es el inicio de este contrato.
    await tx.employee.update({ where: { id: employeeId }, data: { active: true, hireDate: n.data.startDate } });
  }
  if (isEmployment(n.data.contractType) && n.data.contractType !== "Practicas") {
    await ensureEssalud(tx, employeeId, n.data.startDate, n.data.baseSalary);
  }
  // El horario pactado se programa solo: las próximas 2 semanas quedan en Horarios laborales
  // (la renovación reprograma los días futuros con el nuevo horario).
  await scheduleEmployeeAhead(tx, employeeId, renewedFromId != null);
  return mapContract(created);
}

export async function createContract(employeeId: number, data: ContractData, actorUserId: number | null) {
  return prisma.$transaction((tx) => createContractTx(tx, employeeId, data, actorUserId), { timeout: 30_000 });
}

/**
 * Renovación: el contrato actual termina el día anterior al inicio del nuevo, que hereda la
 * antigüedad (no cambia la fecha de ingreso ni el récord vacacional).
 */
export async function renewContract(id: number, data: ContractData, actorUserId: number | null) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.employmentContract.findUnique({ where: { id }, include: { renewedBy: { select: { id: true } } } });
    if (!current) throw new UserError("Contrato no encontrado", 404);
    if (current.status !== "Vigente") throw new UserError("Solo se puede renovar un contrato vigente");
    if (current.renewedBy) throw new UserError("Este contrato ya fue renovado", 409);

    const start = isoDate(data.start_date, "La fecha de inicio", true)!;
    const currentStart = formatDateToIso(current.startDate);
    if (start <= currentStart) throw new UserError("La renovación debe empezar después del inicio del contrato actual");
    const currentEnd = dateOrNull(current.endDate);
    if (currentEnd && start > addDaysIso(currentEnd, 1)) {
      throw new UserError(
        `La renovación debe empezar a más tardar el ${addDaysIso(currentEnd, 1)}; si hubo una interrupción, finaliza el contrato y registra uno nuevo`,
      );
    }

    await tx.employmentContract.update({
      where: { id },
      data: {
        status: "Finalizado",
        endDate: parseUtcDate(addDaysIso(start, -1)),
        terminationDate: parseUtcDate(addDaysIso(start, -1)),
        terminationReason: "Renovación de contrato",
      },
    });
    return createContractTx(tx, current.employeeId, data, actorUserId, id);
  }, { timeout: 30_000 });
}

/** Adenda: modifica las condiciones de un contrato vigente (cargo, sueldo, horario…). */
export async function updateContract(id: number, data: ContractData): Promise<ContractDto> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.employmentContract.findUnique({ where: { id } });
    if (!current) throw new UserError("Contrato no encontrado", 404);
    if (current.status !== "Vigente") throw new UserError("Solo se puede modificar un contrato vigente");
    const n = await prepare(tx, { ...data, trial_end_date: data.trial_end_date ?? dateOrNull(current.trialEndDate) });
    if (n.data.contractType !== current.contractType && formatDateToIso(current.startDate) <= todayLimaIso()) {
      throw new UserError("El tipo de contrato no se cambia por adenda: finaliza este contrato y registra uno nuevo");
    }
    await verifyNoOverlappingContract(tx, current.employeeId, n.data.startDate, n.data.endDate, id);
    await tx.contractScheduleDay.deleteMany({ where: { contractId: id } });
    const updated = await tx.employmentContract.update({
      where: { id },
      data: { ...n.data, schedule: { create: scheduleRows(n.schedule) } },
      include: INCLUDE,
    });
    if (!current.renewedFromId) {
      await tx.employee.update({ where: { id: current.employeeId }, data: { hireDate: n.data.startDate } });
    }
    // La adenda reprograma los días futuros según el nuevo horario pactado.
    await scheduleEmployeeAhead(tx, current.employeeId, true);
    return mapContract(updated);
  }, { timeout: 30_000 });
}

/**
 * Cese: cierra el contrato. Si el empleado no queda con otro contrato vigente se le da de
 * baja, se desactiva su acceso al sistema y se le retira de los horarios posteriores al cese.
 */
export async function terminateContract(id: number, data: TerminationData) {
  const date = isoDate(data?.termination_date, "La fecha de cese", true)!;
  const reason = text(data?.reason, "El motivo del cese", 200, true)!;
  const kind = enumValue(data?.kind, ["Finalizado", "Rescindido"] as const, "El tipo de cese");

  return prisma.$transaction(async (tx) => {
    const current = await tx.employmentContract.findUnique({ where: { id } });
    if (!current) throw new UserError("Contrato no encontrado", 404);
    if (current.status !== "Vigente") throw new UserError("El contrato ya no está vigente");
    if (date < formatDateToIso(current.startDate)) throw new UserError("La fecha de cese no puede ser anterior al inicio del contrato");
    const end = dateOrNull(current.endDate);
    if (end && date > end) throw new UserError(`La fecha de cese no puede ser posterior al término del contrato (${end})`);

    const updated = await tx.employmentContract.update({
      where: { id },
      data: { status: kind, terminationDate: parseUtcDate(date), terminationReason: reason, endDate: parseUtcDate(date) },
      include: INCLUDE,
    });

    const stillActive = await tx.employmentContract.count({ where: { employeeId: current.employeeId, status: "Vigente" } });
    let usersDeactivated = 0;
    let shiftsRemoved = 0;
    if (stillActive === 0) {
      await tx.employee.update({ where: { id: current.employeeId }, data: { active: false } });
      usersDeactivated = (
        await tx.user.updateMany({ where: { employeeId: current.employeeId, active: true }, data: { active: false } })
      ).count;
      shiftsRemoved = (
        await tx.employeeShift.deleteMany({
          where: { employeeId: current.employeeId, shift: { date: { gt: parseUtcDate(date) } } },
        })
      ).count;
    }
    return { contract: mapContract(updated), users_deactivated: usersDeactivated, shifts_removed: shiftsRemoved };
  });
}

export interface ContractFilters {
  employee_id?: number | null;
  status?: "Vigente" | "Historial" | null;
  q?: string | null;
}

export async function listContracts(filters: ContractFilters = {}): Promise<ContractDto[]> {
  const q = filters.q?.trim();
  const rows = await prisma.employmentContract.findMany({
    where: {
      ...(filters.employee_id ? { employeeId: filters.employee_id } : {}),
      ...(filters.status === "Vigente" ? { status: "Vigente" } : filters.status === "Historial" ? { status: { not: "Vigente" } } : {}),
      ...(q
        ? {
            OR: [
              { position: { contains: q, mode: "insensitive" } },
              { area: { contains: q, mode: "insensitive" } },
              { employee: { dni: { contains: q } } },
              { employee: { firstName: { contains: q, mode: "insensitive" } } },
              { employee: { paternalLastName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: INCLUDE,
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
  });
  const today = todayLimaIso();
  return rows.map((r) => mapContract(r, today));
}

export async function getContract(id: number): Promise<ContractDto> {
  const c = await prisma.employmentContract.findUnique({ where: { id }, include: INCLUDE });
  if (!c) throw new UserError("Contrato no encontrado", 404);
  return mapContract(c);
}

/** Contrato vigente del empleado en una fecha (por defecto hoy). */
export async function currentContractOf(db: Tx | typeof prisma, employeeId: number, dateIso = todayLimaIso()) {
  return db.employmentContract.findFirst({
    where: { employeeId, ...contractCovering(parseUtcDate(dateIso)) },
    orderBy: { startDate: "desc" },
  });
}

export interface HrAlert {
  kind: "contract_expiring" | "contract_expired" | "trial_ending" | "no_schedule" | "no_vida_ley" | "no_contract";
  severity: "danger" | "warning" | "info";
  employee_id: number;
  employee_name: string;
  contract_id: number | null;
  message: string;
}

/** Pendientes de cumplimiento para el panel de RR. HH. */
export async function hrAlerts(): Promise<HrAlert[]> {
  const today = todayLimaIso();
  const contracts = await prisma.employmentContract.findMany({
    where: { status: "Vigente" },
    include: { ...INCLUDE, employee: { select: { ...INCLUDE.employee.select, insurances: { where: { type: "VidaLey", active: true }, select: { id: true } } } } },
  });
  const alerts: HrAlert[] = [];
  for (const c of contracts) {
    const dto = mapContract(c as unknown as ContractRow, today);
    const base = { employee_id: dto.employee_id, employee_name: dto.employee_name, contract_id: dto.contract_id };
    if (dto.phase === "Vencido") {
      alerts.push({ ...base, kind: "contract_expired", severity: "danger", message: `Contrato vencido el ${dto.end_date}: renuévalo o registra el cese` });
    } else if (dto.phase === "Por vencer") {
      alerts.push({ ...base, kind: "contract_expiring", severity: "warning", message: `Contrato vence en ${dto.days_to_expiry} día(s) (${dto.end_date})` });
    }
    if (dto.in_trial && dto.trial_end_date && daysInclusive(today, dto.trial_end_date) - 1 <= 15) {
      alerts.push({ ...base, kind: "trial_ending", severity: "info", message: `Termina su periodo de prueba el ${dto.trial_end_date}` });
    }
    if (dto.schedule.length === 0) {
      alerts.push({ ...base, kind: "no_schedule", severity: "warning", message: "El contrato no tiene horario pactado" });
    }
    if (isEmployment(dto.contract_type) && dto.contract_type !== "Practicas" && c.employee.insurances.length === 0) {
      alerts.push({ ...base, kind: "no_vida_ley", severity: "warning", message: "Sin Seguro Vida Ley (obligatorio desde el primer día)" });
    }
  }
  const withoutContract = await prisma.employee.findMany({
    where: { active: true, contracts: { none: { status: "Vigente" } } },
    select: { id: true, firstName: true, middleName: true, paternalLastName: true, maternalLastName: true },
  });
  for (const e of withoutContract) {
    alerts.push({
      kind: "no_contract",
      severity: "danger",
      employee_id: e.id,
      employee_name: fullName(e),
      contract_id: null,
      message: "Empleado activo sin contrato vigente",
    });
  }
  const order = { danger: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity] || a.employee_name.localeCompare(b.employee_name));
}
