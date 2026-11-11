/**
 * Integración con la caja registradora física (gaveta de efectivo + impresora térmica de caja).
 *
 * Una gaveta de pollería se abre con un pulso ESC/POS que la impresora térmica recibe y reenvía al
 * conector RJ11 (`ESC p`). Este módulo soporta dos modos:
 *
 *  - **simulated** (por defecto): no toca hardware; arma el ticket y el pulso, y los guarda en una bitácora
 *    en memoria que la API expone para demostrar/probar el flujo.
 *  - **network**: envía los bytes ESC/POS por TCP (puerto 9100) a una impresora térmica de red.
 *
 * Selección del modo (en orden):
 *  1. `CASH_DRAWER_MODE=simulated|network|off` (variable de entorno).
 *  2. La impresora de caja configurada (`Configuración → Impresoras`): si está activa y su campo
 *     «IP o puerto» tiene la forma `192.168.1.50` o `192.168.1.50:9100` → network. Cualquier otro
 *     valor (p. ej. `USB001 / Local`) → simulated.
 *
 * Un fallo del dispositivo **nunca** debe impedir abrir o cerrar la caja: `notifyCashDrawer` no lanza.
 */
import net from "node:net";
import { getPrinterConfig } from "@/lib/services/settings/restaurant-config.service";

export type DrawerMode = "simulated" | "network" | "off";
export type DrawerEventType = "OPEN_SESSION" | "CLOSE_SESSION" | "NO_SALE";

export interface DrawerTicketInfo {
  registerName: string;
  sessionId: number;
  cashier: string;
  at: Date;
  initialAmount?: number;
  salesCash?: number;
  incomes?: number;
  expenses?: number;
  expectedAmount?: number;
  countedAmount?: number;
  difference?: number;
  reason?: string;
}

export interface DrawerResult {
  ok: boolean;
  mode: DrawerMode;
  event: DrawerEventType;
  message: string;
  /** Texto del ticket tal como saldría en papel (útil en modo simulado). */
  ticket: string;
  at: string;
  target?: string;
}

// ---------------------------------------------------------------------------
// ESC/POS
// ---------------------------------------------------------------------------

const ESC = 0x1b;
const GS = 0x1d;

/** `ESC p m t1 t2`: pulso al pin 2 (m=0) por 50 ms ON / 500 ms OFF (valores en unidades de 2 ms). */
export function drawerPulseCommand(pin: 0 | 1 = 0): Buffer {
  return Buffer.from([ESC, 0x70, pin, 25, 250]);
}

const INIT = Buffer.from([ESC, 0x40]);
const ALIGN_CENTER = Buffer.from([ESC, 0x61, 1]);
const ALIGN_LEFT = Buffer.from([ESC, 0x61, 0]);
const BOLD_ON = Buffer.from([ESC, 0x45, 1]);
const BOLD_OFF = Buffer.from([ESC, 0x45, 0]);
/** `GS V B 0`: avanza papel y corta. */
const CUT = Buffer.from([GS, 0x56, 0x42, 0x00]);

/** Las impresoras térmicas usan una página de códigos de 1 byte: se quitan acentos y símbolos raros. */
export function toPrinterText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e\n]/g, "?");
}

const money = (n: number) => `S/ ${n.toFixed(2)}`;

function row(label: string, value: string, width: number): string {
  const space = Math.max(1, width - label.length - value.length);
  return `${label}${" ".repeat(space)}${value}`;
}

