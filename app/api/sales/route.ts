import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateDailySalesSummary } from "@/lib/utils/sales-helpers";

export const dynamic = "force-dynamic";

interface SplitPaymentInput {
  id_tipo_pago: number;
  monto: number;
}

interface RegisterSaleInput {
  id_pedido: number;
  id_tipo_pago?: number;
  pagos?: SplitPaymentInput[];
  tipo_comprobante: "Boleta" | "Factura" | "Ticket";
  cliente?: {
    nro_doc?: string;
    nombre: string;
    tipo_persona?: "Natural" | "Juridico";
    telefono?: string;
  };
  monto_recibido?: number;
  pasarela?: {
    proveedor?: string;
    modo?: "tap_to_pay" | "qr" | "manual";
    operacion_id?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as RegisterSaleInput | null;
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Datos de venta no válidos." }, { status: 400 });
    }

    const { id_pedido, id_tipo_pago, tipo_comprobante, cliente, monto_recibido, pasarela } = body;

    if (!id_pedido || Number.isNaN(Number(id_pedido))) {
      return Response.json({ error: "ID de pedido inválido." }, { status: 400 });
    }

    const isSplitPayment = Array.isArray(body.pagos) && body.pagos.length > 0;

    if (!isSplitPayment && (!id_tipo_pago || Number.isNaN(Number(id_tipo_pago)))) {
      return Response.json({ error: "Debe seleccionar un método de pago válido." }, { status: 400 });
    }

    // 1. Validar existencia del método o métodos de pago
    let paymentType: { id_tipo_pago: number; nombre: string; estado: boolean } | null = null;
    const paymentsList: Array<{ id_tipo_pago: number; monto: number; nombre: string }> = [];

    if (isSplitPayment) {
      const paymentTypesDb = await prisma.tipo_pago.findMany({ where: { estado: true } });
      const paymentTypesMap = new Map(paymentTypesDb.map((t) => [t.id_tipo_pago, t]));
      for (const p of body.pagos!) {
        const idTP = Number(p.id_tipo_pago);
        const montoNum = Math.round(Number(p.monto) * 100) / 100;
        const tp = paymentTypesMap.get(idTP);
        if (!tp) {
          return Response.json({ error: `El método de pago con ID ${idTP} no está disponible.` }, { status: 400 });
        }
        if (montoNum <= 0) {
          return Response.json({ error: "El monto de cada pago parcial debe ser mayor a 0." }, { status: 400 });
        }
        paymentsList.push({ id_tipo_pago: idTP, monto: montoNum, nombre: tp.nombre });
      }
    } else {
      paymentType = await prisma.tipo_pago.findUnique({
        where: { id_tipo_pago: Number(id_tipo_pago) }
      });
      if (!paymentType || !paymentType.estado) {
        return Response.json({ error: "El método de pago no está disponible." }, { status: 400 });
      }
    }

    // 2. Validar que el pedido exista, esté pendiente de cobro y tenga ítems
    const order = await prisma.pedido.findUnique({
      where: { id_pedido: Number(id_pedido) },
      include: {
        pedidos_mesa: { include: { mesa: true } },
        detalles_pedido: { include: { plato: true } }
      }
    });

    if (!order) {
      return Response.json({ error: "El pedido a cobrar no existe." }, { status: 404 });
    }

    if (order.estado === "Cerrado") {
      return Response.json(
        { error: "Operación inválida: El pedido ya fue cobrado y cerrado anteriormente." },
        { status: 400 }
      );
    }

    if (order.estado === "Cancelado") {
      return Response.json(
        { error: "Operación rechazada: Un pedido cancelado no puede convertirse en una venta ni generar cobro." },
        { status: 400 }
      );
    }

    if (order.detalles_pedido.length === 0) {
      return Response.json(
        { error: "El pedido no contiene ítems para ser cobrado." },
        { status: 400 }
      );
    }

    // 3. Cálculos de importes oficiales basados en BD
    const saleTotal = order.detalles_pedido.reduce(
      (sum, item) => sum + Number(item.sub_total),
      0
    );
    const roundedTotal = Math.round(saleTotal * 100) / 100;

    // En Perú, precios de carta ya incluyen IGV (18%)
    const taxableSubtotal = Math.round((roundedTotal / 1.18) * 100) / 100;
    const calculatedIgv = Math.round((roundedTotal - taxableSubtotal) * 100) / 100;

