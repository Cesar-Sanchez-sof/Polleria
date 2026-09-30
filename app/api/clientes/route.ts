import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validarDocumentoCliente } from "@/lib/utils/ventas-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const busqueda = (searchParams.get("q") || "").trim();

    const clientes = await prisma.cliente.findMany({
      where: busqueda
        ? {
            OR: [
              { nro_doc: { contains: busqueda, mode: "insensitive" } },
              { nombre: { contains: busqueda, mode: "insensitive" } },
              { apellido: { contains: busqueda, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: {
        _count: {
          select: { comprobantes_venta: true },
        },
      },
      orderBy: { id_cliente: "desc" },
      take: 100,
    });

    const resultado = clientes.map((c) => ({
      id: c.id_cliente,
      nroDoc: c.nro_doc,
      nombre: c.nombre,
      apellido: c.apellido || "",
      nombreCompleto: c.apellido ? `${c.nombre} ${c.apellido}`.trim() : c.nombre,
      telefono: c.telefono || "",
      tipoPersona: c.tipo_persona,
      estado: c.estado,
      totalCompras: c._count.comprobantes_venta,
    }));

    return Response.json({ data: resultado });
  } catch (error) {
    console.error("[api/clientes] Error al listar clientes:", error);
    return Response.json(
      { error: "No se pudo obtener la lista de clientes." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Datos del cliente no válidos." }, { status: 400 });
    }

    const { nro_doc, nombre, apellido, telefono, tipo_persona } = body;

    if (!nombre || !nombre.trim()) {
      return Response.json({ error: "El nombre o razón social es obligatorio." }, { status: 400 });
    }

    const docLimpio = (nro_doc || "").trim();
    const tipo = tipo_persona === "Juridico" ? "Juridico" : "Natural";

    // Validar formato de documento según tipo de persona
    const validacion = validarDocumentoCliente(tipo, docLimpio);
    if (!validacion.esValido) {
      return Response.json({ error: validacion.error }, { status: 400 });
    }

    // Verificar si ya existe cliente con este mismo tipo_persona y nro_doc (excepto cliente genérico)
    if (docLimpio && docLimpio !== "00000000") {
      const existe = await prisma.cliente.findUnique({
        where: {
          tipo_persona_nro_doc: {
            tipo_persona: tipo,
            nro_doc: docLimpio,
          },
        },
      });

      if (existe) {
        return Response.json(
          { error: `Ya existe un cliente registrado con el documento ${docLimpio}.` },
          { status: 400 }
        );
      }
    }

    const nuevoCliente = await prisma.cliente.create({
      data: {
        nro_doc: docLimpio || "00000000",
        nombre: nombre.trim().toUpperCase(),
        apellido: apellido ? apellido.trim().toUpperCase() : null,
        telefono: telefono ? telefono.trim() : null,
        tipo_persona: tipo,
        estado: true,
      },
    });

    return Response.json(
      {
        mensaje: "Cliente registrado con éxito.",
        cliente: {
          id: nuevoCliente.id_cliente,
          nroDoc: nuevoCliente.nro_doc,
          nombre: nuevoCliente.nombre,
          apellido: nuevoCliente.apellido || "",
          nombreCompleto: nuevoCliente.apellido
            ? `${nuevoCliente.nombre} ${nuevoCliente.apellido}`.trim()
            : nuevoCliente.nombre,
          telefono: nuevoCliente.telefono || "",
          tipoPersona: nuevoCliente.tipo_persona,
          estado: nuevoCliente.estado,
          totalCompras: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/clientes] Error al crear cliente:", error);
    return Response.json(
      { error: "Error interno al guardar los datos del cliente." },
      { status: 500 }
    );
  }
}
