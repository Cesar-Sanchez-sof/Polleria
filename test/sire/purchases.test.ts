import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
import {
  consultPurchases,
  createSireGuard,
  extractReportText,
  MAX_DOCUMENTS,
  parseProposal,
  parseSireQuery,
  SIRE_API_HOST,
  SIRE_AUTH_HOST,
  SIRE_MESSAGES,
  SireError,
  totalsByCurrency,
  type SireDeps,
  type SireQuery,
} from "@/lib/sire/purchases";

const SECRETS = { solPassword: "Cl4ve-Sol!", clientSecret: "s3cr3t-api-value" };
const CREDENTIALS = { ruc: "20123456789", solUser: "MODDATOS", clientId: "11111111-2222-3333-4444-555555555555", ...SECRETS };
const QUERY: SireQuery = { credentials: CREDENTIALS, period: "202610", ticket: null };

const HEADER = [
  "RUC", "Apellidos y Nombres o Razón social", "Periodo", "CAR SUNAT", "Fecha de emisión", "Fecha Vcto/Pago", "Tipo CP/Doc.",
  "Serie del CDP", "Año", "Nro CP o Doc. Nro Inicial (Rango)", "Nro Final (Rango)", "Tipo Doc Identidad", "Nro Doc Identidad",
  "Apellidos Nombres/ Razón Social", "BI Gravado DG", "IGV / IPM DG", "BI Gravado DGNG", "IGV / IPM DGNG", "BI Gravado DNG",
  "IGV / IPM DNG", "Valor Adq. NG", "ISC", "ICBPER", "Otros Trib/ Cargos", "Total CP", "Moneda", "Tipo de Cambio",
].join("|");

function line(values: Record<string, string>): string {
  return HEADER.split("|").map((name) => values[name] ?? "").join("|");
}

const FACTURA = line({
  RUC: "20123456789", "Apellidos y Nombres o Razón social": "MI POLLERIA SAC", "CAR SUNAT": "2012345678901F001000000123",
  "Fecha de emisión": "05/10/2026", "Fecha Vcto/Pago": "20/10/2026", "Tipo CP/Doc.": "01", "Serie del CDP": "F001",
  "Nro CP o Doc. Nro Inicial (Rango)": "123", "Tipo Doc Identidad": "6", "Nro Doc Identidad": "20555555551",
  "Apellidos Nombres/ Razón Social": "AVICOLA SAN JOSE SAC", "BI Gravado DG": "100.00", "IGV / IPM DG": "18.00",
  "Total CP": "118.00", Moneda: "PEN",
});
const BOLETA = line({
  RUC: "20123456789", "CAR SUNAT": "X", "Fecha de emisión": "07/10/2026", "Tipo CP/Doc.": "3", "Serie del CDP": "B001",
  "Nro CP o Doc. Nro Inicial (Rango)": "45", "Nro Doc Identidad": "20555555552", "Apellidos Nombres/ Razón Social": "LIBRERIA UNO",
  "BI Gravado DG": "50.00", "IGV / IPM DG": "9.00", "Total CP": "59.00", Moneda: "PEN",
});
const FILE = [HEADER, FACTURA, BOLETA].join("\n");

function zip(content: string, name = "propuesta.txt"): Buffer {
  const archive = new AdmZip();
  archive.addFile(name, Buffer.from(content, "utf8"));
  return archive.toBuffer();
}

type Reply = Response | (() => Response);
interface Call { url: URL; init: RequestInit }

/** `fetch` falso que responde según la ruta; guarda cada llamada para inspeccionarla. */
function sunat(routes: Partial<Record<"token" | "export" | "tickets" | "download", Reply>>, waitMs = 40_000) {
  const calls: Call[] = [];
  let clock = 0;
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, init: init ?? {} });
    const key = url.pathname.includes("/oauth2/token") ? "token"
      : url.pathname.endsWith("exportacioncomprobantepropuesta") ? "export"
      : url.pathname.endsWith("consultaestadotickets") ? "tickets"
      : url.pathname.endsWith("archivoreporte") ? "download" : null;
    const reply = key ? routes[key] : undefined;
    if (!reply) return new Response("{}", { status: 404 });
    return typeof reply === "function" ? reply() : reply.clone();
  }) as typeof fetch;
  const deps: SireDeps = { fetchFn, sleep: async (ms) => { clock += ms; }, now: () => clock, waitMs };
  return { deps, calls };
}

