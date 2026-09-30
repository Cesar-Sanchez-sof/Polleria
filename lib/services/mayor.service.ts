/**
 * Servicio de frontend para la historia de usuario "Consultar libro mayor".
 *
 * Centraliza el acceso a /api/mayor: movimientos cronológicos de una cuenta
 * contable con su saldo corriente y totales, filtrados por un periodo de
 * fechas.
 */

import { ErrorApi, obtenerJson } from "./http";

const BASE = "/api/mayor";

/** `ErrorApi` se comparte con el resto de servicios; se reexporta aquí. */
export { ErrorApi };

/** Filtro del libro mayor: la cuenta a consultar y el periodo (inclusive). */
export interface FiltroMayor {
  /** Código de la cuenta contable (obligatorio). */
  codigo: string;
  /** Fecha inicial (YYYY-MM-DD, inclusive). */
  desde?: string;
  /** Fecha final (YYYY-MM-DD, inclusive). */
  hasta?: string;
}

/** Saldo de un movimiento: `deudor` (Debe > Haber), `acreedor` o `null` (cero). */
export type TipoSaldo = "deudor" | "acreedor" | null;

/** Movimiento de la cuenta: asiento de origen, importe y saldo resultante. */
export interface MovimientoMayor {
  id: number;
  /** Identificador del asiento contable relacionado (C13). */
  idAsiento: number;
  /** Número/código único del asiento (C05). */
  numero: string;
  /** Fecha de operación (YYYY-MM-DD) (C04). */
  fecha: string;
  /** Glosa del asiento (C06). */
  glosa: string;
  /** Descripción del movimiento dentro del asiento (C06). */
  descripcion: string;
  /** Módulo (diario) que originó el movimiento (C12). */
  modulo: string;
  /** Comprobante/planilla de origen, si quedó registrado (C12). */
  referencia: string | null;
  estado: "Registrado" | "Anulado";
  /** Importe en Debe o en Haber (C07). */
  debe: number;
  haber: number;
  /** Saldo de la cuenta después del movimiento (C08). */
  saldo: number;
  tipoSaldo: TipoSaldo;
}

export interface LibroMayor {
  /** Cuenta consultada (C02). */
  cuenta: { codigo: string; nombre: string; tipo: string };
  /** Saldo de la cuenta anterior a la fecha inicial del periodo. */
  saldoAnterior: number;
  /** Saldo de la cuenta después del último movimiento mostrado. */
  saldoFinal: number;
  /** Totales de los movimientos consultados (C11). */
  totales: { debe: number; haber: number; movimientos: number };
  movimientos: MovimientoMayor[];
}

/** Serializa el filtro a query string, omitiendo los valores vacíos. */
export function construirQueryMayor(filtros: FiltroMayor): string {
  const params = new URLSearchParams();

  params.set("codigo", filtros.codigo);
  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);

  return params.toString();
}

/**
 * Obtiene los movimientos cronológicos de una cuenta contable dentro del
 * periodo indicado, con el saldo corriente y los totales del periodo.
 */
export async function obtenerLibroMayor(filtros: FiltroMayor): Promise<LibroMayor> {
  const query = construirQueryMayor(filtros);
  return obtenerJson<LibroMayor>(`${BASE}?${query}`);
}

/**
 * Reutiliza los helpers y tipos del módulo de asientos (formatos, detalle del
 * asiento y plan contable) para que el bloque de contabilidad sea consistente.
 */
export {
  formatearFecha,
  formatearMoneda,
  listarCuentasContables,
  obtenerAsiento,
  type AsientoDetalle,
  type CuentaContable,
} from "./asientos.service";
