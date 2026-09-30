import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularResumenVentasDiarias } from "@/lib/utils/ventas-helpers";

export const dynamic = "force-dynamic";

interface PagoDivididoInput {
  id_tipo_pago: number;
  monto: number;
}

interface RegistrarVentaInput {
  id_pedido: number;
  id_tipo_pago?: number;
  pagos?: PagoDivididoInput[];
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
    const cuerpo = (await request.json().catch(() => null)) as RegistrarVentaInput | null;
    if (!cuerpo || typeof cuerpo !== "object") {
      return Response.json({ error: "Datos de venta no válidos." }, { status: 400 });
    }

    const { id_pedido, id_tipo_pago, tipo_comprobante, cliente, monto_recibido, pasarela } = cuerpo;

    if (!id_pedido || Number.isNaN(Number(id_pedido))) {
      return Response.json({ error: "ID de pedido inválido." }, { status: 400 });
    }

    const esPagoDividido = Array.isArray(cuerpo.pagos) && cuerpo.pagos.length > 0;

    if (!esPagoDividido && (!id_tipo_pago || Number.isNaN(Number(id_tipo_pago)))) {
      return Response.json({ error: "Debe seleccionar un método de pago válido." }, { status: 400 });
    }

    // 1. Validar existencia del método o métodos de pago
    let tipoPago: { id_tipo_pago: number; nombre: string; estado: boolean } | null = null;
    const listaPagos: Array<{ id_tipo_pago: number; monto: number; nombre: string }> = [];

    if (esPagoDividido) {
      const tiposDb = await prisma.tipo_pago.findMany({ where: { estado: true } });
      const mapaTipos = new Map(tiposDb.map((t) => [t.id_tipo_pago, t]));
      for (const p of cuerpo.pagos!) {
        const idTP = Number(p.id_tipo_pago);
        const montoNum = Math.round(Number(p.monto) * 100) / 100;
        const tp = mapaTipos.get(idTP);
        if (!tp) {
          return Response.json({ error: `El método de pago con ID ${idTP} no está disponible.` }, { status: 400 });
        }
        if (montoNum <= 0) {
          return Response.json({ error: "El monto de cada pago parcial debe ser mayor a 0." }, { status: 400 });
        }
        listaPagos.push({ id_tipo_pago: idTP, monto: montoNum, nombre: tp.nombre });
      }
    } else {
      tipoPago = await prisma.tipo_pago.findUnique({
        where: { id_tipo_pago: Number(id_tipo_pago) }
      });
      if (!tipoPago || !tipoPago.estado) {
        return Response.json({ error: "El método de pago no está disponible." }, { status: 400 });
      }
    }

    // 2. Validar que el pedido exista, esté pendiente de cobro y tenga ítems
    const pedido = await prisma.pedido.findUnique({
      where: { id_pedido: Number(id_pedido) },
      include: {
        pedidos_mesa: { include: { mesa: true } },
        detalles_pedido: { include: { plato: true } }
      }
    });

    if (!pedido) {
      return Response.json({ error: "El pedido a cobrar no existe." }, { status: 404 });
    }

    if (pedido.estado === "Cerrado") {
      return Response.json(
        { error: "Operación inválida: El pedido ya fue cobrado y cerrado anteriormente." },
        { status: 400 }
      );
    }

    if (pedido.estado === "Cancelado") {
      return Response.json(
        { error: "Operación rechazada: Un pedido cancelado no puede convertirse en una venta ni generar cobro." },
        { status: 400 }
      );
    }

    if (pedido.detalles_pedido.length === 0) {
      return Response.json(
        { error: "El pedido no contiene ítems para ser cobrado." },
        { status: 400 }
      );
    }

    // 3. Cálculos de importes oficiales basados en BD
    const totalVenta = pedido.detalles_pedido.reduce(
      (sum, item) => sum + Number(item.sub_total),
      0
    );
    const totalRedondeado = Math.round(totalVenta * 100) / 100;

