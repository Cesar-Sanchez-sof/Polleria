"use server";

import { prisma } from "@/lib/prisma";
import { TipoMovimientoEnum } from "@prisma/client";
import { getOrCreateActiveEmployee } from "./employee-helper";

export interface PurchaseWithoutVoucherInput {
  id_insumo: number;
  id_empleado?: number;
  cantidad: number;
  monto_pagado: number;
  fecha?: Date | string | null;
  lugar_o_proveedor_informal?: string;
  motivo?: string;
}

export async function registerPurchaseWithoutVoucher(data: PurchaseWithoutVoucherInput) {
  if (!data.id_insumo) {
    throw new Error("Debe seleccionar un insumo");
  }
  if (!data.cantidad || data.cantidad <= 0) {
    throw new Error("La cantidad debe ser mayor a 0");
  }
  if (!data.monto_pagado || data.monto_pagado <= 0) {
    throw new Error("El monto pagado debe ser mayor a 0");
  }

  return await prisma.$transaction(async (tx) => {
    const validEmployeeId = await getOrCreateActiveEmployee(tx, data.id_empleado);

    const supply = await tx.insumo.findUnique({ where: { id_insumo: data.id_insumo } });
    if (!supply) {
      throw new Error("Insumo no encontrado");
    }

    const purchaseDate = data.fecha ? new Date(data.fecha) : new Date();

    const purchase = await tx.compra_sin_comprobante.create({
      data: {
        id_insumo: data.id_insumo,
        id_empleado: validEmployeeId,
        cantidad: data.cantidad,
        monto_pagado: data.monto_pagado,
        fecha: purchaseDate,
        lugar_o_proveedor_informal: data.lugar_o_proveedor_informal?.trim() || null,
        motivo: data.motivo?.trim() || null,
      },
    });

    const unitCost = data.monto_pagado / data.cantidad;

    await tx.movimiento_inventario.create({
      data: {
        id_insumo: data.id_insumo,
        tipo_movimiento: TipoMovimientoEnum.CompraSinComprobante,
        cantidad: data.cantidad,
        costo_unitario: unitCost,
        motivo: data.motivo?.trim() || `Compra menor sin comprobante #${purchase.id_compra_menor}`,
      },
    });

    const newStock = Number(supply.stock_actual) + data.cantidad;
    await tx.insumo.update({
      where: { id_insumo: data.id_insumo },
      data: { stock_actual: newStock },
    });

    return purchase;
  });
}

export async function getPurchasesWithoutVoucher() {
  try {
    return await prisma.compra_sin_comprobante.findMany({
      include: {
        insumo: true,
        empleado: true,
      },
      orderBy: { fecha: "desc" },
    });
  } catch (error) {
    console.error("Error al obtener compras sin comprobante:", error);
    return [];
  }
}
