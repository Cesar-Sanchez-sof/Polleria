"use server";

import { prisma } from "@/lib/prisma";
import { EstadoOrdenCompraEnum } from "@prisma/client";
import { obtenerOCrearEmpleadoActivo } from "./empleado-helper";

export interface DetalleOrdenCompraInput {
  id_insumo: number;
  cantidad_pedida: number;
  precio_unitario: number;
}

export interface OrdenCompraInput {
  id_proveedor: number;
  id_empleado?: number;
  fecha_esperada?: Date | string | null;
  observaciones?: string;
  detalles: DetalleOrdenCompraInput[];
}

export async function generarNumeroOrden(): Promise<string> {
  const count = await prisma.orden_compra.count();
  const year = new Date().getFullYear();
  const num = (count + 1).toString().padStart(5, "0");
  return `OC-${year}-${num}`;
}

export async function crearOrdenCompra(data: OrdenCompraInput) {
  if (!data.id_proveedor) {
    throw new Error("Debe seleccionar un proveedor");
  }
  if (!data.detalles || data.detalles.length === 0) {
    throw new Error("La orden debe tener al menos una línea de insumo");
  }

  for (const d of data.detalles) {
    if (!d.id_insumo) {
      throw new Error("Insumo no válido en una de las líneas");
    }
    if (d.cantidad_pedida <= 0) {
      throw new Error("La cantidad pedida debe ser mayor a 0");
    }
    if (d.precio_unitario < 0) {
      throw new Error("El precio unitario no puede ser negativo");
    }
  }

  return await prisma.$transaction(async (tx) => {
    const idEmpleadoValido = await obtenerOCrearEmpleadoActivo(tx, data.id_empleado);

    let numero_orden = await generarNumeroOrden();
    const existe = await tx.orden_compra.findUnique({ where: { numero_orden } });
    if (existe) {
      numero_orden = `${numero_orden}-${Math.floor(Math.random() * 1000)}`;
    }

    let subtotal = 0;
    for (const d of data.detalles) {
      subtotal += d.cantidad_pedida * d.precio_unitario;
    }
    const igv = Math.round(subtotal * 0.18 * 100) / 100;
    const total = subtotal + igv;

    const fechaEsperadaDate = data.fecha_esperada ? new Date(data.fecha_esperada) : null;

    const orden = await tx.orden_compra.create({
      data: {
        id_proveedor: data.id_proveedor,
        id_empleado: idEmpleadoValido,
        numero_orden,
        fecha_emision: new Date(),
        fecha_esperada: fechaEsperadaDate,
        estado: EstadoOrdenCompraEnum.Pendiente,
        subtotal,
        igv,
        total,
        observaciones: data.observaciones?.trim() || null,
        detalles_orden: {
          create: data.detalles.map((d) => ({
            id_insumo: d.id_insumo,
            cantidad_pedida: d.cantidad_pedida,
            precio_unitario: d.precio_unitario,
          })),
        },
      },
      include: {
        proveedor: true,
        empleado: true,
        detalles_orden: {
          include: {
            insumo: true,
          },
        },
      },
    });

    return orden;
  });
}

export async function obtenerOrdenesCompra() {
  try {
    return await prisma.orden_compra.findMany({
      include: {
        proveedor: true,
        empleado: true,
        detalles_orden: {
          include: {
            insumo: true,
          },
        },
        recepciones_compra: true,
      },
      orderBy: { fecha_emision: "desc" },
    });
  } catch (error) {
    console.error("Error al obtener órdenes de compra:", error);
    return [];
  }
}

export async function obtenerOrdenCompraPorId(id_orden_compra: number) {
  try {
    return await prisma.orden_compra.findUnique({
      where: { id_orden_compra },
      include: {
        proveedor: true,
        empleado: true,
        detalles_orden: {
          include: {
            insumo: true,
          },
        },
        recepciones_compra: {
          include: {
            detalles_recepcion_compra: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error al obtener orden de compra:", error);
    return null;
  }
}
