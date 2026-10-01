import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateCustomerDocument } from "@/lib/utils/sales-helpers";

export const dynamic = "force-dynamic";

type PersonTypeValue = "Natural" | "Legal";

function normalizePersonType(value: unknown): PersonTypeValue {
  if (value === "Legal" || value === "Juridico") return "Legal";
  return "Natural";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("q") || "").trim();

    const customers = await prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { documentNumber: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: {
        _count: {
          select: { salesInvoices: true },
        },
      },
      orderBy: { id: "desc" },
      take: 100,
    });

    const result = customers.map((c) => ({
      id: c.id,
      documentNumber: c.documentNumber,
      firstName: c.firstName,
      lastName: c.lastName || "",
      fullName: c.lastName ? `${c.firstName} ${c.lastName}`.trim() : c.firstName,
      phone: c.phone || "",
      personType: c.personType,
      active: c.active,
      totalPurchases: c._count.salesInvoices,
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

    const documentNumber = (body.documentNumber ?? body.nro_doc ?? "").trim();
    const firstName = (body.firstName ?? body.nombre ?? "").trim();
    const lastName = body.lastName ?? body.apellido;
    const phone = body.phone ?? body.telefono;
    const personType = normalizePersonType(body.personType ?? body.tipo_persona);

    if (!firstName) {
      return Response.json({ error: "El nombre o razón social es obligatorio." }, { status: 400 });
    }

    // Validar formato de documento según tipo de persona
    const validation = validateCustomerDocument(personType, documentNumber);
    if (!validation.isValid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    // Verificar si ya existe cliente con este mismo personType y documentNumber
    if (documentNumber && documentNumber !== "00000000") {
      const exists = await prisma.customer.findUnique({
        where: {
          personType_documentNumber: {
            personType,
            documentNumber,
          },
        },
      });

      if (exists) {
        return Response.json(
          { error: `Ya existe un cliente registrado con el documento ${documentNumber}.` },
          { status: 400 }
        );
      }
    }

    const newCustomer = await prisma.customer.create({
      data: {
        documentNumber: documentNumber || "00000000",
        firstName: firstName.toUpperCase(),
        lastName: lastName ? String(lastName).trim().toUpperCase() : null,
        phone: phone ? String(phone).trim() : null,
        personType,
        active: true,
      },
    });

    return Response.json(
      {
        message: "Cliente registrado con éxito.",
        customer: {
          id: newCustomer.id,
          documentNumber: newCustomer.documentNumber,
          firstName: newCustomer.firstName,
          lastName: newCustomer.lastName || "",
          fullName: newCustomer.lastName
            ? `${newCustomer.firstName} ${newCustomer.lastName}`.trim()
            : newCustomer.firstName,
          phone: newCustomer.phone || "",
          personType: newCustomer.personType,
          active: newCustomer.active,
          totalPurchases: 0,
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
