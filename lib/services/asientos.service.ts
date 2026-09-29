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

/** Cuenta del plan contable disponible para una línea del asiento. */
export interface CuentaContable {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
}

/** Línea (partida) de un asiento manual: una cuenta y su importe. */
export interface LineaNuevaAsiento {
  /** `cuenta_contable.id_cuenta_contable`. */
  idCuenta: number;
  descripcion?: string;
  /** Importe en el Debe (0 si la partida va en el Haber). */
  debe: number;
  /** Importe en el Haber (0 si la partida va en el Debe). */
  haber: number;
}

/** Datos necesarios para registrar un asiento contable manual. */
export interface EntradaAsiento {
  /** Fecha contable (YYYY-MM-DD). */
  fecha: string;
  diario: string;
  glosa: string;
  responsable?: string;
  observacion?: string;
  /** Mínimo dos partidas y totales de debe y haber iguales. */
  lineas: LineaNuevaAsiento[];
}

const ORDENES_VALIDOS: OrdenAsiento[] = [
  "fecha",
  "numero",
  "concepto",
  "diario",
  "estado",
  "total",
];

/** Error de negocio devuelto por la API, con el detalle de cada validación. */
export class ErrorApi extends Error {
  /** Una entrada por cada validación fallida (la primera es la principal). */
  readonly errores: string[];

  constructor(mensaje: string, errores: string[] = []) {
    super(mensaje);
    this.name = "ErrorApi";
    this.errores = errores.length > 0 ? errores : [mensaje];
  }
}

async function pedir<T>(url: string, opciones: RequestInit): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, opciones);
  } catch {
    throw new Error("No se pudo conectar con el servidor.");
  }

  if (!respuesta.ok) {
    let mensaje = "Error inesperado al consultar el servicio.";
    let detalle: string[] = [];
    try {
      const cuerpo = (await respuesta.json()) as { error?: string; errores?: string[] };
      if (cuerpo?.error) mensaje = cuerpo.error;
      if (Array.isArray(cuerpo?.errores)) detalle = cuerpo.errores;
    } catch {
      /* la respuesta no traía cuerpo JSON */
    }
    throw new ErrorApi(mensaje, detalle);
  }

  return (await respuesta.json()) as T;
}

async function obtenerJson<T>(url: string): Promise<T> {
  return pedir<T>(url, { cache: "no-store" });
}

async function enviarJson<T>(url: string, cuerpo: unknown): Promise<T> {
  return pedir<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
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

/** Cuentas activas del plan contable, para seleccionar en las líneas. */
export async function listarCuentasContables(): Promise<CuentaContable[]> {
  const respuesta = await obtenerJson<{ data: CuentaContable[] }>(`${BASE}/cuentas`);
  return respuesta.data ?? [];
}

/**
 * Número sugerido (`MISC/AAAA/MM/NNNN`) que recibiría un asiento manual en la
 * fecha indicada. Es una vista previa: el definitivo se genera al crearlo.
 */
export async function obtenerSiguienteCodigo(fecha: string): Promise<string> {
  const params = fecha ? `?fecha=${encodeURIComponent(fecha)}` : "";
  const respuesta = await obtenerJson<{ codigo: string }>(`${BASE}/siguiente-codigo${params}`);
  return respuesta.codigo;
}

/** Registra un asiento contable manual y devuelve su resumen. */
export async function registrarAsiento(entrada: EntradaAsiento): Promise<AsientoResumen> {
  return enviarJson<AsientoResumen>(BASE, entrada);
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
