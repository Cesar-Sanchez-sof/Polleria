import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/users.service";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import {
  CONTRACT_KINDS,
  contractStatus,
  isCurrentOrUpcoming,
  LABOR_REGIMES,
  limaToday,
  MAX_FIXED_TERM_YEARS,
  MAX_WEEKLY_HOURS,
  PENSION_SYSTEMS,
  periodsOverlap,
  type ContractDates,
  type ContractKind,
  type ContractStatus,
  type LaborRegime,
  type PensionSystem,
} from "@/lib/hr/contracts";

export interface ContractData {
  employee_id: number | string;
  kind: string;
  regime?: string | null;
  /** "YYYY-MM-DD" */
  start_date: string;
  /** "YYYY-MM-DD"; obligatoria en plazo fijo y vacía en indeterminado. */
  end_date?: string | null;
  monthly_salary: number | string;
  weekly_hours?: number | string | null;
  position?: string | null;
  pension_system?: string | null;
  family_allowance?: boolean | null;
  notes?: string | null;
  /** Contrato que este renueva. */
  renews_contract_id?: number | string | null;
}

export interface ContractDto {
  contract_id: number;
  employee_id: number;
  employee_name: string;
  employee_dni: string;
  kind: ContractKind;
  regime: LaborRegime;
  start_date: string;
  end_date: string | null;
  monthly_salary: number;
  weekly_hours: number;
  position: string | null;
  pension_system: PensionSystem;
  family_allowance: boolean;
  notes: string | null;
  renews_contract_id: number | null;
  terminated_at: string | null;
  termination_reason: string | null;
  status: ContractStatus;
  /** Días que faltan para el fin (negativo si ya venció); `null` si no tiene fin. */
  days_to_end: number | null;
}

export interface ContractEmployeeOption {
  employee_id: number;
  full_name: string;
  dni: string;
  position: string | null;
  /** Tiene un contrato vigente o por iniciar. */
  has_current_contract: boolean;
}

export interface ContractFilters {
  q?: string | null;
  employeeId?: number | null;
  status?: ContractStatus | null;
  kind?: ContractKind | null;
}

const contractInclude = {
  employee: {
    select: { id: true, dni: true, firstName: true, middleName: true, paternalLastName: true, maternalLastName: true },
  },
} satisfies Prisma.EmploymentContractInclude;

type ContractRow = Prisma.EmploymentContractGetPayload<{ include: typeof contractInclude }>;

function fullName(e: {
  firstName: string;
  middleName: string | null;
  paternalLastName: string;
  maternalLastName: string | null;
}): string {
  return [e.firstName, e.middleName, e.paternalLastName, e.maternalLastName].filter(Boolean).join(" ");
}

function datesOf(c: Pick<ContractRow, "startDate" | "endDate" | "terminatedAt">): ContractDates {
  return {
    startDate: formatDateToIso(c.startDate),
    endDate: c.endDate ? formatDateToIso(c.endDate) : null,
    terminatedAt: c.terminatedAt ? formatDateToIso(c.terminatedAt) : null,
  };
}

function mapContract(c: ContractRow, today: string): ContractDto {
  const dates = datesOf(c);
  return {
    contract_id: c.id,
    employee_id: c.employeeId,
    employee_name: fullName(c.employee),
    employee_dni: c.employee.dni,
    kind: c.kind,
    regime: c.regime,
    start_date: dates.startDate,
    end_date: dates.endDate,
    monthly_salary: Number(c.monthlySalary),
    weekly_hours: c.weeklyHours,
    position: c.position,
    pension_system: c.pensionSystem,
    family_allowance: c.familyAllowance,
    notes: c.notes,
    renews_contract_id: c.renewsContractId,
    terminated_at: dates.terminatedAt,
    termination_reason: c.terminationReason,
    status: contractStatus(dates, today),
    days_to_end: dates.endDate ? Math.round((Date.parse(dates.endDate) - Date.parse(today)) / 86_400_000) : null,
  };
}

