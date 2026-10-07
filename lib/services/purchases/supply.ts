"use server";

import { prisma } from "@/lib/prisma";
import { SupplyType, InventoryMovementType, AffectationIgv } from "@prisma/client";

export interface SupplyInput {
  name: string;
  type?: SupplyType;
  affectationIgv?: AffectationIgv;
  unitOfMeasure: string;
  minimumStock?: number;
}

export async function getSupplies() {
  try {
    const supplies = await prisma.supply.findMany({
      orderBy: { name: "asc" },
    });
    return supplies.map((s) => ({
      ...s,
      currentStock: Number(s.currentStock),
      minimumStock: Number(s.minimumStock),
      lastCost: Number(s.lastCost),
      averageCost: Number(s.averageCost),
    }));
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

  const res = await prisma.supply.create({
    data: {
      name: data.name.trim(),
      type: data.type || SupplyType.RawMaterial,
      affectationIgv: data.affectationIgv || AffectationIgv.Excluded,
      unitOfMeasure: data.unitOfMeasure.trim(),
      currentStock: 0,
      minimumStock: data.minimumStock || 0,
      active: true,
    },
  });

  return {
    ...res,
    currentStock: Number(res.currentStock),
    minimumStock: Number(res.minimumStock),
    lastCost: Number(res.lastCost),
    averageCost: Number(res.averageCost),
  };
}

export async function updateSupplyMinimum(supplyId: number, minimumStock: number) {
  if (minimumStock < 0) {
    throw new Error("El stock mínimo no puede ser negativo");
  }

  const supply = await prisma.supply.findUnique({
    where: { id: supplyId },
  });

  if (!supply) {
    throw new Error("Insumo no encontrado");
  }

  const updated = await prisma.supply.update({
    where: { id: supplyId },
    data: {
      minimumStock,
    },
  });

  return {
    ...updated,
    currentStock: Number(updated.currentStock),
    minimumStock: Number(updated.minimumStock),
    lastCost: Number(updated.lastCost),
    averageCost: Number(updated.averageCost),
  };
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

    return {
      movement: {
        ...movement,
        quantity: Number(movement.quantity),
        unitCost: movement.unitCost ? Number(movement.unitCost) : null,
      },
      supply: {
        ...updatedSupply,
        currentStock: Number(updatedSupply.currentStock),
        minimumStock: Number(updatedSupply.minimumStock),
        lastCost: Number(updatedSupply.lastCost),
        averageCost: Number(updatedSupply.averageCost),
      },
    };
  });
}

export async function setSupplyStatus(supplyId: number, active: boolean) {
  const supply = await prisma.supply.findUnique({
    where: { id: supplyId },
  });

  if (!supply) {
    throw new Error("Insumo no encontrado");
  }

  const updated = await prisma.supply.update({
    where: { id: supplyId },
    data: { active },
  });

  return {
    ...updated,
    currentStock: Number(updated.currentStock),
    minimumStock: Number(updated.minimumStock),
    lastCost: Number(updated.lastCost),
    averageCost: Number(updated.averageCost),
  };
}

export async function getInventoryMovements(supplyId?: number) {
  try {
    const movements = await prisma.inventoryMovement.findMany({
      where: supplyId ? { supplyId } : undefined,
      include: {
        supply: true,
        purchaseOrderItem: {
          include: {
            purchaseOrder: true,
          },
        },
      },
      orderBy: { movedAt: "desc" },
    });

    return movements.map((m) => ({
      ...m,
      quantity: Number(m.quantity),
      unitCost: m.unitCost ? Number(m.unitCost) : null,
      supply: {
        ...m.supply,
        currentStock: Number(m.supply.currentStock),
        minimumStock: Number(m.supply.minimumStock),
        lastCost: Number(m.supply.lastCost),
        averageCost: Number(m.supply.averageCost),
      },
    }));
  } catch (error) {
    console.error("Error al obtener movimientos de inventario:", error);
    return [];
  }
}

export async function searchSupplies(query: string, limit: number = 10) {
  try {
    const results = await prisma.supply.findMany({
      where: {
        active: true,
        name: {
          contains: query,
          mode: "insensitive",
        },
      },
      orderBy: {
        name: "asc",
      },
      take: limit,
      select: {
        id: true,
        name: true,
        unitOfMeasure: true,
        type: true,
        affectationIgv: true,
        lastCost: true,
        currentStock: true,
      },
    });

    return results.map((s) => ({
      id: s.id,
      name: s.name,
      unitOfMeasure: s.unitOfMeasure,
      type: s.type,
      affectationIgv: s.affectationIgv,
      lastCost: Number(s.lastCost),
      currentStock: Number(s.currentStock),
    }));
  } catch (error) {
    console.error("Error en searchSupplies:", error);
    return [];
  }
}
