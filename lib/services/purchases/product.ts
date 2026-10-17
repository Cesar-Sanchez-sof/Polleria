"use server";

import { prisma } from "@/lib/prisma";
import { ProductType, InventoryMovementType, AffectationIgv } from "@prisma/client";
import { requirePermission } from "@/lib/auth/permissions";

export interface ProductInput {
  name: string;
  type?: ProductType;
  affectationIgv?: AffectationIgv | null;
  unitOfMeasure: string;
  minimumStock?: number;
  /** Si se vende en la carta (aparece al mozo y a cocina). Requiere `price`. */
  sellable?: boolean;
  price?: number | null;
  description?: string | null;
}

export async function getProducts() {
  await requirePermission(["inventario.ver", "compras.ver", "transformacion.ver", "platos.ver"]);
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: "asc" },
    });
    return products.map((s) => ({
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

export async function createProduct(data: ProductInput) {
  await requirePermission("inventario.crear");
  if (!data.name || data.name.trim() === "") {
    throw new Error("El nombre del insumo es obligatorio");
  }
  if (!data.unitOfMeasure || data.unitOfMeasure.trim() === "") {
    throw new Error("La unidad de medida es obligatoria");
  }

  if (data.sellable && !(Number(data.price) > 0)) {
    throw new Error("Un producto que se vende necesita un precio de venta mayor a 0");
  }

  const res = await prisma.product.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      sellable: Boolean(data.sellable),
      price: data.sellable ? Number(data.price) : null,
      type: data.type || ProductType.RawMaterial,
      affectationIgv: data.affectationIgv !== undefined ? data.affectationIgv : null,
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

export async function updateProductMinimum(productId: number, minimumStock: number) {
  await requirePermission("inventario.editar");
  if (minimumStock < 0) {
    throw new Error("El stock mínimo no puede ser negativo");
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new Error("Insumo no encontrado");
  }

  const updated = await prisma.product.update({
    where: { id: productId },
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

export async function updateProductUnit(productId: number, unitOfMeasure: string) {
  await requirePermission("inventario.editar");
  if (!unitOfMeasure || unitOfMeasure.trim() === "") {
    throw new Error("La unidad de medida es obligatoria");
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new Error("Insumo no encontrado");
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      unitOfMeasure: unitOfMeasure.trim(),
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
  productId: number,
  actualQuantity: number,
  reason: string,
  movementType: InventoryMovementType = InventoryMovementType.Adjustment
) {
  await requirePermission("inventario.editar");
  if (actualQuantity < 0) {
    throw new Error("La cantidad real no puede ser negativa");
  }
  if (!reason || reason.trim() === "") {
    throw new Error("El motivo del ajuste o merma es obligatorio");
  }

  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new Error("Insumo no encontrado");
    }

    const currentStock = Number(product.currentStock);
    const difference = actualQuantity - currentStock;

    const movement = await tx.inventoryMovement.create({
      data: {
        productId,
        movementType,
        quantity: difference,
        reason: reason.trim(),
      },
    });

    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: { currentStock: actualQuantity },
    });

    return {
      movement: {
        ...movement,
        quantity: Number(movement.quantity),
        unitCost: movement.unitCost ? Number(movement.unitCost) : null,
      },
      product: {
        ...updatedProduct,
        currentStock: Number(updatedProduct.currentStock),
        minimumStock: Number(updatedProduct.minimumStock),
        lastCost: Number(updatedProduct.lastCost),
        averageCost: Number(updatedProduct.averageCost),
      },
    };
  });
}

export async function setProductStatus(productId: number, active: boolean) {
  await requirePermission("inventario.editar");
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new Error("Insumo no encontrado");
  }

  const updated = await prisma.product.update({
    where: { id: productId },
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

export async function getInventoryMovements(productId?: number) {
  await requirePermission("inventario.ver");
  try {
    const movements = await prisma.inventoryMovement.findMany({
      where: productId ? { productId } : undefined,
      include: {
        product: true,
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
      product: {
        ...m.product,
        currentStock: Number(m.product.currentStock),
        minimumStock: Number(m.product.minimumStock),
        lastCost: Number(m.product.lastCost),
        averageCost: Number(m.product.averageCost),
      },
    }));
  } catch (error) {
    console.error("Error al obtener movimientos de inventario:", error);
    return [];
  }
}

export async function searchProducts(query: string, limit: number = 10) {
  await requirePermission(["compras.ver", "inventario.ver", "transformacion.ver", "platos.ver"]);
  try {
    const results = await prisma.product.findMany({
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
    console.error("Error en searchProducts:", error);
    return [];
  }
}
