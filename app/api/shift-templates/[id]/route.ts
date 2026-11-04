import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { setShiftTemplateActive, updateShiftTemplate, type ShiftTemplateData } from "@/lib/services/hr/shift-templates.service";
import { auditHr, badRequest, routeId, type IdContext } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/shift-templates/{id}:
 *   put:
 *     tags:
 *       - Horarios
 *     summary: Editar un turno base (sus horas no cambian si lo usan contratos vigentes)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Turno actualizado
 *   patch:
 *     tags:
 *       - Horarios
 *     summary: Activar o desactivar un turno base (body { active })
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
export async function PUT(request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize("horarios.editar");
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    const body = await readJson(request);
    if (!id || !body) return badRequest();
    const t = await updateShiftTemplate(id, body as unknown as ShiftTemplateData);
    await auditHr(auth.session, request, {
      action: "UPDATE",
      module: "Horarios",
      entity: "TurnoBase",
      entityId: id,
      description: `Modificó el turno base ${t.name}`,
      details: { after: { name: t.name, start_time: t.start_time, end_time: t.end_time } },
    });
    return NextResponse.json(t);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize("horarios.editar");
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    const body = await readJson(request);
    if (!id || typeof body?.active !== "boolean") return badRequest("Indica el estado (true/false)");
    const t = await setShiftTemplateActive(id, body.active);
    await auditHr(auth.session, request, {
      action: "STATUS_CHANGE",
      module: "Horarios",
      entity: "TurnoBase",
      entityId: id,
      description: `${body.active ? "Activó" : "Desactivó"} el turno base ${t.name}`,
      details: { before: { active: !body.active }, after: { active: body.active } },
    });
    return NextResponse.json(t);
  } catch (e) {
    return errorResponse(e);
  }
}
