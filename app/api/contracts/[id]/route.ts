import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import {
  getContract,
  renewContract,
  terminateContract,
  updateContract,
  type ContractData,
  type ContractDto,
  type TerminationData,
} from "@/lib/services/hr/contracts.service";
import { employeeIdOfUser, verifyModifiableEmployee } from "@/lib/services/hr/employees.service";
import { auditHr, badRequest, routeId, type IdContext } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/contracts/{id}:
 *   get:
 *     tags:
 *       - Contratos
 *     summary: Consultar un contrato
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contrato
 *   put:
 *     tags:
 *       - Contratos
 *     summary: Adenda — modificar cargo, sueldo, fechas u horario de un contrato vigente
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contrato actualizado
 *   post:
 *     tags:
 *       - Contratos
 *     summary: Renovar (body { action "renew", ...contrato }) o cesar (body { action "terminate", termination_date, reason, kind })
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Operación realizada
 */
const snapshot = (c: ContractDto) => ({
  contract_type: c.contract_type,
  position: c.position,
  area: c.area,
  base_salary: c.base_salary,
  start_date: c.start_date,
  end_date: c.end_date,
  weekly_hours: c.weekly_hours,
  status: c.status,
});

export async function GET(_request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize(["contratos.ver", "empleados.ver"]);
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    if (!id) return badRequest();
    return NextResponse.json(await getContract(id));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize("contratos.editar");
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    const body = await readJson(request);
    if (!id || !body) return badRequest();

    const before = await getContract(id);
    await verifyModifiableEmployee(before.employee_id, auth.superuser);
    const updated = await updateContract(id, body as unknown as ContractData);
    await auditHr(auth.session, request, {
      action: "UPDATE",
      module: "Contratos",
      entity: "Contrato",
      entityId: id,
      description: `Registró una adenda al contrato de ${updated.employee_name}`,
      details: { before: snapshot(before), after: snapshot(updated) },
    });
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest, ctx: IdContext) {
  try {
    const id = await routeId(ctx);
    const body = await readJson(request);
    if (!id || !body) return badRequest();

    if (body.action === "renew") {
      const auth = await authorize("contratos.crear");
      if (!auth.ok) return auth.response;
      const before = await getContract(id);
      await verifyModifiableEmployee(before.employee_id, auth.superuser);
      const renewed = await renewContract(id, body as unknown as ContractData, auth.session.userId);
      await auditHr(auth.session, request, {
        action: "CREATE",
        module: "Contratos",
        entity: "Contrato",
        entityId: renewed.contract_id,
        description: `Renovó el contrato de ${renewed.employee_name} desde el ${renewed.start_date}`,
        details: { before: { contract_id: id, ...snapshot(before) }, after: snapshot(renewed) },
      });
      return NextResponse.json(renewed);
    }

    if (body.action === "terminate") {
      const auth = await authorize("contratos.editar");
      if (!auth.ok) return auth.response;
      const before = await getContract(id);
      if ((await employeeIdOfUser(auth.session.userId)) === before.employee_id) {
        return badRequest("No puedes registrar tu propio cese");
      }
      await verifyModifiableEmployee(before.employee_id, auth.superuser);
      const result = await terminateContract(id, body as unknown as TerminationData);
      await auditHr(auth.session, request, {
        action: "STATUS_CHANGE",
        module: "Contratos",
        entity: "Contrato",
        entityId: id,
        description: `Registró el cese de ${before.employee_name} (${result.contract.status.toLowerCase()}) al ${result.contract.termination_date}`,
        details: {
          before: { status: before.status, end_date: before.end_date },
          after: {
            status: result.contract.status,
            termination_date: result.contract.termination_date,
            reason: result.contract.termination_reason,
          },
          users_deactivated: result.users_deactivated,
          shifts_removed: result.shifts_removed,
        },
      });
      return NextResponse.json(result);
    }

    return badRequest("Acción no válida");
  } catch (e) {
    return errorResponse(e);
  }
}
