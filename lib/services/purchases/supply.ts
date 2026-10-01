"use server";

import { prisma } from "@/lib/prisma";
import { SupplyType, InventoryMovementType } from "@prisma/client";

export interface SupplyInput {
  name: string;
  type?: SupplyType;
  unitOfMeasure: string;
  minimumStock?: number;
}

export async function getSupplies() {
  try {
    return await prisma.supply.findMany({
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Error al obtener insumos:", error);
    return [];
  }
}

export async function createSupply(data: SupplyInput) {
  if (!data.name || data.name.trim() === "") {
    throw new Error("El nombre del insumo es obligatorio");
  }
  if (!data.unitOfMeasure || data.unitOfMeasure.trim() === "") {
    throw new Error("La unidad de medida es obligatoria");
  }

  return await prisma.supply.create({
    data: {
      name: data.name.trim(),
      type: data.type || SupplyType.RawMaterial,
      unitOfMeasure: data.unitOfMeasure.trim(),
      currentStock: 0,
      minimumStock: data.minimumStock || 0,
      active: true,
    },
  });
}

export async function registerInventoryAdjustment(
  supplyId: number,
  actualQuantity: number,
  reason: string,
  movementType: InventoryMovementType = InventoryMovementType.Adjustment
) {
  if (actualQuantity < 0) {
    throw new Error("La cantidad real no puede ser negativa");
  }
  if (!reason || reason.trim() === "") {
    throw new Error("El motivo del ajuste o merma es obligatorio");
  }

  return await prisma.$transaction(async (tx) => {
    const supply = await tx.supply.findUnique({
      where: { id: supplyId },
    });
    if (!supply) {
      throw new Error("Insumo no encontrado");
    }

    const currentStock = Number(supply.currentStock);
    const difference = actualQuantity - currentStock;

    const movement = await tx.inventoryMovement.create({
      data: {
        supplyId,
        movementType,
        quantity: difference,
        reason: reason.trim(),
      },
    });

    const updatedSupply = await tx.supply.update({
      where: { id: supplyId },
      data: { currentStock: actualQuantity },
    });

    return { movement, supply: updatedSupply };
  });
}

export async function getInventoryMovements(supplyId?: number) {
  try {
    return await prisma.inventoryMovement.findMany({
      where: supplyId ? { supplyId } : undefined,
      include: {
        supply: true,
        purchaseReceiptItem: {
          include: {
            receipt: true,
          },
        },
      },
      orderBy: { movedAt: "desc" },
    });
  } catch (error) {
    console.error("Error al obtener movimientos de inventario:", error);
    return [];
  }
}
