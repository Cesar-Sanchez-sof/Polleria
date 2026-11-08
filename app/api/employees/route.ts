import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { hireEmployee, listEmployees, type EmployeeData } from "@/lib/services/hr/employees.service";
import type { ContractData } from "@/lib/services/hr/contracts.service";
import { prepareAccess, type AccessData } from "@/lib/services/hr/access.service";
import { logAudit, requestIp } from "@/lib/services/security/audit.service";
import { auditHr, badRequest } from "@/lib/services/hr/route-helpers";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/employees:
 *   get:
 *     tags:
 *       - Empleados
 *     summary: Listar empleados con su contrato vigente (filtros q, area, active)
 *     responses:
 *       200:
 *         description: Lista de empleados
 *   post:
 *     tags:
 *       - Empleados
 *     summary: Contratar personal (body { personal, contract, access? }) — crea empleado, contrato, horario pactado y, si se envía access, su usuario del sistema
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Empleado contratado
 *       400:
 *         description: Datos inválidos (jornada, sueldo mínimo, fechas…)
 *       409:
 *         description: Documento duplicado
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("empleados.crear");
    if (!auth.ok) return auth.response;

    const body = await readJson(request);
    if (!body?.personal || !body?.contract) return badRequest("Envía los datos personales y del contrato");

    // Crear su usuario del sistema exige además el permiso de Usuarios.
    let access = null;
    let superuser = auth.superuser;
    if (body.access) {
      const userAuth = await authorize("usuarios.crear");
      if (!userAuth.ok) return userAuth.response;
      superuser = userAuth.superuser;
      access = await prepareAccess(body.access as AccessData, superuser);
    }
    const { employee, contract, user } = await hireEmployee(
      body.personal as EmployeeData,
      body.contract as ContractData,
      auth.session.userId,
      access,
    );
    await auditHr(auth.session, request, {
      action: "CREATE",
      module: "Empleados",
      entity: "Empleado",
      entityId: employee.employee_id,
      description: `Contrató a ${employee.full_name} como ${contract.position} (${contract.contract_type_label})`,
      details: {
        after: {
          dni: employee.dni,
          contract_id: contract.contract_id,
          contract_type: contract.contract_type,
          position: contract.position,
          area: contract.area,
          base_salary: contract.base_salary,
          start_date: contract.start_date,
          end_date: contract.end_date,
          weekly_hours: contract.weekly_hours,
        },
      },
    });
    if (user) {
      await logAudit({
        actor: { userId: auth.session.userId, username: auth.session.username },
        action: "CREATE",
        module: "Usuarios",
        entity: "Usuario",
        entityId: user.user_id,
        description: `Creó el usuario ${user.username} (${user.role}) al contratar a ${employee.full_name}`,
        details: { after: { username: user.username, email: user.email, role: user.role, employee_id: employee.employee_id } },
        ipAddress: requestIp(request),
      });
    }
    return NextResponse.json({ employee, contract, user }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize(["empleados.ver", "asistencia.ver", "vacaciones.ver", "seguros.ver", "anticipos.ver", "contratos.ver"]);
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
