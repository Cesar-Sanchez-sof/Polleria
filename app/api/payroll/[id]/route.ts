import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { logAudit, requestIp } from "@/lib/services/audit.service";
import { deleteDraftPayroll, updatePayrollManual, type PayrollManualInput } from "@/lib/services/payroll.service";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function readId(ctx: Context): Promise<number | null> {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * @openapi
 * /api/payroll/{id}:
 *   put:
 *     tags:
 *       - Planilla
 *     summary: Editar los montos manuales de una boleta en borrador
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Boleta recalculada
 *       409:
 *         description: La boleta ya está aprobada o pagada
 *   delete:
 *     tags:
 *       - Planilla
 *     summary: Quitar una boleta en borrador
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Boleta quitada
 */
export async function PUT(request: NextRequest, ctx: Context) {
  try {
    const auth = await authorize("planilla.editar");
    if (!auth.ok) return auth.response;
    const id = await readId(ctx);
    const body = await readJson(request);
    if (!id || !body) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });

    const updated = await updatePayrollManual(id, body as unknown as PayrollManualInput);
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "UPDATE",
      module: "Planilla",
      entity: "Boleta de planilla",
      entityId: id,
      description: `Editó la boleta de ${updated.employee_name} (${updated.month}/${updated.year})`,
      details: {
        after: {
          overtime_pay: updated.overtime_pay,
          bonus: updated.bonus,
          absence_discount: updated.absence_discount,
          advances: updated.advances,
          net_pay: updated.net_pay,
        },
      },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, ctx: Context) {
  try {
    const auth = await authorize("planilla.editar");
    if (!auth.ok) return auth.response;
    const id = await readId(ctx);
    if (!id) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
    await deleteDraftPayroll(id);
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "DELETE",
      module: "Planilla",
      entity: "Boleta de planilla",
      entityId: id,
      description: `Quitó la boleta en borrador #${id}`,
      ipAddress: requestIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
