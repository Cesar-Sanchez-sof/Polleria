"use server";

import { prisma } from "@/lib/prisma";

export interface SupplierInput {
  documentType?: "RUC" | "DNI";
  ruc: string;
  businessName: string;
  contactPerson?: string;
  address?: string;
  phone?: string;
  email?: string;
  active?: boolean;
}

export async function getSuppliers() {
  try {
    return await prisma.supplier.findMany({
      orderBy: { businessName: "asc" },
    });
  } catch (error) {
    console.error("Error al obtener proveedores:", error);
    return [];
  }
}

export async function createSupplier(data: SupplierInput) {
  const document = data.ruc ? data.ruc.trim() : "";
  if (!document || (document.length !== 8 && document.length !== 11)) {
    throw new Error("El documento debe tener 8 dígitos (DNI) u 11 dígitos (RUC)");
  }
  if (!data.businessName || data.businessName.trim() === "") {
    throw new Error("La razón social o nombre es obligatorio");
  }

  const existing = await prisma.supplier.findUnique({
    where: { ruc: document },
  });
  if (existing) {
    throw new Error(`Ya existe un proveedor registrado con el documento ${document}`);
  }

  return await prisma.supplier.create({
    data: {
      ruc: document,
      businessName: data.businessName.trim(),
      contactPerson: data.contactPerson?.trim() || null,
      address: data.address?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      active: data.active !== undefined ? data.active : true,
    },
  });
}

export async function updateSupplier(id: number, data: SupplierInput) {
  const document = data.ruc ? data.ruc.trim() : "";
  if (!document || (document.length !== 8 && document.length !== 11)) {
    throw new Error("El documento debe tener 8 dígitos (DNI) u 11 dígitos (RUC)");
  }
  if (!data.businessName || data.businessName.trim() === "") {
    throw new Error("La razón social o nombre es obligatorio");
  }

  const existingSupplier = await prisma.supplier.findUnique({
    where: { id },
  });
  if (!existingSupplier) {
    throw new Error("Proveedor no encontrado");
  }

  if (existingSupplier.ruc !== document) {
    const duplicate = await prisma.supplier.findUnique({
      where: { ruc: document },
    });
    if (duplicate) {
      throw new Error(`Ya existe un proveedor registrado con el documento ${document}`);
    }
  }

  return await prisma.supplier.update({
    where: { id },
    data: {
      ruc: document,
      businessName: data.businessName.trim(),
      contactPerson: data.contactPerson?.trim() || null,
      address: data.address?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      active: data.active !== undefined ? data.active : existingSupplier.active,
    },
  });
}

export async function setSupplierStatus(id: number, active: boolean) {
  return await prisma.supplier.update({
    where: { id },
    data: { active },
  });
}
