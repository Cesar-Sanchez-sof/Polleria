"use server";

import { prisma } from "@/lib/prisma";
import { EstadoOrdenCompraEnum, EstadoRecepcionCompraEnum, TipoMovimientoEnum } from "@prisma/client";
import { getOrCreateActiveEmployee } from "./employee-helper";

export interface ReceivingLineInput {
  id_detalle_orden_compra: number;
  cantidad_recibida: number;
  observacion?: string;
}

export interface PurchaseReceivingInput {
  id_orden_compra: number;
  id_empleado_recepcion?: number;
  observacion?: string;
  detalles: ReceivingLineInput[];
}

export async function getOrdersForReceiving() {
  try {
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
  } catch (error) {
    console.error("Error al obtener órdenes para recepción:", error);
    return [];
  }
}

export async function receivePurchase(data: PurchaseReceivingInput) {
  if (!data.id_orden_compra) {
    throw new Error("Debe especificar la orden de compra");
  }
  if (!data.detalles || data.detalles.length === 0) {
    throw new Error("Debe ingresar al menos un detalle de recepción");
  }

  return await prisma.$transaction(async (tx) => {
    const validEmployeeId = await getOrCreateActiveEmployee(tx, data.id_empleado_recepcion);

    const order = await tx.orden_compra.findUnique({
      where: { id_orden_compra: data.id_orden_compra },
      include: {
        detalles_orden: {
          include: {
            detalles_recepcion_compra: true,
          },
        },
      },
    });
    if (!order) {
      throw new Error("Orden de compra no encontrada");
    }

    const receipt = await tx.recepcion_compra.create({
      data: {
        id_orden_compra: data.id_orden_compra,
        id_empleado_recepcion: validEmployeeId,
        fecha_recepcion: new Date(),
        observacion: data.observacion?.trim() || null,
        estado: EstadoRecepcionCompraEnum.Confirmada,
      },
    });

    for (const d of data.detalles) {
      if (d.cantidad_recibida <= 0) continue; // Skip lines with 0 received

      const orderLine = order.detalles_orden.find(
        (doItem) => doItem.id_detalle_orden_compra === d.id_detalle_orden_compra
      );
      if (!orderLine) {
        throw new Error(`Detalle de orden ID ${d.id_detalle_orden_compra} no pertenece a la orden`);
      }

      const receiptLine = await tx.detalle_recepcion_compra.create({
        data: {
          id_recepcion: receipt.id_recepcion,
          id_detalle_orden_compra: d.id_detalle_orden_compra,
          cantidad_recibida: d.cantidad_recibida,
          obsevacion: d.observacion?.trim() || null,
        },
      });

      // Stock invariant: create movimiento_inventario and update stock_actual
      await tx.movimiento_inventario.create({
        data: {
          id_insumo: orderLine.id_insumo,
          id_detalle_recepcion_compra: receiptLine.id_detalle_recepcion_compra,
          tipo_movimiento: TipoMovimientoEnum.Compra,
          cantidad: d.cantidad_recibida,
          costo_unitario: orderLine.precio_unitario,
          motivo: `Recepción Orden #${order.numero_orden}`,
        },
      });

      const supply = await tx.insumo.findUnique({ where: { id_insumo: orderLine.id_insumo } });
      if (supply) {
        const newStock = Number(supply.stock_actual) + d.cantidad_recibida;
        await tx.insumo.update({
          where: { id_insumo: orderLine.id_insumo },
          data: { stock_actual: newStock },
        });
      }
    }

    // Check overall order reception status
    const previousReceipts = await tx.detalle_recepcion_compra.findMany({
      where: {
        recepcion: {
          id_orden_compra: data.id_orden_compra,
        },
      },
    });

    let completed = true;
    for (const orderLine of order.detalles_orden) {
      const accumulated = previousReceipts
        .filter((r) => r.id_detalle_orden_compra === orderLine.id_detalle_orden_compra)
        .reduce((sum, r) => sum + Number(r.cantidad_recibida), 0);
      if (accumulated < Number(orderLine.cantidad_pedida)) {
        completed = false;
        break;
      }
    }

    const newStatus = completed
      ? EstadoOrdenCompraEnum.RecibidaTotal
      : EstadoOrdenCompraEnum.RecibidaParcial;

    await tx.orden_compra.update({
      where: { id_orden_compra: data.id_orden_compra },
      data: { estado: newStatus },
    });

    return receipt;
  });
}

export async function getPurchaseReceipts() {
  try {
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
  } catch (error) {
    console.error("Error al obtener recepciones de compra:", error);
    return [];
  }
}
