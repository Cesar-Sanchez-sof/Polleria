import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { logAudit, requestIp } from "@/lib/services/audit.service";
import { listPayrollParameters, savePayrollParameter, type PayrollParameterInput } from "@/lib/services/payroll.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payroll/parameters:
 *   get:
 *     tags:
 *       - Planilla
 *     summary: Parámetros de planilla con su vigencia (RMV, ONP, AFP, EsSalud...)
 *     responses:
 *       200:
 *         description: Lista de parámetros
 *   post:
 *     tags:
 *       - Planilla
 *     summary: Cargar un valor de parámetro con su fecha de vigencia
 *     responses:
 *       200:
 *         description: Parámetro guardado
 *       400:
 *         description: Valor o fecha inválidos
 */
export async function GET() {
  try {
    const auth = await authorize("planilla.ver");
    if (!auth.ok) return auth.response;
    return NextResponse.json(await listPayrollParameters());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("planilla.editar");
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    if (!body) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

    const saved = await savePayrollParameter(body as unknown as PayrollParameterInput);
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "UPDATE",
      module: "Planilla",
      entity: "Parámetro de planilla",
      entityId: saved.parameter_id,
      description: `Cargó ${saved.label} = ${saved.value} desde ${saved.effective_from}`,
      details: { after: { code: saved.code, value: saved.value, effective_from: saved.effective_from } },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(saved);
  } catch (error) {
    return errorResponse(error);
  }
}