const TOKEN = Response.json({ access_token: "tok-" + "a".repeat(30), token_type: "Bearer", expires_in: 3600 });
const EXPORT = Response.json({ numTicket: "20261000012345" });
const DONE = Response.json({
  registros: [{ numTicket: "20261000012345", codEstadoProceso: "06", desEstadoProceso: "Terminado", codProceso: "10",
    archivoReporte: [{ nomArchivoReporte: "LE20123456789202610080000.zip", codTipoAchivoReporte: "00" }] }],
});
const download = (content = FILE) => new Response(new Uint8Array(zip(content)));

describe("validación de la solicitud", () => {
  const body = { ruc: "20123456789", usuarioSol: "moddatos", claveSol: "Cl4ve-Sol!", clientId: CREDENTIALS.clientId, clientSecret: "s3cr3t-api-value", anio: 2026, mes: 10 };

  it("acepta una solicitud completa, normaliza el usuario SOL y arma el periodo", () => {
    const parsed = parseSireQuery(body);
    expect(parsed).toMatchObject({ ok: true, value: { period: "202610", ticket: null, credentials: { solUser: "MODDATOS", ruc: "20123456789" } } });
  });

  it("rechaza campos faltantes, extra o mal formados sin repetir los secretos", () => {
    const cases: Record<string, unknown> = {
      ruc: { ...body, ruc: "123" },
      usuario: { ...body, usuarioSol: "../x" },
      clave: { ...body, claveSol: "" },
      clientIdTraversal: { ...body, clientId: "../../etc/passwd" },
      secret: { ...body, clientSecret: "con espacio" },
      mes: { ...body, mes: 13 },
      anio: { ...body, anio: 1999 },
      ticket: { ...body, ticket: "a/b" },
      extra: { ...body, host: "evil.example" },
      array: [],
      nulo: null,
    };
    for (const [name, input] of Object.entries(cases)) {
      const parsed = parseSireQuery(input);
      expect(parsed.ok, name).toBe(false);
      if (!parsed.ok) for (const secret of Object.values(SECRETS)) expect(parsed.error).not.toContain(secret);
    }
  });
});

