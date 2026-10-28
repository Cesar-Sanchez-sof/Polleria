import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/users.service";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";

export const CONTRACT_TYPES = ["Planilla", "Part-time", "Por horas", "Locación de servicios", "Prácticas"] as const;

export interface EmployeeData {
  dni: string;
  first_name: string;
  middle_name?: string | null;
  paternal_last_name: string;
  maternal_last_name?: string | null;
  phone?: string | null;
  address?: string | null;
  /** "YYYY-MM-DD" */
  birth_date?: string | null;
  /** "YYYY-MM-DD"; si no se envía, hoy. */
  hire_date?: string | null;
  position?: string | null;
  area?: string | null;
  contract_type?: string | null;
  base_salary?: number | string | null;
}

export interface EmployeeDto {
  employee_id: number;
  dni: string;
  first_name: string;
  middle_name: string | null;
  paternal_last_name: string;
  maternal_last_name: string | null;
  full_name: string;
  phone: string | null;
  address: string | null;
  birth_date: string | null;
  hire_date: string;
  position: string | null;
  area: string | null;
  contract_type: string | null;
  base_salary: number;
  active: boolean;
  has_user: boolean;
  /** Horarios asignados de hoy en adelante (un empleado puede tener varios). */
  upcoming_shifts: number;
  next_shift: { shift_id: number; name: string; date: string; start_time: string; end_time: string } | null;
}

export interface EmployeeFilters {
  q?: string | null;
  active?: boolean | null;
  area?: string | null;
}

const MIN_AGE = 18;

/** Hoy en Lima (UTC-5) como fecha de columna `@db.Date`. */
function todayLima(): Date {
  return parseUtcDate(new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10));
}

/** Incluye los usuarios del empleado y sus horarios de hoy en adelante (el más próximo primero). */
function employeeInclude() {
  return {
    shifts: {
      where: { shift: { date: { gte: todayLima() } } },
      include: { shift: true },
      orderBy: [{ shift: { date: "asc" } }, { shift: { startTime: "asc" } }],
    },
    users: { select: { id: true } },
  } satisfies Prisma.EmployeeInclude;
}

type EmployeeRow = Prisma.EmployeeGetPayload<{ include: ReturnType<typeof employeeInclude> }>;

