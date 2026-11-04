import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import { requestIp } from "@/lib/services/audit.service";
import { loginWithCredentials } from "@/lib/services/auth.service";

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
export const POST = createApiHandler<{ username?: string; password?: string }>({
  handler: async ({ body, req }) => {
    const result = await loginWithCredentials({
      username: body?.username,
      password: body?.password,
      ipAddress: requestIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    const response = NextResponse.json({ ...result.user, attendance: result.attendance }, { status: 200 });
    response.cookies.set(result.cookieName, result.token, result.cookieOptions);
    return response;
  },
});
