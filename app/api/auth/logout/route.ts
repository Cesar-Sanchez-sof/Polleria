import { NextResponse } from "next/server";
import { SESSION_COOKIE, COOKIE_OPTIONS } from "@/lib/auth/session";
import { currentActor } from "@/lib/auth/audit-actor";
import { logAudit, requestIp } from "@/lib/services/audit.service";

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
  const actor = await currentActor();
  if (actor) {
    await logAudit({
      actor,
      action: "LOGOUT",
      module: "Seguridad",
      entity: "Sesión",
      entityId: actor.userId,
      description: `Cierre de sesión de ${actor.username}`,
      ipAddress: requestIp(request),
    });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.set(SESSION_COOKIE, "", {
    ...COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}