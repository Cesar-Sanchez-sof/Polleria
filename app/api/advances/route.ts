import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { advanceLimitOf, listAdvances, requestAdvance, type AdvanceData } from "@/lib/services/hr/benefits.service";
import { auditHr, badRequest, optionalInt } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/advances:
 *   get:
 *     tags:
 *       - Seguros y adelantos
 *     summary: Adelantos de sueldo (filtros employee_id, status). Con ?limit_of={id} devuelve el tope disponible
 *     responses:
 *       200:
 *         description: Adelantos o tope
 *   post:
 *     tags:
 *       - Seguros y adelantos
 *     summary: Registrar una solicitud de adelanto (body { employee_id, amount, installments, reason })
 *     responses:
 *       201:
 *         description: Adelanto solicitado
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("anticipos.ver");
    if (!auth.ok) return auth.response;
    const sp = new URL(request.url).searchParams;
    const limitOf = optionalInt(sp.get("limit_of"));
    if (limitOf) return NextResponse.json(await advanceLimitOf(limitOf));
    return NextResponse.json(await listAdvances({ employee_id: optionalInt(sp.get("employee_id")), status: sp.get("status") }));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("anticipos.crear");
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    const employeeId = Number(body?.employee_id);
    if (!body || !Number.isInteger(employeeId) || employeeId <= 0) return badRequest("Indica el empleado");
    const adv = await requestAdvance(employeeId, body as unknown as AdvanceData);
    await auditHr(auth.session, request, {
      action: "CREATE",
      module: "Beneficios",
      entity: "Adelanto",
      entityId: adv.advance_id,
      description: `Registró un adelanto de S/ ${adv.amount.toFixed(2)} para ${adv.employee_name} en ${adv.installments} cuota(s)`,
      details: { after: { amount: adv.amount, installments: adv.installments, reason: adv.reason } },
    });
    return NextResponse.json(adv, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
