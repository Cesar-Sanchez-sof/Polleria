import { NextResponse } from "next/server";
import { sesionActual } from "@/lib/auth/sesion-actual";
import { permisosDeUsuario } from "@/lib/auth/permisos";

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
    const sesion = await sesionActual().catch(() => null);
    if (!sesion) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const acceso = await permisosDeUsuario(sesion.idUsuario);
    return NextResponse.json({
      idUsuario: sesion.idUsuario,
      username: sesion.username,
      rol: sesion.rol,
      superusuario: acceso.superusuario,
      permisos: acceso.codigos,
    });
  } catch {
    return NextResponse.json({ error: "Error al verificar sesión" }, { status: 500 });
  }
}