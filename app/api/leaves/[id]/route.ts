import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { cancelLeave, getLeave, reviewLeave } from "@/lib/services/hr/leaves.service";
import { employeeIdOfUser } from "@/lib/services/hr/employees.service";
import { auditHr, badRequest, routeId, type IdContext } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/leaves/{id}:
 *   patch:
 *     tags:
 *       - Vacaciones y permisos
 *     summary: Aprobar, rechazar o anular una solicitud (body { action approve|reject|cancel, note })
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Solicitud actualizada
 */
export async function PATCH(request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize("vacaciones.editar");
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    const body = await readJson(request);
    if (!id || !body) return badRequest();

    const before = await getLeave(id);
    if (body.action === "approve" || body.action === "reject") {
      // Segregación de funciones: nadie aprueba sus propias vacaciones.
      if ((await employeeIdOfUser(auth.session.userId)) === before.employee_id) {
        return badRequest("No puedes revisar tus propias solicitudes");
      }
      const { leave, shifts_released } = await reviewLeave(id, body.action, body.note, auth.session.userId);
      await auditHr(auth.session, request, {
        action: "STATUS_CHANGE",
        module: "Vacaciones",
        entity: "Licencia",
        entityId: id,
        description: `${body.action === "approve" ? "Aprobó" : "Rechazó"} ${leave.type_label.toLowerCase()} de ${leave.employee_name} (${leave.start_date} al ${leave.end_date})`,
        details: { before: { status: before.status }, after: { status: leave.status, note: leave.review_note }, shifts_released },
      });
      return NextResponse.json({ ...leave, shifts_released });
    }
    if (body.action === "cancel") {
      const leave = await cancelLeave(id, { userId: auth.session.userId, selfService: false });
      await auditHr(auth.session, request, {
        action: "STATUS_CHANGE",
        module: "Vacaciones",
        entity: "Licencia",
        entityId: id,
        description: `Anuló ${leave.type_label.toLowerCase()} de ${leave.employee_name} (${leave.start_date} al ${leave.end_date})`,
        details: { before: { status: before.status }, after: { status: leave.status } },
      });
      return NextResponse.json(leave);
    }
    return badRequest("Acción no válida");
  } catch (e) {
    return errorResponse(e);
  }
}
