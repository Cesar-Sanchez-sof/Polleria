import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateCustomerDocument } from "@/lib/utils/sales-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("q") || "").trim();

    const customers = await prisma.cliente.findMany({
      where: search
        ? {
            OR: [
              { nro_doc: { contains: search, mode: "insensitive" } },
              { nombre: { contains: search, mode: "insensitive" } },
              { apellido: { contains: search, mode: "insensitive" } },
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

    const result = customers.map((c) => ({
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

    return Response.json({ data: result });
  } catch (error) {
    console.error("[api/customers] Error al listar clientes:", error);
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

    const cleanDoc = (nro_doc || "").trim();
    const tipo = tipo_persona === "Juridico" ? "Juridico" : "Natural";

    // Validar formato de documento según tipo de persona
    const validation = validateCustomerDocument(tipo, cleanDoc);
    if (!validation.isValid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    // Verificar si ya existe cliente con este mismo tipo_persona y nro_doc (excepto cliente genérico)
    if (cleanDoc && cleanDoc !== "00000000") {
      const exists = await prisma.cliente.findUnique({
        where: {
          tipo_persona_nro_doc: {
            tipo_persona: tipo,
            nro_doc: cleanDoc,
          },
        },
      });

      if (exists) {
        return Response.json(
          { error: `Ya existe un cliente registrado con el documento ${cleanDoc}.` },
          { status: 400 }
        );
      }
    }

    const newCustomer = await prisma.cliente.create({
      data: {
        nro_doc: cleanDoc || "00000000",
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
          id: newCustomer.id_cliente,
          nroDoc: newCustomer.nro_doc,
          nombre: newCustomer.nombre,
          apellido: newCustomer.apellido || "",
          nombreCompleto: newCustomer.apellido
            ? `${newCustomer.nombre} ${newCustomer.apellido}`.trim()
            : newCustomer.nombre,
          telefono: newCustomer.telefono || "",
          tipoPersona: newCustomer.tipo_persona,
          estado: newCustomer.estado,
          totalCompras: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/customers] Error al crear cliente:", error);
    return Response.json(
      { error: "Error interno al guardar los datos del cliente." },
      { status: 500 }
    );
  }
}
