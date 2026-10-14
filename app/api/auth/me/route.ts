import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/current-session";
import { permissionsForUser } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Obtener datos de la sesión del usuario actual
 *     description: Incluye los permisos vigentes del rol (`permisos`) y si es administrador (`superusuario`).
 */
export async function GET() {
  try {
    const session = await currentSession().catch(() => null);
    if (!session) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const access = await permissionsForUser(session.userId);
    return NextResponse.json({
      userId: session.userId,
      username: session.username,
      role: session.role,
      superuser: access.superuser,
      permissions: access.codes,
    });
  } catch {
    return NextResponse.json({ error: "Error al verificar sesión" }, { status: 500 });
  }
}