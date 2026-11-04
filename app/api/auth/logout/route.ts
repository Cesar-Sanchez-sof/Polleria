import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import { currentActor } from "@/lib/auth/audit-actor";
import { requestIp } from "@/lib/services/audit.service";
import { logoutUser } from "@/lib/services/auth.service";

export const dynamic = "force-dynamic";

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
export const POST = createApiHandler({
  handler: async ({ req }) => {
    const actor = await currentActor();
    const result = await logoutUser(actor, requestIp(req));

    const response = NextResponse.json({ ok: result.ok });
    for (const cookie of result.cookiesToClear) {
      response.cookies.delete(cookie.name);
      response.cookies.set(cookie.name, "", cookie.options);
    }
    return response;
  },
});
