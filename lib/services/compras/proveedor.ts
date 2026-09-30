"use server";

import { prisma } from "@/lib/prisma";

export interface ProveedorInput {
  tipo_documento?: "RUC" | "DNI";
  ruc: string;
  razon_social: string;
  persona_contacto?: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
  estado?: boolean;
}

export async function obtenerProveedores() {
  try {
    return await prisma.proveedor.findMany({
      orderBy: { razon_social: "asc" },
    });
  } catch (error) {
    console.error("Error al obtener proveedores:", error);
    return [];
  }
}

export async function crearProveedor(data: ProveedorInput) {
  const doc = data.ruc ? data.ruc.trim() : "";
  if (!doc || (doc.length !== 8 && doc.length !== 11)) {
    throw new Error("El documento debe tener 8 dígitos (DNI) u 11 dígitos (RUC)");
  }
  if (!data.razon_social || data.razon_social.trim() === "") {
    throw new Error("La razón social o nombre es obligatorio");
  }

  const existe = await prisma.proveedor.findUnique({
    where: { ruc: doc },
  });
  if (existe) {
    throw new Error(`Ya existe un proveedor registrado con el documento ${doc}`);
  }

  return await prisma.proveedor.create({
    data: {
      ruc: doc,
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

export async function actualizarProveedor(id_proveedor: number, data: ProveedorInput) {
  const doc = data.ruc ? data.ruc.trim() : "";
  if (!doc || (doc.length !== 8 && doc.length !== 11)) {
    throw new Error("El documento debe tener 8 dígitos (DNI) u 11 dígitos (RUC)");
  }
  if (!data.razon_social || data.razon_social.trim() === "") {
    throw new Error("La razón social o nombre es obligatorio");
  }

  const proveedorExistente = await prisma.proveedor.findUnique({
    where: { id_proveedor },
  });
  if (!proveedorExistente) {
    throw new Error("Proveedor no encontrado");
  }

  if (proveedorExistente.ruc !== doc) {
    const dupl = await prisma.proveedor.findUnique({
      where: { ruc: doc },
    });
    if (dupl) {
      throw new Error(`Ya existe un proveedor registrado con el documento ${doc}`);
    }
  }

  return await prisma.proveedor.update({
    where: { id_proveedor },
    data: {
      ruc: doc,
      razon_social: data.razon_social.trim(),
      nombre_comercial: null,
      nombre: null,
      persona_contacto: data.persona_contacto?.trim() || null,
      direccion: data.direccion?.trim() || null,
      telefono: data.telefono?.trim() || null,
      correo: data.correo?.trim() || null,
      estado: data.estado !== undefined ? data.estado : proveedorExistente.estado,
    },
  });
}

export async function cambiarEstadoProveedor(id_proveedor: number, estado: boolean) {
  return await prisma.proveedor.update({
    where: { id_proveedor },
    data: { estado },
  });
}
