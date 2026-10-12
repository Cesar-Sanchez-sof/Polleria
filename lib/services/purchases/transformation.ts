"use server";

import { prisma } from "@/lib/prisma";
import { InventoryMovementType, SupplyType } from "@prisma/client";
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

export interface TransformationRecipeInput {
  producedSupplyId: number;
  consumedSupplyId: number;
  producedQuantity: number;
  requiredQuantity: number;
}

// -------------------------------------------------------------
// CRUD de Recetas de Transformación
// -------------------------------------------------------------

export async function getTransformationRecipes() {
  try {
    const recipes = await prisma.transformationRecipe.findMany({
      include: {
        producedSupply: true,
        consumedSupply: true,
      },
      orderBy: { id: "asc" },
    });

    return recipes.map((r) => ({
      ...r,
      producedQuantity: Number(r.producedQuantity),
      requiredQuantity: Number(r.requiredQuantity),
      producedSupply: {
        ...r.producedSupply,
        currentStock: Number(r.producedSupply.currentStock),
        averageCost: Number(r.producedSupply.averageCost),
        lastCost: Number(r.producedSupply.lastCost),
      },
      consumedSupply: {
        ...r.consumedSupply,
        currentStock: Number(r.consumedSupply.currentStock),
        averageCost: Number(r.consumedSupply.averageCost),
        lastCost: Number(r.consumedSupply.lastCost),
      },
    }));
  } catch (error) {
    console.error("Error al obtener recetas de transformación:", error);
    return [];
  }
}

export async function createTransformationRecipe(data: TransformationRecipeInput) {
  if (!data.producedSupplyId) throw new Error("Debe seleccionar un producto producido");
  if (!data.consumedSupplyId) throw new Error("Debe seleccionar un insumo consumido");
  if (data.producedSupplyId === data.consumedSupplyId) {
    throw new Error("El insumo producido no puede ser el mismo que el consumido");
  }
  if (!data.producedQuantity || data.producedQuantity <= 0) {
    throw new Error("La cantidad producida debe ser mayor a 0");
  }
  if (!data.requiredQuantity || data.requiredQuantity <= 0) {
    throw new Error("La cantidad requerida debe ser mayor a 0");
  }

  const [producedSupply, consumedSupply] = await Promise.all([
    prisma.supply.findUnique({ where: { id: data.producedSupplyId } }),
    prisma.supply.findUnique({ where: { id: data.consumedSupplyId } }),
  ]);

  if (!producedSupply) throw new Error("Producto terminado no encontrado");
  if (!consumedSupply) throw new Error("Insumo consumido no encontrado");

  const existing = await prisma.transformationRecipe.findUnique({
    where: {
      producedSupplyId_consumedSupplyId: {
        producedSupplyId: data.producedSupplyId,
        consumedSupplyId: data.consumedSupplyId,
      },
    },
  });

  if (existing) {
    throw new Error("Ya existe una receta para esta combinación de insumos");
  }

  return await prisma.transformationRecipe.create({
    data: {
      producedSupplyId: data.producedSupplyId,
      consumedSupplyId: data.consumedSupplyId,
      producedQuantity: data.producedQuantity,
      requiredQuantity: data.requiredQuantity,
      active: true,
    },
    include: {
      producedSupply: true,
      consumedSupply: true,
    },
  });
}

export async function updateTransformationRecipe(
  id: number,
  data: Partial<TransformationRecipeInput>
) {
  const existing = await prisma.transformationRecipe.findUnique({ where: { id } });
  if (!existing) throw new Error("Receta de transformación no encontrada");

  if (data.producedQuantity !== undefined && data.producedQuantity <= 0) {
    throw new Error("La cantidad producida debe ser mayor a 0");
  }
  if (data.requiredQuantity !== undefined && data.requiredQuantity <= 0) {
    throw new Error("La cantidad requerida debe ser mayor a 0");
  }

  return await prisma.transformationRecipe.update({
    where: { id },
    data: {
      producedQuantity: data.producedQuantity,
      requiredQuantity: data.requiredQuantity,
    },
    include: {
      producedSupply: true,
      consumedSupply: true,
    },
  });
}