    // En Perú, precios de carta ya incluyen IGV (18%)
    const subtotalGravado = Math.round((totalRedondeado / 1.18) * 100) / 100;
    const igvCalculado = Math.round((totalRedondeado - subtotalGravado) * 100) / 100;

    // Validación de total en pagos divididos
    if (esPagoDividido) {
      const sumaPagos = Math.round(listaPagos.reduce((s, p) => s + p.monto, 0) * 100) / 100;
      if (Math.abs(sumaPagos - totalRedondeado) > 0.05) {
        return Response.json(
          { error: `La suma de las partes de pago (S/ ${sumaPagos.toFixed(2)}) no coincide con el total de la cuenta (S/ ${totalRedondeado.toFixed(2)}).` },
          { status: 400 }
        );
      }
    } else {
      // Validación de efectivo entregado para pago único
      if (tipoPago && tipoPago.nombre.toLowerCase().includes("efectivo") && monto_recibido) {
        if (monto_recibido < totalRedondeado) {
          return Response.json(
            { error: `El monto entregado (S/ ${monto_recibido.toFixed(2)}) es menor al total a cobrar (S/ ${totalRedondeado.toFixed(2)}).` },
            { status: 400 }
          );
        }
      }
    }

    // 4. Determinar o registrar cliente
    let idCliente: number;
    const docCliente = cliente?.nro_doc?.trim() || "00000000";
    const nombreCliente = cliente?.nombre?.trim() || "CLIENTE GENERAL";
    const tipoPersona = cliente?.tipo_persona ?? (docCliente.length === 11 ? "Juridico" : "Natural");

    const clienteExistente = await prisma.cliente.findFirst({
      where: { nro_doc: docCliente, tipo_persona: tipoPersona }
    });

    if (clienteExistente) {
      idCliente = clienteExistente.id_cliente;
    } else {
      const nuevoCliente = await prisma.cliente.create({
        data: {
          nro_doc: docCliente,
          nombre: nombreCliente,
          tipo_persona: tipoPersona,
          telefono: cliente?.telefono?.trim() || null,
          estado: true
        }
      });
      idCliente = nuevoCliente.id_cliente;
    }

    // 5. Determinar serie y correlativo del comprobante
    const tipoDoc = tipo_comprobante === "Factura" ? "Factura" : tipo_comprobante === "Boleta" ? "Boleta" : "Boleta";
    const serie = tipoDoc === "Factura" ? "F001" : "B001";

    const ultimoComprobante = await prisma.comprobante_venta.findFirst({
      where: { tipo_comprobante: tipoDoc, serie },
      orderBy: { numero: "desc" }
    });
    const correlativo = (ultimoComprobante?.numero ?? 0) + 1;

    // 6. Transacción atómica en Prisma:
    //    Crear Comprobante -> Registrar Pago(s) -> Cerrar Pedido -> Liberar Mesa y Mesas Unidas
    const transaccion = await prisma.$transaction(async (tx) => {
      // A. Registrar Comprobante de Venta
      const comprobante = await tx.comprobante_venta.create({
        data: {
          id_pedido: pedido.id_pedido,
          id_cliente: idCliente,
          tipo_comprobante: tipoDoc,
          serie,
          numero: correlativo,
          subtotal: subtotalGravado,
          igv: igvCalculado,
          monto_total: totalRedondeado,
          estado: "Emitido",
          fecha_emision: new Date()
        }
      });

      // B. Registrar Pago(s) de Venta
      if (esPagoDividido) {
        for (const p of listaPagos) {
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
            id_tipo_pago: tipoPago!.id_tipo_pago,
            monto: totalRedondeado,
            fecha_pago: new Date()
          }
        });
      }

      // C. Actualizar estado del pedido a Cerrado
      await tx.pedido.update({
        where: { id_pedido: pedido.id_pedido },
        data: { estado: "Cerrado" }
      });

