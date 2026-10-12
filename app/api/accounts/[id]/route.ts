import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria, ipDeSolicitud } from "@/lib/services/audit.service";
import { actorActual } from "@/lib/auth/actor-auditoria";
import {
  ACCOUNT_SELECT,
  duplicateCodeResponse,
  getDescendantsOf,
  HierarchyNode,
  isDuplicateCodeError,
  toAccountApi,
  validateAccount,
  validationResponse,
} from "@/lib/chart-of-accounts";

export const dynamic = "force-dynamic";

/** Minimal parent structure required to validate hierarchy and active status. */
const SELECT_PARENT = {
  id: true,
  type: true,
  active: true,
} as const;

/** Minimal account node structure to check hierarchy. */
const SELECT_NODE = {
  id: true,
  parentId: true,
} as const;

/** Individual account lookup (detail or edit baseline). */
/**
 * @openapi
 * /api/accounts/{id}:
 *   get:
 *     tags:
 *       - Accounts
 *     summary: Obtener detalle de cuenta contable
 *     description: Recupera la información completa de una cuenta contable por su identificador.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador numérico de la cuenta.
 *     responses:
 *       200:
 *         description: Detalle de la cuenta contable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Account'
 *       400:
 *         description: Identificador inválido.
 *       404:
 *         description: Cuenta no encontrada.
 *       500:
 *         description: Error interno.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const accountId = Number.parseInt(idParam, 10);

    if (Number.isNaN(accountId)) {
      return Response.json({ error: "Identificador de cuenta inválido." }, { status: 400 });
    }

    const account = await prisma.accountingAccount.findUnique({
      where: { id: accountId },
      select: ACCOUNT_SELECT,
    });

    if (!account) {
      return Response.json({ error: "Cuenta contable no encontrada." }, { status: 404 });
    }

    return Response.json(toAccountApi(account));
  } catch (error) {
    console.error("[api/accounts/[id]] error al obtener la cuenta:", error);
    return Response.json(
      { error: "No se pudo obtener la cuenta contable." },
      { status: 500 }
    );
  }
}

/**
 * Modifies an existing account: code, name, type, hierarchy, or status.
 */