export async function toggleTransformationRecipe(id: number, active: boolean) {
  return await prisma.transformationRecipe.update({
    where: { id },
    data: { active },
    include: {
      producedSupply: true,
      consumedSupply: true,
    },
  });
}

// -------------------------------------------------------------
// Ejecutar Receta N veces
// -------------------------------------------------------------

export async function executeTransformation(
  recipeId: number,
  times: number,
  notes?: string,
  employeeId?: number
) {
  if (!recipeId) throw new Error("Debe seleccionar una receta");
  if (!times || times <= 0) {
    throw new Error("La cantidad de veces debe ser mayor a 0");
  }

  const recipe = await prisma.transformationRecipe.findUnique({
    where: { id: recipeId },
    include: {
      producedSupply: true,
      consumedSupply: true,
    },
  });

  if (!recipe || !recipe.active) {
    throw new Error("Receta no encontrada o inactiva");
  }

  const totalConsumedQty = Number(recipe.requiredQuantity) * times;
  const totalProducedQty = Number(recipe.producedQuantity) * times;

  return await prisma.$transaction(async (tx) => {
    const consumedSupply = await tx.supply.findUnique({
      where: { id: recipe.consumedSupplyId },
    });
    if (!consumedSupply) throw new Error("Insumo consumido no encontrado");

    const currentStockConsumed = Number(consumedSupply.currentStock);
    if (currentStockConsumed < totalConsumedQty) {
      throw new Error(
        `Stock insuficiente. Disponibles: ${currentStockConsumed}, necesarios: ${totalConsumedQty}`
      );
    }

    const producedSupply = await tx.supply.findUnique({
      where: { id: recipe.producedSupplyId },
    });
    if (!producedSupply) throw new Error("Insumo producido no encontrado");

    const validEmployeeId = await getOrCreateActiveEmployee(tx, employeeId);

    const transformation = await tx.transformation.create({
      data: {
        employeeId: validEmployeeId,
        date: new Date(),
        notes: notes?.trim() || null,
      },
    });

    const unitCostConsumed =
      Number(consumedSupply.averageCost) > 0
        ? Number(consumedSupply.averageCost)
        : Number(consumedSupply.lastCost) > 0
        ? Number(consumedSupply.lastCost)
        : 0;

    const totalValueConsumed = totalConsumedQty * unitCostConsumed;
    const unitCostProduced = totalProducedQty > 0 ? totalValueConsumed / totalProducedQty : 0;

    // 1. TransformationItem Consumo
    const itemConsumo = await tx.transformationItem.create({
      data: {
        transformationId: transformation.id,
        supplyId: recipe.consumedSupplyId,
        itemType: "Consumo",
        quantity: totalConsumedQty,
        unitCost: unitCostConsumed,
      },
    });

    // 2. TransformationItem Producido
    const itemProducido = await tx.transformationItem.create({
      data: {
        transformationId: transformation.id,
        supplyId: recipe.producedSupplyId,
        itemType: "Producido",
        quantity: totalProducedQty,
        unitCost: unitCostProduced,
      },
    });

    // 3. InventoryMovement Out
    await tx.inventoryMovement.create({
      data: {
        supplyId: recipe.consumedSupplyId,
        transformationItemId: itemConsumo.id,
        movementType: InventoryMovementType.TransformationOut,
        quantity: totalConsumedQty,
        unitCost: unitCostConsumed,
        reason: `Consumo Receta #${recipe.id} (Lote TR-${transformation.id})`,
      },
    });

    // 4. InventoryMovement In
    await tx.inventoryMovement.create({
      data: {
        supplyId: recipe.producedSupplyId,
        transformationItemId: itemProducido.id,
        movementType: InventoryMovementType.TransformationIn,
        quantity: totalProducedQty,
        unitCost: unitCostProduced,
        reason: `Producción Receta #${recipe.id} (Lote TR-${transformation.id})`,
      },
    });

    // 5. Update Stock Consumed
    const newStockConsumed = currentStockConsumed - totalConsumedQty;
    await tx.supply.update({
      where: { id: recipe.consumedSupplyId },
      data: { currentStock: newStockConsumed },
    });

    // 6. Update Stock & Average Cost Produced (Promedio ponderado móvil)
    const currentStockProduced = Number(producedSupply.currentStock);
    const currentAvgCostProduced = Number(producedSupply.averageCost);
    const newStockProduced = currentStockProduced + totalProducedQty;

    let newAvgCostProduced = 0;
    if (newStockProduced > 0) {
      newAvgCostProduced =
        (currentStockProduced * currentAvgCostProduced + totalProducedQty * unitCostProduced) /
        newStockProduced;
    }

    await tx.supply.update({
      where: { id: recipe.producedSupplyId },
      data: {
        currentStock: newStockProduced,
        lastCost: Math.round(unitCostProduced * 100) / 100,
        averageCost: Math.round(newAvgCostProduced * 100) / 100,
      },
    });

    return transformation;
  });
}