      // D. Liberar la mesa y mesas unidas si el pedido estuvo en mesa
      if (pedido.pedidos_mesa.length > 0) {
        for (const pm of pedido.pedidos_mesa) {
          await tx.mesa.update({
            where: { id_mesa: pm.id_mesa },
            data: { estado: true } // Disponible / Libre
          });

          // Liberar mesas unidas si existen en la observación
          if (pm.observacion) {
            const match = pm.observacion.match(/\[Mesas unidas:\s*([0-9,\s]+)\]/i);
            if (match && match[1]) {
              const numMesas = match[1]
                .split(",")
                .map((n) => Number(n.trim()))
                .filter((n) => !Number.isNaN(n));
              if (numMesas.length > 0) {
                await tx.mesa.updateMany({
                  where: { numero: { in: numMesas } },
                  data: { estado: true }
                });
              }
            }
          }
        }
      }

      return { comprobante };
    });

    const mesaAsociada = pedido.pedidos_mesa[0]?.mesa ?? null;
    const vuelto = monto_recibido ? Math.max(0, Math.round((monto_recibido - totalRedondeado) * 100) / 100) : 0;

    const metodoPagoNombre = esPagoDividido
      ? `Pago en Partes (${listaPagos.map((p) => `${p.nombre}: S/ ${p.monto.toFixed(2)}`).join(" + ")})`
      : (tipoPago?.nombre ?? "Efectivo");

    return Response.json(
      {
        mensaje: "Venta registrada, pedido cerrado y mesa liberada con éxito.",
        comprobante: {
          id: transaccion.comprobante.id_comprobante_venta,
          tipo: tipoDoc,
          serie,
          numero: correlativo,
          codigoCompleto: `${serie}-${String(correlativo).padStart(6, "0")}`,
          fecha: transaccion.comprobante.fecha_emision.toISOString(),
          subtotal: subtotalGravado,
          igv: igvCalculado,
          total: totalRedondeado,
          metodoPago: metodoPagoNombre,
          montoRecibido: monto_recibido ?? totalRedondeado,
          vuelto,
          cliente: {
            nombre: nombreCliente,
            nroDoc: docCliente,
            tipoPersona
          },
          origen: mesaAsociada ? `Mesa ${mesaAsociada.numero}` : "Pedido Para Llevar",
          items: pedido.detalles_pedido.map((d) => ({
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
    console.error("[api/ventas] Error al registrar venta:", error);
    return Response.json(
      { error: "No se pudo completar el cobro y cierre de la venta." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fechaParam = searchParams.get("fecha"); // "hoy", YYYY-MM-DD o "todas"

    const whereClause: any = {};

    if (fechaParam && fechaParam !== "todas") {
      let baseDate: Date;
      if (fechaParam === "hoy") {
        baseDate = new Date();
      } else {
        baseDate = new Date(fechaParam);
      }

      // Rango de inicio a fin del día
      const fechaInicio = new Date(baseDate);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(baseDate);
      fechaFin.setHours(23, 59, 59, 999);

      whereClause.created_at = {
        gte: fechaInicio,
        lte: fechaFin,
      };
    }

    const comprobantes = await prisma.comprobante_venta.findMany({
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

    const listaFormateada = comprobantes.map((c) => {
      const nombreCliente = c.cliente
        ? `${c.cliente.nombre}${c.cliente.apellido ? " " + c.cliente.apellido : ""}`.trim()
        : "CLIENTE GENERAL";
      const mesaAsociada = c.pedido?.pedidos_mesa[0]?.mesa;
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
          nombre: nombreCliente,
          nroDoc: c.cliente?.nro_doc || "00000000",
          tipoPersona: c.cliente?.tipo_persona || "Natural",
        },
        origen: mesaAsociada ? `Mesa ${mesaAsociada.numero}` : "Pedido Para Llevar",
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

    const resumenDiario = calcularResumenVentasDiarias(
      listaFormateada.map((v) => ({
        monto_total: v.total,
        metodo_pago: v.metodoPago,
        tipo_comprobante: v.tipo,
        fecha_emision: v.fecha,
      }))
    );

    return Response.json({
      data: listaFormateada,
      resumenDiario,
    });
  } catch (error) {
    console.error("[api/ventas] Error al listar comprobantes y ventas:", error);
    return Response.json(
      { error: "No se pudieron obtener las ventas registradas." },
      { status: 500 }
    );
  }
}

