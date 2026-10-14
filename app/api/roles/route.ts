import { NextRequest, NextResponse } from "next/server";
import { readJson, unauthorized, errorResponse } from "@/lib/auth/responses";
import { currentSession } from "@/lib/auth/current-session";
import { authorize } from "@/lib/auth/permissions";
import { logAudit, requestIp } from "@/lib/services/audit.service";
import { listRoles } from "@/lib/services/users.service";
import { createRole, listManagementRoles, type RoleData } from "@/lib/services/roles.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/roles:
 *   get:
 *     tags:
 *       - Roles
 *     summary: Listar roles activos (selector) o, con ?detalle=1, todos con sus permisos
 *     responses:
 *       200:
 *         description: Lista de roles
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permiso roles.ver (solo con detalle=1)
 *   post:
 *     tags:
 *       - Roles
 *     summary: Crear un rol con sus permisos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Rol creado
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: Sin permiso roles.crear
 *       409:
 *         description: Ya existe un rol con ese nombre
 */
export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get("detalle") === "1") {
      const auth = await authorize("roles.ver");
      if (!auth.ok) return auth.response;
      return NextResponse.json(await listManagementRoles());
    }

    const session = await currentSession().catch(() => null);
    if (!session) return unauthorized();
    return NextResponse.json(await listRoles());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("roles.crear");
    if (!auth.ok) return auth.response;

    const body = await readJson(request);
    if (!body) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

    const role = await createRole(body as unknown as RoleData);
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "CREATE",
      module: "Seguridad",
      entity: "Rol",
      entityId: role.role_id,
      description: `Creó el rol ${role.name}`,
      details: { after: { name: role.name, active: role.active, permissions: role.permissions } },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}