import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErrorUsuario } from "@/lib/services/usuarios.service";
import { CODIGOS_VALIDOS, MODULOS_PERMISOS } from "@/lib/auth/catalogo-permisos";

export interface RolGestionDto {
  id_rol: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  es_sistema: boolean;
  total_usuarios: number;
  permisos: string[];
}

export interface DatosRol {
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
  permisos: string[];
}

const RE_NOMBRE = /^[A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 _-]{2,49}$/;

const INCLUIR_ROL = {
  _count: { select: { users: true } },
  permissions: { select: { permission: { select: { code: true } } } },
} satisfies Prisma.RoleInclude;

type RolConRelaciones = Prisma.RoleGetPayload<{ include: typeof INCLUIR_ROL }>;

function mapear(r: RolConRelaciones): RolGestionDto {
  return {
    id_rol: r.id,
    nombre: r.name,
    descripcion: r.description,
    activo: r.active,
    es_sistema: r.isSystem,
    total_usuarios: r._count.users,
    permisos: r.permissions.map((rp) => rp.permission.code).sort(),
  };
}

function normalizar(d: DatosRol) {
  const nombre = typeof d.nombre === "string" ? d.nombre.trim().replace(/\s+/g, " ").toUpperCase() : "";
  if (!RE_NOMBRE.test(nombre)) {
    throw new ErrorUsuario("El nombre del rol debe tener de 3 a 50 caracteres (letras, números, espacio, _ -)");
  }
  const descripcion = typeof d.descripcion === "string" ? d.descripcion.trim() : "";
  if (descripcion.length > 150) throw new ErrorUsuario("La descripción no puede superar 150 caracteres");
  if (!Array.isArray(d.permisos)) throw new ErrorUsuario("Los permisos deben enviarse como una lista");

  const permisos = new Set<string>();
  for (const c of d.permisos) {
    if (typeof c !== "string" || !CODIGOS_VALIDOS.has(c)) throw new ErrorUsuario(`Permiso desconocido: ${String(c)}`);
    permisos.add(c);
  }
  // Quien puede crear/editar/eliminar en un módulo necesita poder verlo.
  for (const m of MODULOS_PERMISOS) {
    if (m.acciones.some((a) => a !== "ver" && permisos.has(`${m.codigo}.${a}`))) permisos.add(`${m.codigo}.ver`);
  }
  return { nombre, descripcion: descripcion || null, activo: d.activo !== false, permisos: [...permisos] };
}

function traducirError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new ErrorUsuario("Ya existe un rol con ese nombre", 409);
  }
  throw e;
}

async function asignarPermisos(tx: Prisma.TransactionClient, roleId: number, codigos: string[]) {
  const filas = await tx.permission.findMany({ where: { code: { in: codigos } }, select: { id: true } });
  if (filas.length !== codigos.length) {
    throw new ErrorUsuario("El catálogo de permisos no está sincronizado. Ejecuta el seed (npm run db:seed)", 500);
  }
  await tx.rolePermission.deleteMany({ where: { roleId } });
  if (filas.length) {
    await tx.rolePermission.createMany({ data: filas.map((f) => ({ roleId, permissionId: f.id })) });
  }
}

export async function listarRolesGestion(): Promise<RolGestionDto[]> {
  const roles = await prisma.role.findMany({ include: INCLUIR_ROL, orderBy: [{ isSystem: "desc" }, { name: "asc" }] });
  return roles.map(mapear);
}

export async function obtenerRol(id: number): Promise<RolGestionDto> {
  const rol = await prisma.role.findUnique({ where: { id }, include: INCLUIR_ROL });
  if (!rol) throw new ErrorUsuario("Rol no encontrado", 404);
  return mapear(rol);
}

export async function crearRol(datos: DatosRol): Promise<RolGestionDto> {
  const n = normalizar(datos);
  try {
    const id = await prisma.$transaction(async (tx) => {
      const rol = await tx.role.create({
        data: { name: n.nombre, description: n.descripcion, active: n.activo },
        select: { id: true },
      });
      await asignarPermisos(tx, rol.id, n.permisos);
      return rol.id;
    });
    return await obtenerRol(id);
  } catch (e) {
    return traducirError(e);
  }
}

export async function actualizarRol(id: number, datos: DatosRol): Promise<RolGestionDto> {
  const n = normalizar(datos);
  try {
    await prisma.$transaction(async (tx) => {
      const actual = await tx.role.findUnique({
        where: { id },
        select: { name: true, isSystem: true, _count: { select: { users: true } } },
      });
      if (!actual) throw new ErrorUsuario("Rol no encontrado", 404);

      if (actual.isSystem) {
        // Rol de sistema: solo se puede cambiar la descripción.
        if (n.nombre !== actual.name || !n.activo) {
          throw new ErrorUsuario("Un rol de sistema no se puede renombrar ni desactivar", 400);
        }
        await tx.role.update({ where: { id }, data: { description: n.descripcion } });
        return;
      }
      if (!n.activo && actual._count.users > 0) {
        throw new ErrorUsuario(
          `No se puede desactivar: tiene ${actual._count.users} usuario(s) asignado(s). Reasígnalos primero`,
          409,
        );
      }
      await tx.role.update({ where: { id }, data: { name: n.nombre, description: n.descripcion, active: n.activo } });
      await asignarPermisos(tx, id, n.permisos);
    });
    return await obtenerRol(id);
  } catch (e) {
    return traducirError(e);
  }
}

export async function eliminarRol(id: number): Promise<RolGestionDto> {
  const rol = await prisma.role.findUnique({ where: { id }, include: INCLUIR_ROL });
  if (!rol) throw new ErrorUsuario("Rol no encontrado", 404);
  if (rol.isSystem) throw new ErrorUsuario("Un rol de sistema no se puede eliminar", 400);
  if (rol._count.users > 0) {
    throw new ErrorUsuario(
      `No se puede eliminar: tiene ${rol._count.users} usuario(s) asignado(s). Reasígnalos primero`,
      409,
    );
  }
  await prisma.role.delete({ where: { id } }); // role_permission se borra en cascada
  return mapear(rol);
}

/** El rol existe, está activo y, si es de sistema, solo lo asigna un administrador. */
export async function verificarRolAsignable(idRol: unknown, esSuperusuario: boolean): Promise<void> {
  const id = Number(idRol);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorUsuario("Selecciona un rol");
  const rol = await prisma.role.findUnique({ where: { id }, select: { active: true, isSystem: true } });
  if (!rol || !rol.active) throw new ErrorUsuario("El rol seleccionado no existe o está inactivo");
  if (rol.isSystem && !esSuperusuario) {
    throw new ErrorUsuario("Solo un administrador puede asignar un rol de sistema", 403);
  }
}

/** Solo un administrador puede modificar a otro administrador (evita tomar su cuenta). */
export async function verificarUsuarioModificable(idUsuario: number, esSuperusuario: boolean): Promise<void> {
  if (esSuperusuario) return;
  const u = await prisma.user.findUnique({ where: { id: idUsuario }, select: { role: { select: { isSystem: true } } } });
  if (u?.role.isSystem) throw new ErrorUsuario("Solo un administrador puede modificar a un administrador", 403);
}