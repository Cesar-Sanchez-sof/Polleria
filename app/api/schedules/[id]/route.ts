import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { logAudit, requestIp } from "@/lib/services/audit.service";
import { deleteSchedule, getSchedule, updateSchedule, type ScheduleData } from "@/lib/services/schedules.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/schedules/{id}:
 *   get:
 *     tags:
 *       - Horarios
 *     summary: Consultar un horario con sus empleados
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Horario
 *   put:
 *     tags:
 *       - Horarios
 *     summary: Editar un horario
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Horario actualizado
 *   delete:
 *     tags:
 *       - Horarios
 *     summary: Eliminar un horario (sus empleados quedan sin horario)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Horario eliminado
 */
type Context = { params: Promise<{ id: string }> };

async function readId(ctx: Context): Promise<number | null> {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: NextRequest, ctx: Context) {
  try {
    const auth = await authorize("horarios.ver");
    if (!auth.ok) return auth.response;
    const id = await readId(ctx);
    if (!id) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
    return NextResponse.json(await getSchedule(id));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(request: NextRequest, ctx: Context) {
  try {
    const auth = await authorize("horarios.editar");
    if (!auth.ok) return auth.response;
    const id = await readId(ctx);
    const body = await readJson(request);
    if (!id || !body) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });

    const before = await getSchedule(id);
    const updated = await updateSchedule(id, body as unknown as ScheduleData);
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "UPDATE",
      module: "Horarios",
      entity: "Horario",
      entityId: id,
      description: `Modificó el horario ${updated.name}`,
      details: {
        before: { name: before.name, date: before.date, start_time: before.start_time, end_time: before.end_time },
        after: { name: updated.name, date: updated.date, start_time: updated.start_time, end_time: updated.end_time },
      },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(request: NextRequest, ctx: Context) {
  try {
    const auth = await authorize("horarios.eliminar");
    if (!auth.ok) return auth.response;
    const id = await readId(ctx);
    if (!id) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });

    const { schedule } = await deleteSchedule(id);
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "DELETE",
      module: "Horarios",
      entity: "Horario",
      entityId: id,
      description: `Eliminó el horario ${schedule.name} (${schedule.date})`,
      details: { before: { name: schedule.name, employees: schedule.employees.map((e) => e.employee_id) } },
      ipAddress: requestIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}