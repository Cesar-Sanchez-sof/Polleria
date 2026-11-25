import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { listDashboardOptions } from "@/lib/services/security/roles.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/roles/dashboards:
 *   get:
 *     tags:
 *       - Roles
 *     summary: Listar los tableros disponibles para asignar a un rol
 *     responses:
 *       200:
 *         description: Tableros con su sección
 *       403:
 *         description: Sin permiso roles.ver
 */
export async function GET() {
  try {
    const auth = await authorize("roles.ver");
    if (!auth.ok) return auth.response;
    return NextResponse.json(await listDashboardOptions());
  } catch (error) {
    return errorResponse(error);
  }
}
