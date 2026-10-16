"use server";

import { prisma } from "@/lib/prisma";
import { InventoryMovementType, ProductType } from "@prisma/client";
import { getOrCreateActiveEmployee } from "./employee-helper";
import { requirePermission } from "@/lib/auth/permissions";

export interface TransformationLineInput {
  productId: number;
  quantity: number;
  unitCost?: number;
}

export interface TransformationInput {
  employeeId?: number;
  notes?: string;
  consumptions: TransformationLineInput[];
  produced: TransformationLineInput[];
}

export interface TransformationRecipeInput {
  producedProductId: number;
  consumedProductId: number;
  producedQuantity: number;
  requiredQuantity: number;
}

// -------------------------------------------------------------
// CRUD de Recetas de Transformación
// -------------------------------------------------------------

export async function getTransformationRecipes() {
  await requirePermission("transformacion.ver");
  try {
    const recipes = await prisma.transformationRecipe.findMany({
      include: {
        producedProduct: true,
        consumedProduct: true,
      },
      orderBy: { id: "asc" },
    });

    // Validar si cada receta ha sido ejecutada basándonos en los movimientos de inventario generados
    const recipesWithUsage = await Promise.all(
      recipes.map(async (r) => {
        const usageCount = await prisma.inventoryMovement.count({
          where: {
            OR: [
              { reason: { startsWith: `Consumo Receta #${r.id}` } },
              { reason: { startsWith: `Producción Receta #${r.id}` } },
            ],
          },
        });

        return {
          ...r,
          producedQuantity: Number(r.producedQuantity),
          requiredQuantity: Number(r.requiredQuantity),
          timesUsed: usageCount,
          producedProduct: {
            ...r.producedProduct,
            currentStock: Number(r.producedProduct.currentStock),
            averageCost: Number(r.producedProduct.averageCost),
            lastCost: Number(r.producedProduct.lastCost),
          },
          consumedProduct: {
            ...r.consumedProduct,
            currentStock: Number(r.consumedProduct.currentStock),
            averageCost: Number(r.consumedProduct.averageCost),
            lastCost: Number(r.consumedProduct.lastCost),
          },
        };
      })
    );

    return recipesWithUsage;
  } catch (error) {
    console.error("Error al obtener recetas de transformación:", error);
    return [];
  }
}

export async function createTransformationRecipe(data: TransformationRecipeInput) {
  await requirePermission("transformacion.crear");
  if (!data.producedProductId) throw new Error("Debe seleccionar un producto producido");
  if (!data.consumedProductId) throw new Error("Debe seleccionar un insumo consumido");
  if (data.producedProductId === data.consumedProductId) {
    throw new Error("El insumo producido no puede ser el mismo que el consumido");
  }
  if (!data.producedQuantity || data.producedQuantity <= 0) {
    throw new Error("La cantidad producida debe ser mayor a 0");
  }
  if (!data.requiredQuantity || data.requiredQuantity <= 0) {
    throw new Error("La cantidad requerida debe ser mayor a 0");
  }

  const [producedProduct, consumedProduct] = await Promise.all([
    prisma.product.findUnique({ where: { id: data.producedProductId } }),
    prisma.product.findUnique({ where: { id: data.consumedProductId } }),
  ]);

  if (!producedProduct) throw new Error("Producto terminado no encontrado");
  if (!consumedProduct) throw new Error("Insumo consumido no encontrado");

  const existing = await prisma.transformationRecipe.findUnique({
    where: {
      producedProductId_consumedProductId: {
        producedProductId: data.producedProductId,
        consumedProductId: data.consumedProductId,
      },
    },
  });

  if (existing) {
    throw new Error("Ya existe una receta para esta combinación de insumos");
  }

  return await prisma.transformationRecipe.create({
    data: {
      producedProductId: data.producedProductId,
      consumedProductId: data.consumedProductId,
      producedQuantity: data.producedQuantity,
      requiredQuantity: data.requiredQuantity,
      active: true,
    },
    include: {
      producedProduct: true,
      consumedProduct: true,
    },
  });
}

export async function updateTransformationRecipe(
  id: number,
  data: Partial<TransformationRecipeInput>
) {
  await requirePermission("transformacion.crear");
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
      producedProduct: true,
      consumedProduct: true,
    },
  });
}

export async function toggleTransformationRecipe(id: number, active: boolean) {
  await requirePermission("transformacion.crear");
  return await prisma.transformationRecipe.update({
    where: { id },
    data: { active },
    include: {
      producedProduct: true,
      consumedProduct: true,
    },
  });
}

