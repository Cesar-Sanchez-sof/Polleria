"use server";

import { prisma } from "@/lib/prisma";
import { InventoryMovementType } from "@prisma/client";
import { getOrCreateActiveEmployee } from "./employee-helper";
import { requirePermission } from "@/lib/auth/permissions";
import {
  inventoryAccountCode,
  postTransformationJournalEntries,
  reverseTransformationJournalEntries,
} from "@/lib/services/accounting-posting.service";

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

export interface RecipeIngredientInput {
  ingredientId: number;
  /** Cantidad del ingrediente por 1 unidad producida. */
  quantityRequired: number;
}

export interface TransformationRecipeInput {
  /** Producto que se obtiene al ejecutar la receta. */
  productId: number;
  ingredients: RecipeIngredientInput[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function unitCostOf(product: { averageCost?: unknown; lastCost?: unknown }): number {
  const average = Number(product.averageCost) || 0;
  if (average > 0) return average;
  return Number(product.lastCost) || 0;
}

/** Ids (entre `ids`) de los productos que tienen receta, es decir, los que salen de una transformación. */
async function productIdsWithRecipe(
  tx: Pick<typeof prisma, "productRecipe">,
  ids: number[],
): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const rows = await tx.productRecipe.findMany({
    where: { productId: { in: ids } },
    select: { productId: true },
  });
  return new Set(rows.map((r) => r.productId));
}

// -------------------------------------------------------------
// CRUD de Recetas (un producto con varios ingredientes)
// -------------------------------------------------------------

export async function getTransformationRecipes() {
  await requirePermission("transformacion.ver");
  try {
    const rows = await prisma.productRecipe.findMany({
      include: { product: true, ingredient: true },
      orderBy: [{ productId: "asc" }, { id: "asc" }],
    });

    const grouped = new Map<number, typeof rows>();
    for (const row of rows) {
      const list = grouped.get(row.productId);
      if (list) list.push(row);
      else grouped.set(row.productId, [row]);
    }

    return await Promise.all(
      [...grouped.entries()].map(async ([productId, items]) => {
        // Una receta ya usada no se borra: el historial de lotes la referencia.
        const timesUsed = await prisma.transformationItem.count({
          where: { productId, itemType: "Producido", transformation: { annulled: false } },
        });
        const product = items[0].product;
        return {
          id: productId,
          productId,
          active: items.every((i) => i.active),
          timesUsed,
          product: {
            id: product.id,
            name: product.name,
            type: product.type,
            unitOfMeasure: product.unitOfMeasure,
            currentStock: Number(product.currentStock),
            averageCost: Number(product.averageCost),
            lastCost: Number(product.lastCost),
          },
          ingredients: items.map((i) => ({
            id: i.id,
            ingredientId: i.ingredientId,
            quantityRequired: Number(i.quantityRequired),
            ingredient: {
              id: i.ingredient.id,
              name: i.ingredient.name,
              type: i.ingredient.type,
              unitOfMeasure: i.ingredient.unitOfMeasure,
              currentStock: Number(i.ingredient.currentStock),
              averageCost: Number(i.ingredient.averageCost),
              lastCost: Number(i.ingredient.lastCost),
            },
          })),
        };
      }),
    );
  } catch (error) {
    console.error("Error al obtener recetas de transformación:", error);
    return [];
  }
}

function validateIngredients(productId: number, ingredients: RecipeIngredientInput[] | undefined) {
  if (!ingredients || ingredients.length === 0) {
    throw new Error("Debe agregar al menos un ingrediente a la receta");
  }
  const seen = new Set<number>();
  for (const item of ingredients) {
    if (!item.ingredientId) throw new Error("Debe seleccionar el ingrediente de cada línea");
    if (item.ingredientId === productId) {
      throw new Error("El producto no puede ser ingrediente de sí mismo");
    }
    if (seen.has(item.ingredientId)) {
      throw new Error("Hay ingredientes repetidos en la receta");
    }
    if (!item.quantityRequired || item.quantityRequired <= 0) {
      throw new Error("La cantidad de cada ingrediente debe ser mayor a 0");
    }
    seen.add(item.ingredientId);
  }
}

async function saveRecipe(productId: number, ingredients: RecipeIngredientInput[], active = true) {
  const ingredientIds = ingredients.map((i) => i.ingredientId);
  const loops = await prisma.productRecipe.findFirst({
    where: { productId: { in: ingredientIds }, ingredientId: productId },
    select: { id: true },
  });
  if (loops) {
    throw new Error("Receta circular: uno de los ingredientes ya se elabora con este producto");
  }

  return await prisma.$transaction(async (tx) => {
    const found = await tx.product.findMany({ where: { id: { in: ingredientIds } }, select: { id: true } });
    if (found.length !== ingredientIds.length) throw new Error("Ingrediente no encontrado");

    await tx.productRecipe.deleteMany({ where: { productId } });
    await tx.productRecipe.createMany({
      data: ingredients.map((i) => ({
        productId,
        ingredientId: i.ingredientId,
        quantityRequired: i.quantityRequired,
        active,
      })),
    });
    return await tx.productRecipe.findMany({
      where: { productId },
      include: { product: true, ingredient: true },
      orderBy: { id: "asc" },
    });
  });
}

export async function createTransformationRecipe(data: TransformationRecipeInput) {
  await requirePermission("transformacion.crear");
  if (!data.productId) throw new Error("Debe seleccionar el producto que se obtiene");
  validateIngredients(data.productId, data.ingredients);

  const product = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!product) throw new Error("Producto no encontrado");

