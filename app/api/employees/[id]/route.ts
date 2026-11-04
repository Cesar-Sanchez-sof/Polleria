import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { getEmployee, updateEmployee, verifyModifiableEmployee, type EmployeeData } from "@/lib/services/employees.service";
import { auditHr, badRequest, routeId, type IdContext } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/employees/{id}:
 *   get:
 *     tags:
 *       - Empleados
 *     summary: Consultar la ficha de un empleado
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
 *     summary: Editar los datos personales (las condiciones laborales se cambian por adenda del contrato)
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
 */
export async function GET(_request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize("empleados.ver");
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    if (!id) return badRequest();
    return NextResponse.json(await getEmployee(id));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(request: NextRequest, ctx: IdContext) {
  try {
    const auth = await authorize("empleados.editar");
    if (!auth.ok) return auth.response;
    const id = await routeId(ctx);
    const body = await readJson(request);
    if (!id || !body) return badRequest();

    await verifyModifiableEmployee(id, auth.superuser);
    const before = await getEmployee(id);
    const updated = await updateEmployee(id, body as unknown as EmployeeData);
    const snapshot = (e: typeof before) => ({
      dni: e.dni,
      full_name: e.full_name,
      phone: e.phone,
      email: e.email,
      address: e.address,
      emergency_contact: e.emergency_contact,
    });
    await auditHr(auth.session, request, {
      action: "UPDATE",
      module: "Empleados",
      entity: "Empleado",
      entityId: id,
      description: `Modificó los datos personales de ${updated.full_name}`,
      details: { before: snapshot(before), after: snapshot(updated) },
    });
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}
