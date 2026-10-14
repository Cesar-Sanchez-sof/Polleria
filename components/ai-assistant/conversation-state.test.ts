import { describe, expect, it } from "vitest";
import {
  conversationReducer,
  historyForRequest,
  initialConversation,
  MAX_MESSAGES,
  userKeyFrom,
  type ConversationState,
} from "@/components/ai-assistant/conversation-state";

const detalle = { cuenta: "Caja (cuenta 101)", periodo: "septiembre de 2026", filas: [], nota: null };

function run(...actions: Parameters<typeof conversationReducer>[1][]): ConversationState {
  return actions.reduce(conversationReducer, initialConversation);
}

describe("estados de la conversación", () => {
  it("carga, respuesta con detalle y error", () => {
    const sending = run({ type: "send", id: "1", texto: " Saldo de caja " });
    expect(sending.pending).toBe(true);
    expect(sending.messages).toEqual([{ id: "1", rol: "usuario", texto: "Saldo de caja" }]);

    const answered = conversationReducer(sending, { type: "reply", id: "2", estado: "respondida", texto: "Saldo neto…", detalle });
    expect(answered.pending).toBe(false);
    expect(answered.messages[1]).toMatchObject({ rol: "asistente", estado: "respondida", detalle });

    const failed = run({ type: "send", id: "1", texto: "Hola" }, { type: "error", id: "2", texto: "No disponible" });
    expect(failed.messages[1]).toMatchObject({ estado: "error", detalle: null });
  });

  it("el detalle solo se conserva en respuestas respondidas", () => {
    const state = run(
      { type: "send", id: "1", texto: "Saldo" },
      { type: "reply", id: "2", estado: "requiere_aclaracion", texto: "¿De qué cuenta?", detalle },
    );
    expect(state.messages[1]).toMatchObject({ estado: "requiere_aclaracion", detalle: null });
  });

  it("no envía dos preguntas a la vez ni mensajes vacíos", () => {
    const state = run({ type: "send", id: "1", texto: "Uno" }, { type: "send", id: "2", texto: "Dos" }, { type: "send", id: "3", texto: "  " });
    expect(state.messages).toHaveLength(1);
    expect(run({ type: "send", id: "1", texto: "   " }).messages).toHaveLength(0);
    expect(conversationReducer(initialConversation, { type: "reply", id: "x", estado: "respondida", texto: "?", detalle: null })).toBe(initialConversation);
  });

  it("limpia el historial al cerrar o cambiar de usuario", () => {
    const state = run({ type: "send", id: "1", texto: "Hola" }, { type: "error", id: "2", texto: "x" }, { type: "reset", userKey: "8" });
    expect(state).toEqual({ userKey: "8", messages: [], pending: false });
  });

  it("limita el historial en memoria", () => {
    let state = initialConversation;
    for (let i = 0; i < MAX_MESSAGES; i++) {
      state = conversationReducer(state, { type: "send", id: `u${i}`, texto: `P${i}` });
      state = conversationReducer(state, { type: "error", id: `a${i}`, texto: "x" });
    }
    expect(state.messages).toHaveLength(MAX_MESSAGES);
  });
});

describe("historial enviado al proxy", () => {
  it("solo turnos previos del usuario, como máximo 10", () => {
    let state = initialConversation;
    for (let i = 0; i < 12; i++) {
      state = conversationReducer(state, { type: "send", id: `u${i}`, texto: `Pregunta ${i}` });
      state = conversationReducer(state, { type: "reply", id: `a${i}`, estado: "respondida", texto: `S/ ${i}`, detalle: null });
    }
    state = conversationReducer(state, { type: "send", id: "actual", texto: "Pregunta actual" });
    const history = historyForRequest(state);
    expect(history).toHaveLength(10);
    expect(history.every((turn) => turn.rol === "usuario" && !turn.texto.includes("S/"))).toBe(true);
    expect(history.at(-1)?.texto).toBe("Pregunta 11");
  });
});

describe("clave de usuario", () => {
  it("solo con asistente habilitado y usuario numérico", () => {
    expect(userKeyFrom({ habilitado: true, usuario: 7 })).toBe("7");
    expect(userKeyFrom({ habilitado: false, usuario: 7 })).toBeNull();
    expect(userKeyFrom({ habilitado: true, usuario: "7" })).toBeNull();
    expect(userKeyFrom(null)).toBeNull();
  });
});
