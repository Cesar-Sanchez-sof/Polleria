import { NextRequest, NextResponse } from "next/server";
import { noAutorizado, respuestaError } from "@/lib/auth/respuestas";
import { sesionActual } from "@/lib/auth/sesion-actual";
import { listarAuditoria, MODULOS_AUDITORIA, ACCIONES_AUDITORIA } from "@/lib/services/audit.service";

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
 *         name: desde
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: hasta
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: usuario
 *         schema: { type: string }
 *       - in: query
 *         name: accion
 *         schema: { type: string, enum: [CREATE, UPDATE, DELETE, STATUS_CHANGE, LOGIN, LOGIN_FAILED, LOGOUT] }
 *       - in: query
 *         name: modulo
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: pagina
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: porPagina
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
  try {
    const sesion = await sesionActual().catch(() => null);
    if (!sesion) return noAutorizado();
    if (!["ADMIN", "ADMINISTRADOR"].includes(sesion.rol.toUpperCase())) {
      return NextResponse.json({ error: "Solo un administrador puede ver la auditoría" }, { status: 403 });
    }

    const p = request.nextUrl.searchParams;
    const resultado = await listarAuditoria({
      desde: p.get("desde"),
      hasta: p.get("hasta"),
      usuario: p.get("usuario"),
      accion: p.get("accion"),
      modulo: p.get("modulo"),
      q: p.get("q"),
      pagina: Number(p.get("pagina")) || 1,
      porPagina: Number(p.get("porPagina")) || 20,
    });
    return NextResponse.json({ ...resultado, modulos: MODULOS_AUDITORIA, acciones: ACCIONES_AUDITORIA });
  } catch (error) {
    return respuestaError(error);
  }
}