describe("consulta a SUNAT", () => {
  it("pide token, exporta la propuesta, espera el ticket, descarga y lee los comprobantes", async () => {
    let polls = 0;
    const { deps, calls } = sunat({
      token: TOKEN.clone(),
      export: EXPORT.clone(),
      tickets: () => (++polls < 2
        ? Response.json({ registros: [{ numTicket: "20261000012345", codEstadoProceso: "03", desEstadoProceso: "En proceso" }] })
        : DONE.clone()),
      download: () => download(),
    });
    const outcome = await consultPurchases(QUERY, deps);

    expect(outcome.status).toBe("ready");
    if (outcome.status !== "ready") return;
    expect(outcome.ticket).toBe("20261000012345");
    expect(outcome.documentCount).toBe(2);
    expect(outcome.documents.map((d) => [d.typeCode, d.typeName, `${d.series}-${d.number}`])).toEqual([
      ["01", "Factura", "F001-123"],
      ["03", "Boleta de venta", "B001-45"],
    ]);
    expect(outcome.documents[0]).toMatchObject({
      supplierDocument: "20555555551", supplierName: "AVICOLA SAN JOSE SAC", issueDate: "2026-10-05", taxableBase: 100, igv: 18, total: 118, currency: "PEN",
    });
    expect(outcome.totals).toEqual([{ currency: "PEN", count: 2, taxableBase: 150, igv: 27, total: 177 }]);

    // Token: host fijo, usuario = RUC + usuario SOL, credenciales en el cuerpo (no en la URL).
    const token = calls[0];
    expect(token.url.origin).toBe(SIRE_AUTH_HOST);
    expect(token.url.pathname).toBe(`/v1/clientessol/${CREDENTIALS.clientId}/oauth2/token/`);
    const form = token.init.body as URLSearchParams;
    expect(form.get("grant_type")).toBe("password");
    expect(form.get("scope")).toBe(SIRE_API_HOST);
    expect(form.get("username")).toBe("20123456789MODDATOS");
    expect(form.get("password")).toBe(SECRETS.solPassword);
    expect(token.url.search).toBe("");

    // Resto de llamadas: solo al host de SIRE, con el token en la cabecera y sin redirecciones.
    for (const call of calls.slice(1)) {
      expect(call.url.origin).toBe(SIRE_API_HOST);
      expect((call.init.headers as Record<string, string>).Authorization).toMatch(/^Bearer tok-/);
      expect(call.init.redirect).toBe("error");
      expect(call.url.href).not.toContain(SECRETS.solPassword);
      expect(call.url.href).not.toContain(SECRETS.clientSecret);
    }
    expect(calls[1].url.pathname).toContain("/202610/exportacioncomprobantepropuesta");
    expect(calls.at(-1)?.url.searchParams.get("numTicket")).toBe("20261000012345");
    expect(JSON.stringify(outcome)).not.toContain(SECRETS.solPassword);
    expect(JSON.stringify(outcome)).not.toContain(SECRETS.clientSecret);
  });

  it("si el ticket sigue en proceso al agotar la espera, devuelve el ticket para continuar", async () => {
    const pending = Response.json({ registros: [{ numTicket: "20261000012345", codEstadoProceso: "03", desEstadoProceso: "En proceso" }] });
    const { deps } = sunat({ token: TOKEN.clone(), export: EXPORT.clone(), tickets: pending }, 9_000);
    expect(await consultPurchases(QUERY, deps)).toEqual({ status: "pending", period: "202610", ticket: "20261000012345" });
  });

  it("con un ticket previo no vuelve a exportar la propuesta", async () => {
    const { deps, calls } = sunat({ token: TOKEN.clone(), tickets: DONE.clone(), download: () => download() });
    const outcome = await consultPurchases({ ...QUERY, ticket: "20261000012345" }, deps);
    expect(outcome.status).toBe("ready");
    expect(calls.some((c) => c.url.pathname.endsWith("exportacioncomprobantepropuesta"))).toBe(false);
  });

  it("credenciales rechazadas (400/401/403): error de credenciales y ninguna llamada más", async () => {
    for (const status of [400, 401, 403]) {
      const { deps, calls } = sunat({ token: new Response(JSON.stringify({ error: "invalid_grant", detail: SECRETS.solPassword }), { status }) });
      const error = await consultPurchases(QUERY, deps).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(SireError);
      expect(error).toMatchObject({ status: 401, kind: "credentials", message: SIRE_MESSAGES.credentials });
      expect((error as SireError).message).not.toContain(SECRETS.solPassword);
      expect(calls).toHaveLength(1);
    }
  });

  it("errores de SUNAT: 5xx, red, sin respuesta útil y proceso con error", async () => {
    const run = async (routes: Parameters<typeof sunat>[0]) => consultPurchases(QUERY, sunat(routes).deps).catch((e: unknown) => e as SireError);
    expect(await run({ token: new Response("", { status: 503 }) })).toMatchObject({ status: 502, kind: "other" });
    expect(await run({ token: Response.json({}) })).toMatchObject({ status: 502 });
    expect(await run({ token: TOKEN.clone(), export: new Response("{}", { status: 404 }) })).toMatchObject({ status: 404, message: SIRE_MESSAGES.noProposal });
    expect(await run({ token: TOKEN.clone(), export: Response.json({ numTicket: "../x" }) })).toMatchObject({ status: 502 });
    const failed = Response.json({ registros: [{ numTicket: "20261000012345", codEstadoProceso: "05", desEstadoProceso: "Terminado con errores" }] });
    expect(await run({ token: TOKEN.clone(), export: EXPORT.clone(), tickets: failed })).toMatchObject({ status: 502, message: SIRE_MESSAGES.failedTicket });

    const network = sunat({}).deps;
    network.fetchFn = (async () => { throw new TypeError("fetch failed"); }) as typeof fetch;
    expect(await consultPurchases(QUERY, network).catch((e: unknown) => e)).toMatchObject({ status: 503 });
    network.fetchFn = (async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); }) as typeof fetch;
    expect(await consultPurchases(QUERY, network).catch((e: unknown) => e)).toMatchObject({ status: 504 });
  });

  it("archivo con columnas desconocidas -> error claro, sin inventar datos", async () => {
    const { deps } = sunat({ token: TOKEN.clone(), export: EXPORT.clone(), tickets: DONE.clone(), download: () => download("a|b|c\n1|2|3") });
    expect(await consultPurchases(QUERY, deps).catch((e: unknown) => e)).toMatchObject({ status: 502, message: SIRE_MESSAGES.unknownColumns });
  });

  it("recorta lo que se envía al navegador pero informa la cantidad real", async () => {
    const rows = Array.from({ length: MAX_DOCUMENTS + 5 }, () => FACTURA);
    const { deps } = sunat({ token: TOKEN.clone(), export: EXPORT.clone(), tickets: DONE.clone(), download: () => download([HEADER, ...rows].join("\n")) });
    const outcome = await consultPurchases(QUERY, deps);
    expect(outcome.status === "ready" && [outcome.documents.length, outcome.documentCount, outcome.truncated]).toEqual([MAX_DOCUMENTS, MAX_DOCUMENTS + 5, true]);
  });
});

