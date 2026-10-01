"use server";

import { prisma } from "@/lib/prisma";
import { TipoInsumoEnum, TipoMovimientoEnum } from "@prisma/client";

export interface SupplyInput {
  nombre: string;
  tipo?: TipoInsumoEnum;
  unidad_medida: string;
  stock_minimo?: number;
}

export async function getSupplies() {
  try {
    return await prisma.insumo.findMany({
      orderBy: { nombre: "asc" },
    });
  } catch (error) {
    console.error("Error al obtener insumos:", error);
    return [];
  }
}

export async function createSupply(data: SupplyInput) {
  if (!data.nombre || data.nombre.trim() === "") {
    throw new Error("El nombre del insumo es obligatorio");
  }
  if (!data.unidad_medida || data.unidad_medida.trim() === "") {
    throw new Error("La unidad de medida es obligatoria");
  }

  return await prisma.insumo.create({
    data: {
      nombre: data.nombre.trim(),
      tipo: data.tipo || TipoInsumoEnum.MateriaPrima,
      unidad_medida: data.unidad_medida.trim(),
      stock_actual: 0,
      stock_minimo: data.stock_minimo || 0,
      estado: true,
    },
  });
}

export async function registerInventoryAdjustment(
  id_insumo: number,
  cantidad_real: number,
  reason: string,
  tipo_movimiento: TipoMovimientoEnum = TipoMovimientoEnum.Ajuste
) {
  if (cantidad_real < 0) {
    throw new Error("La cantidad real no puede ser negativa");
  }
  if (!reason || reason.trim() === "") {
    throw new Error("El motivo del ajuste o merma es obligatorio");
  }

  return await prisma.$transaction(async (tx) => {
    const supply = await tx.insumo.findUnique({
      where: { id_insumo },
    });
    if (!supply) {
      throw new Error("Insumo no encontrado");
    }

    const currentStock = Number(supply.stock_actual);
    const difference = cantidad_real - currentStock;

    const movement = await tx.movimiento_inventario.create({
      data: {
        id_insumo,
        tipo_movimiento,
        cantidad: difference,
        motivo: reason.trim(),
      },
    });

    const updatedSupply = await tx.insumo.update({
      where: { id_insumo },
      data: { stock_actual: cantidad_real },
    });

    return { movement, supply: updatedSupply };
  });
}

export async function getInventoryMovements(id_insumo?: number) {
  try {
    return await prisma.movimiento_inventario.findMany({
      where: id_insumo ? { id_insumo } : undefined,
      include: {
        insumo: true,
        detalle_recepcion_compra: {
          include: {
            recepcion: true,
          },
        },
      },
      orderBy: { fecha_movimiento: "desc" },
    });
  } catch (error) {
    console.error("Error al obtener movimientos de inventario:", error);
    return [];
  }
}
