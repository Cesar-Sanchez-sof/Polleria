"use server";

import { exigirPermiso } from "@/lib/auth/permisos";

/**
 * lookupDocument — Server Action para consultar RUC/DNI vía JSON.PE
 *
 * El token se lee de process.env.JSON_PE_TOKEN y NUNCA se expone al cliente.
 * Si la API falla por cualquier motivo, retorna { success: false, error: "..." }
 * para que el formulario permanezca operativo (degradación graceful).
 */

export interface LookupDocumentData {
  documentNumber: string;
  documentType: "RUC" | "DNI";
  /** Razón social (RUC) o nombre completo (DNI) */
  businessName?: string;
  /** Solo DNI */
  firstName?: string;
  /** Solo DNI */
  lastName?: string;
  address?: string;
  district?: string;
  province?: string;
  department?: string;
  /** Estado SUNAT: ej. "ACTIVO", "INHABILITADO", etc. */
  status?: string;
}

export interface LookupDocumentResult {
  success: boolean;
  data?: LookupDocumentData;
  error?: string;
}

const TIMEOUT_MS = 5_000;

export async function lookupDocument(
  documentNumber: string
): Promise<LookupDocumentResult> {
  await exigirPermiso(["clientes.crear", "ventas.crear", "proveedores.crear", "compras.crear"]);
  const doc = documentNumber ? documentNumber.trim().replace(/\D/g, "") : "";

  if (doc.length !== 8 && doc.length !== 11) {
    return {
      success: false,
      error: "El documento debe tener 8 u 11 dígitos",
    };
  }

  const documentType: "RUC" | "DNI" = doc.length === 8 ? "DNI" : "RUC";
  const token = process.env.JSON_PE_TOKEN;

  if (!token) {
    return {
      success: false,
      error:
        "Servicio de consulta no disponible. Ingresa los datos manualmente.",
    };
  }

  const endpoint =
    documentType === "DNI"
      ? `https://api.json.pe/api/dni/${doc}`
      : `https://api.json.pe/api/ruc/${doc}`;

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    clearTimeout(timeoutId);
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return {
        success: false,
        error: "La consulta tardó demasiado. Intenta de nuevo.",
      };
    }
    return {
      success: false,
      error: "Sin conexión al servicio de consulta.",
    };
  }

  if (response.status === 429) {
    return {
      success: false,
      error: "Consulta temporalmente no disponible. Intenta más tarde.",
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      success: false,
      error:
        "Servicio de consulta no disponible. Ingresa los datos manualmente.",
    };
  }

  if (!response.ok) {
    return {
      success: false,
      error: "No se encontró información para ese documento.",
    };
  }

  let json: any;
  try {
    json = await response.json();
  } catch {
    return {
      success: false,
      error: "No se encontró información para ese documento.",
    };
  }

  // JSON.PE retorna { success: true/false, data: { ... } }
  if (!json || json.success === false || !json.data) {
    return {
      success: false,
      error: json?.message || "No se encontró información para ese documento.",
    };
  }

  const payload = json.data;

  if (documentType === "RUC") {
    const businessName: string =
      payload.nombre_o_razon_social ||
      payload.razonSocial ||
      payload.nombre ||
      payload.businessName ||
      "";
    const address: string =
      payload.direccion_completa ||
      payload.direccion ||
      payload.domicilioFiscal ||
      payload.address ||
      "";
    const district: string =
      payload.distrito || payload.district || "";
    const province: string =
      payload.provincia || payload.province || "";
    const department: string =
      payload.departamento || payload.department || "";
    const status: string =
      payload.estado || payload.condicion || payload.status || "";

    if (!businessName) {
      return {
        success: false,
        error: "No se encontró información para ese documento.",
      };
    }

    return {
      success: true,
      data: {
        documentNumber: doc,
        documentType: "RUC",
        businessName,
        address: address || undefined,
        district: district || undefined,
        province: province || undefined,
        department: department || undefined,
        status: status || undefined,
      },
    };
  } else {
    // DNI
    const firstName: string =
      payload.nombres || payload.firstName || "";
    const lastName: string =
      payload.apellido_paterno && payload.apellido_materno
        ? `${payload.apellido_paterno} ${payload.apellido_materno}`.trim()
        : payload.apellidos || payload.apellido || payload.lastName || "";
    const fullName =
      payload.nombre_completo ||
      [firstName, lastName].filter(Boolean).join(" ").trim() ||
      payload.nombre ||
      payload.businessName ||
      "";

    if (!fullName) {
      return {
        success: false,
        error: "No se encontró información para ese documento.",
      };
    }

    const address: string =
      payload.direccion_completa || payload.direccion || "";

    return {
      success: true,
      data: {
        documentNumber: doc,
        documentType: "DNI",
        businessName: fullName,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        address: address || undefined,
      },
    };
  }
}