function text(value: unknown, field: string, max: number, required = false): string | null {
  const t = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!t) {
    if (required) throw new UserError(`${field} es obligatorio`);
    return null;
  }
  if (t.length > max) throw new UserError(`${field} no puede superar ${max} caracteres`);
  return t;
}

function isoDate(value: unknown, field: string, required = false): string | null {
  const t = typeof value === "string" ? value.trim() : "";
  if (!t) {
    if (required) throw new UserError(`${field} es obligatoria`);
    return null;
  }
  const d = /^\d{4}-\d{2}-\d{2}$/.test(t) ? parseUtcDate(t) : null;
  if (!d || Number.isNaN(d.getTime()) || formatDateToIso(d) !== t) {
    throw new UserError(`${field} no es una fecha válida`);
  }
  return t;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], message: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new UserError(message);
  return value as T;
}

export interface NormalizedContract {
  employeeId: number;
  kind: ContractKind;
  regime: LaborRegime;
  startDate: string;
  endDate: string | null;
  monthlySalary: number;
  weeklyHours: number;
  position: string | null;
  pensionSystem: PensionSystem;
  familyAllowance: boolean;
  notes: string | null;
  renewsContractId: number | null;
}

/** Valida y normaliza un contrato (alta y edición comparten reglas). */
export function normalizeContract(data: ContractData): NormalizedContract {
  const employeeId = Number(data.employee_id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) throw new UserError("Elige el empleado del contrato");

  const kind = oneOf(data.kind, CONTRACT_KINDS, "El tipo de contrato no es válido");
  const isPrivate = kind === "Private";

  const regime: LaborRegime = isPrivate
    ? "None"
    : oneOf(data.regime, LABOR_REGIMES, "Elige el régimen laboral (general, microempresa o pequeña empresa)");
  const pensionSystem: PensionSystem = isPrivate
    ? "None"
    : oneOf(data.pension_system, PENSION_SYSTEMS, "Elige el sistema de pensiones (ONP o AFP)");

  const startDate = isoDate(data.start_date, "La fecha de inicio", true)!;
  const endDate = isoDate(data.end_date, "La fecha de fin");
  if (kind === "FixedTerm") {
    if (!endDate) throw new UserError("El contrato a plazo fijo necesita fecha de fin");
  } else if (kind === "Indefinite" && endDate) {
    throw new UserError("El contrato a plazo indeterminado no tiene fecha de fin");
  }
  if (endDate) {
    if (endDate <= startDate) throw new UserError("La fecha de fin debe ser posterior a la de inicio");
    if (kind === "FixedTerm") {
      const limit = `${Number(startDate.slice(0, 4)) + MAX_FIXED_TERM_YEARS}${startDate.slice(4)}`;
      if (endDate > limit) {
        throw new UserError(`El contrato a plazo fijo no puede durar más de ${MAX_FIXED_TERM_YEARS} años`);
      }
    }
  }

  const salary = Number(data.monthly_salary);
  if (data.monthly_salary === "" || data.monthly_salary == null || !Number.isFinite(salary) || salary <= 0) {
    throw new UserError("La remuneración mensual debe ser mayor a 0");
  }
  if (salary > 99_999_999.99) throw new UserError("La remuneración mensual es demasiado alta");

  const hoursRaw = data.weekly_hours === "" || data.weekly_hours == null ? MAX_WEEKLY_HOURS : Number(data.weekly_hours);
  if (!Number.isInteger(hoursRaw) || hoursRaw < 1 || hoursRaw > MAX_WEEKLY_HOURS) {
    throw new UserError(`La jornada semanal debe estar entre 1 y ${MAX_WEEKLY_HOURS} horas`);
  }

  const renewsRaw = data.renews_contract_id;
  const renewsContractId = renewsRaw == null || renewsRaw === "" ? null : Number(renewsRaw);
  if (renewsContractId !== null && (!Number.isInteger(renewsContractId) || renewsContractId <= 0)) {
    throw new UserError("El contrato a renovar no es válido");
  }

  return {
    employeeId,
    kind,
    regime,
    startDate,
    endDate,
    monthlySalary: Math.round(salary * 100) / 100,
    weeklyHours: hoursRaw,
    position: text(data.position, "El cargo", 30),
    pensionSystem,
    // La asignación familiar es un beneficio laboral: el contrato privado no la tiene.
    familyAllowance: !isPrivate && data.family_allowance === true,
    notes: text(data.notes, "Las observaciones", 300),
    renewsContractId,
  };
}

