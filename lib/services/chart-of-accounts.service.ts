import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/services/audit.service";
import { currentActor } from "@/lib/auth/audit-actor";
import {
  ACCOUNT_SELECT,
  getDescendantsOf,
  HierarchyNode,
  isDuplicateCodeError,
  toAccountApi,
  validateAccount,
  AccountApi,
} from "@/lib/chart-of-accounts";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/http/errors";

export class AccountValidationError extends ValidationError {
  constructor(public errors: string[]) {
    super(errors[0], errors);
  }
}

const SELECT_PARENT = {
  id: true,
  type: true,
  active: true,
} as const;

const SELECT_NODE = {
  id: true,
  parentId: true,
} as const;

/**
 * Retorna todo el catálogo de cuentas contables ordenado por código.
 */
export async function listAccountsDomain(): Promise<{ data: AccountApi[] }> {
  const accounts = await prisma.accountingAccount.findMany({
    orderBy: { code: "asc" },
    select: ACCOUNT_SELECT,
  });

  return { data: accounts.map(toAccountApi) };
}

/**
 * Obtiene el detalle de una cuenta contable por ID.
 */
export async function getAccountByIdDomain(idParam: string): Promise<AccountApi> {
  const accountId = Number.parseInt(idParam, 10);
  if (Number.isNaN(accountId)) {
    throw new ValidationError("Identificador de cuenta inválido.");
  }

  const account = await prisma.accountingAccount.findUnique({
    where: { id: accountId },
    select: ACCOUNT_SELECT,
  });

  if (!account) {
    throw new NotFoundError("Cuenta contable no encontrada.");
  }

  return toAccountApi(account);
}

/**
 * Registra una nueva cuenta contable.
 */
export async function createAccountDomain(
  body: unknown,
  ipAddress?: string
): Promise<AccountApi> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("El cuerpo de la petición no es un JSON válido.");
  }

  const { errors, values } = validateAccount(body as Record<string, unknown>, "create");
  if (errors.length > 0) {
    throw new AccountValidationError(errors);
  }

  const code = values.code as string;
  const type = values.type as string;
  const parentId = values.parentId ?? null;

  const existing = await prisma.accountingAccount.findUnique({
    where: { code },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(`Ya existe una cuenta contable con el código ${code}.`);
  }

  if (parentId !== null) {
    const parent = await prisma.accountingAccount.findUnique({
      where: { id: parentId },
      select: { id: true, type: true, active: true },
    });

    if (!parent) {
      errors.push("La cuenta padre indicada no existe.");
    } else {
      if (!parent.active) {
        errors.push("La cuenta padre está inactiva: actívala antes de crear subcuentas.");
      }
      if (parent.type !== type) {
        errors.push(`La subcuenta debe tener el mismo tipo que su cuenta padre (${parent.type}).`);
      }
    }
    if (errors.length > 0) {
      throw new AccountValidationError(errors);
    }
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

    await logAudit({
      actor: await currentActor(),
      action: "CREATE",
      module: "Contabilidad",
      entity: "Cuenta contable",
      entityId: createdAccount.id,
      description: `Creó la cuenta contable ${code} - ${values.name}`,
      details: { after: { code, name: values.name, type, parentId, active: values.active ?? true } },
      ipAddress,
    });

    return toAccountApi(createdAccount);
  } catch (error) {
    if (isDuplicateCodeError(error)) {
      throw new ConflictError(`Ya existe una cuenta contable con el código ${code}.`);
    }
    throw error;
  }
}

/**
 * Modifica una cuenta contable existente.
 */
export async function updateAccountDomain(
  idParam: string,
  body: unknown,
  ipAddress?: string
): Promise<AccountApi> {
  const accountId = Number.parseInt(idParam, 10);
  if (Number.isNaN(accountId)) {
    throw new ValidationError("Identificador de cuenta inválido.");
  }

  const currentAccount = await prisma.accountingAccount.findUnique({
    where: { id: accountId },
    select: ACCOUNT_SELECT,
  });

  if (!currentAccount) {
    throw new NotFoundError("Cuenta contable no encontrada.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("El cuerpo de la petición no es un JSON válido.");
  }

  const { errors, values } = validateAccount(body as Record<string, unknown>, "edit");
  if (errors.length > 0) {
    throw new AccountValidationError(errors);
  }

  if (values.code !== undefined) {
    const existingWithCode = await prisma.accountingAccount.findUnique({
      where: { code: values.code },
      select: { id: true },
    });
    if (existingWithCode && existingWithCode.id !== accountId) {
      throw new ConflictError(`Ya existe una cuenta contable con el código ${values.code}.`);
    }
  }

  const finalType = values.type ?? currentAccount.type;
  const typeChanged = values.type !== undefined && values.type !== currentAccount.type;
  const changesParent = values.parentId !== undefined;
  const finalParentId = changesParent ? (values.parentId ?? null) : currentAccount.parentId;
  const isOwnParent = changesParent && finalParentId === accountId;

  if (isOwnParent) {
    errors.push("Una cuenta no puede ser su propia cuenta padre.");
    throw new AccountValidationError(errors);
  }

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

  if (values.active === false) {
    const activeChild = await prisma.accountingAccount.findFirst({
      where: { parentId: accountId, active: true },
      select: { id: true },
    });
    if (activeChild) {
      errors.push("No se puede desactivar una cuenta con subcuentas activas: desactívalas primero.");
    }
  }

  if (errors.length > 0) {
    throw new AccountValidationError(errors);
  }

  const descendants = nodes && typeChanged ? getDescendantsOf(accountId, nodes) : [];

  try {
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

    await logAudit({
      actor: await currentActor(),
      action: "UPDATE",
      module: "Contabilidad",
      entity: "Cuenta contable",
      entityId: accountId,
      description: `Modificó la cuenta contable ${updated.code} - ${updated.name}`,
      details: { before: currentAccount, after: updated },
      ipAddress,
    });

    return toAccountApi(updated);
  } catch (error) {
    if (isDuplicateCodeError(error)) {
      throw new ConflictError(
        values.code
          ? `Ya existe una cuenta contable con el código ${values.code}.`
          : "Ya existe una cuenta contable con ese código."
      );
    }
    throw error;
  }
}
