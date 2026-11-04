/**
 * Interruptores de desarrollador (fuente única de verdad). Cada uno es una bandera apagada por defecto que
 * se guarda en `developer_setting` y se cambia desde Configuración → Desarrollador; ya no se lee de `.env`.
 * Solo contiene banderas: claves, tokens y URLs siguen en variables de entorno.
 */
export interface DeveloperSettingDefinition {
  key: string;
  group: string;
  label: string;
  description: string;
  /** Barrera de seguridad o salida de datos a un tercero: la pantalla pide confirmar antes de encenderla. */
  sensitive?: boolean;
}

export const DEVELOPER_SETTINGS = [
  // General: qué entorno habilita el asistente y funciones comunes a todos los modelos.
  {
    key: "assistant.demo",
    group: "General",
    label: "Modo demostración local",
    description: "Habilita el asistente en desarrollo (nunca con NODE_ENV=production). Sin esto y sin evaluación, el asistente queda apagado.",
  },
  {
    key: "assistant.eval",
    group: "General",
    label: "Modo evaluación",
    description: "Habilita el asistente en el despliegue de Vercel (Preview) y tiene prioridad sobre el modo demostración. En local no funciona: déjalo apagado. En Production exige además el permiso de evaluación en producción.",
    sensitive: true,
  },
  {
    key: "assistant.allow_production_eval",
    group: "General",
    label: "Permitir evaluación en producción",
    description: "Habilitación temporal y explícita para evaluar en Production. Solo surte efecto con el modo evaluación encendido.",
    sensitive: true,
  },
  {
    key: "assistant.voice",
    group: "General",
    label: "Dictado por voz (Whisper)",
    description: "Muestra el botón de micrófono en el asistente. El audio se envía a Groq, un tercero, y requiere GROQ_API_KEY en el servidor.",
    sensitive: true,
  },
  // Modelo LoRA (Modelo R, servido por ai-service).
  {
    key: "assistant.model_r",
    group: "Modelo LoRA",
    label: "Mostrar el Modelo R en el selector",
    description: "Con un agente activo, el Modelo R se oculta salvo que esté encendido. Sin agentes activos aparece siempre. Requiere su servidor de inferencia (ai-service).",
  },
  {
    key: "assistant.real_data",
    group: "Modelo LoRA",
    label: "Consultar datos reales",
    description: "El Modelo R pasa de los datos ficticios a la base real, en solo lectura. Exige la clave de identidad y, en evaluación, cuentas evaluadoras. Los agentes siempre usan datos reales.",
    sensitive: true,
  },
  {
    key: "assistant.diagnostics",
    group: "Modelo LoRA",
    label: "Traza técnica de cada consulta",
    description: "Pide al Modelo R etapas, modelo, SQL generado y tiempos en cada respuesta. Exige la clave de identidad y, en evaluación, cuentas evaluadoras.",
    sensitive: true,
  },
  // Agentes de solo lectura (Gemini y GPT OSS, servidos por agents-service).
  {
    key: "assistant.gemini_sql",
    group: "Agentes",
    label: "Agente Gemini",
    description: "Ofrece el agente Gemini en el selector. Requiere agents-service con identidad firmada y GEMINI_API_KEY allí.",
  },
  {
    key: "assistant.groq_sql",
    group: "Agentes",
    label: "Agente GPT OSS (Groq)",
    description: "Ofrece el agente GPT OSS en el selector. Requiere agents-service con identidad firmada y GROQ_API_KEY allí.",
  },
] as const satisfies readonly DeveloperSettingDefinition[];

export type DeveloperSettingKey = (typeof DEVELOPER_SETTINGS)[number]["key"];

export type DeveloperFlags = Readonly<Record<DeveloperSettingKey, boolean>>;

export const DEVELOPER_SETTING_KEYS: readonly DeveloperSettingKey[] = DEVELOPER_SETTINGS.map((s) => s.key);

export function isDeveloperSettingKey(value: unknown): value is DeveloperSettingKey {
  return typeof value === "string" && (DEVELOPER_SETTING_KEYS as readonly string[]).includes(value);
}

/** Todo apagado: lo que rige si no hay fila o la base no responde (falla cerrado). */
export const ALL_FLAGS_OFF: DeveloperFlags = Object.freeze(
  Object.fromEntries(DEVELOPER_SETTING_KEYS.map((key) => [key, false])) as Record<DeveloperSettingKey, boolean>,
);
