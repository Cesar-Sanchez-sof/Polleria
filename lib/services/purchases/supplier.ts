"use server";

import { prisma } from "@/lib/prisma";

export interface SupplierInput {
  tipo_documento?: "RUC" | "DNI";
  ruc: string;
  razon_social: string;
  persona_contacto?: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
  estado?: boolean;
}

export async function getSuppliers() {
  try {
    return await prisma.proveedor.findMany({
      orderBy: { razon_social: "asc" },
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
  if (!data.razon_social || data.razon_social.trim() === "") {
    throw new Error("La razón social o nombre es obligatorio");
  }

  const existing = await prisma.proveedor.findUnique({
    where: { ruc: document },
  });
  if (existing) {
    throw new Error(`Ya existe un proveedor registrado con el documento ${document}`);
  }

  return await prisma.proveedor.create({
    data: {
      ruc: document,
      razon_social: data.razon_social.trim(),
      nombre_comercial: null,
      nombre: null,
      persona_contacto: data.persona_contacto?.trim() || null,
      direccion: data.direccion?.trim() || null,
      telefono: data.telefono?.trim() || null,
      correo: data.correo?.trim() || null,
      estado: data.estado !== undefined ? data.estado : true,
    },
  });
}

export async function updateSupplier(id_proveedor: number, data: SupplierInput) {
  const document = data.ruc ? data.ruc.trim() : "";
  if (!document || (document.length !== 8 && document.length !== 11)) {
    throw new Error("El documento debe tener 8 dígitos (DNI) u 11 dígitos (RUC)");
  }
  if (!data.razon_social || data.razon_social.trim() === "") {
    throw new Error("La razón social o nombre es obligatorio");
  }

  const existingSupplier = await prisma.proveedor.findUnique({
    where: { id_proveedor },
  });
  if (!existingSupplier) {
    throw new Error("Proveedor no encontrado");
  }

  if (existingSupplier.ruc !== document) {
    const duplicate = await prisma.proveedor.findUnique({
      where: { ruc: document },
    });
    if (duplicate) {
      throw new Error(`Ya existe un proveedor registrado con el documento ${document}`);
    }
  }

  return await prisma.proveedor.update({
    where: { id_proveedor },
    data: {
      ruc: document,
      razon_social: data.razon_social.trim(),
      nombre_comercial: null,
      nombre: null,
      persona_contacto: data.persona_contacto?.trim() || null,
      direccion: data.direccion?.trim() || null,
      telefono: data.telefono?.trim() || null,
      correo: data.correo?.trim() || null,
      estado: data.estado !== undefined ? data.estado : existingSupplier.estado,
    },
  });
}

export async function setSupplierStatus(id_proveedor: number, estado: boolean) {
  return await prisma.proveedor.update({
    where: { id_proveedor },
    data: { estado },
  });
}
