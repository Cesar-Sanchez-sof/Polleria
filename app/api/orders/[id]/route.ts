import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseDishStock } from "@/lib/services/redis-stock.service";

export const dynamic = "force-dynamic";
/**
 * @openapi
 * /api/orders/{id}:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Obtener detalle de pedido por ID
 *   put:
 *     tags:
 *       - Orders
 *     summary: Actualizar pedido existente
 *   patch:
 *     tags:
 *       - Orders
 *     summary: Cambiar estado del pedido
 */

interface OrderItemInput {
  dishId?: number;
  id_plato?: number;
  quantity?: number;
  cantidad?: number;
  notes?: string;
  observaciones?: string;
}

function resolveDishId(item: OrderItemInput): number {
  return Number(item.dishId ?? item.id_plato);
}

function resolveQuantity(item: OrderItemInput): number {
  return Number(item.quantity ?? item.cantidad);
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

    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        tables: { include: { table: true } },
        items: {
          include: { dish: true },
          orderBy: { id: "asc" }
        }
      }
    });

    if (!order) {
      return Response.json({ error: "Pedido no encontrado." }, { status: 404 });
    }

    const pm = order.tables[0] ?? null;
    const items = order.items.map((d) => ({
      id: d.id,
      dishId: d.dishId,
      name: d.dish.name,
      quantity: d.quantity,
      unitPrice: Number(d.unitPrice),
      subtotal: Number(d.subtotal),
      dishStatus: d.dishStatus,
      notes: d.notes ?? ""
    }));
    const total = items.reduce((acc, it) => acc + it.subtotal, 0);

    return Response.json({
      id: order.id,
      code: order.code,
      orderType: order.orderType,
      orderedAt: order.orderedAt.toISOString(),
      status: order.status,
      table: pm ? { id: pm.table.id, number: pm.table.number } : null,
      notes: pm?.notes ?? "",
      items,
      total,
      editable: order.status !== "Served" && order.status !== "Closed"
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

    const existingOrder = await prisma.salesOrder.findUnique({
      where: { id },
      include: { tables: true }
    });

    if (!existingOrder) {
      return Response.json({ error: "El pedido no existe." }, { status: 404 });
    }

    if (existingOrder.status === "Served") {
      return Response.json(
        { error: "Operación rechazada: No se puede editar un pedido que ya ha sido servido." },
        { status: 400 }
      );
    }
    if (existingOrder.status === "Closed" || existingOrder.status === "Cancelled") {
      return Response.json(
        { error: "Operación rechazada: El pedido ya se encuentra cerrado o cancelado." },
        { status: 400 }
      );
    }

    const dishIds = items.map((it) => resolveDishId(it));
    const dishesDb = await prisma.dish.findMany({
      where: { id: { in: dishIds }, active: true }
    });
    const dishesMap = new Map(dishesDb.map((pl) => [pl.id, pl]));

    for (const item of items) {
      const dishId = resolveDishId(item);
      const quantity = resolveQuantity(item);
      if (!dishesMap.has(dishId)) {
        return Response.json({ error: `El producto con ID ${dishId} no es válido.` }, { status: 400 });
      }
      if (!quantity || quantity < 1) {
        return Response.json({ error: "La cantidad de cada producto debe ser mayor a 0." }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({
        where: { orderId: id }
      });

      for (const item of items) {
        const dish = dishesMap.get(resolveDishId(item))!;
        const quantity = Math.floor(resolveQuantity(item));
        const unitPrice = Number(dish.price);
        const subtotal = Math.round(unitPrice * quantity * 100) / 100;
        const itemNotes = item.notes ?? item.observaciones;

        await tx.orderItem.create({
          data: {
            orderId: id,
            dishId: dish.id,
            quantity,
            unitPrice,
            subtotal,
            dishStatus: existingOrder.status,
            notes: itemNotes ? itemNotes.trim().slice(0, 100) : null
          }
        });
      }

      const notes = body.notes ?? body.observacion;
      if (typeof notes === "string" && existingOrder.tables.length > 0) {
        await tx.orderTable.updateMany({
          where: { orderId: id },
          data: { notes: notes.trim().slice(0, 100) }
        });
      }
    });

    return Response.json({ message: "Pedido actualizado exitosamente." });
  } catch (error) {
    console.error("[api/orders/[id]] Error al editar pedido:", error);
    return Response.json({ error: "No se pudo actualizar el pedido." }, { status: 500 });
  }
}

// Transición de estado del pedido (Received -> Preparing -> Served)
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
    const rawStatus = body?.status ?? body?.estado;

    // Map Spanish aliases → English status values
    const statusAliases: Record<string, string> = {
      Recibido: "Received",
      Preparando: "Preparing",
      Servido: "Served",
      Cancelado: "Cancelled",
      Received: "Received",
      Preparing: "Preparing",
      Served: "Served",
      Cancelled: "Cancelled",
    };
    const newStatus = statusAliases[rawStatus] ?? rawStatus;

    const validStatuses = ["Received", "Preparing", "Served", "Cancelled"];
    if (!validStatuses.includes(newStatus)) {
      return Response.json(
        { error: `Estado inválido. Los estados permitidos son: ${validStatuses.join(", ")}.` },
        { status: 400 }
      );
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: { tables: true }
    });
    if (!order) {
      return Response.json({ error: "Pedido no encontrado." }, { status: 404 });
    }

    if (order.status === "Closed") {
      return Response.json({ error: "No se puede alterar el estado de un pedido ya cerrado." }, { status: 400 });
    }

    if (newStatus === "Cancelled") {
      if (order.status === "Cancelled") {
        return Response.json({ error: "El pedido ya se encuentra cancelado." }, { status: 400 });
      }
      const reason = typeof (body?.reason ?? body?.motivo) === "string"
        ? String(body?.reason ?? body?.motivo).trim()
        : "";
      if (!reason) {
        return Response.json({ error: "Debe indicar el motivo de la cancelación." }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id },
        data: { status: newStatus }
      });

      if (newStatus === "Served") {
        await tx.orderItem.updateMany({
          where: { orderId: id },
          data: { dishStatus: "Served" }
        });
      }

      if (newStatus === "Cancelled" && order.status !== "Cancelled") {
        const user =
          typeof (body?.user ?? body?.usuario) === "string" && String(body?.user ?? body?.usuario).trim()
            ? String(body?.user ?? body?.usuario).trim()
            : "Personal";
        const reason = typeof (body?.reason ?? body?.motivo) === "string"
          ? String(body?.reason ?? body?.motivo).trim()
          : "Cancelled";
        const cancelTag = `[CANCELADO por ${user}: ${reason}]`;

        for (const pm of order.tables) {
          await tx.diningTable.update({
            where: { id: pm.tableId },
            data: { active: true }
          });

          if (pm.notes) {
            const match = pm.notes.match(/\[Mesas unidas:\s*([0-9,\s]+)\]/i);
            if (match && match[1]) {
              const tableNumbers = match[1]
                .split(",")
                .map((n) => Number(n.trim()))
                .filter((n) => !Number.isNaN(n));
              if (tableNumbers.length > 0) {
                await tx.diningTable.updateMany({
                  where: { number: { in: tableNumbers } },
                  data: { active: true }
                });
              }
            }
          }

          const currentNote = pm.notes || "";
          const newNote = `${currentNote.slice(0, 45)} ${cancelTag}`.trim().slice(0, 100);
          await tx.orderTable.update({
            where: { id: pm.id },
            data: { notes: newNote }
          });
        }

        const details = await tx.orderItem.findMany({
          where: { orderId: id }
        });
        for (const d of details) {
          await releaseDishStock(d.dishId, d.quantity).catch(() => {});
        }
      }
    });

    return Response.json({ message: `Estado del pedido actualizado a ${newStatus}.` });
  } catch (error) {
    console.error("[api/orders/[id]/status] Error al actualizar estado:", error);
    return Response.json({ error: "No se pudo actualizar el estado del pedido." }, { status: 500 });
  }
}
