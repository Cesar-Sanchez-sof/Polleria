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
  "/accounting/reports/ledger",
  "/accounting/reports/balance",
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
  /** `N`: cantidad (comprobantes, unidades vendidas). */
  unidad: "PEN" | "%" | "N";
  origen: "executor" | "motor";
}

/** `saldo_cuenta` lleva `cuenta`; `consulta` (familia de consulta entrenada, P1) lleva `titulo`. */
export interface Detail {
  tipo: "saldo_cuenta" | "consulta";
  cuenta: string | null;
  cuenta_nombre: string | null;
  titulo: string | null;
  /** `null` solo en consultas sin período (ruta ampliada, p. ej. stock actual). */
  periodo: { desde: string; hasta: string } | null;
  etiquetas: { marcador: string; etiqueta: string }[];
  nota: string | null;
}

export const DIAGNOSTIC_STAGES = [
  "prefiltro",
  "interpretacion",
  "plan",
  "recuperacion",
  "generacion_sql",
  "validacion_sql",
  "ejecucion_sql",
  "calculo",
  "explicacion",
] as const;

/** Traza técnica (solo modo diagnóstico autorizado): sin prompts, filas ni cifras. */
export interface Diagnostic {
  etapas: { etapa: (typeof DIAGNOSTIC_STAGES)[number]; estado: "ok" | "fallo"; codigo: string | null; ms: number }[];
  intencion: string | null;
  /** Familia de consulta entrenada elegida (P1) o `null` (saldo de una cuenta). */
  consulta: string | null;
  /** Magnitud contable que identificó el intérprete (ventas facturadas, cobros, compras facturadas…). */
  concepto: string | null;
  /** Código si el backend ajustó la familia al concepto (p. ej. `FAMILY_ADJUSTED_TO_CONCEPT`). */
  ajuste: string | null;
  /** `entrenada` (familia del entrenamiento), `saldo` (saldo de cuenta) o `ampliada` (fuera del catálogo). */
  ruta: "entrenada" | "saldo" | "ampliada" | null;
  /** Tablas que propuso el RAG de módulos y las que llegaron al prompt (ruta ampliada). */
  tablas_rag: string[];
  tablas_prompt: string[];
  /** Motivo del único reintento de la ruta ampliada y SQL del primer intento. */
  reintento: string | null;
  sql_previo: string | null;
  cuenta: string | null;
  periodo: { desde: string; hasta: string } | null;
  fragmentos_rag: number | null;
  /** Recuperador que respondió: `semantico` (Milvus/E5 híbrido) o `lexico` (fallback). */
  fuente_rag: "semantico" | "lexico" | "ninguno" | null;
  indice_rag: "milvus" | "local" | null;
  modelo_sql: {
    base: string;
    adaptador: string;
    latencia_ms: number;
    tokens_prompt: number;
    tokens_salida: number;
    fin: "stop" | "length";
  } | null;
  sql_generado: string | null;
  sql_validado: string | null;
  motivos_rechazo: string[];
  filas: number | null;
  duracion_total_ms: number;
}

export interface QueryResponse {
  id_traza: string;
  estado: ResponseState;
  texto: string;
  cifras: Figure[];
  detalle: Detail | null;
  diagnostico?: Diagnostic;
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
  if (unidad !== "PEN" && unidad !== "%" && unidad !== "N") return null;
  if (origen !== "executor" && origen !== "motor") return null;
  return { marcador, valor, unidad, origen };
}

