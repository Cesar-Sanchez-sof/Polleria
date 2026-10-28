import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { logAudit, requestIp } from "@/lib/services/audit.service";
import { getSchedule, setScheduleEmployees } from "@/lib/services/schedules.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/schedules/{id}/employees:
 *   put:
 *     tags:
 *       - Horarios
 *     summary: Asignar empleados a un horario (body { employee_ids }); reemplaza la lista actual
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Horario con sus empleados
 *       400:
 *         description: Lista inválida o empleado dado de baja
 */
export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authorize("horarios.editar");
    if (!auth.ok) return auth.response;
    const id = Number((await ctx.params).id);
    const body = await readJson(request);
    if (!Number.isInteger(id) || id <= 0 || !body) {
      return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
    }

    const before = await getSchedule(id);
    const updated = await setScheduleEmployees(id, body.employee_ids);
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "UPDATE",
      module: "Horarios",
      entity: "Horario",
      entityId: id,
      description: `Actualizó los empleados del horario ${updated.name}`,
      details: {
        before: { employees: before.employees.map((e) => e.employee_id) },
        after: { employees: updated.employees.map((e) => e.employee_id) },
      },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}