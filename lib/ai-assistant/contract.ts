/**
 * Contrato CT-B con el servicio de IA (`ai-service`, `POST /v1/queries`).
 *
 * Refleja exactamente los esquemas Pydantic de `ai-service/src/ai_service/http/schemas.py`.
 * La respuesta se valida antes de usarla: cualquier campo inesperado o con formato inválido hace
 * que se descarte completa (nunca se muestran datos a medias).
 */

export const RESPONSE_STATES = [
  "respondida",
  "sin_datos",
  "requiere_aclaracion",
  "solo_lectura",
  "fuera_de_dominio",
  "no_resoluble",
] as const;
export type ResponseState = (typeof RESPONSE_STATES)[number];

/** Pantallas cuyo contexto puede enviarse al servicio (P-2). */
export const AUTHORIZED_ROUTES = [
  "/accounting/entries",
  "/accounting/journal",
  "/accounting/accounts",
  "/accounting/ledger",
  "/accounting/balance",
  "/accounting/periods",
] as const;
export type AuthorizedRoute = (typeof AUTHORIZED_ROUTES)[number];

export const MAX_MESSAGE_CHARS = 1000;
export const MAX_HISTORY_TURNS = 10;

export interface QueryRequest {
  id_traza: string;
  usuario: { id: number; rol: string };
  mensaje: string;
  contexto: { ruta: AuthorizedRoute; filtros: Record<string, never> } | null;
  historial: { rol: "usuario" | "asistente"; texto: string }[];
  fecha_referencia_lima: string;
}

export interface Figure {
  marcador: string;
  valor: string;
  unidad: "PEN" | "%";
  origen: "executor" | "motor";
}

export interface Detail {
  tipo: "saldo_cuenta";
  cuenta: string;
  cuenta_nombre: string | null;
  periodo: { desde: string; hasta: string };
  etiquetas: { marcador: string; etiqueta: string }[];
  nota: string | null;
}

export interface QueryResponse {
  id_traza: string;
  estado: ResponseState;
  texto: string;
  cifras: Figure[];
  detalle: Detail | null;
}

const TRACE_RE = /^[A-Za-z0-9_-]{8,64}$/;
const MARKER_RE = /^c[0-9]{1,3}$/;
const DECIMAL_RE = /^-?\d{1,15}(\.\d{1,6})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ACCOUNT_RE = /^[0-9]{1,10}$/;

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Json, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isString(value: unknown, max: number, min = 0): value is string {
  return typeof value === "string" && value.length >= min && value.length <= max;
}

function parseFigure(value: unknown): Figure | null {
  if (!isObject(value) || !onlyKeys(value, ["marcador", "valor", "unidad", "origen"])) return null;
  const { marcador, valor, unidad, origen } = value;
  if (typeof marcador !== "string" || !MARKER_RE.test(marcador)) return null;
  if (typeof valor !== "string" || !DECIMAL_RE.test(valor)) return null; // importes como texto, nunca float
  if (unidad !== "PEN" && unidad !== "%") return null;
  if (origen !== "executor" && origen !== "motor") return null;
  return { marcador, valor, unidad, origen };
}

function parseDetail(value: unknown): Detail | null | undefined {
  if (value === null || value === undefined) return null;
  if (!isObject(value) || !onlyKeys(value, ["tipo", "cuenta", "cuenta_nombre", "periodo", "etiquetas", "nota"])) {
    return undefined;
  }
  const { tipo, cuenta, cuenta_nombre, periodo, etiquetas, nota } = value;
  if (tipo !== "saldo_cuenta" || typeof cuenta !== "string" || !ACCOUNT_RE.test(cuenta)) return undefined;
  if (cuenta_nombre !== null && cuenta_nombre !== undefined && !isString(cuenta_nombre, 60, 1)) return undefined;
  if (nota !== null && nota !== undefined && !isString(nota, 200)) return undefined;
  if (!isObject(periodo) || !onlyKeys(periodo, ["desde", "hasta"])) return undefined;
  const { desde, hasta } = periodo;
  if (typeof desde !== "string" || typeof hasta !== "string" || !DATE_RE.test(desde) || !DATE_RE.test(hasta)) {
    return undefined;
  }
  if (!Array.isArray(etiquetas) || etiquetas.length === 0 || etiquetas.length > 20) return undefined;
  const labels: Detail["etiquetas"] = [];
  for (const item of etiquetas) {
    if (!isObject(item) || !onlyKeys(item, ["marcador", "etiqueta"])) return undefined;
    if (typeof item.marcador !== "string" || !MARKER_RE.test(item.marcador) || !isString(item.etiqueta, 80, 1)) {
      return undefined;
    }
    labels.push({ marcador: item.marcador, etiqueta: item.etiqueta });
  }
  return {
    tipo,
    cuenta,
    cuenta_nombre: (cuenta_nombre as string | null | undefined) ?? null,
    periodo: { desde, hasta },
    etiquetas: labels,
    nota: (nota as string | null | undefined) ?? null,
  };
}

/** Valida la respuesta CT-B de `ai-service`. Devuelve `null` si no cumple el contrato. */
export function parseQueryResponse(value: unknown): QueryResponse | null {
  const keys = ["id_traza", "estado", "texto", "cifras", "evidencias", "versiones", "detalle"];
  if (!isObject(value) || !onlyKeys(value, keys)) return null;
  const { id_traza, estado, texto, cifras, detalle } = value;
  if (typeof id_traza !== "string" || !TRACE_RE.test(id_traza)) return null;
  if (typeof estado !== "string" || !(RESPONSE_STATES as readonly string[]).includes(estado)) return null;
  if (!isString(texto, 4000)) return null;
  if (!Array.isArray(cifras) || cifras.length > 20) return null;
  const figures: Figure[] = [];
  for (const item of cifras) {
    const figure = parseFigure(item);
    if (!figure) return null;
    figures.push(figure);
  }
  if (new Set(figures.map((f) => f.marcador)).size !== figures.length) return null;
  const parsedDetail = parseDetail(detalle);
  if (parsedDetail === undefined) return null;
  if (parsedDetail) {
    const labelled = parsedDetail.etiquetas.map((l) => l.marcador).sort();
    const markers = figures.map((f) => f.marcador).sort();
    if (estado !== "respondida" || labelled.join() !== markers.join()) return null;
  }
  return { id_traza, estado: estado as ResponseState, texto, cifras: figures, detalle: parsedDetail };
}
