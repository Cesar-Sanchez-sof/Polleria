import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { calculatePayrollPeriod, findPayrollPeriod, listPayrollPeriods } from "@/lib/services/hr/payroll.service";
import { auditHr, badRequest } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payroll:
 *   get:
 *     tags:
 *       - Planilla
 *     summary: Planilla de un mes (?year&month) con sus boletas y asientos, o el historial de planillas sin parámetros
 *     responses:
 *       200:
 *         description: Planilla o historial
 *   post:
 *     tags:
 *       - Planilla
 *     summary: Calcular o recalcular la planilla de un mes en borrador (body { year, month })
 *     responses:
 *       200:
 *         description: Planilla calculada
 *       400:
 *         description: Mes futuro o planilla ya aprobada
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("planilla.ver");
    if (!auth.ok) return auth.response;
    const sp = new URL(request.url).searchParams;
    if (sp.get("year") && sp.get("month")) {
      return NextResponse.json(await findPayrollPeriod(sp.get("year"), sp.get("month")));
    }
    return NextResponse.json(await listPayrollPeriods());
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("planilla.crear");
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    if (!body) return badRequest();
    const period = await calculatePayrollPeriod(body.year, body.month);
    await auditHr(auth.session, request, {
      action: "UPDATE",
      module: "Planilla",
      entity: "Planilla",
      entityId: period.period_id,
      description: `Calculó la planilla de ${period.label} (${period.workers} trabajadores, neto S/ ${period.total_net.toFixed(2)})`,
      details: { after: { gross: period.total_gross, deductions: period.total_deductions, net: period.total_net, employer: period.total_employer } },
    });
    return NextResponse.json(period);
  } catch (e) {
    return errorResponse(e);
  }
}
