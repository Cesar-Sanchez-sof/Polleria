import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { logAudit, requestIp } from "@/lib/services/audit.service";
import {
  employeeIdOfUser,
  getEmployee,
  setEmployeeActive,
  updateEmployee,
  verifyModifiableEmployee,
  type EmployeeData,
} from "@/lib/services/employees.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/employees/{id}:
 *   get:
 *     tags:
 *       - Empleados
 *     summary: Consultar un empleado
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Empleado
 *       404:
 *         description: No encontrado
 *   put:
 *     tags:
 *       - Empleados
 *     summary: Editar la información de un empleado
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Empleado actualizado
 *       409:
 *         description: Documento duplicado
 *   patch:
 *     tags:
 *       - Empleados
 *     summary: Dar de baja o reingresar a un empleado (body { active })
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
type Context = { params: Promise<{ id: string }> };

async function readId(ctx: Context): Promise<number | null> {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: NextRequest, ctx: Context) {
  try {
    const auth = await authorize("empleados.ver");
    if (!auth.ok) return auth.response;
    const id = await readId(ctx);
    if (!id) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
    return NextResponse.json(await getEmployee(id));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(request: NextRequest, ctx: Context) {
  try {
    const auth = await authorize("empleados.editar");
    if (!auth.ok) return auth.response;
    const id = await readId(ctx);
    const body = await readJson(request);
    if (!id || !body) return NextResponse.json({ error: "Petición inválida" }, { status: 400 });

    await verifyModifiableEmployee(id, auth.superuser);
    const before = await getEmployee(id);
    const updated = await updateEmployee(id, body as unknown as EmployeeData);
    const snapshot = (e: typeof before) => ({
      dni: e.dni,
      position: e.position,
      area: e.area,
      contract_type: e.contract_type,
      base_salary: e.base_salary,
    });
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "UPDATE",
      module: "Empleados",
      entity: "Empleado",
      entityId: id,
      description: `Modificó al empleado ${updated.full_name}`,
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
    const auth = await authorize("empleados.editar");
    if (!auth.ok) return auth.response;
    const id = await readId(ctx);
    const body = await readJson(request);
    if (!id || typeof body?.active !== "boolean") {
      return NextResponse.json({ error: "Indica el estado (true/false)" }, { status: 400 });
    }
    if (!body.active && (await employeeIdOfUser(auth.session.userId)) === id) {
      return NextResponse.json({ error: "No puedes darte de baja a ti mismo" }, { status: 400 });
    }

    await verifyModifiableEmployee(id, auth.superuser);
    const { employee, users_deactivated } = await setEmployeeActive(id, body.active);
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "STATUS_CHANGE",
      module: "Empleados",
      entity: "Empleado",
      entityId: id,
      description: `${body.active ? "Reingresó" : "Dio de baja"} al empleado ${employee.full_name}`,
      details: { before: { active: !body.active }, after: { active: body.active }, users_deactivated },
      ipAddress: requestIp(request),
    });
    return NextResponse.json({ ...employee, users_deactivated });
  } catch (e) {
    return errorResponse(e);
  }
}