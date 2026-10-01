"use server";

import { prisma } from "@/lib/prisma";
import { PurchaseOrderStatus, PurchaseReceiptStatus, InventoryMovementType } from "@prisma/client";
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
        items: {
          include: {
            supply: true,
            receiptItems: true,
          },
        },
        receipts: {
          include: {
            items: true,
          },
        },
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
        items: {
          include: {
            receiptItems: true,
          },
        },
      },
    });
    if (!order) {
      throw new Error("Orden de compra no encontrada");
    }

    const receipt = await tx.purchaseReceipt.create({
      data: {
        purchaseOrderId: data.purchaseOrderId,
        receivedById: validEmployeeId,
        receivedAt: new Date(),
        notes: data.notes?.trim() || null,
        status: PurchaseReceiptStatus.Confirmed,
      },
    });

    for (const d of data.items) {
      if (d.quantityReceived <= 0) continue; // Skip lines with 0 received

      const orderLine = order.items.find(
        (doItem) => doItem.id === d.purchaseOrderItemId
      );
      if (!orderLine) {
        throw new Error(`Detalle de orden ID ${d.purchaseOrderItemId} no pertenece a la orden`);
      }

      const receiptLine = await tx.purchaseReceiptItem.create({
        data: {
          receiptId: receipt.id,
          purchaseOrderItemId: d.purchaseOrderItemId,
          quantityReceived: d.quantityReceived,
          notes: d.notes?.trim() || null,
        },
      });

      // Stock invariant: create inventoryMovement and update currentStock
      await tx.inventoryMovement.create({
        data: {
          supplyId: orderLine.supplyId,
          purchaseReceiptItemId: receiptLine.id,
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

    // Check overall order reception status
    const previousReceipts = await tx.purchaseReceiptItem.findMany({
      where: {
        receipt: {
          purchaseOrderId: data.purchaseOrderId,
        },
      },
    });

    let completed = true;
    for (const orderLine of order.items) {
      const accumulated = previousReceipts
        .filter((r) => r.purchaseOrderItemId === orderLine.id)
        .reduce((sum, r) => sum + Number(r.quantityReceived), 0);
      if (accumulated < Number(orderLine.quantityOrdered)) {
        completed = false;
        break;
      }
    }

    const newStatus = completed
      ? PurchaseOrderStatus.FullyReceived
      : PurchaseOrderStatus.PartiallyReceived;

    await tx.purchaseOrder.update({
      where: { id: data.purchaseOrderId },
      data: { status: newStatus },
    });

    return receipt;
  });
}

export async function getPurchaseReceipts() {
  try {
    return await prisma.purchaseReceipt.findMany({
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
          },
        },
        receivedBy: true,
        items: {
          include: {
            purchaseOrderItem: {
              include: {
                supply: true,
              },
            },
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
