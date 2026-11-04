import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { approvePayrollPeriod, getPayrollPeriod, payPayrollPeriod, reopenPayrollPeriod } from "@/lib/services/hr/payroll.service";
import { auditHr, badRequest, routeId, type IdContext } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payroll/{id}:
 *   get:
 *     tags:
 *       - Planilla
 *     summary: Planilla con sus boletas y asientos contables
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Planilla
 *   patch:
 *     tags:
 *       - Planilla
 *     summary: Aprobar (asiento de devengo), pagar (asiento de pago y descuento de adelantos) o reabrir (anula el devengo) — body { action approve|pay|reopen, payment_method, payment_date, reason }
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Planilla actualizada
 */
export async function GET(_request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize("planilla.ver");
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    if (!id) return badRequest();
    return NextResponse.json(await getPayrollPeriod(id));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize("planilla.editar");
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    const body = await readJson(request);
    if (!id || !body) return badRequest();
    const actor = { userId: auth.session.userId, username: auth.session.username };

    let period;
    let description: string;
    if (body.action === "approve") {
      period = await approvePayrollPeriod(id, actor);
      description = `Aprobó la planilla de ${period.label} y registró el asiento de devengo (S/ ${period.total_gross.toFixed(2)})`;
    } else if (body.action === "pay") {
      period = await payPayrollPeriod(id, body, actor);
      description = `Pagó la planilla de ${period.label} por ${period.payment_method} (neto S/ ${period.total_net.toFixed(2)})`;
    } else if (body.action === "reopen") {
      period = await reopenPayrollPeriod(id, body.reason);
      description = `Reabrió la planilla de ${period.label} y anuló su asiento de devengo: ${String(body.reason)}`;
    } else {
      return badRequest("Acción no válida");
    }
    await auditHr(auth.session, request, {
      action: "STATUS_CHANGE",
      module: "Planilla",
      entity: "Planilla",
      entityId: id,
      description,
      details: { after: { status: period.status, journal_entries: period.journal_entries.map((j) => j.code) } },
    });
    return NextResponse.json(period);
  } catch (e) {
    return errorResponse(e);
  }
}
