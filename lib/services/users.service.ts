import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

/** Error de negocio con el código HTTP que debe devolver la API. */
export class UserError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "ErrorUsuario";
  }
}

export interface UserData {
  first_name: string;
  middle_name?: string | null;
  paternal_last_name: string;
  maternal_last_name?: string | null;
  dni: string;
  email: string;
  username: string;
  password?: string;
  role_id: number;
}

export interface UserRowDto {
  user_id: number;
  username: string;
  email: string | null;
  active: boolean;
  last_access: string | null;
  role: {
    role_id: number;
    name: string;
  };
  employee: {
    employee_id: number;
    dni: string;
    first_name: string;
    middle_name: string | null;
    paternal_last_name: string;
    maternal_last_name: string | null;
  };
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_USERNAME = /^[a-z0-9._-]{3,20}$/;

function mapUserToDto(u: any): UserRowDto {
  return {
    user_id: u.id,
    username: u.username,
    email: u.email,
    active: Boolean(u.active),
    last_access: u.lastAccessAt ? new Date(u.lastAccessAt).toISOString() : null,
    role: {
      role_id: u.role.id,
      name: u.role.name,
    },
    employee: {
      employee_id: u.employee.id,
      dni: u.employee.dni,
      first_name: u.employee.firstName,
      middle_name: u.employee.middleName ?? null,
      paternal_last_name: u.employee.paternalLastName,
      maternal_last_name: u.employee.maternalLastName ?? null,
    },
  };
}

/** Hash de relleno para que el login tarde igual exista o no el usuario. */
const HASH_FILLER = "$2b$12$1efU1XxeuoovsRSuwQ.YM.2uDaqq/I5nwHjtrWlZNpvK.VxcdCEym";

function textRequired(value: unknown, field: string): string {
  const t = typeof value === "string" ? value.trim() : "";
  if (!t) throw new UserError(`${field} es obligatorio`);
  return t;
}

function textOptional(value: unknown): string | null {
  const t = typeof value === "string" ? value.trim() : "";
  return t || null;
}

export function validatePassword(password: string): void {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new UserError("La contraseña debe tener al menos 8 caracteres, con letras y números");
  }
}

/** Valida y normaliza (username y correo en minúsculas, para que la unicidad no distinga mayúsculas). */
function normalize(data: UserData) {
  const dni = textRequired(data.dni, "El documento");
  if (!/^\d{8}$/.test(dni)) throw new UserError("El documento debe tener 8 dígitos");

  const email = textRequired(data.email, "El correo").toLowerCase();
  if (email.length > 80 || !RE_EMAIL.test(email)) throw new UserError("El correo no es válido");

  const username = textRequired(data.username, "El nombre de usuario").toLowerCase();
  if (!RE_USERNAME.test(username)) {
    throw new UserError("El usuario debe tener de 3 a 20 caracteres (letras, números, . _ -)");
  }

  // Convertir id_rol a número (acepta cadena o número)
  const roleId = Number(data.role_id);
  if (!Number.isInteger(roleId) || roleId <= 0) {
    throw new UserError("Selecciona un rol");
  }

  return {
    employee: {
      dni,
      first_name: textRequired(data.first_name, "El nombre"),
      middle_name: textOptional(data.middle_name),
      paternal_last_name: textRequired(data.paternal_last_name, "El apellido paterno"),
      maternal_last_name: textOptional(data.maternal_last_name),
    },
    username,
    email,
    role_id: roleId,
  };
}

/** Comprueba que usuario, correo y documento no estén tomados por otra persona. */
async function verifyDuplicates(
  db: Prisma.TransactionClient,
  d: { username: string; email: string; dni: string },
  excludeUser?: number,
  excludeEmployee?: number,
) {
  const byUser = await db.user.findFirst({
    where: {
      OR: [{ username: d.username }, { email: d.email }],
      ...(excludeUser ? { NOT: { id: excludeUser } } : {}),
    },
    select: { username: true },
  });
  if (byUser) {
    throw new UserError(
      byUser.username === d.username
        ? "Ya existe un usuario con ese nombre de usuario"
        : "Ya existe un usuario con ese correo",
      409,
    );
  }
  const byDni = await db.employee.findFirst({
    where: { dni: d.dni, ...(excludeEmployee ? { NOT: { id: excludeEmployee } } : {}) },
    select: { id: true },
  });
  if (byDni) throw new UserError("Ya existe un empleado con ese documento", 409);
}

