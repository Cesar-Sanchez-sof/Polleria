import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { updatePayrollLine } from "@/lib/services/hr/payroll.service";
import { auditHr, badRequest, routeId, type IdContext } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payroll/lines/{id}:
 *   put:
 *     tags:
 *       - Planilla
 *     summary: Ajustar una boleta en borrador (body { bonus, other_deductions, notes }) y recalcular la planilla
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Planilla recalculada
 */
export async function PUT(request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize("planilla.crear");
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    const body = await readJson(request);
    if (!id || !body) return badRequest();
    const period = await updatePayrollLine(id, body);
    const line = period.lines.find((l) => l.payroll_id === id);
    await auditHr(auth.session, request, {
      action: "UPDATE",
      module: "Planilla",
      entity: "Boleta",
      entityId: id,
      description: `Ajustó la boleta de ${line?.employee_name ?? `#${id}`} en la planilla de ${period.label}`,
      details: { after: { bonus: line?.bonus, other_deductions: line?.other_deductions, notes: line?.notes, net: line?.net_pay } },
    });
    return NextResponse.json(period);
  } catch (e) {
    return errorResponse(e);
  }
}
