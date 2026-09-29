"use server";

import { prisma } from "@/lib/prisma";
import { TipoMovimientoEnum } from "@prisma/client";
import { obtenerOCrearEmpleadoActivo } from "./empleado-helper";

export interface CompraSinComprobanteInput {
  id_insumo: number;
  id_empleado?: number;
  cantidad: number;
  monto_pagado: number;
  fecha?: Date | string | null;
  lugar_o_proveedor_informal?: string;
  motivo?: string;
}

export async function registrarCompraSinComprobante(data: CompraSinComprobanteInput) {
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
    const idEmpleadoValido = await obtenerOCrearEmpleadoActivo(tx, data.id_empleado);

    const insumo = await tx.insumo.findUnique({ where: { id_insumo: data.id_insumo } });
    if (!insumo) {
      throw new Error("Insumo no encontrado");
    }

    const fechaDate = data.fecha ? new Date(data.fecha) : new Date();

    const compra = await tx.compra_sin_comprobante.create({
      data: {
        id_insumo: data.id_insumo,
        id_empleado: idEmpleadoValido,
        cantidad: data.cantidad,
        monto_pagado: data.monto_pagado,
        fecha: fechaDate,
        lugar_o_proveedor_informal: data.lugar_o_proveedor_informal?.trim() || null,
        motivo: data.motivo?.trim() || null,
      },
    });

    const costoUnitario = data.monto_pagado / data.cantidad;

    await tx.movimiento_inventario.create({
      data: {
        id_insumo: data.id_insumo,
        tipo_movimiento: TipoMovimientoEnum.CompraSinComprobante,
        cantidad: data.cantidad,
        costo_unitario: costoUnitario,
        motivo: data.motivo?.trim() || `Compra menor sin comprobante #${compra.id_compra_menor}`,
      },
    });

    const nuevoStock = Number(insumo.stock_actual) + data.cantidad;
    await tx.insumo.update({
      where: { id_insumo: data.id_insumo },
      data: { stock_actual: nuevoStock },
    });

    return compra;
  });
}

export async function obtenerComprasSinComprobante() {
  return await prisma.compra_sin_comprobante.findMany({
    include: {
      insumo: true,
      empleado: true,
    },
    orderBy: { fecha: "desc" },
  });
}