function translateError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
    throw new UserError("El empleado o el contrato indicado no existe", 404);
  }
  throw e;
}

/** Falla si el nuevo periodo se cruza con otro contrato no rescindido del empleado. */
async function verifyNoOverlap(
  db: Prisma.TransactionClient,
  employeeId: number,
  period: ContractDates,
  excludeId?: number,
) {
  const others = await db.employmentContract.findMany({
    where: { employeeId, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true, startDate: true, endDate: true, terminatedAt: true },
  });
  const clash = others.find((o) => periodsOverlap(period, datesOf(o)));
  if (clash) {
    const d = datesOf(clash);
    const until = d.terminatedAt ?? d.endDate;
    throw new UserError(
      `El empleado ya tiene un contrato del ${d.startDate} ${until ? `al ${until}` : "sin fecha de fin"}. ` +
        "Rescíndelo o ajusta las fechas para que no se crucen",
      409,
    );
  }
}

export async function listContracts(
  filters: ContractFilters = {},
): Promise<{ contracts: ContractDto[]; employees: ContractEmployeeOption[] }> {
  const today = limaToday();
  const q = filters.q?.trim();
  const rows = await prisma.employmentContract.findMany({
    where: {
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(q
        ? {
            employee: {
              OR: [
                { dni: { contains: q } },
                { firstName: { contains: q, mode: "insensitive" } },
                { paternalLastName: { contains: q, mode: "insensitive" } },
                { maternalLastName: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: contractInclude,
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
  });
  const all = rows.map((r) => mapContract(r, today));

  const activeEmployees = await prisma.employee.findMany({
    where: { active: true },
    select: { id: true, dni: true, position: true, firstName: true, middleName: true, paternalLastName: true, maternalLastName: true },
    orderBy: [{ paternalLastName: "asc" }, { firstName: "asc" }],
  });
  // Quién tiene contrato se calcula sobre todos los contratos, aunque la lista esté filtrada.
  const everyContract = await prisma.employmentContract.findMany({
    select: { employeeId: true, startDate: true, endDate: true, terminatedAt: true },
  });
  const current = new Set(
    everyContract.filter((c) => isCurrentOrUpcoming(contractStatus(datesOf(c), today))).map((c) => c.employeeId),
  );

  return {
    contracts: filters.status ? all.filter((c) => c.status === filters.status) : all,
    employees: activeEmployees.map((e) => ({
      employee_id: e.id,
      full_name: fullName(e),
      dni: e.dni,
      position: e.position,
      has_current_contract: current.has(e.id),
    })),
  };
}

export async function getContract(id: number): Promise<ContractDto> {
  const c = await prisma.employmentContract.findUnique({ where: { id }, include: contractInclude });
  if (!c) throw new UserError("Contrato no encontrado", 404);
  return mapContract(c, limaToday());
}

export async function createContract(data: ContractData): Promise<ContractDto> {
  const n = normalizeContract(data);
  try {
    return await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: n.employeeId }, select: { id: true, active: true } });
      if (!employee) throw new UserError("Empleado no encontrado", 404);
      if (!employee.active) throw new UserError("El empleado está dado de baja", 409);

      if (n.renewsContractId !== null) {
        const previous = await tx.employmentContract.findUnique({
          where: { id: n.renewsContractId },
          select: { employeeId: true, terminatedAt: true },
        });
        if (!previous || previous.employeeId !== n.employeeId) {
          throw new UserError("El contrato a renovar no pertenece a este empleado", 400);
        }
        if (previous.terminatedAt) throw new UserError("Un contrato rescindido no se puede renovar", 409);
      }

      await verifyNoOverlap(tx, n.employeeId, { startDate: n.startDate, endDate: n.endDate, terminatedAt: null });
      const created = await tx.employmentContract.create({
        data: {
          employeeId: n.employeeId,
          kind: n.kind,
          regime: n.regime,
          startDate: parseUtcDate(n.startDate),
          endDate: n.endDate ? parseUtcDate(n.endDate) : null,
          monthlySalary: n.monthlySalary,
          weeklyHours: n.weeklyHours,
          position: n.position,
          pensionSystem: n.pensionSystem,
          familyAllowance: n.familyAllowance,
          notes: n.notes,
          renewsContractId: n.renewsContractId,
        },
        include: contractInclude,
      });
      return mapContract(created, limaToday());
    });
  } catch (e) {
    return translateError(e);
  }
}

/** Edita un contrato que no se haya rescindido. El empleado no se cambia: para eso se crea otro contrato. */
export async function updateContract(id: number, data: ContractData): Promise<ContractDto> {
  const n = normalizeContract(data);
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.employmentContract.findUnique({
        where: { id },
        select: { employeeId: true, terminatedAt: true },
      });
      if (!current) throw new UserError("Contrato no encontrado", 404);
      if (current.terminatedAt) throw new UserError("Un contrato rescindido ya no se puede editar", 409);
      if (current.employeeId !== n.employeeId) {
        throw new UserError("No se puede cambiar el empleado de un contrato", 400);
      }

      await verifyNoOverlap(tx, n.employeeId, { startDate: n.startDate, endDate: n.endDate, terminatedAt: null }, id);
      const updated = await tx.employmentContract.update({
        where: { id },
        data: {
          kind: n.kind,
          regime: n.regime,
          startDate: parseUtcDate(n.startDate),
          endDate: n.endDate ? parseUtcDate(n.endDate) : null,
          monthlySalary: n.monthlySalary,
          weeklyHours: n.weeklyHours,
          position: n.position,
          pensionSystem: n.pensionSystem,
          familyAllowance: n.familyAllowance,
          notes: n.notes,
        },
        include: contractInclude,
      });
      return mapContract(updated, limaToday());
    });
  } catch (e) {
    return translateError(e);
  }
}

