import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { UserError, validatePassword } from "@/lib/services/users.service";
import { verifyAssignableRole } from "@/lib/services/roles.service";

/**
 * Acceso al sistema de un trabajador: su usuario se crea al contratarlo (o después, desde su
 * ficha) y queda vinculado a su registro de empleado. Con ese usuario marca asistencia al
 * iniciar sesión y usa «Mi horario y asistencia». Mismas reglas que Seguridad → Usuarios.
 */
export interface AccessData {
  username: string;
  email: string;
  role_id: number | string;
  password: string;
}

export interface AccessDto {
  user_id: number;
  username: string;
  email: string | null;
  role: string;
}

const RE_USERNAME = /^[a-z0-9._-]{3,20}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida los datos de acceso (sin tocar la BD) y devuelve la contraseña ya cifrada. */
export async function prepareAccess(data: AccessData, isSuperuser: boolean) {
  const username = typeof data?.username === "string" ? data.username.trim().toLowerCase() : "";
  if (!RE_USERNAME.test(username)) {
    throw new UserError("El usuario debe tener de 3 a 20 caracteres: minúsculas, números, punto, guion o guion bajo");
  }
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!email || email.length > 80 || !RE_EMAIL.test(email)) throw new UserError("El correo del usuario no es válido");
  const password = typeof data.password === "string" ? data.password : "";
  validatePassword(password);
  await verifyAssignableRole(data.role_id, isSuperuser);
  return { username, email, roleId: Number(data.role_id), password: await hashPassword(password) };
}

/** Crea el usuario del empleado dentro de la transacción (un empleado tiene un solo usuario). */
export async function createAccessTx(
  tx: Prisma.TransactionClient,
  employeeId: number,
  access: Awaited<ReturnType<typeof prepareAccess>>,
): Promise<AccessDto> {
  const existing = await tx.user.findFirst({ where: { employeeId }, select: { username: true } });
  if (existing) throw new UserError(`El trabajador ya tiene el usuario «${existing.username}»`, 409);
  const dup = await tx.user.findFirst({
    where: { OR: [{ username: access.username }, { email: access.email }] },
    select: { username: true },
  });
  if (dup) {
    throw new UserError(dup.username === access.username ? "Ya existe un usuario con ese nombre de usuario" : "Ya existe un usuario con ese correo", 409);
  }
  const user = await tx.user.create({
    data: { employeeId, roleId: access.roleId, username: access.username, email: access.email, password: access.password, active: true },
    select: { id: true, username: true, email: true, role: { select: { name: true } } },
  });
  return { user_id: user.id, username: user.username, email: user.email, role: user.role.name };
}

/** Da acceso al sistema a un empleado ya registrado (que no tenga usuario). */
export async function grantAccess(employeeId: number, data: AccessData, isSuperuser: boolean): Promise<AccessDto> {
  const access = await prepareAccess(data, isSuperuser);
  return prisma.$transaction(async (tx) => {
    const e = await tx.employee.findUnique({ where: { id: employeeId }, select: { active: true } });
    if (!e) throw new UserError("Empleado no encontrado", 404);
    if (!e.active) throw new UserError("El empleado está cesado: regístrale un contrato antes de darle acceso");
    return createAccessTx(tx, employeeId, access);
  });
}
