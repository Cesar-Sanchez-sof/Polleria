"use server";

import { prisma } from "@/lib/prisma";
import { TipoMovimientoEnum } from "@prisma/client";
import { getOrCreateActiveEmployee } from "./employee-helper";

export interface TransformationLineInput {
  id_insumo: number;
  cantidad: number;
  costo_unitario?: number;
}

export interface TransformationInput {
  id_empleado?: number;
  observacion?: string;
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
    if (c.cantidad <= 0) throw new Error("La cantidad consumida debe ser mayor a 0");
  }
  for (const p of data.producidos) {
    if (p.cantidad <= 0) throw new Error("La cantidad producida debe ser mayor a 0");
  }

  return await prisma.$transaction(async (tx) => {
    const validEmployeeId = await getOrCreateActiveEmployee(tx, data.id_empleado);

    const transformation = await tx.transformacion.create({
      data: {
        id_empleado: validEmployeeId,
        fecha: new Date(),
        observacion: data.observacion?.trim() || null,
      },
    });

    // 1. Process Consumos (Salida)
    for (const c of data.consumos) {
      const supply = await tx.insumo.findUnique({ where: { id_insumo: c.id_insumo } });
      if (!supply) throw new Error(`Insumo ID ${c.id_insumo} no encontrado`);

      await tx.detalle_transformacion.create({
        data: {
          id_transformacion: transformation.id_transformacion,
          id_insumo: c.id_insumo,
          tipo_detalle: "Consumo",
          cantidad: c.cantidad,
          costo_unitario: c.costo_unitario || null,
        },
      });

      // Stock invariant: create movimiento_inventario and update stock
      await tx.movimiento_inventario.create({
        data: {
          id_insumo: c.id_insumo,
          tipo_movimiento: TipoMovimientoEnum.TransformacionSalida,
          cantidad: c.cantidad,
          costo_unitario: c.costo_unitario || null,
          motivo: `Consumo Transformación #${transformation.id_transformacion}`,
        },
      });

      const newStock = Math.max(0, Number(supply.stock_actual) - c.cantidad);
      await tx.insumo.update({
        where: { id_insumo: c.id_insumo },
        data: { stock_actual: newStock },
      });
    }

    // 2. Process Producidos (Entrada)
    for (const p of data.producidos) {
      const supply = await tx.insumo.findUnique({ where: { id_insumo: p.id_insumo } });
      if (!supply) throw new Error(`Insumo ID ${p.id_insumo} no encontrado`);

      await tx.detalle_transformacion.create({
        data: {
          id_transformacion: transformation.id_transformacion,
          id_insumo: p.id_insumo,
          tipo_detalle: "Producido",
          cantidad: p.cantidad,
          costo_unitario: p.costo_unitario || null,
        },
      });

      // Stock invariant: create movimiento_inventario and update stock
      await tx.movimiento_inventario.create({
        data: {
          id_insumo: p.id_insumo,
          tipo_movimiento: TipoMovimientoEnum.TransformacionEntrada,
          cantidad: p.cantidad,
          costo_unitario: p.costo_unitario || null,
          motivo: `Producción Transformación #${transformation.id_transformacion}`,
        },
      });

      const newStock = Number(supply.stock_actual) + p.cantidad;
      await tx.insumo.update({
        where: { id_insumo: p.id_insumo },
        data: { stock_actual: newStock },
      });
    }

    return transformation;
  });
}

export async function getTransformations() {
  try {
    return await prisma.transformacion.findMany({
      include: {
        empleado: true,
        detalles_transformacion: {
          include: {
            insumo: true,
          },
        },
      },
      orderBy: { fecha: "desc" },
    });
  } catch (error) {
    console.error("Error al obtener transformaciones:", error);
    return [];
  }
}
