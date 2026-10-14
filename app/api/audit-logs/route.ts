import { NextRequest, NextResponse } from "next/server";
import { unauthorized, errorResponse } from "@/lib/auth/responses";
import { currentSession } from "@/lib/auth/current-session";
import { listAudit, AUDIT_MODULES, AUDIT_ACTIONS } from "@/lib/services/audit.service";
import { authorize } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/audit-logs:
 *   get:
 *     tags:
 *       - Auditoria
 *     summary: Listar logs de auditoría
 *     description: Devuelve la bitácora paginada (más recientes primero). Solo rol ADMIN.
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: user
 *         schema: { type: string }
 *       - in: query
 *         name: action
 *         schema: { type: string, enum: [CREATE, UPDATE, DELETE, STATUS_CHANGE, LOGIN, LOGIN_FAILED, LOGOUT] }
 *       - in: query
 *         name: module
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: perPage
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Página de registros de auditoría
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permisos
 */
export async function GET(request: NextRequest) {
  const auth = await authorize("auditoria.ver");
  if (!auth.ok) return auth.response;
  try {
    const session = await currentSession().catch(() => null);
    if (!session) return unauthorized();
    if (!["ADMIN", "ADMINISTRADOR"].includes(session.role.toUpperCase())) {
      return NextResponse.json({ error: "Solo un administrador puede ver la auditoría" }, { status: 403 });
    }

    const p = request.nextUrl.searchParams;
    const result = await listAudit({
      from: p.get("from"),
      to: p.get("to"),
      user: p.get("user"),
      action: p.get("action"),
      module: p.get("module"),
      q: p.get("q"),
      page: Number(p.get("page")) || 1,
      perPage: Number(p.get("perPage")) || 20,
    });
    return NextResponse.json({ ...result, modules: AUDIT_MODULES, actions: AUDIT_ACTIONS });
  } catch (error) {
    return errorResponse(error);
  }
}