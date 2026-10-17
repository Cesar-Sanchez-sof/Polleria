import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/users.service";
import { VALID_CODES, PERMISSION_MODULES } from "@/lib/auth/permissions-catalog";

export interface RoleManagementDto {
  role_id: number;
  name: string;
  description: string | null;
  active: boolean;
  is_system: boolean;
  total_users: number;
  permissions: string[];
}

export interface RoleData {
  name: string;
  description?: string | null;
  active?: boolean;
  permissions: string[];
}

const RE_NAME = /^[A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 _-]{2,49}$/;

const INCLUDE_ROLE = {
  _count: { select: { users: true } },
  permissions: { select: { permission: { select: { code: true } } } },
} satisfies Prisma.RoleInclude;

type RoleWithRelations = Prisma.RoleGetPayload<{ include: typeof INCLUDE_ROLE }>;

function map(r: RoleWithRelations): RoleManagementDto {
  return {
    role_id: r.id,
    name: r.name,
    description: r.description,
    active: r.active,
    is_system: r.isSystem,
    total_users: r._count.users,
    permissions: r.permissions.map((rp) => rp.permission.code).sort(),
  };
}

function normalize(d: RoleData) {
  const name = typeof d.name === "string" ? d.name.trim().replace(/\s+/g, " ").toUpperCase() : "";
  if (!RE_NAME.test(name)) {
    throw new UserError("El nombre del rol debe tener de 3 a 50 caracteres (letras, números, espacio, _ -)");
  }
  const description = typeof d.description === "string" ? d.description.trim() : "";
  if (description.length > 150) throw new UserError("La descripción no puede superar 150 caracteres");
  if (!Array.isArray(d.permissions)) throw new UserError("Los permisos deben enviarse como una lista");

  const permissions = new Set<string>();
  for (const c of d.permissions) {
    if (typeof c !== "string" || !VALID_CODES.has(c)) throw new UserError(`Permiso desconocido: ${String(c)}`);
    permissions.add(c);
  }
  // Quien puede crear/editar/eliminar en un módulo necesita poder verlo.
  for (const m of PERMISSION_MODULES) {
    if (m.actions.some((a) => a !== "ver" && permissions.has(`${m.code}.${a}`))) permissions.add(`${m.code}.ver`);
  }
  return { name, description: description || null, active: d.active !== false, permissions: [...permissions] };
}

function translateError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new UserError("Ya existe un rol con ese nombre", 409);
  }
  throw e;
}

async function assignPermissions(tx: Prisma.TransactionClient, roleId: number, codes: string[]) {
  const rows = await tx.permission.findMany({ where: { code: { in: codes } }, select: { id: true } });
  if (rows.length !== codes.length) {
    throw new UserError("El catálogo de permisos no está sincronizado. Ejecuta el seed (npm run db:seed)", 500);
  }
  await tx.rolePermission.deleteMany({ where: { roleId } });
  if (rows.length) {
    await tx.rolePermission.createMany({ data: rows.map((f) => ({ roleId, permissionId: f.id })) });
  }
}

export async function listManagementRoles(): Promise<RoleManagementDto[]> {
  const roles = await prisma.role.findMany({ include: INCLUDE_ROLE, orderBy: [{ isSystem: "desc" }, { name: "asc" }] });
  return roles.map(map);
}

export async function getRole(id: number): Promise<RoleManagementDto> {
  const role = await prisma.role.findUnique({ where: { id }, include: INCLUDE_ROLE });
  if (!role) throw new UserError("Rol no encontrado", 404);
  return map(role);
}

export async function createRole(data: RoleData): Promise<RoleManagementDto> {
  const n = normalize(data);
  try {
    const id = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: { name: n.name, description: n.description, active: n.active },
        select: { id: true },
      });
      await assignPermissions(tx, role.id, n.permissions);
      return role.id;
    });
    return await getRole(id);
  } catch (e) {
    return translateError(e);
  }
}

export async function updateRole(id: number, data: RoleData): Promise<RoleManagementDto> {
  const n = normalize(data);
  try {
    await prisma.$transaction(async (tx) => {
      const actual = await tx.role.findUnique({
        where: { id },
        select: { name: true, isSystem: true, _count: { select: { users: true } } },
      });
      if (!actual) throw new UserError("Rol no encontrado", 404);

      if (actual.isSystem) {
        // Rol de sistema: solo se puede cambiar la descripción.
        if (n.name !== actual.name || !n.active) {
          throw new UserError("Un rol de sistema no se puede renombrar ni desactivar", 400);
        }
        await tx.role.update({ where: { id }, data: { description: n.description } });
        return;
      }
      if (!n.active && actual._count.users > 0) {
        throw new UserError(
          `No se puede desactivar: tiene ${actual._count.users} usuario(s) asignado(s). Reasígnalos primero`,
          409,
        );
      }
      await tx.role.update({ where: { id }, data: { name: n.name, description: n.description, active: n.active } });
      await assignPermissions(tx, id, n.permissions);
    });
    return await getRole(id);
  } catch (e) {
    return translateError(e);
  }
}

export async function deleteRole(id: number): Promise<RoleManagementDto> {
  const role = await prisma.role.findUnique({ where: { id }, include: INCLUDE_ROLE });
  if (!role) throw new UserError("Rol no encontrado", 404);
  if (role.isSystem) throw new UserError("Un rol de sistema no se puede eliminar", 400);
  if (role._count.users > 0) {
    throw new UserError(
      `No se puede eliminar: tiene ${role._count.users} usuario(s) asignado(s). Reasígnalos primero`,
      409,
    );
  }
  await prisma.role.delete({ where: { id } }); // role_permission se borra en cascada
  return map(role);
}

/** El rol existe, está activo y, si es de sistema, solo lo asigna un administrador. */
export async function verifyAssignableRole(roleId: unknown, isSuperuser: boolean): Promise<void> {
  const id = Number(roleId);
  if (!Number.isInteger(id) || id <= 0) throw new UserError("Selecciona un rol");
  const role = await prisma.role.findUnique({ where: { id }, select: { active: true, isSystem: true } });
  if (!role || !role.active) throw new UserError("El rol seleccionado no existe o está inactivo");
  if (role.isSystem && !isSuperuser) {
    throw new UserError("Solo un administrador puede asignar un rol de sistema", 403);
  }
}

/** Solo un administrador puede modificar a otro administrador (evita tomar su cuenta). */
export async function verifyModifiableUser(userId: number, isSuperuser: boolean): Promise<void> {
  if (isSuperuser) return;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: { select: { isSystem: true } } } });
  if (u?.role.isSystem) throw new UserError("Solo un administrador puede modificar a un administrador", 403);
}