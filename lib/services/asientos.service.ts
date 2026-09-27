/**
 * Servicio de frontend para la historia de usuario
 * "Consultar y filtrar asientos contables".
 *
 * Centraliza el acceso a /api/asientos: listado con filtros combinados,
 * orden y paginación, detalle de un asiento y opciones de filtrado.
 */

const BASE = "/api/asientos";

export type OrdenAsiento = "fecha" | "numero" | "concepto" | "diario" | "estado" | "total";
export type DireccionOrden = "asc" | "desc";
export type EstadoAsiento = "Registrado" | "Anulado";

/** Filtros que el usuario puede aplicar de forma simultánea. */
export interface FiltroAsientos {
  /** Fecha desde (YYYY-MM-DD, inclusive). */
  desde?: string;
  /** Fecha hasta (YYYY-MM-DD, inclusive). */
  hasta?: string;
  /** Diario contable exacto. Vacío = todos. */
  diario?: string;
  /** "registrado" | "anulado". Vacío = todos. */
  estado?: string;
  /** Búsqueda libre: número/referencia, concepto o cuenta contable. */
  q?: string;
  page?: number;
  pageSize?: number;
  orden?: OrdenAsiento;
  dir?: DireccionOrden;
}

export interface AsientoResumen {
  id: number;
  numero: string;
  fecha: string;
  diario: string;
  concepto: string;
  responsable: string | null;
  estado: EstadoAsiento;
  total: number;
}

export interface MetaAsientos {
  total: number;
  registrados: number;
  anulados: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
  orden: OrdenAsiento;
  dir: DireccionOrden;
}

export interface PaginaAsientos {
  data: AsientoResumen[];
  meta: MetaAsientos;
}

export interface LineaAsiento {
  id: number;
  cuentaCodigo: string;
  cuentaNombre: string;
  cuentaTipo: string;
  descripcion: string;
  debe: number;
  haber: number;
}

export interface AsientoDetalle {
  id: number;
  numero: string;
  fecha: string;
  diario: string;
  concepto: string;
  estado: EstadoAsiento;
  responsable: string;
  observacion: string;
  fechaCreacion: string;
  fechaActualizacion: string;
  total: number;
  cuadrado: boolean;
  totales: { debe: number; haber: number };
  lineas: LineaAsiento[];
}

export interface OpcionDiario {
  nombre: string;
  total: number;
}

export interface OpcionEstado {
  valor: string;
  etiqueta: string;
  total: number;
}

export interface OpcionesAsientos {
  diarios: OpcionDiario[];
  estados: OpcionEstado[];
}

const ORDENES_VALIDOS: OrdenAsiento[] = [
  "fecha",
  "numero",
  "concepto",
  "diario",
  "estado",
  "total",
];

async function obtenerJson<T>(url: string): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, { cache: "no-store" });
  } catch {
    throw new Error("No se pudo conectar con el servidor.");
  }

  if (!respuesta.ok) {
    let mensaje = "Error inesperado al consultar el servicio.";
    try {
      const cuerpo = (await respuesta.json()) as { error?: string };
      if (cuerpo?.error) mensaje = cuerpo.error;
    } catch {
      /* la respuesta no traía cuerpo JSON */
    }
    throw new Error(mensaje);
  }

  return (await respuesta.json()) as T;
}

/** Serializa los filtros a query string, omitiendo los vacíos. */
export function construirQuery(filtros: FiltroAsientos): string {
  const params = new URLSearchParams();

  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  if (filtros.diario) params.set("diario", filtros.diario);
  if (filtros.estado) params.set("estado", filtros.estado);
  if (filtros.q?.trim()) params.set("q", filtros.q.trim());
  if (filtros.page) params.set("page", String(filtros.page));
  if (filtros.pageSize) params.set("pageSize", String(filtros.pageSize));

  const orden = filtros.orden && ORDENES_VALIDOS.includes(filtros.orden) ? filtros.orden : "fecha";
  params.set("orden", orden);
  params.set("dir", filtros.dir === "asc" ? "asc" : "desc");

  return params.toString();
}

/**
 * Lista asientos aplicando todos los filtros indicados (se combinan con AND),
 * el orden pedido y la página solicitada.
 */
export async function listarAsientos(filtros: FiltroAsientos = {}): Promise<PaginaAsientos> {
  return obtenerJson<PaginaAsientos>(`${BASE}?${construirQuery(filtros)}`);
}

/** Devuelve el asiento seleccionado con todas sus líneas (cuenta, descripción, debe y haber). */
export async function obtenerAsiento(id: number): Promise<AsientoDetalle> {
  return obtenerJson<AsientoDetalle>(`${BASE}/${id}`);
}

/** Diarios contables y estados disponibles para los filtros, con sus conteos. */
export async function obtenerOpcionesAsientos(): Promise<OpcionesAsientos> {
  return obtenerJson<OpcionesAsientos>(`${BASE}/opciones`);
}

/** Formatea una fecha ISO (YYYY-MM-DD) como dd/mm/AAAA sin corrimiento horario. */
export function formatearFecha(iso: string): string {
  if (!iso) return "—";
  const [anio, mes, dia] = iso.split("-");
  if (!anio || !mes || !dia) return iso;
  return `${dia}/${mes}/${anio}`;
}

/** Formatea un importe en soles peruanos. */
export function formatearMoneda(valor: number): string {
  return `S/ ${(valor ?? 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