function parseDetail(value: unknown): Detail | null | undefined {
  if (value === null || value === undefined) return null;
  if (!isObject(value) || !onlyKeys(value, ["tipo", "cuenta", "cuenta_nombre", "titulo", "periodo", "etiquetas", "nota"])) {
    return undefined;
  }
  const { tipo, cuenta, cuenta_nombre, titulo, periodo, etiquetas, nota } = value;
  if (tipo === "saldo_cuenta") {
    if (typeof cuenta !== "string" || !ACCOUNT_RE.test(cuenta) || (titulo !== null && titulo !== undefined)) return undefined;
  } else if (tipo === "consulta") {
    if ((cuenta !== null && cuenta !== undefined) || !isString(titulo, 80, 1)) return undefined;
  } else {
    return undefined;
  }
  if (cuenta_nombre !== null && cuenta_nombre !== undefined && !isString(cuenta_nombre, 60, 1)) return undefined;
  if (nota !== null && nota !== undefined && !isString(nota, 200)) return undefined;
  let period: Detail["periodo"] = null;
  if (periodo === null || periodo === undefined) {
    if (tipo === "saldo_cuenta") return undefined; // el saldo siempre tiene período
  } else {
    if (!isObject(periodo) || !onlyKeys(periodo, ["desde", "hasta"])) return undefined;
    const { desde, hasta } = periodo;
    if (typeof desde !== "string" || typeof hasta !== "string" || !DATE_RE.test(desde) || !DATE_RE.test(hasta)) {
      return undefined;
    }
    period = { desde, hasta };
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
    cuenta: (cuenta as string | null | undefined) ?? null,
    cuenta_nombre: (cuenta_nombre as string | null | undefined) ?? null,
    titulo: (titulo as string | null | undefined) ?? null,
    periodo: period,
    etiquetas: labels,
    nota: (nota as string | null | undefined) ?? null,
  };
}

const CODE_RE = /^[A-Z_]{3,40}$/;
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const isOptionalString = (value: unknown, max: number): value is string | null => value === null || isString(value, max);

