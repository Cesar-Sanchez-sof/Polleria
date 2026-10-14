import { NextRequest } from "next/server";
import { lookupIdentityDocument } from "@/lib/services/document-lookup.service";
import { validateCustomerDocument } from "@/lib/utils/sales-helpers";
import { authorize } from "@/lib/auth/permissions";

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
  const auth = await authorize(["clientes.crear", "ventas.crear", "proveedores.crear", "compras.crear"]);
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("tipo") || "dni").toLowerCase() as "dni" | "ruc";
    const number = (searchParams.get("numero") || "").trim();

    if (!number) {
      return Response.json({ error: "Debe ingresar el número de documento." }, { status: 400 });
    }

    // Validar formato inicial
    const personType = type === "ruc" ? "Juridico" : "Natural";
    const validation = validateCustomerDocument(personType, number);
    if (!validation.isValid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const result = await lookupIdentityDocument(type, number);

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
  const auth = await authorize(["clientes.crear", "ventas.crear", "proveedores.crear", "compras.crear"]);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const type = (body?.type || "dni").toLowerCase() as "dni" | "ruc";
    const number = (body?.number || "").trim();

    if (!number) {
      return Response.json({ error: "Debe ingresar el número de documento." }, { status: 400 });
    }

    const personType = type === "ruc" ? "Juridico" : "Natural";
    const validation = validateCustomerDocument(personType, number);
    if (!validation.isValid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const result = await lookupIdentityDocument(type, number);

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
