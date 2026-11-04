import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { markAttendance, openAttendanceOf, type MarkAction } from "@/lib/services/hr/attendance.service";
import { requestIp } from "@/lib/services/audit.service";
import { auditHr, badRequest, requireSelf } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/me/attendance:
 *   get:
 *     tags:
 *       - Autoservicio
 *     summary: Mi entrada abierta (sin salida) de hoy o de ayer — se usa para ofrecer marcar la salida al cerrar sesión
 *     responses:
 *       200:
 *         description: "{ open: { date, check_in, expected_end, minutes_to_end } | null }"
 *   post:
 *     tags:
 *       - Autoservicio
 *     summary: Marcar mi entrada o salida con la hora actual (body { action check_in|check_out })
 *     responses:
 *       200:
 *         description: Marcación registrada
 *       400:
 *         description: Sin horario hoy, demasiado temprano o ya marcado
 */
export async function GET() {
  try {
    const self = await requireSelf();
    if (!self.ok) return NextResponse.json({ open: null });
    return NextResponse.json({ open: await openAttendanceOf(self.employeeId) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const self = await requireSelf();
    if (!self.ok) return self.response;
    const body = await readJson(request);
    if (body?.action !== "check_in" && body?.action !== "check_out") return badRequest("Acción no válida");

    const result = await markAttendance(self.employeeId, body.action as MarkAction, {
      actorUserId: self.session.userId,
      actorUsername: self.session.username,
      source: "Autoservicio",
      ip: requestIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    await auditHr(self.session, request, {
      action: "CREATE",
      module: "Asistencia",
      entity: "Asistencia",
      entityId: result.attendance_id,
      description: `Marcó su ${result.action === "check_in" ? "entrada" : "salida"} (${result.date} ${result.time})`,
      details: { after: { employee_id: self.employeeId, ...result, source: "Autoservicio" } },
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
