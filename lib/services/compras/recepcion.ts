"use server";

import { prisma } from "@/lib/prisma";
import { EstadoOrdenCompraEnum, EstadoRecepcionCompraEnum, TipoMovimientoEnum } from "@prisma/client";
import { obtenerOCrearEmpleadoActivo } from "./empleado-helper";

export interface DetalleRecepcionInput {
  id_detalle_orden_compra: number;
  cantidad_recibida: number;
  observacion?: string;
}

export interface RecepcionCompraInput {
  id_orden_compra: number;
  id_empleado_recepcion?: number;
  observacion?: string;
  detalles: DetalleRecepcionInput[];
}

export async function obtenerOrdenesParaRecepcion() {
  return await prisma.orden_compra.findMany({
    where: {
      estado: {
        in: [EstadoOrdenCompraEnum.Pendiente, EstadoOrdenCompraEnum.RecibidaParcial],
      },
    },
    include: {
      proveedor: true,
      empleado: true,
      detalles_orden: {
        include: {
          insumo: true,
          detalles_recepcion_compra: true,
        },
      },
      recepciones_compra: {
        include: {
          detalles_recepcion_compra: true,
        },
      },
    },
    orderBy: { fecha_emision: "desc" },
  });
}

export async function recepcionarCompra(data: RecepcionCompraInput) {
  if (!data.id_orden_compra) {
    throw new Error("Debe especificar la orden de compra");
  }
  if (!data.detalles || data.detalles.length === 0) {
    throw new Error("Debe ingresar al menos un detalle de recepción");
  }

  return await prisma.$transaction(async (tx) => {
    const idEmpleadoValido = await obtenerOCrearEmpleadoActivo(tx, data.id_empleado_recepcion);

    const orden = await tx.orden_compra.findUnique({
      where: { id_orden_compra: data.id_orden_compra },
      include: {
        detalles_orden: {
          include: {
            detalles_recepcion_compra: true,
          },
        },
      },
    });
    if (!orden) {
      throw new Error("Orden de compra no encontrada");
    }

    const recepcion = await tx.recepcion_compra.create({
      data: {
        id_orden_compra: data.id_orden_compra,
        id_empleado_recepcion: idEmpleadoValido,
        fecha_recepcion: new Date(),
        observacion: data.observacion?.trim() || null,
        estado: EstadoRecepcionCompraEnum.Confirmada,
      },
    });

    for (const d of data.detalles) {
      if (d.cantidad_recibida <= 0) continue; // Skip lines with 0 received

      const detOrden = orden.detalles_orden.find(
        (doItem) => doItem.id_detalle_orden_compra === d.id_detalle_orden_compra
      );
      if (!detOrden) {
        throw new Error(`Detalle de orden ID ${d.id_detalle_orden_compra} no pertenece a la orden`);
      }

      const detRecep = await tx.detalle_recepcion_compra.create({
        data: {
          id_recepcion: recepcion.id_recepcion,
          id_detalle_orden_compra: d.id_detalle_orden_compra,
          cantidad_recibida: d.cantidad_recibida,
          obsevacion: d.observacion?.trim() || null,
        },
      });

      // Stock invariant: create movimiento_inventario and update stock_actual
      await tx.movimiento_inventario.create({
        data: {
          id_insumo: detOrden.id_insumo,
          id_detalle_recepcion_compra: detRecep.id_detalle_recepcion_compra,
          tipo_movimiento: TipoMovimientoEnum.Compra,
          cantidad: d.cantidad_recibida,
          costo_unitario: detOrden.precio_unitario,
          motivo: `Recepción Orden #${orden.numero_orden}`,
        },
      });

      const insumo = await tx.insumo.findUnique({ where: { id_insumo: detOrden.id_insumo } });
      if (insumo) {
        const nuevoStock = Number(insumo.stock_actual) + d.cantidad_recibida;
        await tx.insumo.update({
          where: { id_insumo: detOrden.id_insumo },
          data: { stock_actual: nuevoStock },
        });
      }
    }

    // Check overall order reception status
    const recepcionesAnteriores = await tx.detalle_recepcion_compra.findMany({
      where: {
        recepcion: {
          id_orden_compra: data.id_orden_compra,
        },
      },
    });

    let completada = true;
    for (const detOrden of orden.detalles_orden) {
      const acumulado = recepcionesAnteriores
        .filter((r) => r.id_detalle_orden_compra === detOrden.id_detalle_orden_compra)
        .reduce((sum, r) => sum + Number(r.cantidad_recibida), 0);
      if (acumulado < Number(detOrden.cantidad_pedida)) {
        completada = false;
        break;
      }
    }

    const nuevoEstado = completada
      ? EstadoOrdenCompraEnum.RecibidaTotal
      : EstadoOrdenCompraEnum.RecibidaParcial;

    await tx.orden_compra.update({
      where: { id_orden_compra: data.id_orden_compra },
      data: { estado: nuevoEstado },
    });

    return recepcion;
  });
}

export async function obtenerRecepcionesCompra() {
  return await prisma.recepcion_compra.findMany({
    include: {
      orden_compra: {
        include: {
          proveedor: true,
        },
      },
      empleado_recepcion: true,
      detalles_recepcion_compra: {
        include: {
          detalle_orden_compra: {
            include: {
              insumo: true,
            },
          },
        },
      },
      comprobantes_compra: true,
    },
    orderBy: { fecha_recepcion: "desc" },
  });
}
