import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseDishStock } from "@/lib/services/redis-stock.service";

export const dynamic = "force-dynamic";

interface OrderItemInput {
  id_plato: number;
  cantidad: number;
  observaciones?: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      return Response.json({ error: "ID de pedido inválido." }, { status: 400 });
    }

    const order = await prisma.pedido.findUnique({
      where: { id_pedido: id },
      include: {
        pedidos_mesa: { include: { mesa: true } },
        detalles_pedido: {
          include: { plato: true },
          orderBy: { id_detalle_pedido: "asc" }
        }
      }
    });

    if (!order) {
      return Response.json({ error: "Pedido no encontrado." }, { status: 404 });
    }

    const pm = order.pedidos_mesa[0] ?? null;
    const items = order.detalles_pedido.map((d) => ({
      idDetalle: d.id_detalle_pedido,
      idPlato: d.id_plato,
      nombre: d.plato.nombre,
      cantidad: d.cantidad,
      precioUnitario: Number(d.precio_unitario),
      subTotal: Number(d.sub_total),
      estadoPlato: d.estado_plato,
      observaciones: d.observaciones ?? ""
    }));
    const total = items.reduce((acc, it) => acc + it.subTotal, 0);

    return Response.json({
      id: order.id_pedido,
      codigo: order.codigo,
      tipoPedido: order.tipo_pedido,
      fecha: order.fecha_pedido.toISOString(),
      estado: order.estado,
      mesa: pm ? { id: pm.mesa.id_mesa, numero: pm.mesa.numero } : null,
      observacion: pm?.observacion ?? "",
      items,
      total,
      editable: order.estado !== "Servido" && order.estado !== "Cerrado"
    });
  } catch (error) {
    console.error("[api/orders/[id]] Error al obtener pedido:", error);
    return Response.json({ error: "No se pudo obtener el pedido." }, { status: 500 });
  }
}

// Edición de pedido (agregar, modificar cantidades, modificar observaciones, eliminar)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      return Response.json({ error: "ID de pedido inválido." }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Datos de edición no válidos." }, { status: 400 });
    }

    const items = Array.isArray(body.items) ? (body.items as OrderItemInput[]) : [];
    if (items.length === 0) {
      return Response.json({ error: "El pedido debe contener al menos un producto." }, { status: 400 });
    }

    // 1. Verificar estado actual del pedido en la base de datos
    const existingOrder = await prisma.pedido.findUnique({
      where: { id_pedido: id },
      include: { pedidos_mesa: true }
    });

    if (!existingOrder) {
      return Response.json({ error: "El pedido no existe." }, { status: 404 });
    }

    // Regla de Negocio Crítica: El pedido NO puede editarse si ya fue Servido o Cerrado
    if (existingOrder.estado === "Servido") {
      return Response.json(
        { error: "Operación rechazada: No se puede editar un pedido que ya ha sido servido." },
        { status: 400 }
      );
    }
    if (existingOrder.estado === "Cerrado" || existingOrder.estado === "Cancelado") {
      return Response.json(
        { error: "Operación rechazada: El pedido ya se encuentra cerrado o cancelado." },
        { status: 400 }
      );
    }

    // 2. Validar que los platos existan y estén activos
    const dishIds = items.map((it) => Number(it.id_plato));
    const dishesDb = await prisma.plato.findMany({
      where: { id_plato: { in: dishIds }, estado: true }
    });
    const dishesMap = new Map(dishesDb.map((pl) => [pl.id_plato, pl]));

    for (const item of items) {
      if (!dishesMap.has(Number(item.id_plato))) {
        return Response.json({ error: `El producto con ID ${item.id_plato} no es válido.` }, { status: 400 });
      }
      if (!item.cantidad || item.cantidad < 1) {
        return Response.json({ error: "La cantidad de cada producto debe ser mayor a 0." }, { status: 400 });
      }
    }

    // 3. Ejecutar actualización transaccional
    await prisma.$transaction(async (tx) => {
      // Eliminar detalles previos del pedido
      await tx.detalle_pedido.deleteMany({
        where: { id_pedido: id }
      });

      // Insertar nuevos detalles actualizados
      for (const item of items) {
        const plato = dishesMap.get(Number(item.id_plato))!;
        const precioUnitario = Number(plato.precio);
        const subTotal = Math.round(precioUnitario * item.cantidad * 100) / 100;

        await tx.detalle_pedido.create({
          data: {
            id_pedido: id,
            id_plato: plato.id_plato,
            cantidad: Math.floor(item.cantidad),
            precio_unitario: precioUnitario,
            sub_total: subTotal,
            estado_plato: existingOrder.estado,
            observaciones: item.observaciones ? item.observaciones.trim().slice(0, 100) : null
          }
        });
      }

      // Si se proporcionó nueva observación general de la mesa
      if (typeof body.observacion === "string" && existingOrder.pedidos_mesa.length > 0) {
        await tx.pedido_mesa.updateMany({
          where: { id_pedido: id },
          data: { observacion: body.observacion.trim().slice(0, 100) }
        });
      }
    });

    return Response.json({ mensaje: "Pedido actualizado exitosamente." });
  } catch (error) {
    console.error("[api/orders/[id]] Error al editar pedido:", error);
    return Response.json({ error: "No se pudo actualizar el pedido." }, { status: 500 });
  }
}

