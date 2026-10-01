"use server";

import { prisma } from "@/lib/prisma";
import { InventoryMovementType } from "@prisma/client";
import { getOrCreateActiveEmployee } from "./employee-helper";

export interface TransformationLineInput {
  supplyId: number;
  quantity: number;
  unitCost?: number;
}

export interface TransformationInput {
  employeeId?: number;
  notes?: string;
  consumos: TransformationLineInput[];
  producidos: TransformationLineInput[];
}

export async function registerTransformation(data: TransformationInput) {
  if (!data.consumos || data.consumos.length === 0) {
    throw new Error("Debe agregar al menos un insumo consumido (Materia Prima)");
  }
  if (!data.producidos || data.producidos.length === 0) {
    throw new Error("Debe agregar al menos un insumo producido (Producto Terminado)");
  }

  for (const c of data.consumos) {
    if (c.quantity <= 0) throw new Error("La cantidad consumida debe ser mayor a 0");
  }
  for (const p of data.producidos) {
    if (p.quantity <= 0) throw new Error("La cantidad producida debe ser mayor a 0");
  }

  return await prisma.$transaction(async (tx) => {
    const validEmployeeId = await getOrCreateActiveEmployee(tx, data.employeeId);

    const transformation = await tx.transformation.create({
      data: {
        employeeId: validEmployeeId,
        date: new Date(),
        notes: data.notes?.trim() || null,
      },
    });

    // 1. Process Consumos (Salida)
    for (const c of data.consumos) {
      const supply = await tx.supply.findUnique({ where: { id: c.supplyId } });
      if (!supply) throw new Error(`Insumo ID ${c.supplyId} no encontrado`);

      await tx.transformationItem.create({
        data: {
          transformationId: transformation.id,
          supplyId: c.supplyId,
          itemType: "Consumo",
          quantity: c.quantity,
          unitCost: c.unitCost || null,
        },
      });

      // Stock invariant: create inventoryMovement and update stock
      await tx.inventoryMovement.create({
        data: {
          supplyId: c.supplyId,
          movementType: InventoryMovementType.TransformationOut,
          quantity: c.quantity,
          unitCost: c.unitCost || null,
          reason: `Consumo Transformación #${transformation.id}`,
        },
      });

      const newStock = Math.max(0, Number(supply.currentStock) - c.quantity);
      await tx.supply.update({
        where: { id: c.supplyId },
        data: { currentStock: newStock },
      });
    }

    // 2. Process Producidos (Entrada)
    for (const p of data.producidos) {
      const supply = await tx.supply.findUnique({ where: { id: p.supplyId } });
      if (!supply) throw new Error(`Insumo ID ${p.supplyId} no encontrado`);

      await tx.transformationItem.create({
        data: {
          transformationId: transformation.id,
          supplyId: p.supplyId,
          itemType: "Producido",
          quantity: p.quantity,
          unitCost: p.unitCost || null,
        },
      });

      // Stock invariant: create inventoryMovement and update stock
      await tx.inventoryMovement.create({
        data: {
          supplyId: p.supplyId,
          movementType: InventoryMovementType.TransformationIn,
          quantity: p.quantity,
          unitCost: p.unitCost || null,
          reason: `Producción Transformación #${transformation.id}`,
        },
      });

      const newStock = Number(supply.currentStock) + p.quantity;
      await tx.supply.update({
        where: { id: p.supplyId },
        data: { currentStock: newStock },
      });
    }

    return transformation;
  });
}

export async function getTransformations() {
  try {
    return await prisma.transformation.findMany({
      include: {
        employee: true,
        items: {
          include: {
            supply: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });
  } catch (error) {
    console.error("Error al obtener transformaciones:", error);
    return [];
  }
}
