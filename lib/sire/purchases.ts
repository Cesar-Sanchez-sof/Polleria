/**
 * Consulta de comprobantes de compra en SUNAT (SIRE - módulo RCE), solo lectura.
 *
 * Flujo oficial de la API SIRE (todo con las credenciales del contribuyente, que NO se guardan ni se registran):
 *  1. Token OAuth2 (`api-seguridad.sunat.gob.pe`): `client_id`/`client_secret` de "Credenciales de API SUNAT"
 *     más RUC + usuario SOL + clave SOL.
 *  2. Exportar la propuesta del periodo -> devuelve un ticket (la generación es asíncrona).
 *  3. Consultar el ticket hasta que termine y descargar el archivo (ZIP con un TXT/CSV).
 *  4. Leer el archivo: solo se devuelven los comprobantes, nunca se envía ni se modifica nada en SUNAT.
 *
 * Los hosts de SUNAT son constantes (nunca salen de la entrada del usuario) y no se siguen redirecciones.
 * El archivo se interpreta por los NOMBRES de sus columnas, no por posición, para tolerar cambios de orden.
 */
import AdmZip from "adm-zip";

export const SIRE_AUTH_HOST = "https://api-seguridad.sunat.gob.pe";
export const SIRE_API_HOST = "https://api-sire.sunat.gob.pe";
const RCE_BOOK_CODE = "080000";
const PROPOSAL_PATH = "/v1/contribuyente/migeigv/libros/rce/propuesta/web/propuesta";
const MASSIVE_PATH = "/v1/contribuyente/migeigv/libros/rvierce/gestionprocesosmasivos/web/masivo";
/** Tope del archivo descargado y del texto ya descomprimido (defensa ante respuestas anómalas o ZIP bomb). */
export const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024;
/** Filas devueltas al navegador (el resto se cuenta pero no se envía). */
export const MAX_DOCUMENTS = 5000;
const REQUEST_TIMEOUT_MS = 20_000;
/** Espera máxima dentro de una misma consulta; si SUNAT sigue generando el archivo se devuelve el ticket. */
export const DEFAULT_WAIT_MS = 40_000;
const POLL_INTERVAL_MS = 4_000;

/** Error con mensaje seguro para mostrar al usuario (nunca incluye credenciales ni cuerpos de SUNAT). */
export class SireError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** `credentials` = SUNAT rechazó las credenciales (la ruta frena reintentos para no bloquear la clave SOL). */
    readonly kind: "credentials" | "other" = "other"
  ) {
    super(message);
    this.name = "SireError";
  }
}

export const SIRE_MESSAGES = {
  credentials: "SUNAT rechazó las credenciales. Verifica RUC, usuario SOL, clave SOL y las credenciales de API. Evita reintentar muchas veces: SUNAT puede bloquear la clave SOL.",
  proposalDenied: "SUNAT no entregó la propuesta de ese periodo (las credenciales fueron aceptadas). Prueba con un periodo ya cerrado o verifica que tu RUC tenga acceso a SIRE Compras.",
  unavailable: "SUNAT no está disponible en este momento. Inténtalo de nuevo en unos minutos.",
  timeout: "SUNAT tardó demasiado en responder. Inténtalo de nuevo.",
  noProposal: "SUNAT no tiene comprobantes de compra para ese periodo.",
  failedTicket: "SUNAT no pudo generar el archivo de comprobantes de ese periodo.",
  badFile: "No se pudo leer el archivo que devolvió SUNAT.",
  unknownColumns: "No se reconocieron las columnas del archivo de SUNAT.",
} as const;

// --------------------------------------------------------------------------------------------- entrada

export interface SireCredentials {
  ruc: string;
  solUser: string;
  solPassword: string;
  clientId: string;
  clientSecret: string;
}

export interface SireQuery {
  credentials: SireCredentials;
  /** `AAAAMM`. */
  period: string;
  /** Ticket de una consulta anterior que seguía en proceso. */
  ticket: string | null;
}

const PRINTABLE = /^[\x20-\x7e]+$/;

