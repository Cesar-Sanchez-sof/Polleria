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
 * Para APIs: exige sesión válida y el permiso indicado.
 *
 *   const auth = await autorizar("usuarios.crear");
 *   if (!auth.ok) return auth.respuesta;   // 401 sin sesión, 403 sin permiso
 */
export async function autorizar(codigo: string): Promise<ResultadoAutorizacion> {
  const sesion = await sesionActual().catch(() => null);
  if (!sesion) return { ok: false, respuesta: noAutorizado() };
  const acceso = await permisosDeUsuario(sesion.idUsuario);
  if (!tienePermiso(acceso, codigo)) {
    return {
      ok: false,
      respuesta: NextResponse.json({ error: "No tienes permiso para realizar esta acción" }, { status: 403 }),
    };
  }
  return { ok: true, sesion, superusuario: acceso.superusuario };
}