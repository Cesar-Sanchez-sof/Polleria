/**
 * Catálogo de modelos del asistente (seguro para cliente y servidor: sin claves ni configuración).
 *
 * - `modelo-r`: el modelo propio del ERP (XiYanSQL-QwenCoder-7B-2504 + adaptador LoRA, servido por
 *   `ai-service`). Consulta saldos contables con datos del ERP. Versión = adaptador por defecto
 *   (`DEFAULT_ADAPTER` en `ai-service/src/ai_service/sqlgen/profile.py`).
 * - `gpt-luna`: GPT Luna de OpenAI, conectado solo con `OPENAI_API_KEY`. Conversación general;
 *   no consulta datos del ERP.
 * - `gemini`: Gemini Flash 3.5 de Google, conectado solo con `GEMINI_API_KEY`. Conversación general;
 *   no consulta datos del ERP.
 */
export const ASSISTANT_MODELS = ["modelo-r", "gpt-luna", "gemini"] as const;
export type AssistantModelId = (typeof ASSISTANT_MODELS)[number];

export const DEFAULT_MODEL: AssistantModelId = "modelo-r";

export interface ModelInfo {
  id: AssistantModelId;
  nombre: string;
  version: string;
  descripcion: string;
}

export const MODEL_INFO: Readonly<Record<AssistantModelId, ModelInfo>> = {
  "modelo-r": {
    id: "modelo-r",
    nombre: "Modelo R",
    version: "v17",
    descripcion: "Saldos contables con datos del ERP",
  },
  "gpt-luna": {
    id: "gpt-luna",
    nombre: "GPT Luna",
    version: "gpt-6-luna",
    descripcion: "Conversación general (sin datos del ERP)",
  },
  gemini: {
    id: "gemini",
    nombre: "Gemini",
    version: "Flash 3.5",
    descripcion: "Conversación general (sin datos del ERP)",
  },
};

export function isModelId(value: unknown): value is AssistantModelId {
  return typeof value === "string" && (ASSISTANT_MODELS as readonly string[]).includes(value);
}