function text(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

/** Valida el cuerpo de la petición. Los mensajes nombran el campo, nunca repiten su valor. */
export function parseSireQuery(input: unknown): { ok: true; value: SireQuery } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, error: "Solicitud no válida." };
  const body = input as Record<string, unknown>;
  const allowed = new Set(["ruc", "usuarioSol", "claveSol", "clientId", "clientSecret", "anio", "mes", "ticket"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) return { ok: false, error: "Solicitud no válida." };

  const ruc = text(body.ruc);
  if (!ruc || !/^\d{11}$/.test(ruc)) return { ok: false, error: "El RUC debe tener 11 dígitos." };
  const solUser = text(body.usuarioSol);
  if (!solUser || !/^[A-Za-z0-9]{1,20}$/.test(solUser)) return { ok: false, error: "El usuario SOL solo admite letras y números." };
  // La clave se usa tal cual (sin recortar espacios): es un secreto, no un texto.
  const solPassword = typeof body.claveSol === "string" ? body.claveSol : null;
  if (!solPassword || solPassword.length > 64 || !PRINTABLE.test(solPassword)) return { ok: false, error: "Ingresa la clave SOL." };
  const clientId = text(body.clientId);
  if (!clientId || !/^[A-Za-z0-9-]{8,64}$/.test(clientId)) return { ok: false, error: "El Client ID de la API de SUNAT no es válido." };
  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret.trim() : null;
  if (!clientSecret || clientSecret.length > 128 || !/^[\x21-\x7e]+$/.test(clientSecret)) return { ok: false, error: "El Client Secret de la API de SUNAT no es válido." };

  const year = Number(body.anio);
  const month = Number(body.mes);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return { ok: false, error: "El año debe estar entre 2020 y 2100." };
  if (!Number.isInteger(month) || month < 1 || month > 12) return { ok: false, error: "El mes debe estar entre 1 y 12." };

  let ticket: string | null = null;
  if (body.ticket !== undefined && body.ticket !== null && body.ticket !== "") {
    ticket = text(body.ticket);
    if (!ticket || !/^[A-Za-z0-9-]{4,40}$/.test(ticket)) return { ok: false, error: "El ticket no es válido." };
  }

  return {
    ok: true,
    value: {
      credentials: { ruc, solUser: solUser.toUpperCase(), solPassword, clientId, clientSecret },
      period: `${year}${String(month).padStart(2, "0")}`,
      ticket,
    },
  };
}

// ------------------------------------------------------------------------------------------ salida

export interface SirePurchaseDocument {
  car: string;
  issueDate: string;
  dueDate: string;
  /** Código SUNAT del tipo de comprobante (`01` factura, `03` boleta...). */
  typeCode: string;
  typeName: string;
  series: string;
  number: string;
  supplierDocument: string;
  supplierName: string;
  currency: string;
  exchangeRate: number | null;
  taxableBase: number;
  igv: number;
  total: number;
}

export interface SireCurrencyTotal {
  currency: string;
  count: number;
  taxableBase: number;
  igv: number;
  total: number;
}

export type SireOutcome =
  | {
      status: "ready";
      period: string;
      ticket: string;
      documents: SirePurchaseDocument[];
      /** Cantidad real de comprobantes del archivo (puede superar `documents` si se recortó). */
      documentCount: number;
      truncated: boolean;
      totals: SireCurrencyTotal[];
    }
  | { status: "pending"; period: string; ticket: string };

export interface SireDeps {
  fetchFn: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  waitMs?: number;
}

export const defaultSireDeps = (): SireDeps => ({
  fetchFn: fetch,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: Date.now,
});

// -------------------------------------------------------------------------------------- llamadas a SUNAT

