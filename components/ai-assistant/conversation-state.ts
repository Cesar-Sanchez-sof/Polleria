/**
 * Estado de la conversación del asistente (P-3): solo en memoria de React, por pestaña.
 *
 * No usa localStorage ni sessionStorage: el historial se pierde al recargar y se limpia al cerrar
 * la conversación, al cerrar sesión o al cambiar de usuario.
 */
import type { AgentTable, ResponseState } from "@/lib/ai-assistant/contract";
import type { ReplyDetail } from "@/lib/ai-assistant/presentation";

export const MAX_MESSAGES = 60;
export const MAX_HISTORY_SENT = 10;

export type ChatMessage =
  | { id: string; rol: "usuario"; texto: string }
  | {
      id: string;
      rol: "asistente";
      texto: string;
      estado: ResponseState | "error";
      detalle: ReplyDetail | null;
      /** Solo los agentes (Gemini/Groq + ERP): resultado en tabla y consulta de solo lectura ejecutada. */
      tabla?: AgentTable | null;
      sql?: string | null;
    };

export interface ConversationState {
  userKey: string | null;
  messages: ChatMessage[];
  pending: boolean;
}

export type ConversationAction =
  | { type: "send"; id: string; texto: string }
  | { type: "reply"; id: string; estado: ResponseState; texto: string; detalle: ReplyDetail | null; tabla?: AgentTable | null; sql?: string | null }
  | { type: "error"; id: string; texto: string }
  | { type: "reset"; userKey: string | null };

export const initialConversation: ConversationState = { userKey: null, messages: [], pending: false };

function append(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return [...messages, message].slice(-MAX_MESSAGES);
}

export function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case "send":
      if (state.pending || !action.texto.trim()) return state;
      return { ...state, pending: true, messages: append(state.messages, { id: action.id, rol: "usuario", texto: action.texto.trim() }) };
    case "reply":
      if (!state.pending) return state;
      return {
        ...state,
        pending: false,
        messages: append(state.messages, {
          id: action.id,
          rol: "asistente",
          texto: action.texto,
          estado: action.estado,
          detalle: action.estado === "respondida" ? action.detalle : null,
          tabla: action.estado === "respondida" ? (action.tabla ?? null) : null,
          sql: action.estado === "respondida" || action.estado === "sin_datos" ? (action.sql ?? null) : null,
        }),
      };
    case "error":
      if (!state.pending) return state;
      return {
        ...state,
        pending: false,
        messages: append(state.messages, { id: action.id, rol: "asistente", texto: action.texto, estado: "error", detalle: null }),
      };
    case "reset":
      return { userKey: action.userKey, messages: [], pending: false };
  }
}

/** Turnos previos que se envían al proxy: solo los mensajes del usuario anteriores al actual. */
export function historyForRequest(state: ConversationState): { rol: "usuario"; texto: string }[] {
  const userTurns = state.messages.filter((m): m is Extract<ChatMessage, { rol: "usuario" }> => m.rol === "usuario");
  return userTurns.slice(0, -1).slice(-MAX_HISTORY_SENT).map((m) => ({ rol: "usuario", texto: m.texto }));
}

/** Clave de usuario para detectar cambios de sesión; `null` sin sesión. */
export function userKeyFrom(status: { enabled?: unknown; usuario?: unknown } | null): string | null {
  return status && status.enabled === true && typeof status.usuario === "number" ? String(status.usuario) : null;
}
