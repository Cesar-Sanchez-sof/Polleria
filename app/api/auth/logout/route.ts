import { NextResponse } from "next/server";
import { COOKIE_SESION } from "@/lib/auth/session";

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
export async function POST() {
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.delete(COOKIE_SESION);
  return respuesta;
}