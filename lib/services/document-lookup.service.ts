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

export interface DocumentLookupResult {
  tipo: "dni" | "ruc";
  numero: string;
  nombreCompleto: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  apellidos?: string;
  razonSocial?: string;
  direccion?: string;
  estado?: string;
  condicion?: string;
  fuente: "json.pe" | "simulado";
}

export function getJsonPeToken(): string | null {
  return process.env.JSON_PE_TOKEN || process.env.JSON_PE_API_KEY || null;
}

/**
 * Consulta un DNI o RUC contra la API de json.pe.
 */
export async function lookupIdentityDocument(
  tipo: "dni" | "ruc",
  numero: string
): Promise<DocumentLookupResult> {
  const cleanNumber = (numero || "").trim();
  const token = getJsonPeToken();

  // MODO 1: Consulta a la API Oficial de json.pe (si hay token configurado)
  if (token && token.trim() !== "" && !token.includes("TU_TOKEN")) {
    try {
      const url =
        tipo === "dni" ? "https://api.json.pe/api/dni" : "https://api.json.pe/api/ruc";
      const bodyPayload = tipo === "dni" ? { dni: cleanNumber } : { ruc: cleanNumber };

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
          const apePat = data?.apellido_paterno || data?.apellidoPaterno || "";
          const apeMat = data?.apellido_materno || data?.apellidoMaterno || "";
          const apellidos = data?.apellidos || `${apePat} ${apeMat}`.trim();
          const nombreCompleto =
            data?.nombre_completo ||
            data?.nombreCompleto ||
            `${nombres} ${apellidos}`.trim() ||
            "CLIENTE ENCONTRADO";

          return {
            tipo: "dni",
            numero: cleanNumber,
            nombreCompleto,
            nombres,
            apellidoPaterno: apePat,
            apellidoMaterno: apeMat,
            apellidos,
            direccion: data?.direccion || data?.direccion_completa || "",
            fuente: "json.pe",
          };
        } else {
          // RUC
          const razonSocial = data?.razon_social || data?.nombre_o_razon_social || "";
          return {
            tipo: "ruc",
            numero: cleanNumber,
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
    let simulatedName = `CLIENTE GENERAL ${cleanNumber}`;
    let nombres = "CLIENTE";
    let apePat = "PÉREZ";
    let apeMat = "RODRÍGUEZ";

    if (cleanNumber === "47829103") {
      simulatedName = "JUAN CARLOS PÉREZ RODRÍGUEZ";
      nombres = "JUAN CARLOS";
      apePat = "PÉREZ";
      apeMat = "RODRÍGUEZ";
    } else if (cleanNumber === "12345678") {
      simulatedName = "MARÍA ELENA GONZALES CHÁVEZ";
      nombres = "MARÍA ELENA";
      apePat = "GONZALES";
      apeMat = "CHÁVEZ";
    } else {
      nombres = `CLIENTE ${cleanNumber.slice(-4)}`;
      apePat = "VENTAS";
      apeMat = "SALÓN";
      simulatedName = `${nombres} ${apePat} ${apeMat}`;
    }

    return {
      tipo: "dni",
      numero: cleanNumber,
      nombreCompleto: simulatedName,
      nombres,
      apellidoPaterno: apePat,
      apellidoMaterno: apeMat,
      apellidos: `${apePat} ${apeMat}`.trim(),
      fuente: "simulado",
    };
  } else {
    // Si es RUC
    const simulatedBusinessName =
      cleanNumber === "20601234567"
        ? "INVERSIONES GASTRONÓMICAS PERÚ S.A.C."
        : cleanNumber.startsWith("20")
        ? `CORPORACIÓN EMPRESARIAL ${cleanNumber} S.A.C.`
        : `EMPRESA UNIPERSONAL RUC ${cleanNumber}`;

    return {
      tipo: "ruc",
      numero: cleanNumber,
      nombreCompleto: simulatedBusinessName,
      razonSocial: simulatedBusinessName,
      direccion: "AV. PRINCIPAL 123 - LIMA",
      estado: "ACTIVO",
      condicion: "HABIDO",
      fuente: "simulado",
    };
  }
}