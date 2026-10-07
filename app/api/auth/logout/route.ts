import { NextResponse } from "next/server";
import { COOKIE_SESION } from "@/lib/auth/session";
import { actorActual } from "@/lib/auth/actor-auditoria";
import { registrarAuditoria, ipDeSolicitud } from "@/lib/services/audit.service";

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Cerrar sesión de usuario
 *     description: Elimina la cookie de sesión y devuelve confirmación.
 *     responses:
 *       200:
 *         description: Cierre de sesión exitoso.
 */
export async function POST(request: Request) {
  const actor = await actorActual();
  if (actor) {
    await registrarAuditoria({
      actor,
      action: "LOGOUT",
      module: "Seguridad",
      entity: "Sesión",
      entityId: actor.userId,
      description: `Cierre de sesión de ${actor.username}`,
      ipAddress: ipDeSolicitud(request),
    });
  }
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.delete(COOKIE_SESION);
  return respuesta;
}