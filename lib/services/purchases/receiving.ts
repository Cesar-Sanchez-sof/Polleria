"use server";

import { prisma } from "@/lib/prisma";
import { PurchaseOrderStatus, InventoryMovementType } from "@prisma/client";
import { getOrCreateActiveEmployee } from "./employee-helper";

export interface ReceivingLineInput {
  purchaseOrderItemId: number;
  quantityReceived: number;
  notes?: string;
}

export interface PurchaseReceivingInput {
  purchaseOrderId: number;
  receivedById?: number;
  notes?: string;
  items: ReceivingLineInput[];
}

export async function getOrdersForReceiving() {
  try {
    return await prisma.purchaseOrder.findMany({
      where: {
        status: {
          in: [PurchaseOrderStatus.Pending, PurchaseOrderStatus.PartiallyReceived],
        },
      },
      include: {
        supplier: true,
        employee: true,
        receivedBy: true,
        items: {
          include: {
            supply: true,
            inventoryMovements: true,
          },
        },
        invoices: true,
      },
      orderBy: { issuedAt: "desc" },
    });
  } catch (error) {
    console.error("Error al obtener órdenes para recepción:", error);
    return [];
  }
}

export async function receivePurchase(data: PurchaseReceivingInput) {
  if (!data.purchaseOrderId) {
    throw new Error("Debe especificar la orden de compra");
  }
  if (!data.items || data.items.length === 0) {
    throw new Error("Debe ingresar al menos un detalle de recepción");
  }

  return await prisma.$transaction(async (tx) => {
    const validEmployeeId = await getOrCreateActiveEmployee(tx, data.receivedById);

    const order = await tx.purchaseOrder.findUnique({
      where: { id: data.purchaseOrderId },
      include: {
        items: true,
      },
    });
    if (!order) {
      throw new Error("Orden de compra no encontrada");
    }

    for (const d of data.items) {
      if (d.quantityReceived <= 0) continue; // Skip lines with 0 received

      const orderLine = order.items.find(
        (doItem) => doItem.id === d.purchaseOrderItemId
      );
      if (!orderLine) {
        throw new Error(`Detalle de orden ID ${d.purchaseOrderItemId} no pertenece a la orden`);
      }

      const currentReceived = Number(orderLine.quantityReceived || 0);
      const newReceivedTotal = currentReceived + d.quantityReceived;

      await tx.purchaseOrderItem.update({
        where: { id: d.purchaseOrderItemId },
        data: {
          quantityReceived: newReceivedTotal,
          observation: d.notes?.trim() || orderLine.observation,
        },
      });

      // Stock invariant: create inventoryMovement and update currentStock
      await tx.inventoryMovement.create({
        data: {
          supplyId: orderLine.supplyId,
          purchaseOrderItemId: orderLine.id,
          movementType: InventoryMovementType.Purchase,
          quantity: d.quantityReceived,
          unitCost: orderLine.unitPrice,
          reason: `Recepción Orden #${order.orderNumber}`,
        },
      });

      const supply = await tx.supply.findUnique({ where: { id: orderLine.supplyId } });
      if (supply) {
        const newStock = Number(supply.currentStock) + d.quantityReceived;
        await tx.supply.update({
          where: { id: orderLine.supplyId },
          data: { currentStock: newStock },
        });
      }
    }

    // Refresh items to calculate new order status
    const updatedItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: data.purchaseOrderId },
    });

    let completed = true;
    for (const item of updatedItems) {
      if (Number(item.quantityReceived || 0) < Number(item.quantityOrdered)) {
        completed = false;
        break;
      }
    }

    const newStatus = completed
      ? PurchaseOrderStatus.FullyReceived
      : PurchaseOrderStatus.PartiallyReceived;

    const updatedOrder = await tx.purchaseOrder.update({
      where: { id: data.purchaseOrderId },
      data: {
        status: newStatus,
        receivedById: validEmployeeId,
        receivedAt: new Date(),
        notes: data.notes?.trim() || order.notes,
      },
      include: {
        supplier: true,
        receivedBy: true,
        items: {
          include: {
            supply: true,
          },
        },
      },
    });

    return updatedOrder;
  });
}

export async function getPurchaseReceipts() {
  try {
    return await prisma.purchaseOrder.findMany({
      where: {
        status: {
          in: [PurchaseOrderStatus.PartiallyReceived, PurchaseOrderStatus.FullyReceived],
        },
      },
      include: {
        supplier: true,
        receivedBy: true,
        employee: true,
        items: {
          include: {
            supply: true,
            inventoryMovements: true,
          },
        },
        invoices: true,
      },
      orderBy: { receivedAt: "desc" },
    });
  } catch (error) {
    console.error("Error al obtener recepciones de compra:", error);
    return [];
  }
}