    // Validación de total en pagos divididos
    if (isSplitPayment) {
      const paymentsSum = Math.round(paymentsList.reduce((s, p) => s + p.monto, 0) * 100) / 100;
      if (Math.abs(paymentsSum - roundedTotal) > 0.05) {
        return Response.json(
          { error: `La suma de las partes de pago (S/ ${paymentsSum.toFixed(2)}) no coincide con el total de la cuenta (S/ ${roundedTotal.toFixed(2)}).` },
          { status: 400 }
        );
      }
    } else {
      // Validación de efectivo entregado para pago único
      if (paymentType && paymentType.nombre.toLowerCase().includes("efectivo") && monto_recibido) {
        if (monto_recibido < roundedTotal) {
          return Response.json(
            { error: `El monto entregado (S/ ${monto_recibido.toFixed(2)}) es menor al total a cobrar (S/ ${roundedTotal.toFixed(2)}).` },
            { status: 400 }
          );
        }
      }
    }

    // 4. Determinar o registrar cliente
    let customerId: number;
    const customerDoc = cliente?.nro_doc?.trim() || "00000000";
    const customerName = cliente?.nombre?.trim() || "CLIENTE GENERAL";
    const tipoPersona = cliente?.tipo_persona ?? (customerDoc.length === 11 ? "Juridico" : "Natural");

    const existingCustomer = await prisma.cliente.findFirst({
      where: { nro_doc: customerDoc, tipo_persona: tipoPersona }
    });

    if (existingCustomer) {
      customerId = existingCustomer.id_cliente;
    } else {
      const newCustomer = await prisma.cliente.create({
        data: {
          nro_doc: customerDoc,
          nombre: customerName,
          tipo_persona: tipoPersona,
          telefono: cliente?.telefono?.trim() || null,
          estado: true
        }
      });
      customerId = newCustomer.id_cliente;
    }

    // 5. Determinar serie y correlativo del comprobante
    const docType = tipo_comprobante === "Factura" ? "Factura" : tipo_comprobante === "Boleta" ? "Boleta" : "Boleta";
    const serie = docType === "Factura" ? "F001" : "B001";

    const lastVoucher = await prisma.comprobante_venta.findFirst({
      where: { tipo_comprobante: docType, serie },
      orderBy: { numero: "desc" }
    });
    const sequentialNumber = (lastVoucher?.numero ?? 0) + 1;

    // 6. Transacción atómica en Prisma:
    //    Crear Comprobante -> Registrar Pago(s) -> Cerrar Pedido -> Liberar Mesa y Mesas Unidas
    const transaction = await prisma.$transaction(async (tx) => {
      // A. Registrar Comprobante de Venta
      const comprobante = await tx.comprobante_venta.create({
        data: {
          id_pedido: order.id_pedido,
          id_cliente: customerId,
          tipo_comprobante: docType,
          serie,
          numero: sequentialNumber,
          subtotal: taxableSubtotal,
          igv: calculatedIgv,
          monto_total: roundedTotal,
          estado: "Emitido",
          fecha_emision: new Date()
        }
      });

      // B. Registrar Pago(s) de Venta
      if (isSplitPayment) {
        for (const p of paymentsList) {
          await tx.pago_venta.create({
            data: {
              id_comprobante_venta: comprobante.id_comprobante_venta,
              id_tipo_pago: p.id_tipo_pago,
              monto: p.monto,
              fecha_pago: new Date()
            }
          });
        }
      } else {
        await tx.pago_venta.create({
          data: {
            id_comprobante_venta: comprobante.id_comprobante_venta,
            id_tipo_pago: paymentType!.id_tipo_pago,
            monto: roundedTotal,
            fecha_pago: new Date()
          }
        });
      }

      // C. Actualizar estado del pedido a Cerrado
      await tx.pedido.update({
        where: { id_pedido: order.id_pedido },
        data: { estado: "Cerrado" }
      });

      // D. Liberar la mesa y mesas unidas si el pedido estuvo en mesa
      if (order.pedidos_mesa.length > 0) {
        for (const pm of order.pedidos_mesa) {
          await tx.mesa.update({
            where: { id_mesa: pm.id_mesa },
            data: { estado: true } // Disponible / Libre
          });

          // Liberar mesas unidas si existen en la observación
          if (pm.observacion) {
            const match = pm.observacion.match(/\[Mesas unidas:\s*([0-9,\s]+)\]/i);
            if (match && match[1]) {
              const tableNumbers = match[1]
                .split(",")
                .map((n) => Number(n.trim()))
                .filter((n) => !Number.isNaN(n));
              if (tableNumbers.length > 0) {
                await tx.mesa.updateMany({
                  where: { numero: { in: tableNumbers } },
                  data: { estado: true }
                });
              }
            }
          }
        }
      }

      return { comprobante };
    });

    const associatedTable = order.pedidos_mesa[0]?.mesa ?? null;
    const change = monto_recibido ? Math.max(0, Math.round((monto_recibido - roundedTotal) * 100) / 100) : 0;

    const paymentMethodName = isSplitPayment
      ? `Pago en Partes (${paymentsList.map((p) => `${p.nombre}: S/ ${p.monto.toFixed(2)}`).join(" + ")})`
      : (paymentType?.nombre ?? "Efectivo");

