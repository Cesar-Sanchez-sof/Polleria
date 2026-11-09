import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/auth/responses";
import { requireSelf } from "@/lib/services/hr/route-helpers";
import { getEmployeeSelfServiceProfile } from "@/lib/services/hr/self-service.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/me:
 *   get:
 *     tags:
 *       - Autoservicio
 *     summary: Mi ficha laboral — contrato y horario pactado, mi semana (?from lunes YYYY-MM-DD), saldo de vacaciones, solicitudes, adelantos y seguros
 *     responses:
 *       200:
 *         description: Datos del trabajador con sesión
 *       404:
 *         description: El usuario no está vinculado a un empleado
 */
export async function GET(request: NextRequest) {
  try {
    const self = await requireSelf();
    if (!self.ok) return self.response;

    const requested = new URL(request.url).searchParams.get("from");
    const data = await getEmployeeSelfServiceProfile(self.employeeId, requested);
    return NextResponse.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