/** Convierte la violación de unicidad de la BD (carrera entre dos altas) en un 409 legible. */
function translateError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new UserError("El usuario, correo o documento ya está registrado", 409);
  }
  throw e;
}

export async function listUsers(): Promise<UserRowDto[]> {
  const users = await prisma.user.findMany({
    include: { employee: true, role: true },
    orderBy: { id: "asc" },
  });
  return users.map(mapUserToDto);
}

export async function listRoles(): Promise<Array<{ role_id: number; name: string }>> {
  const roles = await prisma.role.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return roles.map((r) => ({ role_id: r.id, name: r.name }));
}

/** Registra empleado y usuario en una sola transacción. */
export async function createUser(data: UserData): Promise<UserRowDto> {
  const n = normalize(data);
  const password = textRequired(data.password, "La contraseña");
  validatePassword(password);
  const hash = await hashPassword(password);

  try {
    return await prisma.$transaction(async (tx) => {
      await verifyDuplicates(tx, { username: n.username, email: n.email, dni: n.employee.dni });
      const employee = await tx.employee.create({
        data: {
          dni: n.employee.dni,
          firstName: n.employee.first_name,
          middleName: n.employee.middle_name,
          paternalLastName: n.employee.paternal_last_name,
          maternalLastName: n.employee.maternal_last_name,
          active: true,
        },
      });
      const user = await tx.user.create({
        data: {
          employeeId: employee.id,
          roleId: n.role_id,
          username: n.username,
          email: n.email,
          password: hash,
          active: true,
        },
        include: { employee: true, role: true },
      });
      return mapUserToDto(user);
    });
  } catch (e) {
    return translateError(e);
  }
}

/** Modifica los datos del usuario y de su empleado; la contraseña solo cambia si se envía una nueva. */
export async function updateUser(userId: number, data: UserData): Promise<UserRowDto> {
  const n = normalize(data);
  let hash: string | undefined;
  if (data.password) {
    validatePassword(data.password);
    hash = await hashPassword(data.password);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await tx.user.findUnique({
        where: { id: userId },
        select: { employeeId: true },
      });
      if (!actual) throw new UserError("Usuario no encontrado", 404);

      await verifyDuplicates(
        tx,
        { username: n.username, email: n.email, dni: n.employee.dni },
        userId,
        actual.employeeId,
      );
      await tx.employee.update({
        where: { id: actual.employeeId },
        data: {
          dni: n.employee.dni,
          firstName: n.employee.first_name,
          middleName: n.employee.middle_name,
          paternalLastName: n.employee.paternal_last_name,
          maternalLastName: n.employee.maternal_last_name,
        },
      });
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          username: n.username,
          email: n.email,
          roleId: n.role_id,
          ...(hash ? { password: hash } : {}),
        },
        include: { employee: true, role: true },
      });
      return mapUserToDto(user);
    });
  } catch (e) {
    return translateError(e);
  }
}

export async function setUserActive(userId: number, active: boolean): Promise<UserRowDto> {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { active },
      include: { employee: true, role: true },
    });
    return mapUserToDto(user);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      throw new UserError("Usuario no encontrado", 404);
    }
    throw e;
  }
}

/**
 * Valida credenciales por usuario o correo. Un usuario desactivado no entra, y
 * el mensaje de "inactivo" solo se da con la contraseña correcta para no
 * revelar qué cuentas existen.
 */
export async function authenticate(identifier: string, password: string) {
  const id = identifier.trim().toLowerCase();
  const user = id
    ? await prisma.user.findFirst({
        where: { OR: [{ username: id }, { email: id }] },
        include: { role: true },
      })
    : null;

  const valid = await verifyPassword(password, user?.password ?? HASH_FILLER).catch(() => false);
  if (!user || !valid) throw new UserError("Usuario o contraseña incorrectos", 401);
  if (!user.active) throw new UserError("Tu usuario está desactivado. Contacta al administrador", 403);
  if (user.role.active === false) throw new UserError("Tu rol está desactivado. Contacta al administrador", 403);
  
  await prisma.user.update({
    where: { id: user.id },
    data: { lastAccessAt: new Date() },
  });
  return { userId: user.id, username: user.username, role: user.role.name };
}

/** ¿Sigue activo el usuario de la sesión? Permite que desactivar corte accesos ya abiertos. */
export async function activeUser(userId: number): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { active: true } });
  return u?.active === true;
}