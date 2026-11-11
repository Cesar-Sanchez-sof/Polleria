import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/auth/responses";
import { currentSession } from "@/lib/auth/current-session";
import { satisfiesPermission } from "@/lib/auth/permissions-catalog";
import type { SessionPayload } from "@/lib/auth/session";
import { resolveWithAuthCache, primeAuthCache } from "@/lib/auth/auth-cache";

export interface AccessUser {
  /** Rol de sistema (ADMIN): tiene todos los permisos. */
  superuser: boolean;
  codes: string[];
}

/** Permisos vigentes del usuario, leídos de la BD con caché corto en memoria + singleflight. */
export async function permissionsForUser(userId: number): Promise<AccessUser> {
  return resolveWithAuthCache("permissions", userId, async () => {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        active: true,
        role: {
          select: {
            active: true,
            isSystem: true,
            permissions: { select: { permission: { select: { code: true } } } },
          },
        },
      },
    });
    const isActive = Boolean(u?.active);
    primeAuthCache("activeUser", userId, isActive);
    if (!u || !isActive || !u.role.active) return { superuser: false, codes: [] };
    return {
      superuser: u.role.isSystem,
      codes: u.role.permissions.map((rp) => rp.permission.code),
    };
  });
}

export function hasPermission(access: AccessUser, code: string): boolean {
  return access.superuser || satisfiesPermission(access.codes, code);
}

export type AuthorizationResult =
  | { ok: true; session: SessionPayload; superuser: boolean }
  | { ok: false; response: NextResponse };

/**
 * Para APIs: exige sesión válida y el permiso indicado (o, si se pasa una lista,
 * al menos uno de ellos).
 *
 *   const auth = await autorizar("usuarios.crear");
 *   if (!auth.ok) return auth.respuesta;   // 401 sin sesión, 403 sin permiso
 */
export async function authorize(code: string | string[]): Promise<AuthorizationResult> {
  const session = await currentSession().catch(() => null);
  if (!session) return { ok: false, response: unauthorized() };
  const access = await permissionsForUser(session.userId);
  const codes = Array.isArray(code) ? code : [code];
  if (!codes.some((c) => hasPermission(access, c))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No tienes permiso para realizar esta acción" }, { status: 403 }),
    };
  }
  return { ok: true, session, superuser: access.superuser };
}

/**
 * Para server actions (funciones "use server"): lanza un error si no hay sesión
 * o permiso. Se llama como primera línea de cada acción.
 */
export async function requirePermission(code: string | string[]): Promise<SessionPayload> {
  const auth = await authorize(code);
  if (!auth.ok) {
    throw new Error(auth.response.status === 401 ? "No autenticado" : "No tienes permiso para realizar esta acción");
  }
  return auth.session;
}
