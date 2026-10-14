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
  type: "dni" | "ruc";
  number: string;
  fullName: string;
  names?: string;
  paternalLastName?: string;
  maternalLastName?: string;
  lastNames?: string;
  businessName?: string;
  address?: string;
  status?: string;
  condition?: string;
  source: "json.pe" | "simulado";
}

export function getJsonPeToken(): string | null {
  return process.env.JSON_PE_TOKEN || process.env.JSON_PE_API_KEY || null;
}

/**
 * Consulta un DNI o RUC contra la API de json.pe.
 */
export async function lookupIdentityDocument(
  type: "dni" | "ruc",
  number: string
): Promise<DocumentLookupResult> {
  const cleanNumber = (number || "").trim();
  const token = getJsonPeToken();

  // MODO 1: Consulta a la API Oficial de json.pe (si hay token configurado)
  if (token && token.trim() !== "" && !token.includes("TU_TOKEN")) {
    try {
      const url =
        type === "dni" ? "https://api.json.pe/api/dni" : "https://api.json.pe/api/ruc";
      const bodyPayload = type === "dni" ? { dni: cleanNumber } : { ruc: cleanNumber };

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

        if (type === "dni") {
          const names = data?.nombres || "";
          const paternalLastName = data?.apellido_paterno || data?.apellidoPaterno || "";
          const maternalLastName = data?.apellido_materno || data?.apellidoMaterno || "";
          const lastNames = data?.apellidos || `${paternalLastName} ${maternalLastName}`.trim();
          const fullName =
            data?.nombre_completo ||
            data?.nombreCompleto ||
            `${names} ${lastNames}`.trim() ||
            "CLIENTE ENCONTRADO";

          return {
            type: "dni",
            number: cleanNumber,
            fullName,
            names,
            paternalLastName: paternalLastName,
            maternalLastName: maternalLastName,
            lastNames,
            address: data?.direccion || data?.direccion_completa || "",
            source: "json.pe",
          };
        } else {
          // RUC
          const businessName = data?.razon_social || data?.nombre_o_razon_social || "";
          return {
            type: "ruc",
            number: cleanNumber,
            fullName: businessName,
            businessName,
            address: data?.direccion || "",
            status: data?.estado || "ACTIVO",
            condition: data?.condicion || "HABIDO",
            source: "json.pe",
          };
        }
      }
    } catch (error) {
      console.warn("[json.pe Service] Error al consultar API externa, usando fallback:", error);
    }
  }

  // MODO 2: Modo Preparado / Simulado Inteligente (cuando aún no se ingresa la clave en .env)
  if (type === "dni") {
    // Si es DNI de prueba común o ingresado
    let simulatedName = `CLIENTE GENERAL ${cleanNumber}`;
    let names = "CLIENTE";
    let paternalLastName = "PÉREZ";
    let maternalLastName = "RODRÍGUEZ";

    if (cleanNumber === "47829103") {
      simulatedName = "JUAN CARLOS PÉREZ RODRÍGUEZ";
      names = "JUAN CARLOS";
      paternalLastName = "PÉREZ";
      maternalLastName = "RODRÍGUEZ";
    } else if (cleanNumber === "12345678") {
      simulatedName = "MARÍA ELENA GONZALES CHÁVEZ";
      names = "MARÍA ELENA";
      paternalLastName = "GONZALES";
      maternalLastName = "CHÁVEZ";
    } else {
      names = `CLIENTE ${cleanNumber.slice(-4)}`;
      paternalLastName = "VENTAS";
      maternalLastName = "SALÓN";
      simulatedName = `${names} ${paternalLastName} ${maternalLastName}`;
    }

    return {
      type: "dni",
      number: cleanNumber,
      fullName: simulatedName,
      names,
      paternalLastName: paternalLastName,
      maternalLastName: maternalLastName,
      lastNames: `${paternalLastName} ${maternalLastName}`.trim(),
      source: "simulado",
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
      type: "ruc",
      number: cleanNumber,
      fullName: simulatedBusinessName,
      businessName: simulatedBusinessName,
      address: "AV. PRINCIPAL 123 - LIMA",
      status: "ACTIVO",
      condition: "HABIDO",
      source: "simulado",
    };
  }
}