/**
 * @openapi
 * /api/accounts:
 *   get:
 *     summary: Lista todas las cuentas contables
 *     operationId: listAccounts
 *     tags:
 *       - Accounts
 *     responses:
 *       '200':
 *         description: Lista de cuentas contables activas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       code:
 *                         type: string
 *                         example: "101"
 *                       name:
 *                         type: string
 *                         example: "Caja"
 *                       type:
 *                         type: string
 *                         example: "Activo"
 *                       active:
 *                         type: boolean
 *                         example: true
 *                       parentId:
 *                         type: integer
 *                         nullable: true
 *                         example: null
 *       '500':
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "No se pudo obtener el plan contable."
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria, ipDeSolicitud } from "@/lib/services/audit.service";
import { actorActual } from "@/lib/auth/actor-auditoria";
import {
  ACCOUNT_SELECT,
  duplicateCodeResponse,
  isDuplicateCodeError,
  toAccountApi,
  validateAccount,
  validationResponse,
} from "@/lib/chart-of-accounts";

export const dynamic = "force-dynamic";

/**
 * Full chart of accounts (roots and subaccounts), ordered by code.
 *
 * This listing is not paginated: frontend builds the full tree and filters client-side,
 * ensuring a subaccount is never separated from its parent.
 */
export async function GET() {
  try {
    const accounts = await prisma.accountingAccount.findMany({
      orderBy: { code: "asc" },
      select: ACCOUNT_SELECT,
    });

    return Response.json({ data: accounts.map(toAccountApi) });
  } catch (error) {
    console.error("[api/accounts] error al obtener el plan contable:", error);
    return Response.json({ error: "No se pudo obtener el plan contable." }, { status: 500 });
  }
}

/**
 * Registers a new accounting account.
 *
 * Body: `{ codigo, nombre, tipo, idPadre?, activo? }`. Code is unique across
 * the table and a subaccount inherits its parent's type.
 */
/**
 * @openapi
 * /api/accounts:
 *   post:
 *     tags:
 *       - Accounts
 *     summary: Crear una nueva cuenta contable
 *     description: Registra una cuenta contable con código único y opcionalmente la asigna a una cuenta padre.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewAccount'
 *     responses:
 *       201:
 *         description: Cuenta creada exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Account'
 *       400:
 *         description: Datos de la solicitud inválidos.
 *       409:
 *         description: Código de cuenta duplicado.
 *       500:
 *         description: Error interno al crear la cuenta.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { error: "El cuerpo de la petición no es un JSON válido." },
        { status: 400 }
      );
    }

    const { errors, values } = validateAccount(body, "create");
    if (errors.length > 0) return validationResponse(errors);

    const code = values.code as string;
    const type = values.type as string;
    const parentId = values.parentId ?? null;

    // Code cannot be duplicated in the chart of accounts
    const existing = await prisma.accountingAccount.findUnique({
      where: { code },
      select: { id: true },
    });
    if (existing) return duplicateCodeResponse(code);

    // Hierarchy: parent account must exist, be active, and share the same type
    if (parentId !== null) {
      const parent = await prisma.accountingAccount.findUnique({
        where: { id: parentId },
        select: { id: true, type: true, active: true },
      });

      if (!parent) errors.push("La cuenta padre indicada no existe.");
      else {
        if (!parent.active) {
          errors.push("La cuenta padre está inactiva: actívala antes de crear subcuentas.");
        }
        if (parent.type !== type) {
          errors.push(`La subcuenta debe tener el mismo tipo que su cuenta padre (${parent.type}).`);
        }
      }
      if (errors.length > 0) return validationResponse(errors);
    }

    try {
      const createdAccount = await prisma.accountingAccount.create({
        data: {
          code,
          name: values.name as string,
          type,
          parentId,
          active: values.active ?? true,
        },
        select: ACCOUNT_SELECT,
      });
            await registrarAuditoria({
        actor: await actorActual(),
        action: "CREATE",
        module: "Contabilidad",
        entity: "Cuenta contable",
        entityId: createdAccount.id,
        description: `Creó la cuenta contable ${code} - ${values.name}`,
        details: { despues: { code, name: values.name, type, parentId, active: values.active ?? true } },
        ipAddress: ipDeSolicitud(request),
      });
      return Response.json(toAccountApi(createdAccount), { status: 201 });
    } catch (error) {
      if (isDuplicateCodeError(error)) return duplicateCodeResponse(code);
      throw error;
    }
  } catch (error) {
    console.error("[api/accounts] error al registrar la cuenta:", error);
    return Response.json(
      { error: "No se pudo registrar la cuenta contable." },
      { status: 500 }
    );
  }
}