describe("lectura del archivo", () => {
  it("interpreta columnas por nombre aunque cambie el orden y distingue la razón social del proveedor", () => {
    const reordered = ["Total CP", "Serie del CDP", "Nro CP o Doc. Nro Inicial (Rango)", "Tipo CP/Doc.", "Apellidos y Nombres o Razón social", "Nro Doc Identidad", "Apellidos Nombres/ Razón Social"];
    const rows = parseProposal([reordered.join("|"), "11.80|F002|9|01|YO SAC|20999999991|PROVEEDOR X"].join("\n"));
    expect(rows).toEqual([expect.objectContaining({ total: 11.8, series: "F002", number: "9", typeCode: "01", supplierName: "PROVEEDOR X", supplierDocument: "20999999991" })]);
  });

  it("acepta CSV con comillas, ignora filas sin tipo de comprobante y devuelve null si faltan columnas clave", () => {
    const csv = 'Tipo CP/Doc.,Serie del CDP,Nro CP o Doc. Nro Inicial (Rango),Total CP,Moneda\n01,F001,7,"1,234.50",USD\nTOTAL,,,9999,\n';
    expect(parseProposal(csv)).toEqual([expect.objectContaining({ total: 1234.5, currency: "USD", number: "7" })]);
    expect(parseProposal("Serie|Total\nF001|1")).toBeNull();
    expect(parseProposal("")).toEqual([]);
  });

  it("totales por moneda sin mezclar soles y dólares", () => {
    const base = parseProposal(FILE)!;
    const usd = { ...base[0], currency: "USD", total: 10, taxableBase: 8, igv: 2 };
    expect(totalsByCurrency([...base, usd]).map((t) => [t.currency, t.count, t.total])).toEqual([["PEN", 2, 177], ["USD", 1, 10]]);
  });

  it("extrae el texto de un ZIP o de un TXT directo, y cae a Windows-1252 si no es UTF-8", () => {
    expect(extractReportText(zip("hola|mundo"))).toBe("hola|mundo");
    expect(extractReportText(Buffer.from("plano|texto"))).toBe("plano|texto");
    expect(extractReportText(Buffer.from([0x41, 0xf1, 0x6f]))).toBe("Año");
    expect(() => extractReportText(Buffer.from("PK\x03\x04roto-roto-roto"))).toThrow(SireError);
  });
});

describe("protección de la clave SOL", () => {
  it("limita consultas por usuario y pausa tras un rechazo de credenciales", () => {
    let now = 0;
    const guard = createSireGuard({ max: 2, windowMs: 1000, lockMs: 5000 }, () => now);
    expect([guard.check(1), guard.check(1), guard.check(1)]).toEqual([null, null, "rate"]);
    expect(guard.check(2)).toBeNull(); // otro usuario no se ve afectado
    now = 1001;
    expect(guard.check(1)).toBeNull();
    guard.credentialsRejected(1);
    expect(guard.check(1)).toBe("locked");
    now = 7000;
    expect(guard.check(1)).toBeNull();
  });
});