  const existing = await prisma.productRecipe.count({ where: { productId: data.productId } });
  if (existing > 0) {
    throw new Error("Este producto ya tiene una receta. Edítala en lugar de crear otra");
  }

  return await saveRecipe(data.productId, data.ingredients);
}

export async function updateTransformationRecipe(productId: number, data: { ingredients: RecipeIngredientInput[] }) {
  await requirePermission("transformacion.crear");
  validateIngredients(productId, data.ingredients);

  const existing = await prisma.productRecipe.findMany({ where: { productId }, select: { active: true } });
  if (existing.length === 0) throw new Error("Receta de transformación no encontrada");

  // Editar los ingredientes no reactiva una receta que estaba desactivada.
  return await saveRecipe(productId, data.ingredients, existing.some((r) => r.active));
}

export async function toggleTransformationRecipe(productId: number, active: boolean) {
  await requirePermission("transformacion.crear");
  const updated = await prisma.productRecipe.updateMany({ where: { productId }, data: { active } });
  if (updated.count === 0) throw new Error("Receta de transformación no encontrada");
  return { productId, active };
}

export async function deleteTransformationRecipe(productId: number) {
  await requirePermission("transformacion.eliminar");
  const rows = await prisma.productRecipe.count({ where: { productId } });
  if (rows === 0) throw new Error("La receta no existe");

  const usageCount = await prisma.transformationItem.count({
    where: { productId, itemType: "Producido" },
  });
  if (usageCount > 0) {
    throw new Error(
      "No se puede eliminar la receta porque ya tiene registros de ejecución histórica. Puedes desactivarla en su lugar."
    );
  }

  return await prisma.productRecipe.deleteMany({ where: { productId } });
}

// -------------------------------------------------------------
// Ejecutar la receta de un producto para N unidades
// -------------------------------------------------------------

