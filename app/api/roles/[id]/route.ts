import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { logAudit, requestIp } from "@/lib/services/audit.service";
import { updateRole, deleteRole, getRole, type RoleData } from "@/lib/services/roles.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/roles/{id}:
 *   get:
 *     tags:
 *       - Roles
 *     summary: Obtener un rol con sus permisos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rol
 *       404:
 *         description: Rol no encontrado
 *   put:
 *     tags:
 *       - Roles
 *     summary: Modificar un rol y sus permisos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rol actualizado
 *       409:
 *         description: Nombre duplicado o rol con usuarios asignados
 *   delete:
 *     tags:
 *       - Roles
 *     summary: Eliminar un rol (bloqueado si es de sistema o tiene usuarios)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rol eliminado
 *       409:
 *         description: El rol tiene usuarios asignados
 */
type Context = { params: Promise<{ id: string }> };

async function readId(ctx: Context): Promise<number | null> {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const INVALID_REQUEST = () => NextResponse.json({ error: "Petición inválida" }, { status: 400 });

export async function GET(_request: NextRequest, ctx: Context) {
  try {
    const auth = await authorize("roles.ver");
    if (!auth.ok) return auth.response;
    const id = await readId(ctx);
    if (!id) return INVALID_REQUEST();
    return NextResponse.json(await getRole(id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest, ctx: Context) {
  try {
    const auth = await authorize("roles.editar");
    if (!auth.ok) return auth.response;
    const id = await readId(ctx);
    const body = await readJson(request);
    if (!id || !body) return INVALID_REQUEST();

    const before = await getRole(id);
    const role = await updateRole(id, body as unknown as RoleData);
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "UPDATE",
      module: "Seguridad",
      entity: "Rol",
      entityId: id,
      description: `Modificó el rol ${role.name}`,
      details: {
        before: { name: before.name, active: before.active, permissions: before.permissions },
        after: { name: role.name, active: role.active, permissions: role.permissions },
      },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(role);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, ctx: Context) {
  try {
    const auth = await authorize("roles.eliminar");
    if (!auth.ok) return auth.response;
    const id = await readId(ctx);
    if (!id) return INVALID_REQUEST();

    const role = await deleteRole(id);
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "DELETE",
      module: "Seguridad",
      entity: "Rol",
      entityId: id,
      description: `Eliminó el rol ${role.name}`,
      details: { before: { name: role.name, permissions: role.permissions } },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(role);
  } catch (error) {
    return errorResponse(error);
  }
}