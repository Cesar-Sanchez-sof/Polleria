import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/auth/responses";
import { payslipsOf } from "@/lib/services/hr/payroll.service";
import { requireSelf } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/me/payslips:
 *   get:
 *     tags:
 *       - Autoservicio
 *     summary: Mis boletas de pago (planillas aprobadas o pagadas de los últimos 12 meses)
 *     responses:
 *       200:
 *         description: Boletas
 */
export async function GET() {
  try {
    const self = await requireSelf();
    if (!self.ok) return self.response;
    return NextResponse.json(await payslipsOf(self.employeeId));
  } catch (e) {
    return errorResponse(e);
  }
}
