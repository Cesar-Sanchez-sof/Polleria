import { NextResponse } from "next/server";
import { sesionActual } from "@/lib/auth/sesion-actual";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Obtener datos de la sesión del usuario actual
 */
export async function GET() {
  try {
    const sesion = await sesionActual().catch(() => null);
    if (!sesion) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.json({
      idUsuario: sesion.idUsuario,
      username: sesion.username,
      rol: sesion.rol,
    });
  } catch (error) {
    return NextResponse.json({ error: "Error al verificar sesión" }, { status: 500 });
  }
}
