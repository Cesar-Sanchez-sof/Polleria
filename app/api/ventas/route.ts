import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface RegistrarVentaInput {
  id_pedido: number;
  id_tipo_pago: number;
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

    if (!id_tipo_pago || Number.isNaN(Number(id_tipo_pago))) {
      return Response.json({ error: "Debe seleccionar un método de pago válido." }, { status: 400 });
    }

    // 1. Validar existencia del método de pago
    const tipoPago = await prisma.tipo_pago.findUnique({
      where: { id_tipo_pago: Number(id_tipo_pago) }
    });
    if (!tipoPago || !tipoPago.estado) {
      return Response.json({ error: "El método de pago no está disponible." }, { status: 400 });
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

    // Validación de efectivo entregado
    if (tipoPago.nombre.toLowerCase().includes("efectivo") && monto_recibido) {
      if (monto_recibido < totalRedondeado) {
        return Response.json(
          { error: `El monto entregado (S/ ${monto_recibido.toFixed(2)}) es menor al total a cobrar (S/ ${totalRedondeado.toFixed(2)}).` },
          { status: 400 }
        );
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
    //    Crear Comprobante -> Registrar Pago -> Cerrar Pedido -> Liberar Mesa
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

      // B. Registrar Pago de Venta
      const pago = await tx.pago_venta.create({
        data: {
          id_comprobante_venta: comprobante.id_comprobante_venta,
          id_tipo_pago: tipoPago.id_tipo_pago,
          monto: totalRedondeado,
          fecha_pago: new Date()
        }
      });

      // C. Actualizar estado del pedido a Cerrado
      await tx.pedido.update({
        where: { id_pedido: pedido.id_pedido },
        data: { estado: "Cerrado" }
      });

      // D. Liberar la mesa si el pedido estuvo en mesa
      if (pedido.pedidos_mesa.length > 0) {
        for (const pm of pedido.pedidos_mesa) {
          await tx.mesa.update({
            where: { id_mesa: pm.id_mesa },
            data: { estado: true } // Disponible / Libre
          });
        }
      }

      return { comprobante, pago };
    });

    const mesaAsociada = pedido.pedidos_mesa[0]?.mesa ?? null;
    const vuelto = monto_recibido ? Math.max(0, Math.round((monto_recibido - totalRedondeado) * 100) / 100) : 0;

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
          metodoPago: tipoPago.nombre,
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