async function call(url: string, init: RequestInit, deps: SireDeps): Promise<Response> {
  try {
    return await deps.fetchFn(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (exc) {
    const name = exc instanceof Error ? exc.name : "";
    throw name === "TimeoutError" || name === "AbortError"
      ? new SireError(504, SIRE_MESSAGES.timeout)
      : new SireError(503, SIRE_MESSAGES.unavailable);
  }
}

async function jsonBody(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const data: unknown = await response.json();
    return typeof data === "object" && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Respuestas de error de SUNAT -> mensaje propio (el cuerpo de SUNAT no se reenvía). */
function failFrom(response: Response): SireError {
  // Diagnóstico en el log del servidor: solo estado y ruta (sin query), nunca el cuerpo ni credenciales.
  let path = "?";
  try {
    path = new URL(response.url).pathname;
  } catch {
    /* sin URL */
  }
  console.warn(`[sire] SUNAT respondió http=${response.status} en ${path}`);
  // Los errores de SIRE traen `cod` y `msg` genéricos (sin datos del contribuyente); se registran acotados.
  void response
    .clone()
    .json()
    .then((body: unknown) => {
      const data = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
      console.warn(`[sire] detalle: cod=${str(data.cod)} msg=${str(data.msg).slice(0, 200)}`);
    })
    .catch(() => undefined);
  // El token ya fue aceptado: un 401/403 aquí no son credenciales inválidas (periodo no disponible o sin acceso a
  // la propuesta), así que no se marca como "credentials" para no activar la pausa de reintentos.
  if (response.status === 401 || response.status === 403) return new SireError(403, SIRE_MESSAGES.proposalDenied);
  if (response.status === 404) return new SireError(404, SIRE_MESSAGES.noProposal);
  return new SireError(502, SIRE_MESSAGES.unavailable);
}

export async function requestToken(credentials: SireCredentials, deps: SireDeps): Promise<string> {
  const response = await call(
    `${SIRE_AUTH_HOST}/v1/clientessol/${encodeURIComponent(credentials.clientId)}/oauth2/token/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "password",
        scope: SIRE_API_HOST,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        username: `${credentials.ruc}${credentials.solUser}`,
        password: credentials.solPassword,
      }),
    },
    deps
  );
  // 400/401: credenciales o usuario SOL inválidos (SUNAT usa 400 con `invalid_grant`).
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    // Diagnóstico solo en el log del servidor: el código de error de OAuth (`invalid_client`: Client ID/secret,
    // `invalid_grant`: usuario o clave SOL) no contiene datos sensibles. Nunca se muestra en pantalla.
    const detail = await jsonBody(response);
    console.warn(`[sire] token rechazado: http=${response.status} error=${str(detail?.error) || "?"}`);
    throw new SireError(401, SIRE_MESSAGES.credentials, "credentials");
  }
  if (!response.ok) throw new SireError(502, SIRE_MESSAGES.unavailable);
  const data = await jsonBody(response);
  const token = data?.access_token;
  if (typeof token !== "string" || token.length < 10) throw new SireError(502, SIRE_MESSAGES.unavailable);
  return token;
}

const bearer = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}`, Accept: "application/json" });

/** Pide a SUNAT que genere el archivo de la propuesta del periodo y devuelve el ticket. */
export async function requestProposalTicket(token: string, period: string, deps: SireDeps): Promise<string> {
  const query = new URLSearchParams({ codTipoArchivo: "0", codOrigenEnvio: "2" });
  const response = await call(
    `${SIRE_API_HOST}${PROPOSAL_PATH}/${period}/exportacioncomprobantepropuesta?${query}`,
    { method: "GET", headers: bearer(token) },
    deps
  );
  if (!response.ok) throw failFrom(response);
  const data = await jsonBody(response);
  const ticket = data?.numTicket ?? data?.ticket;
  const value = typeof ticket === "number" ? String(ticket) : ticket;
  if (typeof value !== "string" || !/^[A-Za-z0-9-]{4,40}$/.test(value)) throw new SireError(502, SIRE_MESSAGES.unavailable);
  return value;
}

interface TicketFile {
  name: string;
  type: string;
  processCode: string;
}

type TicketState = { state: "pending" } | { state: "failed" } | { state: "ready"; file: TicketFile };

const str = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

export async function checkTicket(token: string, period: string, ticket: string, deps: SireDeps): Promise<TicketState> {
  const query = new URLSearchParams({ perIni: period, perFin: period, page: "1", perPage: "20", numTicket: ticket });
  const response = await call(`${SIRE_API_HOST}${MASSIVE_PATH}/consultaestadotickets?${query}`, { method: "GET", headers: bearer(token) }, deps);
  if (!response.ok) throw failFrom(response);
  const data = await jsonBody(response);
  const records = Array.isArray(data?.registros) ? (data.registros as unknown[]) : [];
  const record = records.find((r): r is Record<string, unknown> => typeof r === "object" && r !== null && str((r as Record<string, unknown>).numTicket) === ticket);
  if (!record) return { state: "pending" }; // aún no figura en la lista de procesos

  const description = str(record.desEstadoProceso).toLowerCase();
  const code = str(record.codEstadoProceso);
  if (/error|rechaz|fall/.test(description)) return { state: "failed" };
  if (code !== "06" && !description.includes("terminado")) return { state: "pending" };

  const files = Array.isArray(record.archivoReporte) ? (record.archivoReporte as unknown[]) : [];
  const first = files.find((f): f is Record<string, unknown> => typeof f === "object" && f !== null);
  const name = str(first?.nomArchivoReporte);
  if (!first || !name) return { state: "failed" };
  // SUNAT escribe `codTipoAchivoReporte` (sin la "r"); se aceptan ambas formas.
  const type = str(first.codTipoArchivoReporte) || str(first.codTipoAchivoReporte) || "00";
  return { state: "ready", file: { name, type, processCode: str(record.codProceso) || "10" } };
}

export async function downloadReport(token: string, period: string, ticket: string, file: TicketFile, deps: SireDeps): Promise<Buffer> {
  const query = new URLSearchParams({
    nomArchivoReporte: file.name,
    codTipoArchivoReporte: file.type,
    perTributario: period,
    codProceso: file.processCode,
    numTicket: ticket,
    codLibro: RCE_BOOK_CODE,
  });
  const response = await call(`${SIRE_API_HOST}${MASSIVE_PATH}/archivoreporte?${query}`, { method: "GET", headers: { Authorization: `Bearer ${token}` } }, deps);
  if (!response.ok) throw failFrom(response);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_DOWNLOAD_BYTES) throw new SireError(502, SIRE_MESSAGES.badFile);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_DOWNLOAD_BYTES) throw new SireError(502, SIRE_MESSAGES.badFile);
  return bytes;
}

// ------------------------------------------------------------------------------------- lectura del archivo

/** Texto del archivo: ZIP (lo habitual) o TXT/CSV directo. Decodifica UTF-8 y, si falla, Windows-1252. */
export function extractReportText(bytes: Buffer): string {
  let raw = bytes;
  if (bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    try {
      const entries = new AdmZip(bytes).getEntries().filter((entry) => !entry.isDirectory);
      const entry = entries.find((e) => /\.(txt|csv)$/i.test(e.entryName)) ?? entries[0];
      if (!entry || entry.header.size > MAX_UNZIPPED_BYTES) throw new Error("zip");
      raw = entry.getData();
    } catch {
      throw new SireError(502, SIRE_MESSAGES.badFile);
    }
  }
  const utf8 = new TextDecoder("utf-8").decode(raw);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(raw) : utf8;
}

function splitLine(line: string, delimiter: string): string[] {
  if (delimiter === "|") return line.split("|").map((cell) => cell.trim());
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { cells.push(current.trim()); current = ""; }
    else current += char;
  }
  cells.push(current.trim());
  return cells;
}

