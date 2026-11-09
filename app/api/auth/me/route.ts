import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import { getCurrentUserProfile } from "@/lib/services/security/auth.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Obtener datos de la sesión del usuario actual
 *     description: Incluye los permisos vigentes del rol (`permisos`) y si es administrador (`superusuario`).
 *     responses:
 *       200:
 *         description: Datos de sesión y permisos
 *       401:
 *         description: No autenticado
 */
export const GET = createApiHandler({
  requireAuth: true,
  handler: async ({ session }) => {
    const profile = await getCurrentUserProfile(session);
    return NextResponse.json(profile);
  },
});
