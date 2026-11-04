import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { createShiftTemplate, listShiftTemplates, type ShiftTemplateData } from "@/lib/services/hr/shift-templates.service";
import { auditHr, badRequest } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/shift-templates:
 *   get:
 *     tags:
 *       - Horarios
 *     summary: Turnos base con los que se pacta el horario de los contratos (active=true para solo activos)
 *     responses:
 *       200:
 *         description: Turnos base
 *   post:
 *     tags:
 *       - Horarios
 *     summary: Crear un turno base (name, start_time, end_time)
 *     responses:
 *       201:
 *         description: Turno creado
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize(["horarios.ver", "contratos.ver", "empleados.crear"]);
    if (!auth.ok) return auth.response;
    const onlyActive = new URL(request.url).searchParams.get("active") === "true";
    return NextResponse.json(await listShiftTemplates(onlyActive));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("horarios.crear");
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    if (!body) return badRequest();
    const t = await createShiftTemplate(body as unknown as ShiftTemplateData);
    await auditHr(auth.session, request, {
      action: "CREATE",
      module: "Horarios",
      entity: "TurnoBase",
      entityId: t.id,
      description: `Creó el turno base ${t.name} (${t.start_time}–${t.end_time})`,
      details: { after: { name: t.name, start_time: t.start_time, end_time: t.end_time } },
    });
    return NextResponse.json(t, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
