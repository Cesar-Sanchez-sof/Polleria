/**
 * Catálogo de modelos del asistente (seguro para cliente y servidor: sin claves ni configuración).
 *
 * - `modelo-r`: el modelo propio del ERP (XiYanSQL-QwenCoder-7B-2504 + adaptador LoRA, servido por
 *   `ai-service`). Consulta saldos contables con datos del ERP. Versión = adaptador por defecto
 *   (`DEFAULT_ADAPTER` en `ai-service/src/ai_service/sqlgen/profile.py`).
 * - `gemini-erp`: Gemini (Flash 3.5 lite por defecto; ver `GEMINI_MODEL` en ai-service) propone un SELECT de solo lectura a partir del esquema permitido (sin datos); el SQL
 *   lo valida y ejecuta `ai-service` con el rol `ai_readonly`. Las filas no vuelven a Gemini.
 * - `groq-erp`: mismo agente de solo lectura que `gemini-erp`, pero con GPT OSS 120B servido por Groq
 *   (`GROQ_MODEL` en ai-service) como proponente del SELECT
 *   (`POST /v1/agent/groq/queries`). Igual que Gemini, solo ve el esquema permitido, nunca los datos.
 */
export const ASSISTANT_MODELS = ["modelo-r", "gemini-erp", "groq-erp"] as const;
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
    nombre: "XiYanSQL-QwenCoder-7B-QLoRA",
    version: "v1.7",
    descripcion: "Saldos contables con datos del ERP",
  },
  "gemini-erp": {
    id: "gemini-erp",
    nombre: "Gemini",
    version: "Flash 3.5 lite",
    descripcion: "Consulta datos del ERP con SELECT de solo lectura",
  },
  "groq-erp": {
    id: "groq-erp",
    nombre: "GPT",
    version: "OSS 120B",
    descripcion: "Consulta datos del ERP con SELECT de solo lectura desde Groq",
  },
};

export function isModelId(value: unknown): value is AssistantModelId {
  return typeof value === "string" && (ASSISTANT_MODELS as readonly string[]).includes(value);
}
