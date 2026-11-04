import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { cancelLeave, requestLeave, type LeaveData } from "@/lib/services/hr/leaves.service";
import { auditHr, badRequest, requireSelf } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/me/leaves:
 *   post:
 *     tags:
 *       - Autoservicio
 *     summary: Solicitar vacaciones (o su adelanto), licencia o permiso — queda pendiente de aprobación
 *     responses:
 *       201:
 *         description: Solicitud registrada
 *   patch:
 *     tags:
 *       - Autoservicio
 *     summary: Anular mi solicitud pendiente (body { leave_id })
 *     responses:
 *       200:
 *         description: Solicitud anulada
 */
export async function POST(request: NextRequest) {
  try {
    const self = await requireSelf();
    if (!self.ok) return self.response;
    const body = await readJson(request);
    if (!body) return badRequest();
    const { leave } = await requestLeave(self.employeeId, { ...(body as unknown as LeaveData), approve: false }, {
      userId: self.session.userId,
      selfService: true,
    });
    await auditHr(self.session, request, {
      action: "CREATE",
      module: "Vacaciones",
      entity: "Licencia",
      entityId: leave.leave_id,
      description: `Solicitó ${leave.type_label.toLowerCase()} del ${leave.start_date} al ${leave.end_date} (${leave.days} días)`,
      details: { after: { type: leave.type, days: leave.days, is_advance: leave.is_advance } },
    });
    return NextResponse.json(leave, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const self = await requireSelf();
    if (!self.ok) return self.response;
    const body = await readJson(request);
    const id = Number(body?.leave_id);
    if (!Number.isInteger(id) || id <= 0) return badRequest("Indica la solicitud");
    const leave = await cancelLeave(id, { userId: self.session.userId, selfService: true, employeeId: self.employeeId });
    await auditHr(self.session, request, {
      action: "STATUS_CHANGE",
      module: "Vacaciones",
      entity: "Licencia",
      entityId: id,
      description: `Anuló su solicitud de ${leave.type_label.toLowerCase()}`,
      details: { before: { status: "Pendiente" }, after: { status: "Anulada" } },
    });
    return NextResponse.json(leave);
  } catch (e) {
    return errorResponse(e);
  }
}