export async function deleteTransformationRecipe(id: number) {
  await requirePermission("transformacion.eliminar");
  const recipe = await prisma.transformationRecipe.findUnique({
    where: { id },
  });
  if (!recipe) {
    throw new Error("La receta no existe");
  }

  // Validar si la receta fue ejecutada
  const usageCount = await prisma.inventoryMovement.count({
    where: {
      OR: [
        { reason: { startsWith: `Consumo Receta #${id}` } },
        { reason: { startsWith: `Producción Receta #${id}` } },
      ],
    },
  });

  if (usageCount > 0) {
    throw new Error(
      "No se puede eliminar la receta porque ya tiene registros de ejecución histórica. Puedes desactivarla en su lugar."
    );
  }

  return await prisma.transformationRecipe.delete({
    where: { id },
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
  await requirePermission("transformacion.crear");
  if (!recipeId) throw new Error("Debe seleccionar una receta");
  if (!times || times <= 0) {
    throw new Error("La cantidad de veces debe ser mayor a 0");
  }

  const recipe = await prisma.transformationRecipe.findUnique({
    where: { id: recipeId },
    include: {
      producedProduct: true,
      consumedProduct: true,
    },
  });

  if (!recipe || !recipe.active) {
    throw new Error("Receta no encontrada o inactiva");
  }

  const totalConsumedQty = Number(recipe.requiredQuantity) * times;
  const totalProducedQty = Number(recipe.producedQuantity) * times;

  return await prisma.$transaction(
    async (tx) => {
      const consumedProduct = await tx.product.findUnique({
        where: { id: recipe.consumedProductId },
      });
      if (!consumedProduct) throw new Error("Insumo consumido no encontrado");

      const currentStockConsumed = Number(consumedProduct.currentStock);
      if (currentStockConsumed < totalConsumedQty) {
        throw new Error(
          `Stock insuficiente. Disponibles: ${currentStockConsumed}, necesarios: ${totalConsumedQty}`
        );
      }

      const producedProduct = await tx.product.findUnique({
        where: { id: recipe.producedProductId },
      });
      if (!producedProduct) throw new Error("Insumo producido no encontrado");

      const validEmployeeId = await getOrCreateActiveEmployee(tx, employeeId);

      const transformation = await tx.transformation.create({
        data: {
          employeeId: validEmployeeId,
          date: new Date(),
          notes: notes?.trim() || null,
        },
      });

    const unitCostConsumed =
      Number(consumedProduct.averageCost) > 0
        ? Number(consumedProduct.averageCost)
        : Number(consumedProduct.lastCost) > 0
        ? Number(consumedProduct.lastCost)
        : 0;

    const totalValueConsumed = totalConsumedQty * unitCostConsumed;
    const unitCostProduced = totalProducedQty > 0 ? totalValueConsumed / totalProducedQty : 0;

    // 1. TransformationItem Consumo
    const itemConsumption = await tx.transformationItem.create({
      data: {
        transformationId: transformation.id,
        productId: recipe.consumedProductId,
        itemType: "Consumo",
        quantity: totalConsumedQty,
        unitCost: unitCostConsumed,
      },
    });

    // 2. TransformationItem Producido
    const producedItem = await tx.transformationItem.create({
      data: {
        transformationId: transformation.id,
        productId: recipe.producedProductId,
        itemType: "Producido",
        quantity: totalProducedQty,
        unitCost: unitCostProduced,
      },
    });

    // 3. InventoryMovement Out
    await tx.inventoryMovement.create({
      data: {
        productId: recipe.consumedProductId,
        transformationItemId: itemConsumption.id,
        movementType: InventoryMovementType.TransformationOut,
        quantity: totalConsumedQty,
        unitCost: unitCostConsumed,
        reason: `Consumo Receta #${recipe.id} (Lote TR-${transformation.id})`,
      },
    });

    // 4. InventoryMovement In
    await tx.inventoryMovement.create({
      data: {
        productId: recipe.producedProductId,
        transformationItemId: producedItem.id,
        movementType: InventoryMovementType.TransformationIn,
        quantity: totalProducedQty,
        unitCost: unitCostProduced,
        reason: `Producción Receta #${recipe.id} (Lote TR-${transformation.id})`,
      },
    });

    // 5. Update Stock Consumed
    const newStockConsumed = currentStockConsumed - totalConsumedQty;
    await tx.product.update({
      where: { id: recipe.consumedProductId },
      data: { currentStock: newStockConsumed },
    });

    // 6. Update Stock & Average Cost Produced (Promedio ponderado móvil)
    const currentStockProduced = Number(producedProduct.currentStock);
    const currentAvgCostProduced = Number(producedProduct.averageCost);
    const newStockProduced = currentStockProduced + totalProducedQty;

    let newAvgCostProduced = 0;
    if (newStockProduced > 0) {
      newAvgCostProduced =
        (currentStockProduced * currentAvgCostProduced + totalProducedQty * unitCostProduced) /
        newStockProduced;
    }

    await tx.product.update({
      where: { id: recipe.producedProductId },
      data: {
        currentStock: newStockProduced,
        lastCost: Math.round(unitCostProduced * 100) / 100,
        averageCost: Math.round(newAvgCostProduced * 100) / 100,
      },
    });

    return transformation;
    },
    { maxWait: 10000, timeout: 20000 }
  );
}

// -------------------------------------------------------------
// Registro Manual de Transformación (Retrocompatibilidad)
// -------------------------------------------------------------

export async function registerTransformation(data: TransformationInput) {
  await requirePermission("transformacion.crear");
  if (!data.consumptions || data.consumptions.length === 0) {
    throw new Error("Debe agregar al menos un insumo consumido (Materia Prima)");
  }
  if (!data.produced || data.produced.length === 0) {
    throw new Error("Debe agregar al menos un insumo producido (Producto Terminado)");
  }

  for (const c of data.consumptions) {
    if (c.quantity <= 0) throw new Error("La cantidad consumida debe ser mayor a 0");
  }
  for (const p of data.produced) {
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
    for (const c of data.consumptions) {
      const product = await tx.product.findUnique({ where: { id: c.productId } });
      if (!product) throw new Error(`Insumo ID ${c.productId} no encontrado`);

      const currentStock = Number(product.currentStock);
      if (currentStock < c.quantity) {
        throw new Error(
          `Stock insuficiente para el insumo ${product.name}. Disponibles: ${currentStock}, requeridos: ${c.quantity}`
        );
      }

      const item = await tx.transformationItem.create({
        data: {
          transformationId: transformation.id,
          productId: c.productId,
          itemType: "Consumo",
          quantity: c.quantity,
          unitCost: c.unitCost || null,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: c.productId,
          transformationItemId: item.id,
          movementType: InventoryMovementType.TransformationOut,
          quantity: c.quantity,
          unitCost: c.unitCost || null,
          reason: `Consumo Transformación #${transformation.id}`,
        },
      });

      const newStock = currentStock - c.quantity;
      await tx.product.update({
        where: { id: c.productId },
        data: { currentStock: newStock },
      });
    }

    // 2. Process Producidos (Entrada)
    for (const p of data.produced) {
      const product = await tx.product.findUnique({ where: { id: p.productId } });
      if (!product) throw new Error(`Insumo ID ${p.productId} no encontrado`);

      const item = await tx.transformationItem.create({
        data: {
          transformationId: transformation.id,
          productId: p.productId,
          itemType: "Producido",
          quantity: p.quantity,
          unitCost: p.unitCost || null,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: p.productId,
          transformationItemId: item.id,
          movementType: InventoryMovementType.TransformationIn,
          quantity: p.quantity,
          unitCost: p.unitCost || null,
          reason: `Producción Transformación #${transformation.id}`,
        },
      });

      const currentStock = Number(product.currentStock);
      const newStock = currentStock + p.quantity;
      await tx.product.update({
        where: { id: p.productId },
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
  await requirePermission("transformacion.ver");
  try {
    const list = await prisma.transformation.findMany({
      include: {
        employee: true,
        annulledBy: true,
        items: {
          include: {
            product: true,
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
        product: {
          ...i.product,
          currentStock: Number(i.product.currentStock),
          averageCost: Number(i.product.averageCost),
          lastCost: Number(i.product.lastCost),
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
  reason: string,
  employeeId?: number
) {
  await requirePermission("transformacion.eliminar");
  if (!id) {
    throw new Error("ID de transformación inválido");
  }

  const cleanReason = reason ? reason.trim() : "";
  if (!cleanReason) {
    throw new Error("El motivo de anulación es obligatorio");
  }

  // 1. Validaciones previas fuera de la transacción para no consumir tiempo del timeout
  const transformation = await prisma.transformation.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!transformation) {
    throw new Error(`Transformación con ID ${id} no encontrada`);
  }

  if (transformation.annulled) {
    throw new Error("Esta transformación ya está anulada");
  }

  return await prisma.$transaction(
    async (tx) => {
      const validEmployeeId = await getOrCreateActiveEmployee(tx, employeeId);

      // 1. Validar y procesar reversión de stock
      // Para insumos consumidos (itemType === "Consumo"): devolvemos el stock (TransformationIn, quantity positiva, currentStock += quantity)
      // Para insumos producidos (itemType === "Producido"): descontamos el stock (TransformationOut, quantity positiva, currentStock -= quantity)
      // Validamos primero que haya suficiente stock de todos los insumos producidos antes de modificar nada
      for (const item of transformation.items) {
        if (item.itemType === "Producido") {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) {
            throw new Error(`Insumo ID ${item.productId} no encontrado`);
          }

          const currentStock = Number(product.currentStock);
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
              productId: item.productId,
              transformationItemId: item.id,
              movementType: InventoryMovementType.TransformationIn,
              quantity: itemQty,
              unitCost: unitCost,
              reason: `Reversión anulación Transformación #${transformation.id}: ${cleanReason}`,
            },
          });

          await tx.product.update({
            where: { id: item.productId },
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
              productId: item.productId,
              transformationItemId: item.id,
              movementType: InventoryMovementType.TransformationOut,
              quantity: itemQty,
              unitCost: unitCost,
              reason: `Reversión anulación Transformación #${transformation.id}: ${cleanReason}`,
            },
          });

          await tx.product.update({
            where: { id: item.productId },
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
          annulled: true,
          annulledAt: new Date(),
          annulledById: validEmployeeId,
          annulmentReason: cleanReason,
        },
        include: {
          employee: true,
          annulledBy: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return updated;
    },
    { maxWait: 10000, timeout: 20000 }
  );
}

