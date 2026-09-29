/**
 * Servicio de Consulta de Documentos de Identidad (DNI y RUC) en Perú mediante json.pe.
 * 
 * Documentación oficial:
 * - DNI: POST https://api.json.pe/api/dni { "dni": "..." }
 * - RUC: POST https://api.json.pe/api/ruc { "ruc": "..." }
 * Header: Authorization: Bearer <JSON_PE_TOKEN>
 * 
 * Si no se encuentra configurado JSON_PE_TOKEN en .env, opera en modo preparado/fallback
 * para no bloquear las pruebas del restaurante.
 */

export interface ResultadoConsultaDocumento {
  tipo: "dni" | "ruc";
  numero: string;
  nombreCompleto: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  razonSocial?: string;
  direccion?: string;
  estado?: string;
  condicion?: string;
  fuente: "json.pe" | "simulado";
}

export function obtenerTokenJsonPe(): string | null {
  return process.env.JSON_PE_TOKEN || process.env.JSON_PE_API_KEY || null;
}

/**
 * Consulta un DNI o RUC contra la API de json.pe.
 */
export async function consultarDocumentoIdentidad(
  tipo: "dni" | "ruc",
  numero: string
): Promise<ResultadoConsultaDocumento> {
  const numLimpio = (numero || "").trim();
  const token = obtenerTokenJsonPe();

  // MODO 1: Consulta a la API Oficial de json.pe (si hay token configurado)
  if (token && token.trim() !== "" && !token.includes("TU_TOKEN")) {
    try {
      const url =
        tipo === "dni" ? "https://api.json.pe/api/dni" : "https://api.json.pe/api/ruc";
      const bodyPayload = tipo === "dni" ? { dni: numLimpio } : { ruc: numLimpio };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });

      if (response.ok) {
        const json = await response.json();
        const data = json?.data || json;

        if (tipo === "dni") {
          const nombres = data?.nombres || "";
          const apePat = data?.apellido_paterno || "";
          const apeMat = data?.apellido_materno || "";
          const nombreCompleto =
            data?.nombre_completo ||
            `${nombres} ${apePat} ${apeMat}`.trim() ||
            "CLIENTE ENCONTRADO";

          return {
            tipo: "dni",
            numero: numLimpio,
            nombreCompleto,
            nombres,
            apellidoPaterno: apePat,
            apellidoMaterno: apeMat,
            direccion: data?.direccion || data?.direccion_completa || "",
            fuente: "json.pe",
          };
        } else {
          // RUC
          const razonSocial = data?.razon_social || data?.nombre_o_razon_social || "";
          return {
            tipo: "ruc",
            numero: numLimpio,
            nombreCompleto: razonSocial,
            razonSocial,
            direccion: data?.direccion || "",
            estado: data?.estado || "ACTIVO",
            condicion: data?.condicion || "HABIDO",
            fuente: "json.pe",
          };
        }
      }
    } catch (error) {
      console.warn("[json.pe Service] Error al consultar API externa, usando fallback:", error);
    }
  }

  // MODO 2: Modo Preparado / Simulado Inteligente (cuando aún no se ingresa la clave en .env)
  if (tipo === "dni") {
    // Si es DNI de prueba común o ingresado
    const nombreSimulado =
      numLimpio === "47829103"
        ? "JUAN CARLOS PÉREZ RODRÍGUEZ"
        : numLimpio === "12345678"
        ? "MARÍA ELENA GONZALES CHÁVEZ"
        : `CLIENTE DNI ${numLimpio}`;

    return {
      tipo: "dni",
      numero: numLimpio,
      nombreCompleto: nombreSimulado,
      nombres: nombreSimulado.split(" ")[0] || "CLIENTE",
      apellidoPaterno: nombreSimulado.split(" ")[1] || "NATURAL",
      fuente: "simulado",
    };
  } else {
    // Si es RUC
    const razonSimulada =
      numLimpio === "20601234567"
        ? "INVERSIONES GASTRONÓMICAS PERÚ S.A.C."
        : numLimpio.startsWith("20")
        ? `CORPORACIÓN EMPRESARIAL ${numLimpio} S.A.C.`
        : `EMPRESA UNIPERSONAL RUC ${numLimpio}`;

    return {
      tipo: "ruc",
      numero: numLimpio,
      nombreCompleto: razonSimulada,
      razonSocial: razonSimulada,
      direccion: "AV. PRINCIPAL 123 - LIMA",
      estado: "ACTIVO",
      condicion: "HABIDO",
      fuente: "simulado",
    };
  }
}