export async function executeTransformation(
  productId: number,
  quantity: number,
  notes?: string,
  employeeId?: number
) {
  await requirePermission("transformacion.crear");
  if (!productId) throw new Error("Debe seleccionar una receta");
  if (!quantity || quantity <= 0) {
    throw new Error("La cantidad a producir debe ser mayor a 0");
  }

  const recipe = await prisma.productRecipe.findMany({
    where: { productId },
    orderBy: { id: "asc" },
  });
  if (recipe.length === 0 || recipe.some((r) => !r.active)) {
    throw new Error("Receta no encontrada o inactiva");
  }

  return await prisma.$transaction(
    async (tx) => {
      const producedProduct = await tx.product.findUnique({ where: { id: productId } });
      if (!producedProduct) throw new Error("Producto a producir no encontrado");

      // 1. Se valida el stock de todos los ingredientes antes de mover nada
      const lines: Array<{
        ingredient: NonNullable<Awaited<ReturnType<typeof tx.product.findUnique>>>;
        stock: number;
        quantity: number;
        unitCost: number;
      }> = [];
      const shortages: string[] = [];
      for (const row of recipe) {
        const ingredient = await tx.product.findUnique({ where: { id: row.ingredientId } });
        if (!ingredient) throw new Error("Ingrediente no encontrado");

        const needed = round2(Number(row.quantityRequired) * quantity);
        const stock = Number(ingredient.currentStock);
        if (stock < needed) {
          shortages.push(`${ingredient.name}: disponibles ${stock}, necesarios ${needed}`);
        }
        lines.push({ ingredient, stock, quantity: needed, unitCost: unitCostOf(ingredient) });
      }
      if (shortages.length > 0) {
        throw new Error(`Stock insuficiente. ${shortages.join("; ")}`);
      }

      const validEmployeeId = await getOrCreateActiveEmployee(tx, employeeId);
      const transformation = await tx.transformation.create({
        data: {
          employeeId: validEmployeeId,
          date: new Date(),
          notes: notes?.trim() || null,
        },
      });

      const totalValueConsumed = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
      const unitCostProduced = totalValueConsumed / quantity;

      // 2. Consumo de cada ingrediente
      for (const line of lines) {
        const item = await tx.transformationItem.create({
          data: {
            transformationId: transformation.id,
            productId: line.ingredient.id,
            itemType: "Consumo",
            quantity: line.quantity,
            unitCost: line.unitCost,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            productId: line.ingredient.id,
            transformationItemId: item.id,
            movementType: InventoryMovementType.TransformationOut,
            quantity: line.quantity,
            unitCost: line.unitCost,
            reason: `Consumo para ${producedProduct.name} (Lote TR-${transformation.id})`,
          },
        });
        await tx.product.update({
          where: { id: line.ingredient.id },
          data: { currentStock: line.stock - line.quantity },
        });
      }

      // 3. Producto terminado
      const producedItem = await tx.transformationItem.create({
        data: {
          transformationId: transformation.id,
          productId,
          itemType: "Producido",
          quantity,
          unitCost: unitCostProduced,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          productId,
          transformationItemId: producedItem.id,
          movementType: InventoryMovementType.TransformationIn,
          quantity,
          unitCost: unitCostProduced,
          reason: `Producción de ${producedProduct.name} (Lote TR-${transformation.id})`,
        },
      });

      // Promedio ponderado móvil del producto terminado
      const currentStockProduced = Number(producedProduct.currentStock);
      const currentAvgCostProduced = Number(producedProduct.averageCost);
      const newStockProduced = currentStockProduced + quantity;
      const newAvgCostProduced =
        newStockProduced > 0
          ? (currentStockProduced * currentAvgCostProduced + quantity * unitCostProduced) / newStockProduced
          : 0;

      await tx.product.update({
        where: { id: productId },
        data: {
          currentStock: newStockProduced,
          lastCost: Math.round(unitCostProduced * 100) / 100,
          averageCost: Math.round(newAvgCostProduced * 100) / 100,
        },
      });

      // 4. Asiento en el diario: insumos (241/201) -> productos terminados (211)
      const withRecipe = await productIdsWithRecipe(tx, lines.map((l) => l.ingredient.id));
      await postTransformationJournalEntries(tx, {
        transformationId: transformation.id,
        label: `TR-${transformation.id}`,
        consumed: lines.map((l) => ({
          accountCode: inventoryAccountCode({ type: l.ingredient.type, hasRecipe: withRecipe.has(l.ingredient.id) }),
          amount: l.quantity * l.unitCost,
        })),
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
    const consumedValues: Array<{ productId: number; type: "RawMaterial" | "FinishedProduct"; amount: number }> = [];

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

      consumedValues.push({
        productId: c.productId,
        type: product.type ?? "RawMaterial",
        amount: c.quantity * (c.unitCost ?? unitCostOf(product)),
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

    const withRecipe = await productIdsWithRecipe(tx, consumedValues.map((c) => c.productId));
    await postTransformationJournalEntries(tx, {
      transformationId: transformation.id,
      label: `TR-${transformation.id}`,
      consumed: consumedValues.map((c) => ({
        accountCode: inventoryAccountCode({ type: c.type, hasRecipe: withRecipe.has(c.productId) }),
        amount: c.amount,
      })),
    });

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

      // 3. Asiento inverso en el diario (los lotes anteriores al asiento no tienen ninguno)
      await reverseTransformationJournalEntries(tx, {
        transformationId: transformation.id,
        label: `TR-${transformation.id}`,
        reason: cleanReason,
      });

      // 4. Marcar la transformación como anulada
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