// Transición de estado del pedido (Recibido -> Preparando -> Servido)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      return Response.json({ error: "ID de pedido inválido." }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const newStatus = body?.estado;

    const validStatuses = ["Recibido", "Preparando", "Servido", "Cancelado"];
    if (!validStatuses.includes(newStatus)) {
      return Response.json(
        { error: `Estado inválido. Los estados permitidos son: ${validStatuses.join(", ")}.` },
        { status: 400 }
      );
    }

    const order = await prisma.pedido.findUnique({
      where: { id_pedido: id },
      include: { pedidos_mesa: true }
    });
    if (!order) {
      return Response.json({ error: "Pedido no encontrado." }, { status: 404 });
    }

    if (order.estado === "Cerrado") {
      return Response.json({ error: "No se puede alterar el estado de un pedido ya cerrado." }, { status: 400 });
    }

    if (newStatus === "Cancelado") {
      if (order.estado === "Cancelado") {
        return Response.json({ error: "El pedido ya se encuentra cancelado." }, { status: 400 });
      }
      const motivo = typeof body?.motivo === "string" ? body.motivo.trim() : "";
      if (!motivo) {
        return Response.json({ error: "Debe indicar el motivo de la cancelación." }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.pedido.update({
        where: { id_pedido: id },
        data: { estado: newStatus }
      });

      // Si pasa a Servido, actualizar el estado de los platos
      if (newStatus === "Servido") {
        await tx.detalle_pedido.updateMany({
          where: { id_pedido: id },
          data: { estado_plato: "Servido" }
        });
      }

      // Si el pedido se cancela, liberar mesas asociadas y devolver stock
      if (newStatus === "Cancelado" && order.estado !== "Cancelado") {
        const usuario = typeof body?.usuario === "string" && body.usuario.trim() ? body.usuario.trim() : "Personal";
        const motivo = typeof body?.motivo === "string" ? body.motivo.trim() : "Cancelado";
        const tagCancelado = `[CANCELADO por ${usuario}: ${motivo}]`;

        // 1. Liberar mesas y registrar auditoría en pedido_mesa
        for (const pm of order.pedidos_mesa) {
          // Liberar mesa principal
          await tx.mesa.update({
            where: { id_mesa: pm.id_mesa },
            data: { estado: true }
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

          // Actualizar observación con motivo y responsable de la cancelación
          const currentNote = pm.observacion || "";
          const newNote = `${currentNote.slice(0, 45)} ${tagCancelado}`.trim().slice(0, 100);
          await tx.pedido_mesa.update({
            where: { id_pedido_mesa: pm.id_pedido_mesa },
            data: { observacion: newNote }
          });
        }

        // 2. Liberar el stock reservado en Redis
        const details = await tx.detalle_pedido.findMany({
          where: { id_pedido: id }
        });
        for (const d of details) {
          await releaseDishStock(d.id_plato, d.cantidad).catch(() => {});
        }
      }
    });

    return Response.json({ mensaje: `Estado del pedido actualizado a ${newStatus}.` });
  } catch (error) {
    console.error("[api/orders/[id]/status] Error al actualizar estado:", error);
    return Response.json({ error: "No se pudo actualizar el estado del pedido." }, { status: 500 });
  }
}