/** `Fecha de Emisión` -> `fechadeemision` (sin tildes, espacios ni signos). */
const normalize = (header: string): string =>
  header.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const DOCUMENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  "01": "Factura",
  "03": "Boleta de venta",
  "07": "Nota de crédito",
  "08": "Nota de débito",
  "12": "Ticket de máquina registradora",
  "14": "Recibo de servicios públicos",
});

function amount(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

/** `dd/mm/aaaa` -> `aaaa-mm-dd`; cualquier otro formato se conserva. */
function isoDate(value: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : value;
}

/** Posición de la primera columna cuyo nombre normalizado está en `names`. */
function find(headers: string[], names: string[], from = 0): number {
  for (let i = from; i < headers.length; i++) if (names.includes(headers[i])) return i;
  return -1;
}

/**
 * Interpreta el archivo de la propuesta del RCE. Devuelve `null` si no reconoce las columnas mínimas
 * (tipo, serie, número y total).
 */
export function parseProposal(content: string): SirePurchaseDocument[] | null {
  const lines = content.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes("|") ? "|" : ",";
  const headers = splitLine(lines[0], delimiter).map(normalize);

  const type = find(headers, ["tipocpdoc", "tipodecomprobante", "tipocp"]);
  const series = find(headers, ["seriedelcdp", "serie", "seriedelcomprobante"]);
  const number = find(headers, ["nrocpodocnroinicialrango", "numero", "nrocp", "nrodelcomprobante"]);
  const total = find(headers, ["totalcp", "total", "importetotal"]);
  if (type < 0 || series < 0 || number < 0 || total < 0) return null;

  const car = find(headers, ["carsunat", "car"]);
  const issue = find(headers, ["fechadeemision", "fechaemision"]);
  const due = find(headers, ["fechavctopago", "fechadevencimiento", "fechavcto"]);
  const supplierDoc = find(headers, ["nrodocidentidad", "numdocidentidad", "nrodedocumentodeidentidad"]);
  // La primera columna de razón social es la del contribuyente; la del proveedor viene después del documento.
  const supplierName =
    supplierDoc >= 0
      ? headers.findIndex((h, i) => i > supplierDoc && h.includes("razonsocial"))
      : headers.map((h) => h.includes("razonsocial")).lastIndexOf(true);
  const currency = find(headers, ["moneda"]);
  const rate = find(headers, ["tipodecambio", "tipocambio"]);
  const bases = ["bigravadodg", "bigravadodgng", "bigravadodng"].map((name) => find(headers, [name]));
  const igvs = ["igvipmdg", "igvipmdgng", "igvipmdng"].map((name) => find(headers, [name]));

  const documents: SirePurchaseDocument[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, delimiter);
    const at = (index: number): string => (index >= 0 ? cells[index] ?? "" : "");
    const typeCode = at(type).padStart(2, "0");
    if (!/^\d{2}$/.test(typeCode)) continue; // línea de totales u otra fila sin comprobante
    const rateText = at(rate);
    documents.push({
      car: at(car),
      issueDate: isoDate(at(issue)),
      dueDate: isoDate(at(due)),
      typeCode,
      typeName: DOCUMENT_TYPES[typeCode] ?? "Otro comprobante",
      series: at(series),
      number: at(number),
      supplierDocument: at(supplierDoc),
      supplierName: supplierName >= 0 ? at(supplierName) : "",
      currency: at(currency) || "PEN",
      exchangeRate: rateText ? amount(rateText) : null,
      taxableBase: bases.reduce((sum, index) => sum + amount(at(index)), 0),
      igv: igvs.reduce((sum, index) => sum + amount(at(index)), 0),
      total: amount(at(total)),
    });
  }
  return documents;
}

