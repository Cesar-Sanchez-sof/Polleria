/**
 * Servicio de interpretación contable con Gemini.
 * Especializado en análisis financiero para empresas peruanas bajo PCGE / SUNAT.
 */

export interface ReportInterpretationRequest {
  reportType: "balance" | "income-statement" | "executive-summary" | "cash-flow" | "trial-balance" | "dashboard" | "general";
  reportTitle: string;
  periodOrCutOff?: string;
  data: Record<string, unknown> | unknown[];
  userPrompt?: string;
}

export interface ReportInterpretationResult {
  diagnosis: string;
  keyPoints: string[];
  recommendations: string[];
  ratios?: { label: string; value: string; interpretation: string }[];
  summary: string;
}

const SYSTEM_PROMPT = `Eres un Experto Contador Público Colegiado y Consultor Financiero Senior en Perú.
Tu función es interpretar reportes contables y financieros de una empresa gastronómica/comercial (Pollería / Restaurante) bajo el Plan Contable General Empresarial (PCGE) y normativa de SUNAT.

Directrices:
1. Habla en español claro, profesional, ejecutivo y accesible para la gerencia y el contador.
2. Analiza los datos proporcionados (cifras, totales, cuentas, balances o márgenes).
3. Entrega siempre una respuesta estructurada en formato JSON estricto con los siguientes campos:
   - "summary": Resumen ejecutivo de 2 a 3 líneas del estado del reporte.
   - "diagnosis": Diagnóstico financiero detallado de la situación (liquidez, solvencia, rentabilidad, márgenes o rotación).
   - "keyPoints": Array de strings con los 3 a 5 hallazgos o alertas más relevantes (positivos o de riesgo).
   - "ratios": Array de objetos { "label": string, "value": string, "interpretation": string } calculando u observando ratios o indicadores pertinentes (ej. Margen bruto, capital de trabajo, liquidez corriente, etc.), si los datos lo permiten.
   - "recommendations": Array de strings con 3 a 4 acciones concretas y prácticas para el negocio.

IMPORTANTE: Responde ÚNICAMENTE el bloque JSON válido, sin texto introductorio ni bloques markdown con comillas triples (o si usas markdown, asegúrate que sea un JSON parseable).`;

export async function interpretAccountingReport(
  req: ReportInterpretationRequest
): Promise<ReportInterpretationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está configurada en las variables de entorno.");
  }

  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `Por favor interpreta el siguiente reporte contable:
Tipo de Reporte: ${req.reportTitle} (${req.reportType})
Periodo / Fecha de corte: ${req.periodOrCutOff || "No especificado"}
${req.userPrompt ? `Consulta específica del usuario: "${req.userPrompt}"` : ""}

DATOS DEL REPORTE:
${JSON.stringify(req.data, null, 2)}
`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: SYSTEM_PROMPT },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API Error:", response.status, errorText);
    throw new Error(`Error al consultar Gemini (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("El modelo de IA no devolvió ninguna interpretación.");
  }

  try {
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as ReportInterpretationResult;
    return parsed;
  } catch (parseError) {
    console.error("Error al parsear respuesta JSON de Gemini:", rawText, parseError);
    return {
      summary: "Interpretación generada con observaciones de formato.",
      diagnosis: rawText,
      keyPoints: ["Revisar detalles en el diagnóstico."],
      recommendations: ["Validar cifras con contabilidad."],
    };
  }
}
