import { NextResponse } from "next/server";
import { signSession, SESSION_COOKIE, COOKIE_OPTIONS } from "@/lib/auth/session";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authenticate, UserError } from "@/lib/services/users.service";
import { logAudit, requestIp } from "@/lib/services/audit.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Iniciar sesión de usuario
 *     description: Verifica credenciales (usuario o correo) y crea la cookie de sesión firmada.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso.
 *       400:
 *         description: Falta username o password.
 *       401:
 *         description: Credenciales inválidas.
 *       403:
 *         description: Usuario desactivado.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ error: "Usuario y contraseña son obligatorios" }, { status: 400 });
  }

  const ip = requestIp(request);
  try {
    const session = await authenticate(username, password);
    const token = await signSession(session);

    await logAudit({
      actor: { userId: session.userId, username: session.username },
      action: "LOGIN",
      module: "Seguridad",
      entity: "Sesión",
      entityId: session.userId,
      description: `Inicio de sesión de ${session.username}`,
      ipAddress: ip,
    });

    const response = NextResponse.json({ userId: session.userId, username: session.username, role: session.role });
    response.cookies.set(SESSION_COOKIE, token, COOKIE_OPTIONS);
    // Compatibilidad: algunas rutas antiguas (períodos contables) aún leen esta cookie.
    response.cookies.set("auth-token", token, COOKIE_OPTIONS);
    return response;
  } catch (e) {
    if (e instanceof UserError) {
      await logAudit({
        actor: { userId: null, username },
        action: "LOGIN_FAILED",
        module: "Seguridad",
        entity: "Sesión",
        description: `Intento de inicio de sesión fallido para "${username}"`,
        details: { reason: e.message },
        ipAddress: ip,
      });
    }
    return errorResponse(e);
  }
}