const cents = (value: number): number => Math.round(value * 100) / 100;

/** Totales por moneda (no se mezclan soles con dólares). */
export function totalsByCurrency(documents: SirePurchaseDocument[]): SireCurrencyTotal[] {
  const map = new Map<string, SireCurrencyTotal>();
  for (const doc of documents) {
    const row = map.get(doc.currency) ?? { currency: doc.currency, count: 0, taxableBase: 0, igv: 0, total: 0 };
    row.count += 1;
    row.taxableBase += doc.taxableBase;
    row.igv += doc.igv;
    row.total += doc.total;
    map.set(doc.currency, row);
  }
  return [...map.values()].map((row) => ({ ...row, taxableBase: cents(row.taxableBase), igv: cents(row.igv), total: cents(row.total) }));
}

// ------------------------------------------------------------------------------------------- orquestación

/** Consulta completa: token -> ticket (nuevo o previo) -> espera -> descarga -> lectura. */
export async function consultPurchases(query: SireQuery, deps: SireDeps = defaultSireDeps()): Promise<SireOutcome> {
  const token = await requestToken(query.credentials, deps);
  const ticket = query.ticket ?? (await requestProposalTicket(token, query.period, deps));

  const deadline = deps.now() + (deps.waitMs ?? DEFAULT_WAIT_MS);
  for (;;) {
    const state = await checkTicket(token, query.period, ticket, deps);
    if (state.state === "failed") throw new SireError(502, SIRE_MESSAGES.failedTicket);
    if (state.state === "ready") {
      const bytes = await downloadReport(token, query.period, ticket, state.file, deps);
      const all = parseProposal(extractReportText(bytes));
      if (all === null) throw new SireError(502, SIRE_MESSAGES.unknownColumns);
      return {
        status: "ready",
        period: query.period,
        ticket,
        documents: all.slice(0, MAX_DOCUMENTS),
        documentCount: all.length,
        truncated: all.length > MAX_DOCUMENTS,
        totals: totalsByCurrency(all),
      };
    }
    if (deps.now() + POLL_INTERVAL_MS >= deadline) return { status: "pending", period: query.period, ticket };
    await deps.sleep(POLL_INTERVAL_MS);
  }
}

// ------------------------------------------------------------------------------------------- protección

/**
 * Límite por usuario (en memoria, por instancia: tope aproximado en serverless). Además, tras un rechazo de
 * credenciales se frena al usuario un rato: SUNAT bloquea la clave SOL con varios intentos fallidos seguidos.
 */
export function createSireGuard(options: { max: number; windowMs: number; lockMs: number }, now: () => number = Date.now) {
  const hits = new Map<number, number[]>();
  const locked = new Map<number, number>();
  return {
    /** `null` si puede continuar; si no, el motivo. */
    check(userId: number): "rate" | "locked" | null {
      const t = now();
      if ((locked.get(userId) ?? 0) > t) return "locked";
      const recent = (hits.get(userId) ?? []).filter((at) => t - at < options.windowMs);
      if (recent.length >= options.max) {
        hits.set(userId, recent);
        return "rate";
      }
      recent.push(t);
      hits.set(userId, recent);
      return null;
    },
    credentialsRejected(userId: number): void {
      locked.set(userId, now() + options.lockMs);
    },
  };
}
