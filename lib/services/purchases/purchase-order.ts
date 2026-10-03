"use server";

import { prisma } from "@/lib/prisma";
import { PurchaseOrderStatus } from "@prisma/client";
import { getOrCreateActiveEmployee } from "./employee-helper";

export interface PurchaseOrderLineInput {
  supplyId: number;
  quantityOrdered: number;
  unitPrice: number;
}

export interface PurchaseOrderInput {
  supplierId: number;
  employeeId?: number;
  expectedAt?: Date | string | null;
  notes?: string;
  items: PurchaseOrderLineInput[];
}

export async function generateOrderNumber(): Promise<string> {
  const count = await prisma.purchaseOrder.count();
  const year = new Date().getFullYear();
  const num = (count + 1).toString().padStart(5, "0");
  return `OC-${year}-${num}`;
}

export async function createPurchaseOrder(data: PurchaseOrderInput) {
  if (!data.supplierId) {
    throw new Error("Debe seleccionar un proveedor");
  }
  if (!data.items || data.items.length === 0) {
    throw new Error("La orden debe tener al menos una línea de insumo");
  }

  for (const d of data.items) {
    if (!d.supplyId) {
      throw new Error("Insumo no válido en una de las líneas");
    }
    if (d.quantityOrdered <= 0) {
      throw new Error("La cantidad pedida debe ser mayor a 0");
    }
    if (d.unitPrice < 0) {
      throw new Error("El precio unitario no puede ser negativo");
    }
  }

  return await prisma.$transaction(async (tx) => {
    const validEmployeeId = await getOrCreateActiveEmployee(tx, data.employeeId);

    let orderNumber = await generateOrderNumber();
    const existing = await tx.purchaseOrder.findUnique({ where: { orderNumber } });
    if (existing) {
      orderNumber = `${orderNumber}-${Math.floor(Math.random() * 1000)}`;
    }

    let subtotal = 0;
    for (const d of data.items) {
      subtotal += d.quantityOrdered * d.unitPrice;
    }
    const igv = Math.round(subtotal * 0.18 * 100) / 100;
    const total = subtotal + igv;

    const expectedDate = data.expectedAt ? new Date(data.expectedAt) : null;

    const order = await tx.purchaseOrder.create({
      data: {
        supplierId: data.supplierId,
        employeeId: validEmployeeId,
        orderNumber,
        issuedAt: new Date(),
        expectedAt: expectedDate,
        status: PurchaseOrderStatus.Pending,
        subtotal,
        igv,
        total,
        notes: data.notes?.trim() || null,
        items: {
          create: data.items.map((d) => ({
            supplyId: d.supplyId,
            quantityOrdered: d.quantityOrdered,
            unitPrice: d.unitPrice,
          })),
        },
      },
      include: {
        supplier: true,
        employee: true,
        items: {
          include: {
            supply: true,
          },
        },
      },
    });

    return order;
  });
}

export async function getPurchaseOrders() {
  try {
    return await prisma.purchaseOrder.findMany({
      include: {
        supplier: true,
        employee: true,
        items: {
          include: {
            supply: true,
          },
        },
        invoices: true,
      },
      orderBy: { issuedAt: "desc" },
    });
  } catch (error) {
    console.error("Error al obtener órdenes de compra:", error);
    return [];
  }
}

export async function getPurchaseOrderById(id: number) {
  try {
    return await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        employee: true,
        items: {
          include: {
            supply: true,
          },
        },
        invoices: {
          include: {
            payments: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error al obtener orden de compra:", error);
    return null;
  }
}
