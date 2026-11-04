import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { updateAdvance, type AdvanceAction } from "@/lib/services/hr/benefits.service";
import { employeeIdOfUser } from "@/lib/services/employees.service";
import { auditHr, badRequest, routeId, type IdContext } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/advances/{id}:
 *   patch:
 *     tags:
 *       - Seguros y adelantos
 *     summary: Aprobar, rechazar, entregar, registrar descuento o anular (body { action approve|reject|pay|deduct|cancel, ... })
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Adelanto actualizado
 */
const VERB: Record<string, string> = {
  approve: "Aprobó",
  reject: "Rechazó",
  pay: "Entregó",
  deduct: "Registró un descuento del",
  cancel: "Anuló",
};

export async function PATCH(request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize("anticipos.editar");
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    const body = await readJson(request);
    if (!id || !body || typeof body.action !== "string" || !(body.action in VERB)) return badRequest("Acción no válida");

    const { advance, before } = await updateAdvance(
      id,
      body as unknown as AdvanceAction,
      auth.session.userId,
      await employeeIdOfUser(auth.session.userId),
    );
    await auditHr(auth.session, request, {
      action: body.action === "deduct" ? "UPDATE" : "STATUS_CHANGE",
      module: "Beneficios",
      entity: "Adelanto",
      entityId: id,
      description: `${VERB[body.action]} adelanto de S/ ${advance.amount.toFixed(2)} de ${advance.employee_name}`,
      details: {
        before: { status: before },
        after: { status: advance.status, deducted_amount: advance.deducted_amount, payment_method: advance.payment_method, note: advance.review_note },
      },
    });
    return NextResponse.json(advance);
  } catch (e) {
    return errorResponse(e);
  }
}
