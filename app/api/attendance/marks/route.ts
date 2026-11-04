import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { listMarks } from "@/lib/services/hr/attendance.service";
import { optionalInt } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/attendance/marks:
 *   get:
 *     tags:
 *       - Asistencia
 *     summary: Bitácora de marcaciones (?date o ?employee_id&from&to) con origen (inicio/cierre de sesión, autoservicio, RR. HH.), IP y dispositivo
 *     responses:
 *       200:
 *         description: Marcaciones, de la más reciente a la más antigua
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("asistencia.ver");
    if (!auth.ok) return auth.response;
    const sp = new URL(request.url).searchParams;
    return NextResponse.json(
      await listMarks({ date: sp.get("date"), employee_id: optionalInt(sp.get("employee_id")), from: sp.get("from"), to: sp.get("to") }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