// -------------------------------------------------------------
// Registro Manual de Transformación (Retrocompatibilidad)
// -------------------------------------------------------------

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

      const currentStock = Number(supply.currentStock);
      if (currentStock < c.quantity) {
        throw new Error(
          `Stock insuficiente para el insumo ${supply.name}. Disponibles: ${currentStock}, requeridos: ${c.quantity}`
        );
      }

      const item = await tx.transformationItem.create({
        data: {
          transformationId: transformation.id,
          supplyId: c.supplyId,
          itemType: "Consumo",
          quantity: c.quantity,
          unitCost: c.unitCost || null,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          supplyId: c.supplyId,
          transformationItemId: item.id,
          movementType: InventoryMovementType.TransformationOut,
          quantity: c.quantity,
          unitCost: c.unitCost || null,
          reason: `Consumo Transformación #${transformation.id}`,
        },
      });

      const newStock = currentStock - c.quantity;
      await tx.supply.update({
        where: { id: c.supplyId },
        data: { currentStock: newStock },
      });
    }

    // 2. Process Producidos (Entrada)
    for (const p of data.producidos) {
      const supply = await tx.supply.findUnique({ where: { id: p.supplyId } });
      if (!supply) throw new Error(`Insumo ID ${p.supplyId} no encontrado`);

      const item = await tx.transformationItem.create({
        data: {
          transformationId: transformation.id,
          supplyId: p.supplyId,
          itemType: "Producido",
          quantity: p.quantity,
          unitCost: p.unitCost || null,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          supplyId: p.supplyId,
          transformationItemId: item.id,
          movementType: InventoryMovementType.TransformationIn,
          quantity: p.quantity,
          unitCost: p.unitCost || null,
          reason: `Producción Transformación #${transformation.id}`,
        },
      });

      const currentStock = Number(supply.currentStock);
      const newStock = currentStock + p.quantity;
      await tx.supply.update({
        where: { id: p.supplyId },
        data: { currentStock: newStock },
      });
    }

    return transformation;
  });
}

// -------------------------------------------------------------
// Historial de Transformaciones
// -------------------------------------------------------------