function limaStamp(at: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

/** Líneas del ticket de apertura, cierre o apertura sin venta. `width` = caracteres por línea (48 = 80 mm, 32 = 58 mm). */
export function ticketLines(event: DrawerEventType, info: DrawerTicketInfo, width = 42): string[] {
  const line = "-".repeat(width);
  const title = event === "OPEN_SESSION" ? "APERTURA DE CAJA" : event === "CLOSE_SESSION" ? "CIERRE DE CAJA" : "GAVETA SIN VENTA";
  const out = [title, info.registerName, line];
  out.push(row("Sesion:", `#${info.sessionId}`, width));
  out.push(row("Cajero:", info.cashier, width));
  out.push(row("Fecha:", limaStamp(info.at), width));
  out.push(line);
  if (event === "OPEN_SESSION") {
    out.push(row("Fondo inicial:", money(info.initialAmount ?? 0), width));
  } else if (event === "CLOSE_SESSION") {
    out.push(row("Fondo inicial:", money(info.initialAmount ?? 0), width));
    out.push(row("Ventas efectivo:", money(info.salesCash ?? 0), width));
    out.push(row("Ingresos:", money(info.incomes ?? 0), width));
    out.push(row("Egresos:", `-${money(info.expenses ?? 0)}`, width));
    out.push(line);
    out.push(row("Esperado:", money(info.expectedAmount ?? 0), width));
    out.push(row("Contado:", money(info.countedAmount ?? 0), width));
    const diff = info.difference ?? 0;
    out.push(row(diff === 0 ? "Diferencia:" : diff > 0 ? "SOBRANTE:" : "FALTANTE:", money(Math.abs(diff)), width));
  } else {
    out.push(row("Motivo:", (info.reason ?? "").slice(0, width - 8), width));
  }
  out.push(line, "", "Firma cajero: ____________________", "");
  return out;
}

/** Bytes ESC/POS: ticket + pulso de gaveta + corte. */
export function buildDrawerPayload(event: DrawerEventType, info: DrawerTicketInfo, opts: { width?: number; withTicket?: boolean } = {}): Buffer {
  const lines = ticketLines(event, info, opts.width ?? 42);
  const parts: Buffer[] = [INIT, drawerPulseCommand()];
  if (opts.withTicket !== false) {
    parts.push(ALIGN_CENTER, BOLD_ON, Buffer.from(toPrinterText(`${lines[0]}\n${lines[1]}\n`), "latin1"), BOLD_OFF, ALIGN_LEFT);
    parts.push(Buffer.from(toPrinterText(lines.slice(2).join("\n") + "\n"), "latin1"), CUT);
  }
  return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------
// Configuración y envío
// ---------------------------------------------------------------------------

export interface DrawerTarget {
  mode: DrawerMode;
  host?: string;
  port?: number;
  width: number;
}

const HOST_PORT = /^(\d{1,3}(?:\.\d{1,3}){3}|[a-z0-9][a-z0-9.-]*[a-z0-9])(?::(\d{2,5}))?$/i;

export function parseDevice(ipOrPort: string): { host: string; port: number } | null {
  const m = HOST_PORT.exec(ipOrPort.trim());
  // `USB001 / Local` no es un host (tiene espacios y barra), pero «COM3» sí cumpliría: exige IP o nombre con punto.
  if (!m || (!/^\d/.test(m[1]) && !m[1].includes("."))) return null;
  const port = m[2] ? Number(m[2]) : 9100;
  return port > 0 && port < 65536 ? { host: m[1], port } : null;
}

export async function resolveDrawerTarget(): Promise<DrawerTarget> {
  const forced = process.env.CASH_DRAWER_MODE?.toLowerCase();
  const printer = await getPrinterConfig().catch(() => null);
  const width = printer?.paperWidth === "58mm" ? 32 : 42;
  const device = printer?.cashierPrinter?.active ? parseDevice(printer.cashierPrinter.ipOrPort ?? "") : null;
  if (forced === "off") return { mode: "off", width };
  if (forced === "simulated") return { mode: "simulated", width };
  if (forced === "network" || device) {
    const host = process.env.CASH_DRAWER_HOST ?? device?.host;
    const port = Number(process.env.CASH_DRAWER_PORT ?? device?.port ?? 9100);
    if (host) return { mode: "network", host, port, width };
  }
  return { mode: "simulated", width };
}

function sendTcp(host: string, port: number, data: Buffer, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const fail = (e: Error) => {
      socket.destroy();
      reject(e);
    };
    socket.setTimeout(timeoutMs, () => fail(new Error(`Tiempo de espera agotado conectando a ${host}:${port}`)));
    socket.once("error", fail);
    socket.once("connect", () => socket.end(data, () => resolve()));
  });
}

/** Bitácora en memoria del modo simulado (últimos 50 eventos del proceso). */
const simulatedLog: DrawerResult[] = [];
export function recentDrawerEvents(limit = 20): DrawerResult[] {
  return simulatedLog.slice(-limit).reverse();
}
export function clearDrawerEvents() {
  simulatedLog.length = 0;
}

/**
 * Abre la gaveta e imprime el ticket de apertura/cierre/sin venta. Nunca lanza.
 */
export async function notifyCashDrawer(event: DrawerEventType, info: DrawerTicketInfo): Promise<DrawerResult> {
  const base = { event, at: info.at.toISOString() };
  let target: DrawerTarget = { mode: "simulated", width: 42 };
  try {
    target = await resolveDrawerTarget();
  } catch {
    /* se usa el modo simulado */
  }
  const ticket = ticketLines(event, info, target.width).join("\n");

  if (target.mode === "off") {
    return { ...base, ok: true, mode: "off", ticket, message: "Integración con la caja física desactivada" };
  }
  if (target.mode === "simulated") {
    const result: DrawerResult = {
      ...base,
      ok: true,
      mode: "simulated",
      ticket,
      message: "Simulación: gaveta abierta y ticket impreso (sin hardware conectado)",
    };
    simulatedLog.push(result);
    if (simulatedLog.length > 50) simulatedLog.shift();
    return result;
  }

  const host = target.host!;
  const port = target.port!;
  try {
    await sendTcp(host, port, buildDrawerPayload(event, info, { width: target.width }));
    return { ...base, ok: true, mode: "network", ticket, target: `${host}:${port}`, message: `Gaveta abierta e impresión enviada a ${host}:${port}` };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "error desconocido";
    return {
      ...base,
      ok: false,
      mode: "network",
      ticket,
      target: `${host}:${port}`,
      message: `No se pudo comunicar con la caja física (${reason}). La operación de caja se registró igual; abre la gaveta con la llave.`,
    };
  }
}
