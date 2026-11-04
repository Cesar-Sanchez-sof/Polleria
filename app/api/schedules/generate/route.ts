import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { generateWeekFromContracts } from "@/lib/services/schedules.service";
import { auditHr, badRequest } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/schedules/generate:
 *   post:
 *     tags:
 *       - Horarios
 *     summary: Programar la semana desde el horario pactado en los contratos (body { monday YYYY-MM-DD })
 *     responses:
 *       200:
 *         description: Horarios creados, asignaciones hechas y las omitidas con su motivo
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("horarios.crear");
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    if (typeof body?.monday !== "string") return badRequest("Indica el lunes de la semana");
    const result = await generateWeekFromContracts(body.monday);
    await auditHr(auth.session, request, {
      action: "CREATE",
      module: "Horarios",
      entity: "Semana",
      entityId: result.from,
      description: `Programó la semana del ${result.from} al ${result.to} desde los contratos (${result.assignments} asignaciones)`,
      details: { after: { shifts_created: result.shifts_created, assignments: result.assignments, skipped: result.skipped.length } },
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
