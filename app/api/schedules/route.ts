import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { logAudit, requestIp } from "@/lib/services/audit.service";
import { listSchedules, createSchedule, type ScheduleData } from "@/lib/services/schedules.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/schedules:
 *   get:
 *     tags:
 *       - Horarios
 *     summary: Listar horarios laborales con sus empleados (filtros from y to, YYYY-MM-DD)
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de horarios
 *       403:
 *         description: Sin permiso horarios.ver
 *   post:
 *     tags:
 *       - Horarios
 *     summary: Crear un horario laboral
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Horario creado
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Horario duplicado
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("horarios.ver");
    if (!auth.ok) return auth.response;
    const sp = new URL(request.url).searchParams;
    return NextResponse.json(await listSchedules({ from: sp.get("from"), to: sp.get("to") }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("horarios.crear");
    if (!auth.ok) return auth.response;
    const body = (await readJson(request)) as unknown as ScheduleData | null;
    if (!body) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

    const schedule = await createSchedule(body);
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "CREATE",
      module: "Horarios",
      entity: "Horario",
      entityId: schedule.shift_id,
      description: `Creó el horario ${schedule.name} (${schedule.date} ${schedule.start_time}-${schedule.end_time})`,
      details: { after: { name: schedule.name, date: schedule.date, start_time: schedule.start_time, end_time: schedule.end_time } },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}