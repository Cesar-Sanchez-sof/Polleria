import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/security/users.service";
import { VALID_CODES, PERMISSION_MODULES } from "@/lib/auth/permissions-catalog";
import { invalidateAuthCache } from "@/lib/auth/auth-cache";

export interface RoleManagementDto {
  role_id: number;
  name: string;
  description: string | null;
  active: boolean;
  is_system: boolean;
  total_users: number;
  permissions: string[];
  /** Acceso del rol a tableros (dashboards) concretos. */
  dashboards: DashboardAccessEntry[];
}

export interface DashboardAccessEntry {
  dashboard_id: string;
  can_view: boolean;
  can_edit: boolean;
}

export interface DashboardOption {
  dashboard_id: string;
  name: string;
  section: string;
}

export interface RoleData {
  name: string;
  description?: string | null;
  active?: boolean;
  permissions: string[];
  /** Si se omite, el acceso a tableros del rol no se toca. */
  dashboards?: DashboardAccessEntry[];
}

const RE_NAME = /^[A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 _-]{2,49}$/;

const INCLUDE_ROLE = {
  _count: { select: { users: true } },
  permissions: { select: { permission: { select: { code: true } } } },
  dashboardAccess: { select: { dashboardId: true, canView: true, canEdit: true } },
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
    dashboards: r.dashboardAccess.map((a) => ({
      dashboard_id: a.dashboardId,
      can_view: a.canView || a.canEdit,
      can_edit: a.canEdit,
    })),
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
  let dashboards: DashboardAccessEntry[] | undefined;
  if (d.dashboards !== undefined) {
    if (!Array.isArray(d.dashboards)) throw new UserError("El acceso a tableros debe enviarse como una lista");
    const seen = new Map<string, DashboardAccessEntry>();
    for (const e of d.dashboards) {
      if (!e || typeof e.dashboard_id !== "string" || !e.dashboard_id) throw new UserError("Tablero inválido en el acceso del rol");
      const can_edit = e.can_edit === true;
      const can_view = can_edit || e.can_view === true; // editar implica ver
      if (can_view) seen.set(e.dashboard_id, { dashboard_id: e.dashboard_id, can_view, can_edit });
    }
    dashboards = [...seen.values()];
  }
  return { name, description: description || null, active: d.active !== false, permissions: [...permissions], dashboards };
}

/** Reemplaza el acceso del rol a tableros por el conjunto indicado. */
async function assignDashboardAccess(tx: Prisma.TransactionClient, roleId: number, entries: DashboardAccessEntry[]) {
  const ids = entries.map((e) => e.dashboard_id);
  if (ids.length) {
    const found = await tx.dashboard.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new UserError("Alguno de los tableros seleccionados ya no existe", 400);
  }
  await tx.dashboardRoleAccess.deleteMany({ where: { roleId } });
  if (entries.length) {
    await tx.dashboardRoleAccess.createMany({
      data: entries.map((e) => ({ roleId, dashboardId: e.dashboard_id, canView: e.can_view, canEdit: e.can_edit })),
    });
  }
}

/** Tableros existentes, para elegir a cuáles accede un rol. */
export async function listDashboardOptions(): Promise<DashboardOption[]> {
  const rows = await prisma.dashboard.findMany({
    select: { id: true, name: true, section: { select: { name: true, order: true } } },
    orderBy: [{ section: { order: "asc" } }, { name: "asc" }],
  });
  return rows.map((d) => ({ dashboard_id: d.id, name: d.name, section: d.section.name }));
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
      if (n.dashboards) await assignDashboardAccess(tx, role.id, n.dashboards);
      return role.id;
    });
    invalidateAuthCache();
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
        return; // el rol de sistema ve y edita todos los tableros por definición
      }
      if (!n.active && actual._count.users > 0) {
        throw new UserError(
          `No se puede desactivar: tiene ${actual._count.users} usuario(s) asignado(s). Reasígnalos primero`,
          409,
        );
      }
      await tx.role.update({ where: { id }, data: { name: n.name, description: n.description, active: n.active } });
      await assignPermissions(tx, id, n.permissions);
      if (n.dashboards) await assignDashboardAccess(tx, id, n.dashboards);
    });
    invalidateAuthCache();
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
  invalidateAuthCache();
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