import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { logAudit, requestIp } from "@/lib/services/audit.service";
import { createEmployee, listEmployees, type EmployeeData } from "@/lib/services/employees.service";


export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/employees:
 *   post:
 *     tags:
 *       - Empleados
 *     summary: Registrar un empleado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Empleado registrado
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Documento duplicado
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("empleados.crear");
    if (!auth.ok) return auth.response;

    const body = (await readJson(request)) as unknown as EmployeeData | null;
    if (!body) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

    const employee = await createEmployee(body);
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "CREATE",
      module: "Empleados",
      entity: "Empleado",
      entityId: employee.employee_id,
      description: `Registró al empleado ${employee.full_name}`,
      details: { after: { dni: employee.dni, position: employee.position, area: employee.area } },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("empleados.ver");
    if (!auth.ok) return auth.response;

    const sp = new URL(request.url).searchParams;
    const active = sp.get("active");
    const employees = await listEmployees({
      q: sp.get("q"),
      area: sp.get("area"),
      active: active === "true" ? true : active === "false" ? false : null,
    });
    return NextResponse.json(employees);
  } catch (error) {
    return errorResponse(error);
  }
}