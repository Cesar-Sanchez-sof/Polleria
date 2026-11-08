import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { createContract, listContracts, type ContractData } from "@/lib/services/hr/contracts.service";
import { verifyModifiableEmployee } from "@/lib/services/hr/employees.service";
import { auditHr, badRequest, optionalInt } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/contracts:
 *   get:
 *     tags:
 *       - Contratos
 *     summary: Listar contratos (filtros employee_id, status=Vigente|Historial, q)
 *     responses:
 *       200:
 *         description: Contratos con su horario pactado y estado (vigente, por vencer, vencido…)
 *   post:
 *     tags:
 *       - Contratos
 *     summary: Registrar un contrato para un empleado existente (reingreso o nuevo contrato tras un cese)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Contrato creado
 *       409:
 *         description: Ya tiene un contrato vigente en ese periodo
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize(["contratos.ver", "empleados.ver"]);
    if (!auth.ok) return auth.response;
    const sp = new URL(request.url).searchParams;
    const status = sp.get("status");
    return NextResponse.json(
      await listContracts({
        employee_id: optionalInt(sp.get("employee_id")),
        status: status === "Vigente" || status === "Historial" ? status : null,
        q: sp.get("q"),
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("contratos.crear");
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    const employeeId = Number(body?.employee_id);
    if (!body || !Number.isInteger(employeeId) || employeeId <= 0) return badRequest("Indica el empleado");

    await verifyModifiableEmployee(employeeId, auth.superuser);
    const contract = await createContract(employeeId, body as unknown as ContractData, auth.session.userId);
    await auditHr(auth.session, request, {
      action: "CREATE",
      module: "Contratos",
      entity: "Contrato",
      entityId: contract.contract_id,
      description: `Registró un contrato de ${contract.contract_type_label.toLowerCase()} para ${contract.employee_name}`,
      details: {
        after: {
          employee_id: employeeId,
          position: contract.position,
          base_salary: contract.base_salary,
          start_date: contract.start_date,
          end_date: contract.end_date,
          weekly_hours: contract.weekly_hours,
        },
      },
    });
    return NextResponse.json(contract, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
