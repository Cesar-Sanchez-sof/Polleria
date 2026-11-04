import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { createInsurance, listInsurances, type InsuranceData } from "@/lib/services/hr/benefits.service";
import { auditHr, badRequest, optionalInt } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/insurances:
 *   get:
 *     tags:
 *       - Seguros y adelantos
 *     summary: Seguros del personal (filtros employee_id, type)
 *     responses:
 *       200:
 *         description: Seguros con su vigencia
 *   post:
 *     tags:
 *       - Seguros y adelantos
 *     summary: Registrar un seguro (EsSalud, EPS, SCTR, Vida Ley, privado)
 *     responses:
 *       201:
 *         description: Seguro registrado
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("seguros.ver");
    if (!auth.ok) return auth.response;
    const sp = new URL(request.url).searchParams;
    return NextResponse.json(await listInsurances({ employee_id: optionalInt(sp.get("employee_id")), type: sp.get("type") }));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("seguros.crear");
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    const employeeId = Number(body?.employee_id);
    if (!body || !Number.isInteger(employeeId) || employeeId <= 0) return badRequest("Indica el empleado");
    const ins = await createInsurance(employeeId, body as unknown as InsuranceData);
    await auditHr(auth.session, request, {
      action: "CREATE",
      module: "Beneficios",
      entity: "Seguro",
      entityId: ins.insurance_id,
      description: `Registró ${ins.type_label} de ${ins.employee_name} (${ins.provider})`,
      details: { after: { type: ins.type, provider: ins.provider, policy_number: ins.policy_number, monthly_cost: ins.monthly_cost } },
    });
    return NextResponse.json(ins, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
