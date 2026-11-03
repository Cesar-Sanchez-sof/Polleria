import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/auth/responses";
import { authorize } from "@/lib/auth/permissions";
import { logAudit, requestIp } from "@/lib/services/audit.service";
import { createContract, listContracts, type ContractData } from "@/lib/services/contracts.service";
import { CONTRACT_KINDS, type ContractKind, type ContractStatus } from "@/lib/hr/contracts";

export const dynamic = "force-dynamic";

const STATUSES: readonly ContractStatus[] = ["upcoming", "active", "expiring", "expired", "terminated"];

/**
 * @openapi
 * /api/contracts:
 *   get:
 *     tags:
 *       - Contratos
 *     summary: Listar contratos laborales y los empleados que pueden recibir uno
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: employee_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [upcoming, active, expiring, expired, terminated]
 *       - in: query
 *         name: kind
 *         schema:
 *           type: string
 *           enum: [FixedTerm, Indefinite, Private]
 *     responses:
 *       200:
 *         description: Contratos con su estado calculado por fechas y empleados activos
 *   post:
 *     tags:
 *       - Contratos
 *     summary: Registrar un contrato (o renovar uno con renews_contract_id)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Contrato registrado
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: El periodo se cruza con otro contrato del empleado
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("contratos.ver");
    if (!auth.ok) return auth.response;

    const sp = new URL(request.url).searchParams;
    const status = sp.get("status");
    const kind = sp.get("kind");
    const employeeId = Number(sp.get("employee_id"));
    return NextResponse.json(
      await listContracts({
        q: sp.get("q"),
        employeeId: Number.isInteger(employeeId) && employeeId > 0 ? employeeId : null,
        status: STATUSES.includes(status as ContractStatus) ? (status as ContractStatus) : null,
        kind: CONTRACT_KINDS.includes(kind as ContractKind) ? (kind as ContractKind) : null,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("contratos.crear");
    if (!auth.ok) return auth.response;

    const body = (await readJson(request)) as unknown as ContractData | null;
    if (!body) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

    const contract = await createContract(body);
    await logAudit({
      actor: { userId: auth.session.userId, username: auth.session.username },
      action: "CREATE",
      module: "Contratos",
      entity: "Contrato laboral",
      entityId: contract.contract_id,
      description: `${contract.renews_contract_id ? "Renovó" : "Registró"} el contrato de ${contract.employee_name}`,
      details: {
        after: {
          kind: contract.kind,
          regime: contract.regime,
          start_date: contract.start_date,
          end_date: contract.end_date,
          monthly_salary: contract.monthly_salary,
        },
      },
      ipAddress: requestIp(request),
    });
    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
