import { NextResponse } from "next/server";
import { firmarSesion, COOKIE_SESION, OPCIONES_COOKIE } from "@/lib/auth/session";
import { leerJson, respuestaError } from "@/lib/auth/respuestas";
import { autenticar, ErrorUsuario } from "@/lib/services/usuarios.service";
import { registrarAuditoria, ipDeSolicitud } from "@/lib/services/audit.service";

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
  const cuerpo = await leerJson(request);
  const username = typeof cuerpo?.username === "string" ? cuerpo.username.trim() : "";
  const password = typeof cuerpo?.password === "string" ? cuerpo.password : "";
  if (!username || !password) {
    return NextResponse.json({ error: "Usuario y contraseña son obligatorios" }, { status: 400 });
  }

  const ip = ipDeSolicitud(request);
  try {
    const sesion = await autenticar(username, password);
    const token = await firmarSesion(sesion);

    await registrarAuditoria({
      actor: { userId: sesion.idUsuario, username: sesion.username },
      action: "LOGIN",
      module: "Seguridad",
      entity: "Sesión",
      entityId: sesion.idUsuario,
      description: `Inicio de sesión de ${sesion.username}`,
      ipAddress: ip,
    });

    const respuesta = NextResponse.json({ idUsuario: sesion.idUsuario, username: sesion.username, rol: sesion.rol });
    respuesta.cookies.set(COOKIE_SESION, token, OPCIONES_COOKIE);
    // Compatibilidad: algunas rutas antiguas (períodos contables) aún leen esta cookie.
    respuesta.cookies.set("auth-token", token, OPCIONES_COOKIE);
    return respuesta;
  } catch (e) {
    if (e instanceof ErrorUsuario) {
      await registrarAuditoria({
        actor: { userId: null, username },
        action: "LOGIN_FAILED",
        module: "Seguridad",
        entity: "Sesión",
        description: `Intento de inicio de sesión fallido para "${username}"`,
        details: { motivo: e.message },
        ipAddress: ip,
      });
    }
    return respuestaError(e);
  }
}