/**
 * @openapi
 * /api/accounts/{id}:
 *   patch:
 *     tags:
 *       - Accounts
 *     summary: Actualizar cuenta contable
 *     description: Modifica una cuenta contable existente. Requiere permisos de administrador.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador numérico de la cuenta.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: ["ACTIVO", "PASIVO", "PATRIMONIO", "INGRESOS", "GASTOS"]
 *               parentId:
 *                 type: integer
 *                 nullable: true
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cuenta actualizada exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Account'
 *       400:
 *         description: Datos de la solicitud inválidos.
 *       404:
 *         description: Cuenta no encontrada.
 *       409:
 *         description: Código de cuenta duplicado.
 *       500:
 *         description: Error interno al actualizar la cuenta.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let newCode: string | undefined;

  try {
    const { id: idParam } = await params;
    const accountId = Number.parseInt(idParam, 10);

    if (Number.isNaN(accountId)) {
      return Response.json({ error: "Identificador de cuenta inválido." }, { status: 400 });
    }

    const currentAccount = await prisma.accountingAccount.findUnique({
      where: { id: accountId },
      select: ACCOUNT_SELECT,
    });

    if (!currentAccount) {
      return Response.json({ error: "Cuenta contable no encontrada." }, { status: 404 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { error: "El cuerpo de la petición no es un JSON válido." },
        { status: 400 }
      );
    }

    const { errors, values } = validateAccount(body, "edit");
    newCode = values.code;
    if (errors.length > 0) return validationResponse(errors);

    // Code uniqueness across other accounts
    if (values.code !== undefined) {
      const existingWithCode = await prisma.accountingAccount.findUnique({
        where: { code: values.code },
        select: { id: true },
      });
      if (existingWithCode && existingWithCode.id !== accountId) {
        return duplicateCodeResponse(values.code);
      }
    }

    const finalType = values.type ?? currentAccount.type;
    const typeChanged = values.type !== undefined && values.type !== currentAccount.type;
    const changesParent = values.parentId !== undefined;
    const finalParentId = changesParent ? (values.parentId ?? null) : currentAccount.parentId;
    const isOwnParent = changesParent && finalParentId === accountId;

    if (isOwnParent) {
      errors.push("Una cuenta no puede ser su propia cuenta padre.");
      return validationResponse(errors);
    }

    // Full hierarchy needed to detect cycles or propagate type
    const nodes: HierarchyNode[] | null =
      changesParent || typeChanged
        ? await prisma.accountingAccount.findMany({ select: SELECT_NODE })
        : null;

    const needsParentValidation =
      finalParentId !== null &&
      ((changesParent && finalParentId !== accountId) ||
        typeChanged ||
        values.active === true);

    const parentAccount = needsParentValidation
      ? await prisma.accountingAccount.findUnique({
        where: { id: finalParentId as number },
        select: SELECT_PARENT,
      })
      : null;

    if (needsParentValidation && !parentAccount) {
      errors.push("La cuenta padre indicada no existe.");
    } else if (parentAccount) {
      if (changesParent) {
        if (!parentAccount.active) {
          errors.push("La cuenta padre está inactiva: actívala antes de mover la cuenta.");
        }
        if (parentAccount.type !== finalType) {
          errors.push(`La subcuenta debe tener el mismo tipo que su cuenta padre (${parentAccount.type}).`);
        }
        if (nodes && getDescendantsOf(accountId, nodes).includes(finalParentId as number)) {
          errors.push("La cuenta padre no puede ser una subcuenta de la misma cuenta.");
        }
      } else {
        if (typeChanged && parentAccount.type !== finalType) {
          errors.push(`La subcuenta debe tener el mismo tipo que su cuenta padre (${parentAccount.type}).`);
        }
        if (values.active === true && !parentAccount.active) {
          errors.push("No se puede activar una cuenta cuya cuenta padre está inactiva.");
        }
      }
    }

    // Status: cannot deactivate if it has active child accounts
    if (values.active === false) {
      const activeChild = await prisma.accountingAccount.findFirst({
        where: { parentId: accountId, active: true },
        select: { id: true },
      });
      if (activeChild) {
        errors.push("No se puede desactivar una cuenta con subcuentas activas: desactívalas primero.");
      }
    }

    if (errors.length > 0) return validationResponse(errors);

    const descendants = nodes && typeChanged ? getDescendantsOf(accountId, nodes) : [];

    const updated = await prisma.$transaction(async (tx) => {
      const modified = await tx.accountingAccount.update({
        where: { id: accountId },
        data: {
          ...(values.code !== undefined && { code: values.code }),
          ...(values.name !== undefined && { name: values.name }),
          ...(values.type !== undefined && { type: values.type }),
          ...(changesParent && { parentId: finalParentId }),
          ...(values.active !== undefined && { active: values.active }),
        },
        select: ACCOUNT_SELECT,
      });

      if (typeChanged && descendants.length > 0) {
        await tx.accountingAccount.updateMany({
          where: { id: { in: descendants } },
          data: { type: finalType },
        });
      }

      return modified;
    });
        await registrarAuditoria({
      actor: await actorActual(),
      action: "UPDATE",
      module: "Contabilidad",
      entity: "Cuenta contable",
      entityId: accountId,
      description: `Modificó la cuenta contable ${updated.code} - ${updated.name}`,
      details: { antes: currentAccount, despues: updated },
      ipAddress: ipDeSolicitud(request),
    });
    return Response.json(toAccountApi(updated));
  } catch (error) {
    if (isDuplicateCodeError(error)) {
      return Response.json(
        {
          error: newCode
            ? `Ya existe una cuenta contable con el código ${newCode}.`
            : "Ya existe una cuenta contable con ese código.",
        },
        { status: 409 }
      );
    }
    console.error("[api/accounts/[id]] error al actualizar la cuenta:", error);
    return Response.json(
      { error: "No se pudo actualizar la cuenta contable." },
      { status: 500 }
    );
  }
}
