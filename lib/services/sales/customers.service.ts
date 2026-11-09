import { prisma } from "@/lib/prisma";
import { validateCustomerDocument } from "@/lib/utils/sales-helpers";
import {
  ValidationError,
  ConflictError,
  NotFoundError,
} from "@/lib/http/route-handler";

export type PersonTypeValue = "Natural" | "Legal";

export function normalizePersonType(value: unknown): PersonTypeValue {
  if (value === "Legal" || value === "Juridico") return "Legal";
  return "Natural";
}

export interface CustomerDto {
  id: number;
  documentNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  personType: string;
  active: boolean;
  totalPurchases: number;
}

export interface CreateCustomerInput {
  documentNumber?: string;
  document_number?: string;
  firstName?: string;
  name?: string;
  lastName?: string;
  last_name?: string;
  phone?: string;
  personType?: "Natural" | "Legal" | "Juridico";
  person_type?: "Natural" | "Legal" | "Juridico";
}

/**
 * Busca clientes registrados por número de documento, nombre o apellido.
 */
export async function searchCustomers(query?: string): Promise<CustomerDto[]> {
  const search = (query || "").trim();

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

  return customers.map((c) => ({
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
}

/**
 * Obtiene un cliente por su ID.
 */
export async function getCustomerById(id: number): Promise<CustomerDto> {
  const c = await prisma.customer.findUnique({
    where: { id },
    include: {
      _count: {
        select: { salesInvoices: true },
      },
    },
  });

  if (!c) {
    throw new NotFoundError("Cliente no encontrado.");
  }

  return {
    id: c.id,
    documentNumber: c.documentNumber,
    firstName: c.firstName,
    lastName: c.lastName || "",
    fullName: c.lastName ? `${c.firstName} ${c.lastName}`.trim() : c.firstName,
    phone: c.phone || "",
    personType: c.personType,
    active: c.active,
    totalPurchases: c._count.salesInvoices,
  };
}

/**
 * Registra un nuevo cliente con validaciones de documento de identidad peruano.
 */
export async function createCustomer(data: CreateCustomerInput | null): Promise<{
  message: string;
  customer: CustomerDto;
}> {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Datos del cliente no válidos.");
  }

  const documentNumber = (data.documentNumber ?? data.document_number ?? "").trim();
  const firstName = (data.firstName ?? data.name ?? "").trim();
  const lastName = data.lastName ?? data.last_name;
  const phone = data.phone;
  const personType = normalizePersonType(data.personType ?? data.person_type);

  if (!firstName) {
    throw new ValidationError("El nombre o razón social es obligatorio.");
  }

  // Validar formato de documento según tipo de persona
  const validation = validateCustomerDocument(personType, documentNumber);
  if (!validation.isValid) {
    throw new ValidationError(validation.error || "Documento de identidad no válido.");
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
      throw new ConflictError(`Ya existe un cliente registrado con el documento ${documentNumber}.`);
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

  return {
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
  };
}

/**
 * Obtiene o crea un cliente para comprobantes de venta.
 * Si no se proporciona información de cliente, busca o genera "CLIENTES VARIOS".
 */
export async function findOrCreateCustomerForSale(customerInput?: {
  documentNumber?: string;
  document_number?: string;
  firstName?: string;
  name?: string;
  personType?: "Natural" | "Legal" | "Juridico";
  person_type?: "Natural" | "Legal" | "Juridico";
  phone?: string;
}): Promise<{ id: number; name: string; document: string; personType: PersonTypeValue }> {
  const customerDoc = (customerInput?.documentNumber ?? customerInput?.document_number)?.trim() || "00000000";
  const customerName = (customerInput?.firstName ?? customerInput?.name)?.trim() || "CLIENTES VARIOS";
  const personType = normalizePersonType(customerInput?.personType ?? customerInput?.person_type);

  const existingCustomer = await prisma.customer.findFirst({
    where: { documentNumber: customerDoc },
  });

  if (existingCustomer) {
    return {
      id: existingCustomer.id,
      name: existingCustomer.firstName,
      document: existingCustomer.documentNumber,
      personType: normalizePersonType(existingCustomer.personType),
    };
  }

  const newCustomer = await prisma.customer.create({
    data: {
      documentNumber: customerDoc,
      firstName: customerName,
      personType,
      phone: customerInput?.phone ? String(customerInput.phone).trim() : null,
      active: true,
    },
  });

  return {
    id: newCustomer.id,
    name: newCustomer.firstName,
    document: newCustomer.documentNumber,
    personType,
  };
}
