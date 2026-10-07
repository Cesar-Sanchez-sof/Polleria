"use server";

import { prisma } from "@/lib/prisma";
import { PurchaseOrderStatus, InventoryMovementType, AffectationIgv } from "@prisma/client";
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

export interface UnifiedPurchaseInput {
  supplierId: number;
  receivedById?: number;
  voucherType: string;
  series: string;
  number: number;
  issuedAt: Date | string;
  paymentCondition: "Contado" | "Credito";
  paymentTypeId?: number;
  items: Array<{
    supplyId: number;
    quantity: number;
    unitPrice: number;
    affectationIgv: "Included" | "Excluded";
  }>;
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

export async function registerUnifiedPurchase(data: UnifiedPurchaseInput) {
  if (!data.supplierId) {
    throw new Error("Debe seleccionar un proveedor");
  }
  if (!data.items || data.items.length === 0) {
    throw new Error("La orden debe tener al menos una línea de insumo");
  }
  if (!data.voucherType || !data.series || !data.number) {
    throw new Error("Faltan datos del comprobante");
  }

  for (const item of data.items) {
    if (item.quantity <= 0) {
      throw new Error("La cantidad debe ser mayor a 0");
    }
    if (item.unitPrice < 0) {
      throw new Error("El precio unitario no puede ser negativo");
    }
  }

  return await prisma.$transaction(async (tx) => {
    const validEmployeeId = await getOrCreateActiveEmployee(tx, data.receivedById);

    let subtotalGeneral = 0;
    let igvGeneral = 0;
    let totalGeneral = 0;

    const itemsToCreate = data.items.map((item) => {
      let subtotalLine = 0;
      let igvLine = 0;
      let finalAmountLine = 0;
      let unitCost = 0;

      if (item.affectationIgv === "Included") {
        subtotalLine = (item.quantity * item.unitPrice) / 1.18;
        igvLine = (item.quantity * item.unitPrice) - subtotalLine;
        finalAmountLine = item.quantity * item.unitPrice;
        unitCost = item.unitPrice / 1.18;
      } else {
        subtotalLine = item.quantity * item.unitPrice;
        igvLine = subtotalLine * 0.18;
        finalAmountLine = subtotalLine + igvLine;
        unitCost = item.unitPrice;
      }

      subtotalLine = Math.round(subtotalLine * 100) / 100;
      igvLine = Math.round(igvLine * 100) / 100;
      finalAmountLine = Math.round(finalAmountLine * 100) / 100;

      subtotalGeneral += subtotalLine;
      igvGeneral += igvLine;
      totalGeneral += finalAmountLine;

      return {
        supplyId: item.supplyId,
        quantityOrdered: item.quantity,
        quantityReceived: item.quantity,
        unitPrice: item.unitPrice,
        affectationIgvApplied: item.affectationIgv as AffectationIgv,
        subtotalLine,
        igvLine,
        finalAmountLine,
        unitCost,
      };
    });

    subtotalGeneral = Math.round(subtotalGeneral * 100) / 100;
    igvGeneral = Math.round(igvGeneral * 100) / 100;
    totalGeneral = Math.round(totalGeneral * 100) / 100;

    const existingInvoice = await tx.purchaseInvoice.findFirst({
      where: {
        supplierId: data.supplierId,
        voucherType: data.voucherType,
        series: data.series,
        number: data.number,
      },
    });

    if (existingInvoice) {
      throw new Error("Ya existe un comprobante con ese número para este proveedor");
    }

    let orderNumber = await generateOrderNumber();
    const existingOrder = await tx.purchaseOrder.findUnique({ where: { orderNumber } });
    if (existingOrder) {
      orderNumber = `${orderNumber}-${Math.floor(Math.random() * 1000)}`;
    }

    const issuedDate = data.issuedAt ? new Date(data.issuedAt) : new Date();

    const order = await tx.purchaseOrder.create({
      data: {
        supplierId: data.supplierId,
        employeeId: validEmployeeId,
        receivedById: validEmployeeId,
        orderNumber,
        issuedAt: issuedDate,
        receivedAt: new Date(),
        status: PurchaseOrderStatus.FullyReceived,
        subtotal: subtotalGeneral,
        igv: igvGeneral,
        total: totalGeneral,
        items: {
          create: itemsToCreate.map((item) => ({
            supplyId: item.supplyId,
            quantityOrdered: item.quantityOrdered,
            quantityReceived: item.quantityReceived,
            unitPrice: item.unitPrice,
            affectationIgvApplied: item.affectationIgvApplied,
            subtotalLine: item.subtotalLine,
            igvLine: item.igvLine,
            finalAmountLine: item.finalAmountLine,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    const invoice = await tx.purchaseInvoice.create({
      data: {
        supplierId: data.supplierId,
        purchaseOrderId: order.id,
        voucherType: data.voucherType,
        series: data.series,
        number: data.number,
        issuedAt: issuedDate,
        subtotal: subtotalGeneral,
        igv: igvGeneral,
        totalAmount: totalGeneral,
      },
    });

    if (data.paymentCondition === "Contado" && data.paymentTypeId) {
      await tx.purchasePayment.create({
        data: {
          purchaseInvoiceId: invoice.id,
          paymentTypeId: data.paymentTypeId,
          amount: totalGeneral,
          paidAt: new Date(),
        },
      });
    }

    for (let i = 0; i < order.items.length; i++) {
      const poItem = order.items[i];
      const itemConfig = itemsToCreate[i];
      const quantity = Number(poItem.quantityReceived!);

      await tx.inventoryMovement.create({
        data: {
          supplyId: poItem.supplyId,
          purchaseOrderItemId: poItem.id,
          movementType: InventoryMovementType.Purchase,
          quantity: quantity,
          unitCost: itemConfig.unitCost,
        },
      });

      const supply = await tx.supply.findUnique({ where: { id: poItem.supplyId } });
      if (supply) {
        const currentStock = Number(supply.currentStock);
        const currentAverageCost = Number(supply.averageCost);
        const newStock = currentStock + quantity;

        let newAverageCost = 0;
        if (newStock > 0) {
          newAverageCost =
            (currentStock * currentAverageCost + quantity * itemConfig.unitCost) /
            newStock;
        }

        await tx.supply.update({
          where: { id: supply.id },
          data: {
            currentStock: newStock,
            lastCost: Math.round(itemConfig.unitCost * 100) / 100,
            averageCost: Math.round(newAverageCost * 100) / 100,
          },
        });
      }
    }

    return await tx.purchaseOrder.findUnique({
      where: { id: order.id },
      include: {
        items: true,
        invoices: true,
      },
    });
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
