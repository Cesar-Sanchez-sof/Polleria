"use server";

import { prisma } from "@/lib/prisma";
import { TipoMovimientoEnum } from "@prisma/client";
import { obtenerOCrearEmpleadoActivo } from "./empleado-helper";

export interface LineaTransformacionInput {
  id_insumo: number;
  cantidad: number;
  costo_unitario?: number;
}

export interface TransformacionInput {
  id_empleado?: number;
  observacion?: string;
  consumos: LineaTransformacionInput[];
  producidos: LineaTransformacionInput[];
}

export async function registrarTransformacion(data: TransformacionInput) {
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
    const idEmpleadoValido = await obtenerOCrearEmpleadoActivo(tx, data.id_empleado);

    const transformacion = await tx.transformacion.create({
      data: {
        id_empleado: idEmpleadoValido,
        fecha: new Date(),
        observacion: data.observacion?.trim() || null,
      },
    });

    // 1. Process Consumos (Salida)
    for (const c of data.consumos) {
      const insumo = await tx.insumo.findUnique({ where: { id_insumo: c.id_insumo } });
      if (!insumo) throw new Error(`Insumo ID ${c.id_insumo} no encontrado`);

      await tx.detalle_transformacion.create({
        data: {
          id_transformacion: transformacion.id_transformacion,
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
          motivo: `Consumo Transformación #${transformacion.id_transformacion}`,
        },
      });

      const nuevoStock = Math.max(0, Number(insumo.stock_actual) - c.cantidad);
      await tx.insumo.update({
        where: { id_insumo: c.id_insumo },
        data: { stock_actual: nuevoStock },
      });
    }

    // 2. Process Producidos (Entrada)
    for (const p of data.producidos) {
      const insumo = await tx.insumo.findUnique({ where: { id_insumo: p.id_insumo } });
      if (!insumo) throw new Error(`Insumo ID ${p.id_insumo} no encontrado`);

      await tx.detalle_transformacion.create({
        data: {
          id_transformacion: transformacion.id_transformacion,
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
          motivo: `Producción Transformación #${transformacion.id_transformacion}`,
        },
      });

      const nuevoStock = Number(insumo.stock_actual) + p.cantidad;
      await tx.insumo.update({
        where: { id_insumo: p.id_insumo },
        data: { stock_actual: nuevoStock },
      });
    }

    return transformacion;
  });
}

export async function obtenerTransformaciones() {
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
