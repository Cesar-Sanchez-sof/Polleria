/**
 * Servicio de frontend para la historia de usuario "Consultar libro diario".
 *
 * Centraliza el acceso a /api/diario: listado cronológico de asientos con sus
 * líneas (cuenta, descripción e importes) y totales, filtrado por un rango de
 * fechas y paginación.
 */

import { ErrorApi, obtenerJson } from "./http";

const BASE = "/api/diario";

/**
 * `ErrorApi` vive en ./http (se comparte con el resto de servicios) y se
 * reexporta desde aquí para que los consumidores de este módulo no cambien.
 */
export { ErrorApi };

/** Filtros del libro diario: un periodo (fechas inclusive) y la paginación. */
export interface FiltroDiario {
  /** Fecha inicial (YYYY-MM-DD, inclusive). */
  desde?: string;
  /** Fecha final (YYYY-MM-DD, inclusive). */
  hasta?: string;
  page?: number;
  pageSize?: number;
}

/** Línea del asiento: cuenta contable, descripción e importe en Debe/Haber. */
export interface LineaDiario {
  id: number;
  cuentaCodigo: string;
  cuentaNombre: string;
  cuentaTipo: string;
  descripcion: string;
  debe: number;
  haber: number;
}

/** Asiento del libro diario con sus líneas y totales. */
export interface AsientoDiario {
  id: number;
  /** Número/código único del asiento. */
  numero: string;
  /** Fecha contable (YYYY-MM-DD). */
  fecha: string;
  diario: string;
  /** Descripción (glosa) del asiento. */
  concepto: string;
  responsable: string | null;
  estado: "Registrado" | "Anulado";
  /** C05: totales del asiento. */
  totales: { debe: number; haber: number };
  /** C06: `true` cuando el total del Debe coincide con el del Haber. */
  cuadrado: boolean;
  lineas: LineaDiario[];
}

export interface MetaDiario {
  total: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
  /** Rango aplicado (vacío = sin filtro de periodo). */
  desde: string;
  hasta: string;
}

export interface PaginaDiario {
  data: AsientoDiario[];
  meta: MetaDiario;
}

/** Serializa los filtros a query string, omitiendo los vacíos. */
export function construirQueryDiario(filtros: FiltroDiario): string {
  const params = new URLSearchParams();

  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  if (filtros.page) params.set("page", String(filtros.page));
  if (filtros.pageSize) params.set("pageSize", String(filtros.pageSize));

  return params.toString();
}

/**
 * Lista los asientos del libro diario (cronológicamente, del más reciente al
 * más antiguo) aplicando el periodo indicado y la página solicitada.
 */
export async function listarLibroDiario(filtros: FiltroDiario = {}): Promise<PaginaDiario> {
  const query = construirQueryDiario(filtros);
  return obtenerJson<PaginaDiario>(`${BASE}${query ? `?${query}` : ""}`);
}

/**
 * Formatea una fecha ISO (YYYY-MM-DD) como dd/mm/AAAA y un importe en soles,
 * y consulta el detalle de un asiento. Se reutilizan los helpers del módulo de
 * asientos para que todo el bloque de contabilidad muestre los mismos formatos
 * y responda igual el detalle.
 */
export { formatearFecha, formatearMoneda, obtenerAsiento, type AsientoDetalle } from "./asientos.service";
