/**
 * Presentación de las respuestas del asistente para personas sin formación contable.
 *
 * No calcula nada: solo da formato a cifras ya verificadas por el backend (FinanceEngine) y elige
 * textos sencillos para errores. Los importes llegan como texto decimal y se formatean sin pasar
 * por números de coma flotante.
 */
import type { QueryResponse, ResponseState } from "@/lib/ai-assistant/contract";

export interface ReplyDetailRow {
  etiqueta: string;
  valor: string;
}

export interface ReplyDetail {
  cuenta: string;
  periodo: string;
  filas: ReplyDetailRow[];
  nota: string | null;
}

/** Lo único que el proxy entrega al navegador. */
export interface AssistantReply {
  id_traza: string;
  estado: ResponseState;
  texto: string;
  detalle: ReplyDetail | null;
}

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Mensajes sencillos para errores del proxy o del servicio (sin detalles técnicos). */
export const MESSAGES = {
  unauthorized: "Tu sesión terminó. Vuelve a iniciar sesión para usar el asistente.",
  forbidden: "Tu usuario no tiene acceso al asistente financiero.",
  disabled: "El asistente no está disponible en este entorno.",
  invalid: "No pude procesar tu mensaje. Escribe tu pregunta de nuevo, en pocas palabras.",
  unavailable: "El asistente no está disponible en este momento. Intenta de nuevo en unos minutos.",
  timeout: "La consulta tardó demasiado. Intenta de nuevo en unos minutos.",
  rateLimited: "Hiciste muchas consultas seguidas. Espera unos minutos e inténtalo de nuevo.",
} as const;

/** "1149.60" → "S/ 1,149.60" (mismo formato que el backend; negativos: "-S/ 1,149.60"). */
export function formatPen(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) throw new Error("Importe con formato inválido");
  const [, sign, integer, decimals = ""] = match;
  const cents = (decimals + "00").slice(0, 2);
  if (decimals.length > 2 && /[1-9]/.test(decimals.slice(2))) {
    throw new Error("El importe tiene más de dos decimales"); // el backend ya redondea: no se redondea aquí
  }
  const grouped = integer.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const isZero = /^0+$/.test(integer) && /^0*$/.test(cents);
  return `${sign && !isZero ? "-" : ""}S/ ${grouped}.${cents}`;
}

function formatPercent(value: string): string {
  return `${value} %`;
}

function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

/** "septiembre de 2026" para un mes completo; si no, "del 01/09/2026 al 15/09/2026". */
export function periodText(desde: string, hasta: string): string {
  const from = parseIsoDate(desde);
  const to = parseIsoDate(hasta);
  const lastDay = new Date(Date.UTC(from.year, from.month, 0)).getUTCDate();
  if (from.day === 1 && to.year === from.year && to.month === from.month && to.day === lastDay) {
    return `${MONTHS[from.month - 1]} de ${from.year}`;
  }
  const fmt = (d: { year: number; month: number; day: number }) =>
    `${String(d.day).padStart(2, "0")}/${String(d.month).padStart(2, "0")}/${d.year}`;
  return `del ${fmt(from)} al ${fmt(to)}`;
}

/** Convierte la respuesta validada en lo que ve el usuario. El detalle solo usa datos del backend. */
export function toAssistantReply(response: QueryResponse): AssistantReply {
  let detalle: ReplyDetail | null = null;
  const detail = response.detalle;
  if (response.estado === "respondida" && detail) {
    const byMarker = new Map(response.cifras.map((figure) => [figure.marcador, figure]));
    const filas = detail.etiquetas.map(({ marcador, etiqueta }) => {
      const figure = byMarker.get(marcador);
      if (!figure) throw new Error("Etiqueta sin cifra verificada");
      return { etiqueta, valor: figure.unidad === "PEN" ? formatPen(figure.valor) : formatPercent(figure.valor) };
    });
    detalle = {
      cuenta: detail.cuenta_nombre ? `${detail.cuenta_nombre} (cuenta ${detail.cuenta})` : `Cuenta ${detail.cuenta}`,
      periodo: periodText(detail.periodo.desde, detail.periodo.hasta),
      filas,
      nota: detail.nota,
    };
  }
  return { id_traza: response.id_traza, estado: response.estado, texto: response.texto, detalle };
}
