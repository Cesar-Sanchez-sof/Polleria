/**
 * Catálogo de modelos del asistente (seguro para cliente y servidor: sin claves ni configuración).
 *
 * - `modelo-r`: el modelo propio del ERP (XiYanSQL-QwenCoder-7B-2504 + adaptador LoRA, servido por
 *   `ai-service`). Consulta saldos contables con datos del ERP. Versión = adaptador por defecto
 *   (`DEFAULT_ADAPTER` en `ai-service/src/ai_service/sqlgen/profile.py`).
 * - `gemini-erp`: Gemini propone un SELECT de solo lectura a partir del esquema permitido (sin datos); el SQL
 *   lo valida y ejecuta `ai-service` con el rol `ai_readonly`. Las filas no vuelven a Gemini.
 * - `gpt-luna`: GPT Luna de OpenAI, conectado solo con `OPENAI_API_KEY`. Conversación general;
 *   no consulta datos del ERP.
 * - `groq-erp`: mismo agente de solo lectura que `gemini-erp`, pero con Groq como proponente del SELECT
 *   (`POST /v1/agent/groq/queries`). Igual que Gemini, solo ve el esquema permitido, nunca los datos.
 */
export const ASSISTANT_MODELS = ["modelo-r", "gemini-erp", "gpt-luna", "groq-erp"] as const;
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
  "gemini-erp": {
    id: "gemini-erp",
    nombre: "Gemini + ERP",
    version: "solo lectura",
    descripcion: "Consulta datos del ERP con SELECT de solo lectura",
  },
  "gpt-luna": {
    id: "gpt-luna",
    nombre: "GPT Luna",
    version: "gpt-6-luna",
    descripcion: "Conversación general (sin datos del ERP)",
  },
  "groq-erp": {
    id: "groq-erp",
    nombre: "Groq + ERP",
    version: "solo lectura",
    descripcion: "Consulta datos del ERP con SELECT de solo lectura",
  },
};

export function isModelId(value: unknown): value is AssistantModelId {
  return typeof value === "string" && (ASSISTANT_MODELS as readonly string[]).includes(value);
}
