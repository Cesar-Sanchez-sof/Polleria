import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { hrAlerts } from "@/lib/services/hr/contracts.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/contracts/alerts:
 *   get:
 *     tags:
 *       - Contratos
 *     summary: Alertas de cumplimiento (contratos por vencer o vencidos, fin del periodo de prueba, sin horario, sin Vida Ley)
 *     responses:
 *       200:
 *         description: Alertas ordenadas por severidad
 */
export async function GET() {
  try {
    const auth = await authorize(["contratos.ver", "empleados.ver"]);
    if (!auth.ok) return auth.response;
    return NextResponse.json(await hrAlerts());
  } catch (e) {
    return errorResponse(e);
  }
}