/** Valida la traza técnica. `undefined` si no cumple el contrato (la respuesta se descarta entera). */
export function parseDiagnostic(value: unknown): Diagnostic | undefined {
  const keys = [
    "etapas", "intencion", "consulta", "concepto", "ajuste", "ruta", "tablas_rag", "tablas_prompt", "reintento",
    "sql_previo", "cuenta", "periodo", "fragmentos_rag", "fuente_rag", "indice_rag", "modelo_sql", "sql_generado", "sql_validado",
    "motivos_rechazo", "filas", "duracion_total_ms",
  ];
  if (!isObject(value) || !onlyKeys(value, keys) || !Object.keys(value).length) return undefined;
  const v = value;
  if (!Array.isArray(v.etapas) || v.etapas.length > 20) return undefined;
  const etapas: Diagnostic["etapas"] = [];
  for (const stage of v.etapas) {
    if (!isObject(stage) || !onlyKeys(stage, ["etapa", "estado", "codigo", "ms"])) return undefined;
    if (!(DIAGNOSTIC_STAGES as readonly unknown[]).includes(stage.etapa)) return undefined;
    if ((stage.estado !== "ok" && stage.estado !== "fallo") || !isCount(stage.ms)) return undefined;
    if (stage.codigo !== null && !(typeof stage.codigo === "string" && CODE_RE.test(stage.codigo))) return undefined;
    etapas.push({ etapa: stage.etapa as Diagnostic["etapas"][number]["etapa"], estado: stage.estado, codigo: stage.codigo, ms: stage.ms });
  }
  let periodo: Diagnostic["periodo"] = null;
  if (v.periodo !== null) {
    if (!isObject(v.periodo) || !onlyKeys(v.periodo, ["desde", "hasta"])) return undefined;
    const { desde, hasta } = v.periodo;
    if (typeof desde !== "string" || typeof hasta !== "string" || !DATE_RE.test(desde) || !DATE_RE.test(hasta)) return undefined;
    periodo = { desde, hasta };
  }
  let modelo: Diagnostic["modelo_sql"] = null;
  if (v.modelo_sql !== null) {
    const m = v.modelo_sql;
    const modelKeys = ["base", "adaptador", "latencia_ms", "tokens_prompt", "tokens_salida", "fin"];
    if (!isObject(m) || !onlyKeys(m, modelKeys) || !isString(m.base, 80, 1) || !isString(m.adaptador, 80, 1)) return undefined;
    if (!isCount(m.latencia_ms) || !isCount(m.tokens_prompt) || !isCount(m.tokens_salida)) return undefined;
    if (m.fin !== "stop" && m.fin !== "length") return undefined;
    modelo = { base: m.base, adaptador: m.adaptador, latencia_ms: m.latencia_ms, tokens_prompt: m.tokens_prompt, tokens_salida: m.tokens_salida, fin: m.fin };
  }
  if (!isOptionalString(v.intencion, 40) || !isOptionalString(v.sql_generado, 4000) || !isOptionalString(v.sql_validado, 4000)) {
    return undefined;
  }
  if (v.cuenta !== null && !(typeof v.cuenta === "string" && ACCOUNT_RE.test(v.cuenta))) return undefined;
  const consulta = v.consulta ?? null; // ausente en ai-service previo a P1
  if (consulta !== null && !(typeof consulta === "string" && /^[a-z][a-z_]{2,59}$/.test(consulta))) return undefined;
  const concepto = v.concepto ?? null;
  if (concepto !== null && !(typeof concepto === "string" && /^[a-z][a-z_]{2,59}$/.test(concepto))) return undefined;
  const ajuste = v.ajuste ?? null;
  if (ajuste !== null && !(typeof ajuste === "string" && CODE_RE.test(ajuste))) return undefined;
  const ruta = v.ruta ?? null;
  if (ruta !== null && ruta !== "entrenada" && ruta !== "saldo" && ruta !== "ampliada") return undefined;
  const tables = (value: unknown): string[] | undefined => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.length > 10) return undefined;
    return value.every((t) => typeof t === "string" && /^[a-z][a-z0-9_]{0,62}$/.test(t)) ? (value as string[]) : undefined;
  };
  const tablasRag = tables(v.tablas_rag);
  const tablasPrompt = tables(v.tablas_prompt);
  if (!tablasRag || !tablasPrompt) return undefined;
  const reintento = v.reintento ?? null;
  if (reintento !== null && !(typeof reintento === "string" && CODE_RE.test(reintento))) return undefined;
  const sqlPrevio = v.sql_previo ?? null;
  if (!isOptionalString(sqlPrevio, 4000)) return undefined;
  if ((v.fragmentos_rag !== null && !isCount(v.fragmentos_rag)) || (v.filas !== null && !isCount(v.filas))) return undefined;
  const fuenteRag = v.fuente_rag ?? null; // ausente en ai-service anterior
  if (fuenteRag !== null && fuenteRag !== "semantico" && fuenteRag !== "lexico" && fuenteRag !== "ninguno") return undefined;
  const indiceRag = v.indice_rag ?? null; // ausente en ai-service anterior
  if (indiceRag !== null && indiceRag !== "milvus" && indiceRag !== "local") return undefined;
  if (!isCount(v.duracion_total_ms)) return undefined;
  if (!Array.isArray(v.motivos_rechazo) || v.motivos_rechazo.length > 20) return undefined;
  if (!v.motivos_rechazo.every((code) => typeof code === "string" && CODE_RE.test(code))) return undefined;
  return {
    etapas,
    intencion: v.intencion,
    consulta,
    concepto,
    ajuste,
    ruta,
    tablas_rag: tablasRag,
    tablas_prompt: tablasPrompt,
    reintento,
    sql_previo: sqlPrevio,
    cuenta: v.cuenta as string | null,
    periodo,
    fragmentos_rag: v.fragmentos_rag as number | null,
    fuente_rag: fuenteRag,
    indice_rag: indiceRag,
    modelo_sql: modelo,
    sql_generado: v.sql_generado,
    sql_validado: v.sql_validado,
    motivos_rechazo: v.motivos_rechazo as string[],
    filas: v.filas as number | null,
    duracion_total_ms: v.duracion_total_ms,
  };
}

/** Valida la respuesta CT-B de `ai-service`. Devuelve `null` si no cumple el contrato. */
export function parseQueryResponse(value: unknown): QueryResponse | null {
  const keys = ["id_traza", "estado", "texto", "cifras", "evidencias", "versiones", "detalle", "diagnostico"];
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
  const response: QueryResponse = { id_traza, estado: estado as ResponseState, texto, cifras: figures, detalle: parsedDetail };
  if ("diagnostico" in value) {
    const diagnostic = parseDiagnostic(value.diagnostico);
    if (!diagnostic) return null;
    response.diagnostico = diagnostic;
  }
  return response;
}
