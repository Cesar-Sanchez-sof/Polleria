"use server";

import { prisma } from "@/lib/prisma";
import { InventoryMovementType } from "@prisma/client";
import { getOrCreateActiveEmployee } from "./employee-helper";

export interface PurchaseWithoutVoucherInput {
  supplyId: number;
  employeeId?: number;
  quantity: number;
  amountPaid: number;
  date?: Date | string | null;
  informalPlaceOrVendor?: string;
  reason?: string;
}

export async function registerPurchaseWithoutVoucher(data: PurchaseWithoutVoucherInput) {
  if (!data.supplyId) {
    throw new Error("Debe seleccionar un insumo");
  }
  if (!data.quantity || data.quantity <= 0) {
    throw new Error("La cantidad debe ser mayor a 0");
  }
  if (!data.amountPaid || data.amountPaid <= 0) {
    throw new Error("El monto pagado debe ser mayor a 0");
  }

  return await prisma.$transaction(async (tx) => {
    const validEmployeeId = await getOrCreateActiveEmployee(tx, data.employeeId);

    const supply = await tx.supply.findUnique({ where: { id: data.supplyId } });
    if (!supply) {
      throw new Error("Insumo no encontrado");
    }

    const purchaseDate = data.date ? new Date(data.date) : new Date();

    const purchase = await tx.informalPurchase.create({
      data: {
        supplyId: data.supplyId,
        employeeId: validEmployeeId,
        quantity: data.quantity,
        amountPaid: data.amountPaid,
        date: purchaseDate,
        informalPlaceOrVendor: data.informalPlaceOrVendor?.trim() || null,
        reason: data.reason?.trim() || null,
      },
    });

    const unitCost = data.amountPaid / data.quantity;

    await tx.inventoryMovement.create({
      data: {
        supplyId: data.supplyId,
        movementType: InventoryMovementType.InformalPurchase,
        quantity: data.quantity,
        unitCost,
        reason: data.reason?.trim() || `Compra menor sin comprobante #${purchase.id}`,
      },
    });

    const newStock = Number(supply.currentStock) + data.quantity;
    await tx.supply.update({
      where: { id: data.supplyId },
      data: { currentStock: newStock },
    });

    return purchase;
  });
}

export async function getPurchasesWithoutVoucher() {
  try {
    return await prisma.informalPurchase.findMany({
      include: {
        supply: true,
        employee: true,
      },
      orderBy: { date: "desc" },
    });
  } catch (error) {
    console.error("Error al obtener compras sin comprobante:", error);
    return [];
  }
}
