import { NextResponse } from "next/server";
import { noAutorizado, respuestaError } from "@/lib/auth/respuestas";
import { sesionActual } from "@/lib/auth/sesion-actual";
import { listarRoles } from "@/lib/services/usuarios.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/roles:
 *   get:
 *     tags:
 *       - Usuarios
 *     summary: Listar roles activos del sistema
 */
export async function GET() {
  try {
    const sesion = await sesionActual().catch(() => null);
    if (!sesion) return noAutorizado();

    const roles = await listarRoles();
    return NextResponse.json(roles);
  } catch (error) {
    return respuestaError(error);
  }
}
