"use server";

import { prisma } from "@/lib/prisma";
import {
  InventoryMovementType,
  InformalPurchaseType,
  ExpenseCategory,
} from "@prisma/client";
import { getOrCreateActiveEmployee } from "./employee-helper";
import { requirePermission } from "@/lib/auth/permissions";

export interface PurchaseWithoutVoucherInput {
  purchaseType?: InformalPurchaseType | "InventoryItem" | "OperatingExpense";
  supplyId?: number;
  expenseCategory?: ExpenseCategory;
  itemDescription?: string;
  quantity?: number;
  amountPaid: number;
  date?: Date | string | null;
  informalPlaceOrVendor?: string;
  reason?: string;
  employeeId?: number;
}

export async function registerPurchaseWithoutVoucher(data: PurchaseWithoutVoucherInput) {
  await requirePermission("compras.crear");
  const purchaseType =
    (data.purchaseType as InformalPurchaseType) || InformalPurchaseType.InventoryItem;

  if (purchaseType === InformalPurchaseType.OperatingExpense) {
    if (!data.itemDescription || data.itemDescription.trim() === "") {
      throw new Error("La descripción del gasto es obligatoria");
    }
    if (!data.expenseCategory) {
      throw new Error("Debe seleccionar una categoría de gasto");
    }
    if (!data.amountPaid || data.amountPaid <= 0) {
      throw new Error("El monto pagado debe ser mayor a 0");
    }
  } else {
    // InventoryItem
    if (!data.supplyId) {
      throw new Error("Debe seleccionar un insumo");
    }
    if (!data.quantity || data.quantity <= 0) {
      throw new Error("La cantidad debe ser mayor a 0");
    }
    if (!data.amountPaid || data.amountPaid <= 0) {
      throw new Error("El monto pagado debe ser mayor a 0");
    }
  }

  return await prisma.$transaction(async (tx) => {
    const validEmployeeId = await getOrCreateActiveEmployee(tx, data.employeeId);
    const purchaseDate = data.date ? new Date(data.date) : new Date();

    if (purchaseType === InformalPurchaseType.OperatingExpense) {
      const purchase = await tx.informalPurchase.create({
        data: {
          purchaseType: InformalPurchaseType.OperatingExpense,
          expenseCategory: data.expenseCategory,
          itemDescription: data.itemDescription!.trim(),
          quantity: data.quantity && data.quantity > 0 ? data.quantity : 1,
          amountPaid: data.amountPaid,
          date: purchaseDate,
          informalPlaceOrVendor: data.informalPlaceOrVendor?.trim() || null,
          reason: data.reason?.trim() || null,
          employeeId: validEmployeeId,
          supplyId: null,
          annulled: false,
        },
      });

      return purchase;
    }

    // InventoryItem
    const supply = await tx.supply.findUnique({ where: { id: data.supplyId } });
    if (!supply) {
      throw new Error("Insumo no encontrado");
    }

    const purchase = await tx.informalPurchase.create({
      data: {
        purchaseType: InformalPurchaseType.InventoryItem,
        supplyId: data.supplyId,
        employeeId: validEmployeeId,
        quantity: data.quantity!,
        amountPaid: data.amountPaid,
        date: purchaseDate,
        informalPlaceOrVendor: data.informalPlaceOrVendor?.trim() || null,
        reason: data.reason?.trim() || null,
        expenseCategory: null,
        itemDescription: null,
        annulled: false,
      },
    });

    const unitCost = data.amountPaid / data.quantity!;

    await tx.inventoryMovement.create({
      data: {
        supplyId: data.supplyId!,
        informalPurchaseId: purchase.id,
        movementType: InventoryMovementType.InformalPurchase,
        quantity: data.quantity!,
        unitCost,
        reason: data.reason?.trim() || `Compra menor sin comprobante #${purchase.id}`,
      },
    });

    const currentStock = Number(supply.currentStock);
    const currentAverageCost = Number(supply.averageCost);
    const newStock = currentStock + data.quantity!;

    let newAverageCost = 0;
    if (newStock > 0) {
      newAverageCost =
        (currentStock * currentAverageCost + data.quantity! * unitCost) / newStock;
    }

    await tx.supply.update({
      where: { id: data.supplyId },
      data: {
        currentStock: newStock,
        lastCost: Math.round(unitCost * 100) / 100,
        averageCost: Math.round(newAverageCost * 100) / 100,
      },
    });

    return purchase;
  });
}

export async function annulInformalPurchase(
  id: number,
  reason: string,
  employeeId?: number
) {
  await requirePermission("compras.eliminar");
  if (!reason || reason.trim() === "") {
    throw new Error("El motivo de anulación es obligatorio");
  }

  return await prisma.$transaction(async (tx) => {
    const purchase = await tx.informalPurchase.findUnique({
      where: { id },
      include: { supply: true },
    });

    if (!purchase) {
      throw new Error("Compra menor no encontrada");
    }

    if (purchase.annulled) {
      throw new Error("Esta compra ya está anulada");
    }

    const validEmployeeId = await getOrCreateActiveEmployee(tx, employeeId);

    if (
      purchase.purchaseType === InformalPurchaseType.InventoryItem &&
      purchase.supplyId
    ) {
      const supply = await tx.supply.findUnique({
        where: { id: purchase.supplyId },
      });

      if (!supply) {
        throw new Error("Insumo no encontrado");
      }

      const currentStock = Number(supply.currentStock);
      const purchaseQty = Number(purchase.quantity);

      if (currentStock < purchaseQty) {
        throw new Error(
          `Stock insuficiente para revertir. Stock actual: ${currentStock}, necesario: ${purchaseQty}`
        );
      }

      const unitCost =
        purchase.amountPaid && purchaseQty > 0
          ? Number(purchase.amountPaid) / purchaseQty
          : null;

      await tx.inventoryMovement.create({
        data: {
          supplyId: purchase.supplyId,
          informalPurchaseId: purchase.id,
          movementType: InventoryMovementType.InformalPurchase,
          quantity: -purchaseQty,
          unitCost,
          reason: `Anulación compra menor #${purchase.id}: ${reason.trim()}`,
        },
      });

      await tx.supply.update({
        where: { id: purchase.supplyId },
        data: {
          currentStock: currentStock - purchaseQty,
        },
      });
    }

    const updated = await tx.informalPurchase.update({
      where: { id },
      data: {
        annulled: true,
        annulledAt: new Date(),
        annulledById: validEmployeeId,
        annulmentReason: reason.trim(),
      },
    });

    return updated;
  });
}

export async function getPurchasesWithoutVoucher() {
  await requirePermission("compras.ver");
  try {
    const list = await prisma.informalPurchase.findMany({
      include: {
        supply: true,
        employee: true,
        annulledBy: true,
      },
      orderBy: { date: "desc" },
    });

    return list.map((p) => {
      const qty = Number(p.quantity);
      const amount = Number(p.amountPaid);
      const unitCost = qty > 0 ? Math.round((amount / qty) * 100) / 100 : 0;

      return {
        ...p,
        quantity: qty,
        amountPaid: amount,
        unitCost,
      };
    });
  } catch (error) {
    console.error("Error al obtener compras sin comprobante:", error);
    return [];
  }
}
