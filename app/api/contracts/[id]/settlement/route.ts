import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { readJson } from "@/lib/auth/responses";
import { contractSettlement } from "@/lib/services/hr/social-benefits.service";
import { postContractSettlement, settlementEntries } from "@/lib/services/hr/settlement-posting.service";
import { auditHr, badRequest, routeId, type IdContext } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/contracts/{id}/settlement:
 *   get:
 *     tags:
 *       - Contratos
 *     summary: Liquidación de beneficios sociales de un contrato (CTS trunca, gratificación trunca, vacaciones, indemnización)
 *     description: >
 *       Con el contrato cesado calcula la liquidación definitiva; con el contrato vigente es una simulación
 *       a la fecha indicada. Descuenta ONP/AFP sobre las vacaciones y el saldo de adelantos pendientes.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: cutoff
 *         description: Último día de labores (YYYY-MM-DD). Por defecto la fecha de cese o hoy.
 *         schema:
 *           type: string
 *       - in: query
 *         name: arbitrary_dismissal
 *         description: "true si el cese fue por despido arbitrario (suma la indemnización)"
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: other_deductions
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Liquidación calculada
 *       404:
 *         description: Contrato no encontrado
 *   post:
 *     tags:
 *       - Contratos
 *     summary: Registrar la liquidación definitiva (asiento de devengo y, opcionalmente, de pago)
 *     description: >
 *       Exige el contrato cesado. Genera el asiento DEBE 6215/6214/6251/659 contra HABER 4032·407/141/461/411,
 *       cancela los adelantos pendientes y, si se envía payment_method, registra el pago (411 contra caja/bancos).
 *       No permite liquidar dos veces el mismo contrato.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               arbitrary_dismissal:
 *                 type: boolean
 *               other_deductions:
 *                 type: number
 *               payment_method:
 *                 type: string
 *                 enum: [Transferencia, Efectivo, Yape, Plin]
 *               payment_date:
 *                 type: string
 *     responses:
 *       200:
 *         description: Liquidación registrada con sus asientos
 *       400:
 *         description: Contrato vigente, ya liquidado o importes inválidos
 */
export async function GET(request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize("planilla.ver");
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    if (!id) return badRequest();
    const sp = new URL(request.url).searchParams;
    const settlement = await contractSettlement(id, {
      cutoff: sp.get("cutoff") ?? undefined,
      arbitrary_dismissal: sp.get("arbitrary_dismissal") === "true",
      other_deductions: sp.get("other_deductions") ?? undefined,
    });
    return NextResponse.json({ ...settlement, journal_entries: await settlementEntries(id) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize("planilla.editar");
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    const body = (await readJson(request)) ?? {};
    if (!id) return badRequest();
    const actor = { userId: auth.session.userId, username: auth.session.username };
    const result = await postContractSettlement(id, body, actor);
    await auditHr(auth.session, request, {
      action: "STATUS_CHANGE",
      module: "Beneficios",
      entity: "Liquidación",
      entityId: id,
      description: `Registró la liquidación de ${result.settlement.employee_name}: neto S/ ${result.settlement.net_total.toFixed(2)} (${result.journal_entries.map((j) => j.code).join(", ")})`,
      details: { after: { net_total: result.settlement.net_total, journal_entries: result.journal_entries.map((j) => j.code) } },
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
