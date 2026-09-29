"use server";

import { prisma } from "@/lib/prisma";

export interface ComprobanteCompraInput {
  id_proveedor: number;
  id_recepcion: number;
  tipo_comprobante: string; // 'Factura' | 'Boleta' | 'Guía'
  serie: string;
  numero: number;
  fecha_emision?: Date | string | null;
  condicion_pago: "Contado" | "Credito";
  id_tipo_pago?: number;
}

export async function obtenerRecepcionesSinComprobante() {
  try {
    return await prisma.recepcion_compra.findMany({
      where: {
        comprobantes_compra: {
          none: {},
        },
      },
      include: {
        orden_compra: {
          include: {
            proveedor: true,
          },
        },
        detalles_recepcion_compra: {
          include: {
            detalle_orden_compra: {
              include: {
                insumo: true,
              },
            },
          },
        },
      },
      orderBy: { fecha_recepcion: "desc" },
    });
  } catch (error) {
    console.error("Error al obtener recepciones sin comprobante:", error);
    return [];
  }
}

export async function crearComprobanteCompra(data: ComprobanteCompraInput) {
  if (!data.id_proveedor) {
    throw new Error("Debe seleccionar un proveedor");
  }
  if (!data.id_recepcion) {
    throw new Error("Debe seleccionar una recepción de compra");
  }
  if (!data.tipo_comprobante || data.tipo_comprobante.trim() === "") {
    throw new Error("El tipo de comprobante es obligatorio");
  }
  if (!data.serie || data.serie.trim().length === 0) {
    throw new Error("La serie del comprobante es obligatoria");
  }
  if (!data.numero || data.numero <= 0) {
    throw new Error("El número de comprobante es obligatorio");
  }
  if (data.condicion_pago === "Contado" && !data.id_tipo_pago) {
    throw new Error("Debe seleccionar el tipo de pago para venta al contado");
  }

  return await prisma.$transaction(async (tx) => {
    const dupl = await tx.comprobante_compra.findFirst({
      where: {
        id_proveedor: data.id_proveedor,
        tipo_comprobante: data.tipo_comprobante.trim(),
        serie: data.serie.trim(),
        numero: Number(data.numero),
      },
    });
    if (dupl) {
      throw new Error(`El comprobante ${data.tipo_comprobante} ${data.serie}-${data.numero} ya existe para este proveedor`);
    }

    const recepcion = await tx.recepcion_compra.findUnique({
      where: { id_recepcion: data.id_recepcion },
      include: {
        detalles_recepcion_compra: {
          include: {
            detalle_orden_compra: true,
          },
        },
      },
    });
    if (!recepcion) {
      throw new Error("Recepción de compra no encontrada");
    }

    let subtotal = 0;
    for (const d of recepcion.detalles_recepcion_compra) {
      const cant = Number(d.cantidad_recibida);
      const prec = Number(d.detalle_orden_compra.precio_unitario);
      subtotal += cant * prec;
    }
    const igv = Math.round(subtotal * 0.18 * 100) / 100;
    const monto_total = subtotal + igv;

    const fechaEmisionDate = data.fecha_emision ? new Date(data.fecha_emision) : new Date();

    const comprobante = await tx.comprobante_compra.create({
      data: {
        id_proveedor: data.id_proveedor,
        id_recepcion: data.id_recepcion,
        tipo_comprobante: data.tipo_comprobante.trim(),
        serie: data.serie.trim(),
        numero: Number(data.numero),
        fecha_emision: fechaEmisionDate,
        subtotal,
        igv,
        monto_total,
        estado: true,
      },
    });

    if (data.condicion_pago === "Contado" && data.id_tipo_pago) {
      await tx.pago_compra.create({
        data: {
          id_comprobante_compra: comprobante.id_comprobante_compra,
          id_tipo_pago: data.id_tipo_pago,
          monto: monto_total,
          fecha_pago: new Date(),
        },
      });
    }

    return comprobante;
  });
}

export async function obtenerComprobantesCompra() {
  try {
    const comprobantes = await prisma.comprobante_compra.findMany({
      include: {
        proveedor: true,
        recepcion: {
          include: {
            detalles_recepcion_compra: {
              include: {
                detalle_orden_compra: {
                  include: {
                    insumo: true,
                  },
                },
              },
            },
          },
        },
        pagos_compra: {
          include: {
            tipo_pago: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return comprobantes.map((c) => {
      const totalPagado = c.pagos_compra.reduce((sum, p) => sum + Number(p.monto), 0);
      const montoTotal = Number(c.monto_total);
      let estadoPago: "Pendiente" | "Parcial" | "Pagado" = "Pendiente";
      if (totalPagado >= montoTotal && montoTotal > 0) {
        estadoPago = "Pagado";
      } else if (totalPagado > 0) {
        estadoPago = "Parcial";
      }

      return {
        ...c,
        totalPagado,
        saldoPendiente: Math.max(0, montoTotal - totalPagado),
        estadoPago,
      };
    });
  } catch (error) {
    console.error("Error al obtener comprobantes de compra:", error);
    return [];
  }
}

export async function registrarPagoCompra(
  id_comprobante_compra: number,
  id_tipo_pago: number,
  monto: number
) {
  if (monto <= 0) {
    throw new Error("El monto del pago debe ser mayor a 0");
  }
  if (!id_tipo_pago) {
    throw new Error("Debe seleccionar un tipo de pago");
  }

  const comprobante = await prisma.comprobante_compra.findUnique({
    where: { id_comprobante_compra },
    include: { pagos_compra: true },
  });
  if (!comprobante) {
    throw new Error("Comprobante de compra no encontrado");
  }

  const totalPagadoAct = comprobante.pagos_compra.reduce((sum, p) => sum + Number(p.monto), 0);
  const saldoPendiente = Number(comprobante.monto_total) - totalPagadoAct;

  if (monto > saldoPendiente + 0.01) {
    throw new Error(`El monto supera el saldo pendiente (S/ ${saldoPendiente.toFixed(2)})`);
  }

  return await prisma.pago_compra.create({
    data: {
      id_comprobante_compra,
      id_tipo_pago,
      monto,
      fecha_pago: new Date(),
    },
  });
}

export async function obtenerTiposPago() {
  try {
    return await prisma.tipo_pago.findMany({
      where: { estado: true },
      orderBy: { nombre: "asc" },
    });
  } catch (error) {
    console.error("Error al obtener tipos de pago:", error);
    return [];
  }
}
