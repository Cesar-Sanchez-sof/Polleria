import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { requestAdvance, type AdvanceData } from "@/lib/services/hr/benefits.service";
import { auditHr, badRequest, requireSelf } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/me/advances:
 *   post:
 *     tags:
 *       - Autoservicio
 *     summary: Solicitar un adelanto de sueldo (body { amount, installments, reason }) — hasta el 50 % del sueldo
 *     responses:
 *       201:
 *         description: Solicitud registrada
 */
export async function POST(request: NextRequest) {
  try {
    const self = await requireSelf();
    if (!self.ok) return self.response;
    const body = await readJson(request);
    if (!body) return badRequest();
    const adv = await requestAdvance(self.employeeId, body as unknown as AdvanceData);
    await auditHr(self.session, request, {
      action: "CREATE",
      module: "Beneficios",
      entity: "Adelanto",
      entityId: adv.advance_id,
      description: `Solicitó un adelanto de S/ ${adv.amount.toFixed(2)} en ${adv.installments} cuota(s)`,
      details: { after: { amount: adv.amount, installments: adv.installments, reason: adv.reason } },
    });
    return NextResponse.json(adv, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