/** "HH:MM" de una columna `@db.Time` (se guarda como 1970-01-01 en UTC). */
export function formatTime(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function mapEmployee(e: EmployeeRow): EmployeeDto {
  const next = e.shifts[0]?.shift ?? null;
  const full = [e.firstName, e.middleName, e.paternalLastName, e.maternalLastName].filter(Boolean).join(" ");
  return {
    employee_id: e.id,
    dni: e.dni,
    first_name: e.firstName,
    middle_name: e.middleName,
    paternal_last_name: e.paternalLastName,
    maternal_last_name: e.maternalLastName,
    full_name: full,
    phone: e.phone,
    address: e.address,
    birth_date: e.birthDate ? formatDateToIso(e.birthDate) : null,
    hire_date: formatDateToIso(e.hireDate),
    position: e.position,
    area: e.area,
    contract_type: e.contractType,
    base_salary: Number(e.baseSalary),
    active: e.active,
    has_user: e.users.length > 0,
    upcoming_shifts: e.shifts.length,
    next_shift: next
      ? {
          shift_id: next.id,
          name: next.name,
          date: formatDateToIso(next.date),
          start_time: formatTime(next.startTime),
          end_time: formatTime(next.endTime),
        }
      : null,
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

function isoDate(value: unknown, field: string, required = false): Date | null {
  const t = typeof value === "string" ? value.trim() : "";
  if (!t) {
    if (required) throw new UserError(`${field} es obligatoria`);
    return null;
  }
  const d = /^\d{4}-\d{2}-\d{2}$/.test(t) ? parseUtcDate(t) : null;
  if (!d || Number.isNaN(d.getTime()) || formatDateToIso(d) !== t) {
    throw new UserError(`${field} no es una fecha válida`);
  }
  return d;
}

function ageOn(birth: Date, ref: Date): number {
  let age = ref.getUTCFullYear() - birth.getUTCFullYear();
  const m = ref.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && ref.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

/** Valida y normaliza los datos del empleado (alta y edición comparten reglas). */
export function normalizeEmployee(data: EmployeeData, today: Date = new Date()) {
  const dni = typeof data.dni === "string" ? data.dni.trim() : "";
  if (!dni) throw new UserError("El documento es obligatorio");
  if (!/^\d{8}$/.test(dni)) throw new UserError("El documento debe tener 8 dígitos");

  const phone = text(data.phone, "El teléfono", 9);
  if (phone && !/^9\d{8}$/.test(phone)) {
    throw new UserError("El teléfono debe tener 9 dígitos y empezar con 9");
  }

  const birthDate = isoDate(data.birth_date, "La fecha de nacimiento");
  const hireDate = isoDate(data.hire_date, "La fecha de ingreso") ?? parseUtcDate(formatDateToIso(today));
  if (birthDate) {
    if (birthDate > today) throw new UserError("La fecha de nacimiento no puede ser futura");
    if (ageOn(birthDate, hireDate) < MIN_AGE) {
      throw new UserError(`El empleado debe ser mayor de ${MIN_AGE} años a la fecha de ingreso`);
    }
  }

  const contractType = text(data.contract_type, "El tipo de contrato", 30);
  if (contractType && !(CONTRACT_TYPES as readonly string[]).includes(contractType)) {
    throw new UserError("El tipo de contrato no es válido");
  }

  const rawSalary = data.base_salary === "" || data.base_salary == null ? 0 : Number(data.base_salary);
  if (!Number.isFinite(rawSalary) || rawSalary < 0 || rawSalary > 99_999_999.99) {
    throw new UserError("El sueldo base debe ser un monto válido mayor o igual a 0");
  }

  return {
    dni,
    firstName: text(data.first_name, "El nombre", 50, true)!,
    middleName: text(data.middle_name, "El segundo nombre", 50),
    paternalLastName: text(data.paternal_last_name, "El apellido paterno", 50, true)!,
    maternalLastName: text(data.maternal_last_name, "El apellido materno", 50),
    phone,
    address: text(data.address, "La dirección", 200),
    birthDate,
    hireDate,
    position: text(data.position, "El cargo", 30),
    area: text(data.area, "El área", 30),
    contractType,
    baseSalary: Math.round(rawSalary * 100) / 100,
  };
}

async function verifyDni(db: Prisma.TransactionClient, dni: string, excludeId?: number) {
  const dup = await db.employee.findFirst({
    where: { dni, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  if (dup) throw new UserError("Ya existe un empleado con ese documento", 409);
}

function translateError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new UserError("Ya existe un empleado con ese documento", 409);
  }
  throw e;
}

export async function listEmployees(filters: EmployeeFilters = {}): Promise<EmployeeDto[]> {
  const q = filters.q?.trim();
  const where: Prisma.EmployeeWhereInput = {
    ...(filters.active != null ? { active: filters.active } : {}),
    ...(filters.area ? { area: filters.area } : {}),
    ...(q
      ? {
          OR: [
            { dni: { contains: q } },
            { firstName: { contains: q, mode: "insensitive" } },
            { middleName: { contains: q, mode: "insensitive" } },
            { paternalLastName: { contains: q, mode: "insensitive" } },
            { maternalLastName: { contains: q, mode: "insensitive" } },
            { position: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const rows = await prisma.employee.findMany({
    where,
    include: employeeInclude(),
    orderBy: [{ paternalLastName: "asc" }, { firstName: "asc" }],
  });
  return rows.map(mapEmployee);
}

export async function getEmployee(id: number): Promise<EmployeeDto> {
  const e = await prisma.employee.findUnique({ where: { id }, include: employeeInclude() });
  if (!e) throw new UserError("Empleado no encontrado", 404);
  return mapEmployee(e);
}

export async function createEmployee(data: EmployeeData): Promise<EmployeeDto> {
  const n = normalizeEmployee(data);
  try {
    return await prisma.$transaction(async (tx) => {
      await verifyDni(tx, n.dni);
      const e = await tx.employee.create({ data: { ...n, active: true }, include: employeeInclude() });
      return mapEmployee(e);
    });
  } catch (e) {
    return translateError(e);
  }
}

export async function updateEmployee(id: number, data: EmployeeData): Promise<EmployeeDto> {
  const n = normalizeEmployee(data);
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.employee.findUnique({ where: { id }, select: { id: true } });
      if (!current) throw new UserError("Empleado no encontrado", 404);
      await verifyDni(tx, n.dni, id);
      const e = await tx.employee.update({ where: { id }, data: n, include: employeeInclude() });
      return mapEmployee(e);
    });
  } catch (e) {
    return translateError(e);
  }
}

/**
 * Baja o reingreso lógico (no se borra: hay compras, planillas y auditoría que lo referencian).
 * Al dar de baja se desactivan también sus usuarios para que no sigan entrando al sistema.
 */
export async function setEmployeeActive(
  id: number,
  active: boolean,
): Promise<{ employee: EmployeeDto; users_deactivated: number }> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.employee.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new UserError("Empleado no encontrado", 404);
    await tx.employee.update({ where: { id }, data: { active } });
    let usersDeactivated = 0;
    if (!active) {
      const res = await tx.user.updateMany({ where: { employeeId: id, active: true }, data: { active: false } });
      usersDeactivated = res.count;
    }
    const e = await tx.employee.findUniqueOrThrow({ where: { id }, include: employeeInclude() });
    return { employee: mapEmployee(e), users_deactivated: usersDeactivated };
  });
}

/** Solo un administrador puede tocar a un empleado cuyo usuario tiene rol de sistema (misma regla que Usuarios). */
export async function verifyModifiableEmployee(id: number, isSuperuser: boolean): Promise<void> {
  if (isSuperuser) return;
  const admin = await prisma.user.findFirst({ where: { employeeId: id, role: { isSystem: true } }, select: { id: true } });
  if (admin) throw new UserError("Solo un administrador puede modificar a un administrador", 403);
}

/** Id del empleado dueño de un usuario (para impedir que alguien se dé de baja a sí mismo). */
export async function employeeIdOfUser(userId: number): Promise<number | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
  return u?.employeeId ?? null;
}