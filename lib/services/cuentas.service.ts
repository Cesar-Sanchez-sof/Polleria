/**
 * Servicio de frontend para la historia de usuario
 * "Listar y registrar cuentas contables".
 *
 * Centraliza el acceso a /api/cuentas: listado completo del plan contable
 * (raíces y subcuentas), alta de cuentas y modificación de sus datos,
 * jerarquía y estado (activa / inactiva).
 */
import { actualizarJson, enviarJson, ErrorApi, obtenerJson } from "./http";

const BASE = "/api/cuentas";

/** Tipos de cuenta del PCGE, en el mismo orden en que se muestran. */
export const TIPOS_CUENTA = [
  "Activo",
  "Pasivo",
  "Patrimonio",
  "Ingreso",
  "Gasto",
  "Costo",
] as const;

export type TipoCuenta = (typeof TIPOS_CUENTA)[number];

/** Cuenta del plan contable, tal y como la devuelve la API. */
export interface CuentaContable {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
  /** Cuenta de la que depende; `null` cuando es una cuenta raíz. */
  idPadre: number | null;
  activo: boolean;
  /** Líneas de asiento que ya usan la cuenta. */
  usos: number;
}

/** Datos de alta de una cuenta contable. */
export interface EntradaCuenta {
  codigo: string;
  nombre: string;
  tipo: string;
  /** `null` o ausente = cuenta raíz. */
  idPadre?: number | null;
  /** Por defecto `true`. */
  activo?: boolean;
}

/** Datos modificables de una cuenta: sólo lo que se envía se actualiza. */
export interface CambiosCuenta {
  codigo?: string;
  nombre?: string;
  tipo?: string;
  idPadre?: number | null;
  activo?: boolean;
}

/** Devuelve todas las cuentas del plan, ordenadas por código. */
export async function listarCuentas(): Promise<CuentaContable[]> {
  const respuesta = await obtenerJson<{ data: CuentaContable[] }>(BASE);
  return respuesta.data ?? [];
}

/** Registra una cuenta nueva (raíz o subcuenta) y la devuelve con su id. */
export async function registrarCuenta(entrada: EntradaCuenta): Promise<CuentaContable> {
  return enviarJson<CuentaContable>(BASE, entrada);
}

/** Actualiza datos, jerarquía o estado de una cuenta existente. */
export async function actualizarCuenta(
  id: number,
  cambios: CambiosCuenta
): Promise<CuentaContable> {
  return actualizarJson<CuentaContable>(`${BASE}/${id}`, cambios);
}

/** Los errores de la API llegan como `ErrorApi` con el detalle de cada validación. */
export { ErrorApi };
