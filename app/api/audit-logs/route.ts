import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/http/route-handler";
import { listAuditLogsService } from "@/lib/services/security/audit.service";

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
 *         description: Sin permisos o no administrador
 */
export const GET = createApiHandler({
  permission: "auditoria.ver",
  handler: async ({ searchParams, session }) => {
    const filters = {
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      user: searchParams.get("user"),
      action: searchParams.get("action"),
      module: searchParams.get("module"),
      q: searchParams.get("q"),
      page: Number(searchParams.get("page")) || 1,
      perPage: Number(searchParams.get("perPage")) || 20,
    };

    const result = await listAuditLogsService(filters, session?.role);
    return NextResponse.json(result);
  },
});
