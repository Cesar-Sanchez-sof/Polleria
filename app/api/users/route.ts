import { NextResponse } from "next/server";
import { createApiHandler, ValidationError } from "@/lib/http/route-handler";
import { requestIp } from "@/lib/services/audit.service";
import {
  listUsers,
  createUserWithAudit,
  type UserData,
} from "@/lib/services/users.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags:
 *       - Usuarios
 *     summary: Listar todos los usuarios del sistema
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permiso usuarios.ver
 *   post:
 *     tags:
 *       - Usuarios
 *     summary: Crear un nuevo usuario y empleado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permiso usuarios.crear
 */
export const GET = createApiHandler({
  permission: "usuarios.ver",
  handler: async () => {
    const users = await listUsers();
    return NextResponse.json(users);
  },
});

export const POST = createApiHandler<UserData>({
  permission: "usuarios.crear",
  handler: async ({ body, session, superuser, req }) => {
    if (!body) {
      throw new ValidationError("Cuerpo de solicitud inválido");
    }

    const actor = session ? { userId: session.userId, username: session.username } : null;
    const newUser = await createUserWithAudit({
      data: body,
      actor,
      superuser,
      ipAddress: requestIp(req),
    });

    return NextResponse.json(newUser, { status: 201 });
  },
});
