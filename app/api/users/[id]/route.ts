import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { verifyAssignableRole, verifyModifiableUser } from "@/lib/services/roles.service";
import { logAudit, requestIp } from "@/lib/services/audit.service";
import { updateUser, setUserActive, type UserData } from "@/lib/services/users.service";

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

type Context = { params: Promise<{ id: string }> };

async function readId(ctx: Context): Promise<number | null> {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Modifica los datos del usuario. */
export async function PUT(request: NextRequest, ctx: Context) {
  const auth = await authorize("usuarios.editar");
  if (!auth.ok) return auth.response;
  const session = auth.session;
  const id = await readId(ctx);
  const body = await readJson(request);
  if (!id || !body) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  try {
    // Solo un administrador puede tocar a otro administrador o asignar un rol de sistema.
    await verifyModifiableUser(id, auth.superuser);
    await verifyAssignableRole(body.role_id, auth.superuser);
    const updated = await updateUser(id, { ...body, role_id: Number(body.role_id) } as UserData);
    await logAudit({
      actor: { userId: session.userId, username: session.username },
      action: "UPDATE",
      module: "Usuarios",
      entity: "Usuario",
      entityId: id,
      description: `Modificó el usuario ${updated.username}`,
      details: {
        after: { username: updated.username, email: updated.email, role: updated.role.name },
        passwordChanged: Boolean(body.password),
      },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}

/** Activa o desactiva: body `{ "estado": boolean }`. */
export async function PATCH(request: NextRequest, ctx: Context) {
  const auth = await authorize("usuarios.editar");
  if (!auth.ok) return auth.response;
  const session = auth.session;
  const id = await readId(ctx);
  const body = await readJson(request);
  if (!id || typeof body?.active !== "boolean") {
    return NextResponse.json({ error: "Indica el estado (true/false)" }, { status: 400 });
  }
  if (id === session.userId && !body.active) {
    return NextResponse.json({ error: "No puedes desactivar tu propio usuario" }, { status: 400 });
  }
  try {
    await verifyModifiableUser(id, auth.superuser);
    const updated = await setUserActive(id, body.active);
    await logAudit({
      actor: { userId: session.userId, username: session.username },
      action: "STATUS_CHANGE",
      module: "Usuarios",
      entity: "Usuario",
      entityId: id,
      description: `${body.active ? "Activó" : "Desactivó"} al usuario ${updated.username}`,
      details: { before: { active: !body.active }, after: { active: body.active } },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}