import { NextResponse } from "next/server";
import { createApiHandler, ValidationError } from "@/lib/http/route-handler";
import { requestIp } from "@/lib/services/audit.service";
import {
  updateUserWithAudit,
  setUserActiveWithAudit,
  type UserData,
} from "@/lib/services/users.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     tags:
 *       - Usuarios
 *     summary: Actualizar datos del usuario
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UsuarioUpdate'
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente
 *       400:
 *         description: Petición inválida
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permiso usuarios.editar
 *   patch:
 *     tags:
 *       - Usuarios
 *     summary: Cambiar estado del usuario
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               active:
 *                 type: boolean
 *                 description: Nuevo estado activo del usuario
 *     responses:
 *       200:
 *         description: Estado del usuario actualizado
 *       400:
 *         description: Petición inválida
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permiso usuarios.editar
 */

export const PUT = createApiHandler<UserData, { id: string }>({
  permission: "usuarios.editar",
  handler: async ({ body, params, session, superuser, req }) => {
    const id = Number(params?.id);
    if (!Number.isInteger(id) || id <= 0 || !body) {
      throw new ValidationError("Petición inválida");
    }

    const actor = session ? { userId: session.userId, username: session.username } : null;
    const updated = await updateUserWithAudit({
      id,
      data: { ...body, role_id: Number(body.role_id) },
      actor,
      superuser,
      ipAddress: requestIp(req),
    });

    return NextResponse.json(updated);
  },
});

export const PATCH = createApiHandler<{ active?: unknown }, { id: string }>({
  permission: "usuarios.editar",
  handler: async ({ body, params, session, superuser, req }) => {
    const id = Number(params?.id);
    if (!Number.isInteger(id) || id <= 0 || typeof body?.active !== "boolean") {
      throw new ValidationError("Indica el estado (true/false)");
    }

    const actor = session ? { userId: session.userId, username: session.username } : null;
    const updated = await setUserActiveWithAudit({
      id,
      active: body.active,
      actor,
      superuser,
      ipAddress: requestIp(req),
    });

    return NextResponse.json(updated);
  },
});
