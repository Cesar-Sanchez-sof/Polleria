import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { logAudit, requestIp } from "@/lib/services/audit.service";
import { getContract, terminateContract, updateContract, type ContractData } from "@/lib/services/contracts.service";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function readId(ctx: Context): Promise<number | null> {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * @openapi
 * /api/contracts/{id}:
 *   get:
 *     tags:
 *       - Contratos
 *     summary: Ver un contrato
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contrato
 *       404:
 *         description: No existe
 *   put:
 *     tags:
 *       - Contratos
 *     summary: Editar un contrato que no esté rescindido
 *     responses:
 *       200:
 *         description: Contrato actualizado
 *       409:
 *         description: Rescindido o con periodo cruzado
 *   patch:
 *     tags:
 *       - Contratos
 *     summary: Rescindir un contrato (terminated_at y reason)
 *     responses:
 *       200:
 *         description: Contrato rescindido
 */
export async function GET(_request: NextRequest, ctx: Context) {
  try {
    const auth = await authorize("contratos.ver");
    if (!auth.ok) return auth.response;
    const id = await readId(ctx);
    if (!id) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
    return NextResponse.json(await getContract(id));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(request: NextRequest, ctx: Context) {
  try {
    const auth = await authorize("contratos.editar");
    if (!auth.ok) return auth.response;
    const id = await readId(ctx);
    const body = await readJson(request);
    if (!id || !body) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });

    const before = await getContract(id);
    const updated = await updateContract(id, body as unknown as ContractData);
    const snapshot = (c: typeof before) => ({
      kind: c.kind,
      regime: c.regime,
      start_date: c.start_date,
      end_date: c.end_date,
      monthly_salary: c.monthly_salary,
      weekly_hours: c.weekly_hours,
    });
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "UPDATE",
      module: "Contratos",
      entity: "Contrato laboral",
      entityId: id,
      description: `Modificó el contrato de ${updated.employee_name}`,
      details: { before: snapshot(before), after: snapshot(updated) },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(request: NextRequest, ctx: Context) {
  try {
    const auth = await authorize("contratos.editar");
    if (!auth.ok) return auth.response;
    const id = await readId(ctx);
    const body = await readJson(request);
    if (!id || !body) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });

    const terminated = await terminateContract(id, {
      terminated_at: typeof body.terminated_at === "string" ? body.terminated_at : null,
      reason: typeof body.reason === "string" ? body.reason : null,
    });
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "STATUS_CHANGE",
      module: "Contratos",
      entity: "Contrato laboral",
      entityId: id,
      description: `Rescindió el contrato de ${terminated.employee_name}`,
      details: {
        before: { status: "active" },
        after: { terminated_at: terminated.terminated_at, reason: terminated.termination_reason },
      },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(terminated);
  } catch (e) {
    return errorResponse(e);
  }
}
