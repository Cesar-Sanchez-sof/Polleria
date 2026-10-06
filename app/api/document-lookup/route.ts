import { NextRequest } from "next/server";
import { lookupIdentityDocument } from "@/lib/services/document-lookup.service";
import { validateCustomerDocument } from "@/lib/utils/sales-helpers";

export const dynamic = "force-dynamic";
/**
 * @openapi
 * /api/document-lookup:
 *   get:
 *     tags:
 *       - DocumentLookup
 *     summary: Consultar documento de identidad (GET)
 *   post:
 *     tags:
 *       - DocumentLookup
 *     summary: Consultar documento de identidad (POST)
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = (searchParams.get("tipo") || "dni").toLowerCase() as "dni" | "ruc";
    const numero = (searchParams.get("numero") || "").trim();

    if (!numero) {
      return Response.json({ error: "Debe ingresar el número de documento." }, { status: 400 });
    }

    // Validar formato inicial
    const tipoPersona = tipo === "ruc" ? "Juridico" : "Natural";
    const validation = validateCustomerDocument(tipoPersona, numero);
    if (!validation.isValid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const result = await lookupIdentityDocument(tipo, numero);

    return Response.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("[api/document-lookup] Error al consultar documento:", error);
    return Response.json(
      { error: "No se pudo consultar el documento. Intente nuevamente." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tipo = (body?.tipo || "dni").toLowerCase() as "dni" | "ruc";
    const numero = (body?.numero || "").trim();

    if (!numero) {
      return Response.json({ error: "Debe ingresar el número de documento." }, { status: 400 });
    }

    const tipoPersona = tipo === "ruc" ? "Juridico" : "Natural";
    const validation = validateCustomerDocument(tipoPersona, numero);
    if (!validation.isValid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const result = await lookupIdentityDocument(tipo, numero);

    return Response.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("[api/document-lookup] Error al consultar documento:", error);
    return Response.json(
      { error: "No se pudo consultar el documento." },
      { status: 500 }
    );
  }
}
