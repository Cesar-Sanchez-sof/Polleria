import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/security/users.service";
import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import { dateOrNull, formatTime, fullName, isoDate, text, todayLimaDate, todayLimaIso } from "@/lib/services/hr/common";
import { CONTRACT_TYPE_LABEL } from "@/lib/services/hr/labor-rules";
import { contractPhase, createContractTx, type ContractData, type ContractDto, type ContractPhase } from "@/lib/services/hr/contracts.service";
import { createAccessTx, type AccessDto, type prepareAccess } from "@/lib/services/hr/access.service";

export { formatTime };

/** Datos personales del trabajador. Las condiciones laborales se registran en su contrato. */
export interface EmployeeData {
  dni: string;
  first_name: string;
  middle_name?: string | null;
  paternal_last_name: string;
  maternal_last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  /** "YYYY-MM-DD" */
  birth_date?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
}

export interface EmployeeContractSummary {
  contract_id: number;
  contract_type: string;
  contract_type_label: string;
  position: string;
  area: string;
  base_salary: number;
  start_date: string;
  end_date: string | null;
  phase: ContractPhase;
  weekly_hours: number;
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
  email: string | null;
  address: string | null;
  birth_date: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  /** Inicio de la relación laboral actual (o la última). */
  hire_date: string;
  active: boolean;
  has_user: boolean;
  /** Contrato vigente hoy (o el próximo a empezar), si lo hay. */
  contract: EmployeeContractSummary | null;
  /** Atajos del contrato vigente para tablas y filtros. */
  position: string | null;
  area: string | null;
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

/** Incluye usuarios, contrato vigente (con su horario) y horarios de hoy en adelante. */
function employeeInclude() {
  return {
    shifts: {
      where: { shift: { date: { gte: todayLimaDate() } } },
      include: { shift: true },
      orderBy: [{ shift: { date: "asc" } }, { shift: { startTime: "asc" } }],
    },
    contracts: {
      where: { status: "Vigente" },
      include: { schedule: { include: { shiftTemplate: true } } },
      orderBy: { startDate: "asc" },
    },
    users: { select: { id: true } },
  } satisfies Prisma.EmployeeInclude;
}

type EmployeeRow = Prisma.EmployeeGetPayload<{ include: ReturnType<typeof employeeInclude> }>;

function weeklyHours(schedule: EmployeeRow["contracts"][number]["schedule"]): number {
  const minutes = schedule.reduce((sum, d) => {
    const s = d.shiftTemplate.startTime.getUTCHours() * 60 + d.shiftTemplate.startTime.getUTCMinutes();
    const e = d.shiftTemplate.endTime.getUTCHours() * 60 + d.shiftTemplate.endTime.getUTCMinutes();
    return sum + (e > s ? e - s : e - s + 1440);
  }, 0);
  return Math.round((minutes / 60) * 100) / 100;
}

function mapEmployee(e: EmployeeRow, today = todayLimaIso()): EmployeeDto {
  const next = e.shifts[0]?.shift ?? null;
  // El vigente hoy; si aún no empieza ninguno, el próximo.
  const c = e.contracts.find((x) => formatDateToIso(x.startDate) <= today) ?? e.contracts[0] ?? null;
  const contract: EmployeeContractSummary | null = c
    ? {
        contract_id: c.id,
        contract_type: c.contractType,
        contract_type_label: CONTRACT_TYPE_LABEL[c.contractType],
        position: c.position,
        area: c.area,
        base_salary: Number(c.baseSalary),
        start_date: formatDateToIso(c.startDate),
        end_date: dateOrNull(c.endDate),
        phase: contractPhase(
          { status: c.status, startDate: formatDateToIso(c.startDate), endDate: dateOrNull(c.endDate) },
          today,
        ),
        weekly_hours: weeklyHours(c.schedule),
      }
    : null;
  return {
    employee_id: e.id,
    dni: e.dni,
    first_name: e.firstName,
    middle_name: e.middleName,
    paternal_last_name: e.paternalLastName,
    maternal_last_name: e.maternalLastName,
    full_name: fullName(e),
    phone: e.phone,
    email: e.email,
    address: e.address,
    birth_date: dateOrNull(e.birthDate),
    emergency_contact: e.emergencyContact,
    emergency_phone: e.emergencyPhone,
    hire_date: formatDateToIso(e.hireDate),
    active: e.active,
    has_user: e.users.length > 0,
    contract,
    position: contract?.position ?? null,
    area: contract?.area ?? null,
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

function ageOn(birth: string, ref: string): number {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [ry, rm, rd] = ref.split("-").map(Number);
  let age = ry - by;
  if (rm < bm || (rm === bm && rd < bd)) age--;
  return age;
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida y normaliza los datos personales (alta y edición comparten reglas).
 * `hireDate` se usa para exigir la mayoría de edad al ingresar.
 */
export function normalizeEmployee(data: EmployeeData, hireDate: string = todayLimaIso()) {
  const dni = typeof data.dni === "string" ? data.dni.trim() : "";
  if (!dni) throw new UserError("El documento es obligatorio");
  if (!/^\d{8}$/.test(dni)) throw new UserError("El documento debe tener 8 dígitos");

  const phone = text(data.phone, "El teléfono", 9);
  if (phone && !/^9\d{8}$/.test(phone)) throw new UserError("El teléfono debe tener 9 dígitos y empezar con 9");
  const emergencyPhone = text(data.emergency_phone, "El teléfono de emergencia", 9);
  if (emergencyPhone && !/^9\d{8}$/.test(emergencyPhone)) {
    throw new UserError("El teléfono de emergencia debe tener 9 dígitos y empezar con 9");
  }
  const email = text(data.email, "El correo", 80);
  if (email && !RE_EMAIL.test(email)) throw new UserError("El correo no es válido");

  const birth = isoDate(data.birth_date, "La fecha de nacimiento");
  if (birth) {
    if (birth > todayLimaIso()) throw new UserError("La fecha de nacimiento no puede ser futura");
    if (ageOn(birth, hireDate) < MIN_AGE) {
      throw new UserError(`El empleado debe ser mayor de ${MIN_AGE} años a la fecha de ingreso`);
    }
  }

  return {
    dni,
    firstName: text(data.first_name, "El nombre", 50, true)!,
    middleName: text(data.middle_name, "El segundo nombre", 50),
    paternalLastName: text(data.paternal_last_name, "El apellido paterno", 50, true)!,
    maternalLastName: text(data.maternal_last_name, "El apellido materno", 50),
    phone,
    email: email?.toLowerCase() ?? null,
    address: text(data.address, "La dirección", 200),
    birthDate: birth ? parseUtcDate(birth) : null,
    emergencyContact: text(data.emergency_contact, "El contacto de emergencia", 100),
    emergencyPhone,
  };
}

async function verifyDni(db: Prisma.TransactionClient, dni: string, excludeId?: number) {
  const dup = await db.employee.findFirst({
    where: { dni, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true, active: true },
  });
  if (dup) {
    throw new UserError(
      dup.active
        ? "Ya existe un empleado con ese documento"
        : "Ese documento pertenece a un ex empleado: abre su ficha y registra un nuevo contrato para reingresarlo",
      409,
    );
  }
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
    ...(filters.area ? { contracts: { some: { status: "Vigente", area: filters.area } } } : {}),
    ...(q
      ? {
          OR: [
            { dni: { contains: q } },
            { firstName: { contains: q, mode: "insensitive" } },
            { middleName: { contains: q, mode: "insensitive" } },
            { paternalLastName: { contains: q, mode: "insensitive" } },
            { maternalLastName: { contains: q, mode: "insensitive" } },
            { contracts: { some: { status: "Vigente", position: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const rows = await prisma.employee.findMany({
    where,
    include: employeeInclude(),
    orderBy: [{ paternalLastName: "asc" }, { firstName: "asc" }],
  });
  const today = todayLimaIso();
  return rows.map((r) => mapEmployee(r, today));
}

export async function getEmployee(id: number): Promise<EmployeeDto> {
  const e = await prisma.employee.findUnique({ where: { id }, include: employeeInclude() });
  if (!e) throw new UserError("Empleado no encontrado", 404);
  return mapEmployee(e);
}

/**
 * Contratación: registra al trabajador, su contrato y el horario pactado en una sola
 * operación (no existe personal activo sin contrato).
 */
export async function hireEmployee(
  personal: EmployeeData,
  contract: ContractData,
  actorUserId: number | null,
  /** Usuario del sistema ya validado (opcional): se crea en la misma operación. */
  access: Awaited<ReturnType<typeof prepareAccess>> | null = null,
): Promise<{ employee: EmployeeDto; contract: ContractDto; user: AccessDto | null }> {
  const start = isoDate(contract?.start_date, "La fecha de inicio", true)!;
  const n = normalizeEmployee(personal, start);
  try {
    return await prisma.$transaction(async (tx) => {
      await verifyDni(tx, n.dni);
      const e = await tx.employee.create({ data: { ...n, hireDate: parseUtcDate(start), active: true } });
      const created = await createContractTx(tx, e.id, contract, actorUserId);
      const user = access ? await createAccessTx(tx, e.id, access) : null;
      const full = await tx.employee.findUniqueOrThrow({ where: { id: e.id }, include: employeeInclude() });
      return { employee: mapEmployee(full), contract: created, user };
    }, { timeout: 30_000 });
  } catch (e) {
    return translateError(e);
  }
}

/** Edita los datos personales (las condiciones laborales se cambian con una adenda del contrato). */
export async function updateEmployee(id: number, data: EmployeeData): Promise<EmployeeDto> {
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.employee.findUnique({ where: { id }, select: { id: true, hireDate: true } });
      if (!current) throw new UserError("Empleado no encontrado", 404);
      const n = normalizeEmployee(data, formatDateToIso(current.hireDate));
      await verifyDni(tx, n.dni, id);
      const e = await tx.employee.update({ where: { id }, data: n, include: employeeInclude() });
      return mapEmployee(e);
    });
  } catch (e) {
    return translateError(e);
  }
}

/** Solo un administrador puede tocar a un empleado cuyo usuario tiene rol de sistema (misma regla que Usuarios). */
export async function verifyModifiableEmployee(id: number, isSuperuser: boolean): Promise<void> {
  if (isSuperuser) return;
  const admin = await prisma.user.findFirst({ where: { employeeId: id, role: { isSystem: true } }, select: { id: true } });
  if (admin) throw new UserError("Solo un administrador puede modificar a un administrador", 403);
}

/** Id del empleado dueño de un usuario (para el autoservicio y para que nadie se dé de baja a sí mismo). */
export async function employeeIdOfUser(userId: number): Promise<number | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
  return u?.employeeId ?? null;
}
