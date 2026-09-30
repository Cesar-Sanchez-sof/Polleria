/**
 * Frontend service for "List and register accounting accounts".
 *
 * Centralizes access to `/api/cuentas`: full chart of accounts listing
 * (roots and sub-accounts), account creation, updates, hierarchy, and status.
 */
import { ApiError, getJson, patchJson, postJson } from "./http";

const BASE_URL = "/api/cuentas";

/** PCGE account types, in display order. */
export const ACCOUNT_TYPES = [
  "Activo",
  "Pasivo",
  "Patrimonio",
  "Ingreso",
  "Gasto",
  "Costo",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Chart of accounts item as returned by the API. */
export interface AccountingAccount {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
  /** Parent account; `null` for root accounts. */
  idPadre: number | null;
  activo: boolean;
  /** Journal entry lines currently using this account. */
  usos: number;
}

/** Input data to register an account. */
export interface AccountInput {
  codigo: string;
  nombre: string;
  tipo: string;
  /** `null` or undefined = root account. */
  idPadre?: number | null;
  /** Defaults to `true`. */
  activo?: boolean;
}

/** Modifiable account fields. */
export interface AccountChanges {
  codigo?: string;
  nombre?: string;
  tipo?: string;
  idPadre?: number | null;
  activo?: boolean;
}

/** Returns all accounts in the chart, sorted by code. */
export async function listAccounts(): Promise<AccountingAccount[]> {
  const response = await getJson<{ data: AccountingAccount[] }>(BASE_URL);
  return response.data ?? [];
}

/** Registers a new account (root or sub-account) and returns it with its generated id. */
export async function registerAccount(input: AccountInput): Promise<AccountingAccount> {
  return postJson<AccountingAccount>(BASE_URL, input);
}

/** Updates data, hierarchy, or status of an existing account. */
export async function updateAccount(
  id: number,
  changes: AccountChanges
): Promise<AccountingAccount> {
  return patchJson<AccountingAccount>(`${BASE_URL}/${id}`, changes);
}

// Backward-compatibility aliases
export const TIPOS_CUENTA = ACCOUNT_TYPES;
export type TipoCuenta = AccountType;
export type CuentaContable = AccountingAccount;
export type EntradaCuenta = AccountInput;
export type CambiosCuenta = AccountChanges;
export const listarCuentas = listAccounts;
export const registrarCuenta = registerAccount;
export const actualizarCuenta = updateAccount;
export { ApiError as ErrorApi };
