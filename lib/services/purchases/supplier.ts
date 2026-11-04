"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/permissions";
import { auditPurchase } from "./purchase-audit";

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
  await requirePermission(["proveedores.ver", "compras.ver"]);
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
  const session = await requirePermission("proveedores.crear");
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

  const created = await prisma.supplier.create({
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
  await auditPurchase(session, {
    action: "CREATE",
    entity: "Proveedor",
    entityId: created.id,
    description: `Registró al proveedor ${created.businessName} (${created.ruc})`,
    details: { after: { ruc: created.ruc, business_name: created.businessName } },
  });
  return created;
}

export async function updateSupplier(id: number, data: SupplierInput) {
  const session = await requirePermission("proveedores.editar");
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

  const updated = await prisma.supplier.update({
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
  const snapshot = (s: typeof existingSupplier) => ({
    ruc: s.ruc,
    business_name: s.businessName,
    contact_person: s.contactPerson,
    phone: s.phone,
    email: s.email,
    active: s.active,
  });
  await auditPurchase(session, {
    action: "UPDATE",
    entity: "Proveedor",
    entityId: id,
    description: `Modificó al proveedor ${updated.businessName}`,
    details: { before: snapshot(existingSupplier), after: snapshot(updated) },
  });
  return updated;
}

export async function setSupplierStatus(id: number, active: boolean) {
  const session = await requirePermission("proveedores.editar");
  const updated = await prisma.supplier.update({
    where: { id },
    data: { active },
  });
  await auditPurchase(session, {
    action: "STATUS_CHANGE",
    entity: "Proveedor",
    entityId: id,
    description: `${active ? "Activó" : "Desactivó"} al proveedor ${updated.businessName}`,
    details: { before: { active: !active }, after: { active } },
  });
  return updated;
}
