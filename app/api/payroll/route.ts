import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { logAudit, requestIp } from "@/lib/services/audit.service";
import { approvePayrolls, calculatePayrollPeriod, listPayroll, payPayrolls } from "@/lib/services/payroll.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payroll:
 *   get:
 *     tags:
 *       - Planilla
 *     summary: Boletas de un mes
 *     parameters:
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Boletas del mes y parámetros que faltan para calcularlo
 *   post:
 *     tags:
 *       - Planilla
 *     summary: Calcular o recalcular las boletas en borrador de un mes
 *     responses:
 *       200:
 *         description: Cuántas boletas se crearon, actualizaron y quitaron
 *       409:
 *         description: Faltan parámetros vigentes
 *   patch:
 *     tags:
 *       - Planilla
 *     summary: Aprobar (con su asiento contable) o pagar boletas
 *     responses:
 *       200:
 *         description: Boletas actualizadas
 *       409:
 *         description: Estado inválido o periodo contable cerrado
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("planilla.ver");
    if (!auth.ok) return auth.response;
    const sp = new URL(request.url).searchParams;
    return NextResponse.json(await listPayroll(sp.get("year"), sp.get("month")));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("planilla.crear");
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    if (!body) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

    const result = await calculatePayrollPeriod(body.year, body.month);
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "CREATE",
      module: "Planilla",
      entity: "Planilla mensual",
      entityId: `${body.year}-${body.month}`,
      description: `Calculó la planilla ${body.month}/${body.year}: ${result.created} nuevas, ${result.updated} recalculadas`,
      details: { after: result },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authorize("planilla.editar");
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    if (!body) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
    const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
    const actor = { userId: auth.session.userId, username: auth.session.username };

    if (body.action === "approve") {
      const rows = await approvePayrolls(ids, auth.session.username);
      await logAudit({
        actor,
        action: "STATUS_CHANGE",
        module: "Planilla",
        entity: "Boleta de planilla",
        entityId: ids.join(","),
        description: `Aprobó ${rows.length} boleta(s) de planilla y registró sus asientos`,
        details: { after: { status: "Approved", ids } },
        ipAddress: requestIp(request),
      });
      return NextResponse.json(rows);
    }
    if (body.action === "pay") {
      const rows = await payPayrolls(
        ids,
        { method: body.method as string | null, payment_date: body.payment_date as string | null },
        auth.session.username,
      );
      await logAudit({
        actor,
        action: "STATUS_CHANGE",
        module: "Planilla",
        entity: "Boleta de planilla",
        entityId: ids.join(","),
        description: `Pagó ${rows.length} boleta(s) de planilla (${String(body.method)})`,
        details: { after: { status: "Paid", ids, method: body.method, payment_date: body.payment_date } },
        ipAddress: requestIp(request),
      });
      return NextResponse.json(rows);
    }
    return NextResponse.json({ error: "La acción no es válida" }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
