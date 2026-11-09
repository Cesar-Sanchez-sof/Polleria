import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import {
  correctAttendance,
  dailyAttendance,
  employeeAttendance,
  markAttendance,
  type AttendanceCorrection,
  type MarkAction,
} from "@/lib/services/hr/attendance.service";
import { todayLimaIso } from "@/lib/services/hr/common";
import { requestIp } from "@/lib/services/security/audit.service";
import { auditHr, badRequest, optionalInt } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/attendance:
 *   get:
 *     tags:
 *       - Asistencia
 *     summary: Tablero del día (?date) o historial de un empleado (?employee_id&from&to) con estados y totales
 *     responses:
 *       200:
 *         description: Asistencia
 *   post:
 *     tags:
 *       - Asistencia
 *     summary: Registrar entrada o salida (body { employee_id, action check_in|check_out, date?, time? HH:MM })
 *     responses:
 *       200:
 *         description: Marcación registrada
 *   put:
 *     tags:
 *       - Asistencia
 *     summary: Corregir o justificar un día (body { employee_id, date, check_in, check_out, justified, justification, notes })
 *     responses:
 *       200:
 *         description: Día corregido
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("asistencia.ver");
    if (!auth.ok) return auth.response;
    const sp = new URL(request.url).searchParams;
    const employeeId = optionalInt(sp.get("employee_id"));
    if (employeeId) {
      const to = sp.get("to") ?? todayLimaIso();
      const from = sp.get("from") ?? `${to.slice(0, 8)}01`;
      return NextResponse.json(await employeeAttendance(employeeId, from, to));
    }
    return NextResponse.json(await dailyAttendance(sp.get("date") ?? todayLimaIso()));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("asistencia.crear");
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    const employeeId = Number(body?.employee_id);
    if (!body || !Number.isInteger(employeeId) || employeeId <= 0) return badRequest("Indica el empleado");
    const result = await markAttendance(employeeId, body.action as MarkAction, {
      actorUserId: auth.session.userId,
      actorUsername: auth.session.username,
      source: "Manual",
      ip: requestIp(request),
      userAgent: request.headers.get("user-agent"),
      date: typeof body.date === "string" ? body.date : null,
      time: typeof body.time === "string" ? body.time : null,
    });
    await auditHr(auth.session, request, {
      action: "CREATE",
      module: "Asistencia",
      entity: "Asistencia",
      entityId: result.attendance_id,
      description: `Registró la ${result.action === "check_in" ? "entrada" : "salida"} del empleado #${employeeId} (${result.date} ${result.time})`,
      details: { after: { employee_id: employeeId, ...result } },
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await authorize("asistencia.editar");
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    if (!body) return badRequest();
    const result = await correctAttendance(body as unknown as AttendanceCorrection, auth.session.userId, new Date(), auth.session.username);
    await auditHr(auth.session, request, {
      action: "UPDATE",
      module: "Asistencia",
      entity: "Asistencia",
      entityId: result.attendance_id,
      description: `${result.after.justified ? "Justificó" : "Corrigió"} la asistencia del empleado #${body.employee_id} del ${body.date}`,
      details: { before: result.before, after: { ...result.after, justification: body.justification ?? null } },
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
