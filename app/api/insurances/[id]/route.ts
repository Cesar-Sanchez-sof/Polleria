import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { getInsurance, setInsuranceActive, updateInsurance, type InsuranceData, type InsuranceDto } from "@/lib/services/hr/benefits.service";
import { auditHr, badRequest, routeId, type IdContext } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/insurances/{id}:
 *   put:
 *     tags:
 *       - Seguros y adelantos
 *     summary: Editar un seguro
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Seguro actualizado
 *   patch:
 *     tags:
 *       - Seguros y adelantos
 *     summary: Activar o dar de baja un seguro (body { active })
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
const snapshot = (i: InsuranceDto) => ({
  type: i.type,
  provider: i.provider,
  policy_number: i.policy_number,
  start_date: i.start_date,
  end_date: i.end_date,
  monthly_cost: i.monthly_cost,
});

export async function PUT(request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize("seguros.editar");
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    const body = await readJson(request);
    if (!id || !body) return badRequest();
    const before = await getInsurance(id);
    const ins = await updateInsurance(id, body as unknown as InsuranceData);
    await auditHr(auth.session, request, {
      action: "UPDATE",
      module: "Beneficios",
      entity: "Seguro",
      entityId: id,
      description: `Modificó ${ins.type_label} de ${ins.employee_name}`,
      details: { before: snapshot(before), after: snapshot(ins) },
    });
    return NextResponse.json(ins);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize("seguros.editar");
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    const body = await readJson(request);
    if (!id || typeof body?.active !== "boolean") return badRequest("Indica el estado (true/false)");
    const ins = await setInsuranceActive(id, body.active);
    await auditHr(auth.session, request, {
      action: "STATUS_CHANGE",
      module: "Beneficios",
      entity: "Seguro",
      entityId: id,
      description: `${body.active ? "Reactivó" : "Dio de baja"} ${ins.type_label} de ${ins.employee_name}`,
      details: { before: { active: !body.active }, after: { active: body.active } },
    });
    return NextResponse.json(ins);
  } catch (e) {
    return errorResponse(e);
  }
}
