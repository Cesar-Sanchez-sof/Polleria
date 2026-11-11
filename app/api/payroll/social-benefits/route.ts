import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { listSocialBenefits } from "@/lib/services/hr/social-benefits.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payroll/social-benefits:
 *   get:
 *     tags:
 *       - Planilla
 *     summary: Gratificaciones (julio/diciembre) o CTS (mayo/noviembre) de un semestre, por trabajador
 *     description: >
 *       Calcula lo que corresponde pagar según régimen laboral (general, pequeña empresa o microempresa),
 *       meses completos de servicio y faltas injustificadas. La gratificación incluye la bonificación
 *       extraordinaria del 9 %. Para CTS se usa la remuneración computable con 1/6 de la última gratificación.
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [gratificacion, cts]
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: half
 *         required: true
 *         description: "1 = gratificación de julio / CTS de mayo; 2 = gratificación de diciembre / CTS de noviembre"
 *         schema:
 *           type: integer
 *           enum: [1, 2]
 *     responses:
 *       200:
 *         description: Detalle por trabajador y totales del semestre
 *       400:
 *         description: Parámetros inválidos
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("planilla.ver");
    if (!auth.ok) return auth.response;
    const sp = new URL(request.url).searchParams;
    return NextResponse.json(await listSocialBenefits(sp.get("type"), sp.get("year"), sp.get("half")));
  } catch (e) {
    return errorResponse(e);
  }
}
