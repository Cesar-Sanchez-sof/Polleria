import { NextRequest } from "next/server";
import { consultarDocumentoIdentidad } from "@/lib/services/consulta-documento.service";
import { validarDocumentoCliente } from "@/lib/utils/ventas-helpers";

export const dynamic = "force-dynamic";

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
    const validacion = validarDocumentoCliente(tipoPersona, numero);
    if (!validacion.esValido) {
      return Response.json({ error: validacion.error }, { status: 400 });
    }

    const resultado = await consultarDocumentoIdentidad(tipo, numero);

    return Response.json({
      success: true,
      data: resultado,
    });
  } catch (error: any) {
    console.error("[api/consulta-documento] Error al consultar documento:", error);
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
    const validacion = validarDocumentoCliente(tipoPersona, numero);
    if (!validacion.esValido) {
      return Response.json({ error: validacion.error }, { status: 400 });
    }

    const resultado = await consultarDocumentoIdentidad(tipo, numero);

    return Response.json({
      success: true,
      data: resultado,
    });
  } catch (error: any) {
    console.error("[api/consulta-documento] Error al consultar documento:", error);
    return Response.json(
      { error: "No se pudo consultar el documento." },
      { status: 500 }
    );
  }
}