    return Response.json(
      {
        mensaje: "Venta registrada, pedido cerrado y mesa liberada con éxito.",
        comprobante: {
          id: transaction.comprobante.id_comprobante_venta,
          tipo: docType,
          serie,
          numero: sequentialNumber,
          codigoCompleto: `${serie}-${String(sequentialNumber).padStart(6, "0")}`,
          fecha: transaction.comprobante.fecha_emision.toISOString(),
          subtotal: taxableSubtotal,
          igv: calculatedIgv,
          total: roundedTotal,
          metodoPago: paymentMethodName,
          montoRecibido: monto_recibido ?? roundedTotal,
          vuelto: change,
          cliente: {
            nombre: customerName,
            nroDoc: customerDoc,
            tipoPersona
          },
          origen: associatedTable ? `Mesa ${associatedTable.numero}` : "Pedido Para Llevar",
          items: order.detalles_pedido.map((d) => ({
            nombre: d.plato.nombre,
            cantidad: d.cantidad,
            precioUnitario: Number(d.precio_unitario),
            subTotal: Number(d.sub_total),
            observaciones: d.observaciones ?? ""
          })),
          // Metadata de pasarela preparada para Mercado Pago Point / Tap to Pay
          pasarela: pasarela ? {
            proveedor: pasarela.proveedor || "mercado_pago",
            modo: pasarela.modo || "tap_to_pay",
            estado: "completado"
          } : null
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/sales] Error al registrar venta:", error);
    return Response.json(
      { error: "No se pudo completar el cobro y cierre de la venta." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("fecha"); // "hoy", YYYY-MM-DD o "todas"

    const whereClause: any = {};

    if (dateParam && dateParam !== "todas") {
      let baseDate: Date;
      if (dateParam === "hoy") {
        baseDate = new Date();
      } else {
        baseDate = new Date(dateParam);
      }

      // Rango de inicio a fin del día
      const startDate = new Date(baseDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(baseDate);
      endDate.setHours(23, 59, 59, 999);

      whereClause.created_at = {
        gte: startDate,
        lte: endDate,
      };
    }

    const vouchers = await prisma.comprobante_venta.findMany({
      where: whereClause,
      include: {
        cliente: true,
        pagos_venta: {
          include: {
            tipo_pago: true,
          },
        },
        pedido: {
          include: {
            pedidos_mesa: {
              include: {
                mesa: true,
              },
            },
            detalles_pedido: {
              include: {
                plato: true,
              },
            },
          },
        },
      },
      orderBy: { id_comprobante_venta: "desc" },
      take: 150,
    });

    const formattedList = vouchers.map((c) => {
      const customerName = c.cliente
        ? `${c.cliente.nombre}${c.cliente.apellido ? " " + c.cliente.apellido : ""}`.trim()
        : "CLIENTE GENERAL";
      const associatedTable = c.pedido?.pedidos_mesa[0]?.mesa;
      const metodo = c.pagos_venta[0]?.tipo_pago?.nombre || "Efectivo";

      return {
        id: c.id_comprobante_venta,
        idPedido: c.id_pedido,
        tipo: c.tipo_comprobante as "Boleta" | "Factura" | "Ticket",
        serie: c.serie,
        numero: c.numero,
        codigoCompleto: `${c.serie}-${String(c.numero).padStart(6, "0")}`,
        fecha: c.created_at.toISOString(),
        subtotal: Number(c.subtotal),
        igv: Number(c.igv),
        total: Number(c.monto_total),
        estado: c.estado,
        metodoPago: metodo,
        montoRecibido: Number(c.monto_total),
        vuelto: 0,
        cliente: {
          id: c.cliente?.id_cliente,
          nombre: customerName,
          nroDoc: c.cliente?.nro_doc || "00000000",
          tipoPersona: c.cliente?.tipo_persona || "Natural",
        },
        origen: associatedTable ? `Mesa ${associatedTable.numero}` : "Pedido Para Llevar",
        items:
          c.pedido?.detalles_pedido.map((d) => ({
            nombre: d.plato.nombre,
            cantidad: d.cantidad,
            precioUnitario: Number(d.precio_unitario),
            subTotal: Number(d.sub_total),
            observaciones: d.observaciones || "",
          })) || [],
      };
    });

    const resumenDiario = calculateDailySalesSummary(
      formattedList.map((v) => ({
        monto_total: v.total,
        metodo_pago: v.metodoPago,
        tipo_comprobante: v.tipo,
        fecha_emision: v.fecha,
      }))
    );

    return Response.json({
      data: formattedList,
      resumenDiario,
    });
  } catch (error) {
    console.error("[api/sales] Error al listar comprobantes y ventas:", error);
    return Response.json(
      { error: "No se pudieron obtener las ventas registradas." },
      { status: 500 }
    );
  }
}
