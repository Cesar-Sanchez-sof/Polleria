"use server";

import { prisma } from "@/lib/prisma";
import { TipoInsumoEnum, TipoMovimientoEnum } from "@prisma/client";

export interface InsumoInput {
  nombre: string;
  tipo?: TipoInsumoEnum;
  unidad_medida: string;
  stock_minimo?: number;
}

export async function obtenerInsumos() {
  return await prisma.insumo.findMany({
    orderBy: { nombre: "asc" },
  });
}

export async function crearInsumo(data: InsumoInput) {
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

export async function registrarAjusteInventario(
  id_insumo: number,
  cantidad_real: number,
  motivo: string,
  tipo_movimiento: TipoMovimientoEnum = TipoMovimientoEnum.Ajuste
) {
  if (cantidad_real < 0) {
    throw new Error("La cantidad real no puede ser negativa");
  }
  if (!motivo || motivo.trim() === "") {
    throw new Error("El motivo del ajuste o merma es obligatorio");
  }

  return await prisma.$transaction(async (tx) => {
    const insumo = await tx.insumo.findUnique({
      where: { id_insumo },
    });
    if (!insumo) {
      throw new Error("Insumo no encontrado");
    }

    const stockActualNum = Number(insumo.stock_actual);
    const diferencia = cantidad_real - stockActualNum;

    const movimiento = await tx.movimiento_inventario.create({
      data: {
        id_insumo,
        tipo_movimiento,
        cantidad: diferencia,
        motivo: motivo.trim(),
      },
    });

    const insumoActualizado = await tx.insumo.update({
      where: { id_insumo },
      data: { stock_actual: cantidad_real },
    });

    return { movimiento, insumo: insumoActualizado };
  });
}

export async function obtenerMovimientosInventario(id_insumo?: number) {
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
}
