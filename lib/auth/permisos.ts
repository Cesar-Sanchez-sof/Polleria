import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { noAutorizado } from "@/lib/auth/respuestas";
import { sesionActual } from "@/lib/auth/sesion-actual";
import type { PayloadSesion } from "@/lib/auth/session";

export interface AccesoUsuario {
  /** Rol de sistema (ADMIN): tiene todos los permisos. */
  superusuario: boolean;
  codigos: string[];
}

/** Permisos vigentes del usuario, leídos de la BD (un cambio de rol aplica de inmediato). */
export async function permisosDeUsuario(idUsuario: number): Promise<AccesoUsuario> {
  const u = await prisma.user.findUnique({
    where: { id: idUsuario },
    select: {
      estado: true,
      role: {
        select: {
          active: true,
          isSystem: true,
          permissions: { select: { permission: { select: { code: true } } } },
        },
      },
    },
  });
  if (!u || !u.estado || !u.role.active) return { superusuario: false, codigos: [] };
  return {
    superusuario: u.role.isSystem,
    codigos: u.role.permissions.map((rp) => rp.permission.code),
  };
}

export function tienePermiso(acceso: AccesoUsuario, codigo: string): boolean {
  return acceso.superusuario || acceso.codigos.includes(codigo);
}

export type ResultadoAutorizacion =
  | { ok: true; sesion: PayloadSesion; superusuario: boolean }
  | { ok: false; respuesta: NextResponse };

/**
 * Para APIs: exige sesión válida y el permiso indicado (o, si se pasa una lista,
 * al menos uno de ellos).
 *
 *   const auth = await autorizar("usuarios.crear");
 *   if (!auth.ok) return auth.respuesta;   // 401 sin sesión, 403 sin permiso
 */
export async function autorizar(codigo: string | string[]): Promise<ResultadoAutorizacion> {
  const sesion = await sesionActual().catch(() => null);
  if (!sesion) return { ok: false, respuesta: noAutorizado() };
  const acceso = await permisosDeUsuario(sesion.idUsuario);
  const codigos = Array.isArray(codigo) ? codigo : [codigo];
  if (!codigos.some((c) => tienePermiso(acceso, c))) {
    return {
      ok: false,
      respuesta: NextResponse.json({ error: "No tienes permiso para realizar esta acción" }, { status: 403 }),
    };
  }
  return { ok: true, sesion, superusuario: acceso.superusuario };
}

/**
 * Para server actions (funciones "use server"): lanza un error si no hay sesión
 * o permiso. Se llama como primera línea de cada acción.
 */
export async function exigirPermiso(codigo: string | string[]): Promise<PayloadSesion> {
  const auth = await autorizar(codigo);
  if (!auth.ok) {
    throw new Error(auth.respuesta.status === 401 ? "No autenticado" : "No tienes permiso para realizar esta acción");
  }
  return auth.sesion;
}