export async function getTransformations() {
  try {
    const list = await prisma.transformation.findMany({
      include: {
        employee: true,
        annulledBy: true,
        items: {
          include: {
            supply: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    return list.map((t) => ({
      ...t,
      items: t.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        unitCost: i.unitCost ? Number(i.unitCost) : 0,
        supply: {
          ...i.supply,
          currentStock: Number(i.supply.currentStock),
          averageCost: Number(i.supply.averageCost),
          lastCost: Number(i.supply.lastCost),
        },
      })),
    }));
  } catch (error) {
    console.error("Error al obtener transformaciones:", error);
    return [];
  }
}

// -------------------------------------------------------------
// Anulación de Transformación
// -------------------------------------------------------------

export async function annulTransformation(
  id: number,
  motivo: string,
  employeeId?: number
) {
  if (!id) {
    throw new Error("ID de transformación inválido");
  }

  const cleanMotivo = motivo ? motivo.trim() : "";
  if (!cleanMotivo) {
    throw new Error("El motivo de anulación es obligatorio");
  }

  return await prisma.$transaction(async (tx) => {
    const transformation = await tx.transformation.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            supply: true,
          },
        },
      },
    });

    if (!transformation) {
      throw new Error(`Transformación con ID ${id} no encontrada`);
    }

    if (transformation.anulado) {
      throw new Error("Esta transformación ya está anulada");
    }

    const validEmployeeId = await getOrCreateActiveEmployee(tx, employeeId);

    // 1. Validar y procesar reversión de stock
    // Para insumos consumidos (itemType === "Consumo"): devolvemos el stock (TransformationIn, quantity positiva, currentStock += quantity)
    // Para insumos producidos (itemType === "Producido"): descontamos el stock (TransformationOut, quantity positiva, currentStock -= quantity)
    // Validamos primero que haya suficiente stock de todos los insumos producidos antes de modificar nada
    for (const item of transformation.items) {
      if (item.itemType === "Producido") {
        const supply = await tx.supply.findUnique({
          where: { id: item.supplyId },
        });
        if (!supply) {
          throw new Error(`Insumo ID ${item.supplyId} no encontrado`);
        }

        const currentStock = Number(supply.currentStock);
        const itemQty = Number(item.quantity);

        if (currentStock < itemQty) {
          throw new Error(
            `Stock insuficiente para revertir el producto terminado. Stock actual: ${currentStock}, necesario: ${itemQty}`
          );
        }
      }
    }

    // 2. Realizar los movimientos inversos y actualización de stock
    for (const item of transformation.items) {
      const itemQty = Number(item.quantity);
      const unitCost = item.unitCost ? Number(item.unitCost) : null;

      if (item.itemType === "Consumo") {
        // Se devuelve la materia prima al almacén
        await tx.inventoryMovement.create({
          data: {
            supplyId: item.supplyId,
            transformationItemId: item.id,
            movementType: InventoryMovementType.TransformationIn,
            quantity: itemQty,
            unitCost: unitCost,
            reason: `Reversión anulación Transformación #${transformation.id}: ${cleanMotivo}`,
          },
        });

        await tx.supply.update({
          where: { id: item.supplyId },
          data: {
            currentStock: {
              increment: itemQty,
            },
          },
        });
      } else if (item.itemType === "Producido") {
        // Se descuenta el producto terminado generado previamente
        await tx.inventoryMovement.create({
          data: {
            supplyId: item.supplyId,
            transformationItemId: item.id,
            movementType: InventoryMovementType.TransformationOut,
            quantity: itemQty,
            unitCost: unitCost,
            reason: `Reversión anulación Transformación #${transformation.id}: ${cleanMotivo}`,
          },
        });

        await tx.supply.update({
          where: { id: item.supplyId },
          data: {
            currentStock: {
              decrement: itemQty,
            },
          },
        });
      }
    }

    // 3. Marcar la transformación como anulada
    const updated = await tx.transformation.update({
      where: { id },
      data: {
        anulado: true,
        anuladoAt: new Date(),
        anuladoPor: validEmployeeId,
        motivoAnulacion: cleanMotivo,
      },
      include: {
        employee: true,
        annulledBy: true,
        items: {
          include: {
            supply: true,
          },
        },
      },
    });

    return updated;
  });
}