/** Rescinde un contrato a partir de una fecha, con su motivo. Queda en el historial; no se borra. */
export async function terminateContract(
  id: number,
  input: { terminated_at?: string | null; reason?: string | null },
): Promise<ContractDto> {
  const terminatedAt = isoDate(input.terminated_at, "La fecha de rescisión", true)!;
  const reason = text(input.reason, "El motivo", 200, true)!;
  return prisma.$transaction(async (tx) => {
    const current = await tx.employmentContract.findUnique({ where: { id } });
    if (!current) throw new UserError("Contrato no encontrado", 404);
    if (current.terminatedAt) throw new UserError("El contrato ya está rescindido", 409);
    const dates = datesOf(current);
    if (terminatedAt < dates.startDate) {
      throw new UserError("La rescisión no puede ser anterior al inicio del contrato");
    }
    if (dates.endDate && terminatedAt > dates.endDate) {
      throw new UserError("La rescisión no puede ser posterior al fin del contrato");
    }
    const updated = await tx.employmentContract.update({
      where: { id },
      data: { terminatedAt: parseUtcDate(terminatedAt), terminationReason: reason },
      include: contractInclude,
    });
    return mapContract(updated, limaToday());
  });
}

/**
 * Rescinde los contratos abiertos de un empleado que se da de baja. Los que aún no empezaron se cierran el
 * mismo día de su inicio. Devuelve cuántos se rescindieron.
 */
export async function terminateContractsOnDeparture(tx: Prisma.TransactionClient, employeeId: number): Promise<number> {
  const today = limaToday();
  const open = await tx.employmentContract.findMany({
    where: { employeeId, terminatedAt: null },
    select: { id: true, startDate: true, endDate: true },
  });
  let count = 0;
  for (const c of open) {
    const start = formatDateToIso(c.startDate);
    if (c.endDate && formatDateToIso(c.endDate) < today) continue; // ya venció solo
    await tx.employmentContract.update({
      where: { id: c.id },
      data: { terminatedAt: parseUtcDate(start > today ? start : today), terminationReason: "Baja del empleado" },
    });
    count++;
  }
  return count;
}
