/**
 * Chart of accounts rules shared by `/api/accounts` route handlers.
 *
 * Used exclusively by server route handlers: field validation, error responses,
 * unique code index detection, and hierarchy calculation.
 */
import { Prisma } from "@prisma/client";

/** Supported account types (PCGE 2019), in listing order. */
export const VALID_ACCOUNT_TYPES = [
  "Activo",
  "Pasivo",
  "Patrimonio",
  "Ingreso",
  "Gasto",
  "Costo",
] as const;

/** Format allowed for `AccountingAccount.code` (`@db.VarChar(10)`). */
export const ACCOUNT_CODE_REGEX = /^[A-Za-z0-9.-]{1,10}$/;

/** Validated and normalized account fields ready for persistence. */
export interface AccountValues {
  code?: string;
  name?: string;
  type?: string;
  /** `null` = root account (no parent). */
  parentId?: number | null;
  active?: boolean;
}

/** Trimmed string from request body; non-string values are treated as empty string. */
export function trimText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validates and normalizes account fields depending on mode:
 *
 * - `create`: code, name, type, hierarchy, and status are mandatory.
 * - `edit`: only fields present in body are validated.
 *
 * Returns errors array (if any) and validated values.
 */
export function validateAccount(
  body: Record<string, unknown>,
  mode: "create" | "edit"
): { errors: string[]; values: AccountValues } {
  const errors: string[] = [];
  const values: AccountValues = {};
  const isCreate = mode === "create";

  const code = trimText(body.codigo ?? body.code);
  if (isCreate || body.codigo !== undefined || body.code !== undefined) {
    if (!code) {
      errors.push("El código de la cuenta es obligatorio.");
    } else if (!ACCOUNT_CODE_REGEX.test(code)) {
      errors.push(
        "El código sólo puede tener hasta 10 caracteres con letras, números, punto o guion."
      );
    } else {
      values.code = code;
    }
  }

  const name = trimText(body.nombre ?? body.name);
  if (isCreate || body.nombre !== undefined || body.name !== undefined) {
    if (!name) {
      errors.push("El nombre de la cuenta es obligatorio.");
    } else if (name.length > 100) {
      errors.push("El nombre de la cuenta no puede superar los 100 caracteres.");
    } else {
      values.name = name;
    }
  }

  if (isCreate || body.tipo !== undefined || body.type !== undefined) {
    const type = trimText(body.tipo ?? body.type);
    if (!(VALID_ACCOUNT_TYPES as readonly string[]).includes(type)) {
      errors.push(
        `El tipo de cuenta no es válido (valores admitidos: ${VALID_ACCOUNT_TYPES.join(", ")}).`
      );
    } else {
      values.type = type;
    }
  }

  const rawParentId = body.idPadre !== undefined ? body.idPadre : body.parentId;
  if (isCreate || rawParentId !== undefined) {
    if (rawParentId === undefined || rawParentId === null) {
      values.parentId = null;
    } else {
      const parsedNumber = typeof rawParentId === "number" ? rawParentId : Number(rawParentId);
      if (!Number.isInteger(parsedNumber) || parsedNumber <= 0) {
        errors.push("La cuenta padre indicada no es válida.");
      } else {
        values.parentId = parsedNumber;
      }
    }
  }

  const rawActive = body.activo !== undefined ? body.activo : body.active;
  if (isCreate || rawActive !== undefined) {
    const active = isCreate && rawActive === undefined ? true : rawActive;
    if (typeof active !== "boolean") {
      errors.push("El estado de la cuenta debe ser activo o inactivo.");
    } else {
      values.active = active;
    }
  }

  return { errors, values };
}

/** `true` when the error corresponds to unique index constraint on `AccountingAccount.code`. */
export function isDuplicateCodeError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** 400 Bad Request response with the first error as message and full details list. */
export function validationResponse(errors: string[]): Response {
  return Response.json({ error: errors[0], errores: errors }, { status: 400 });
}

/** 409 Conflict response: another account with that code already exists. */
export function duplicateCodeResponse(code: string): Response {
  return Response.json(
    { error: `Ya existe una cuenta contable con el código ${code}.` },
    { status: 409 }
  );
}

/** Fields always selected by the accounts API. */
export const ACCOUNT_SELECT = {
  id: true,
  code: true,
  name: true,
  type: true,
  parentId: true,
  active: true,
  _count: { select: { entryDetails: true } },
} as const;

/** Database row structure for `AccountingAccount` returned by `ACCOUNT_SELECT`. */
export interface AccountRow {
  id: number;
  code: string;
  name: string;
  type: string;
  parentId: number | null;
  active: boolean;
  _count?: { entryDetails: number };
}

/** Public API shape of an account in responses (maintains backward compatibility for clients). */
export interface AccountApi {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
  idPadre: number | null;
  activo: boolean;
  usos: number;
}

/** Maps a database row into the public API format. */
export function toAccountApi(account: AccountRow): AccountApi {
  return {
    id: account.id,
    codigo: account.code,
    nombre: account.name,
    tipo: account.type,
    idPadre: account.parentId,
    activo: account.active,
    usos: account._count?.entryDetails ?? 0,
  };
}

/** Minimal hierarchy node structure to traverse parent-child accounts. */
export interface HierarchyNode {
  id: number;
  parentId: number | null;
}

/**
 * Returns IDs of all descendants (children, grandchildren, ...) of the given account.
 * Calculated in-memory across the list to avoid recursive queries.
 */
export function getDescendantsOf(id: number, nodes: HierarchyNode[]): number[] {
  const childrenByParent = new Map<number, number[]>();
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const list = childrenByParent.get(node.parentId) ?? [];
    list.push(node.id);
    childrenByParent.set(node.parentId, list);
  }

  const descendants: number[] = [];
  const queue = [...(childrenByParent.get(id) ?? [])];
  while (queue.length > 0) {
    const currentId = queue.shift() as number;
    descendants.push(currentId);
    queue.push(...(childrenByParent.get(currentId) ?? []));
  }
  return descendants;
}
