import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { logAudit, requestIp } from "@/lib/services/security/audit.service";
import { grantAccess, type AccessData } from "@/lib/services/hr/access.service";
import { badRequest, routeId, type IdContext } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/employees/{id}/access:
 *   post:
 *     tags:
 *       - Empleados
 *     summary: Dar acceso al sistema a un empleado sin usuario (body { username, email, role_id, password })
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Usuario creado y vinculado al empleado
 *       409:
 *         description: El empleado ya tiene usuario, o el usuario o correo ya existen
 */
export async function POST(request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize("usuarios.crear");
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    const body = await readJson(request);
    if (!id || !body) return badRequest();
    const user = await grantAccess(id, body as unknown as AccessData, auth.superuser);
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "CREATE",
      module: "Usuarios",
      entity: "Usuario",
      entityId: user.user_id,
      description: `Dio acceso al sistema al empleado #${id} con el usuario ${user.username} (${user.role})`,
      details: { after: { username: user.username, email: user.email, role: user.role, employee_id: id } },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
