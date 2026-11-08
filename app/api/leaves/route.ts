import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { listLeaves, requestLeave, vacationBalanceOf, type LeaveData } from "@/lib/services/hr/leaves.service";
import { auditHr, badRequest, optionalInt } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/leaves:
 *   get:
 *     tags:
 *       - Vacaciones y permisos
 *     summary: Listar solicitudes (filtros employee_id, status, type, from, to). Con ?balance_of={id} devuelve el saldo de vacaciones
 *     responses:
 *       200:
 *         description: Solicitudes o saldo
 *   post:
 *     tags:
 *       - Vacaciones y permisos
 *     summary: Registrar vacaciones, licencia o permiso (body { employee_id, type, start_date, end_date, reason, document_ref, advance, approve })
 *     responses:
 *       201:
 *         description: Solicitud registrada
 *       409:
 *         description: Se cruza con otra solicitud
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("vacaciones.ver");
    if (!auth.ok) return auth.response;
    const sp = new URL(request.url).searchParams;
    const balanceOf = optionalInt(sp.get("balance_of"));
    if (balanceOf) return NextResponse.json(await vacationBalanceOf(balanceOf));
    return NextResponse.json(
      await listLeaves({
        employee_id: optionalInt(sp.get("employee_id")),
        status: sp.get("status"),
        type: sp.get("type"),
        from: sp.get("from"),
        to: sp.get("to"),
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("vacaciones.crear");
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    const employeeId = Number(body?.employee_id);
    if (!body || !Number.isInteger(employeeId) || employeeId <= 0) return badRequest("Indica el empleado");

    // Registrar ya aprobada equivale a aprobar: exige también el permiso de aprobación.
    if (body.approve === true) {
      const approver = await authorize("vacaciones.editar");
      if (!approver.ok) return approver.response;
    }
    const { leave, shifts_released } = await requestLeave(employeeId, body as unknown as LeaveData, {
      userId: auth.session.userId,
      selfService: false,
    });
    await auditHr(auth.session, request, {
      action: "CREATE",
      module: "Vacaciones",
      entity: "Licencia",
      entityId: leave.leave_id,
      description: `Registró ${leave.type_label.toLowerCase()} de ${leave.employee_name} (${leave.start_date} al ${leave.end_date}, ${leave.days} días)${leave.status === "Aprobada" ? " ya aprobada" : ""}`,
      details: {
        after: { type: leave.type, days: leave.days, is_advance: leave.is_advance, status: leave.status, document_ref: leave.document_ref },
        shifts_released,
      },
    });
    return NextResponse.json({ ...leave, shifts_released }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
