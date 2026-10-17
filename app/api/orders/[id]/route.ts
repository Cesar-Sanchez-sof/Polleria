import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  deductProductStock,
  InsufficientStockError,
  restoreProductStock,
  totalsByProduct,
} from "@/lib/services/product-stock.service";
import { broadcastRealtimeEvent } from "@/lib/realtime/event-emitter";
import { authorize } from "@/lib/auth/permissions";

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

const CLOSED_STATUSES = ["Closed", "Cancelled"];

interface OrderItemInput {
  productId?: number;
  product_id?: number;
  quantity?: number;
  notes?: string;
  observations?: string;
}

function resolveProductId(item: OrderItemInput): number {
  return Number(item.productId ?? item.product_id);
}

function resolveQuantity(item: OrderItemInput): number {
  return Number(item.quantity);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize(["pedidos.ver", "cocina.ver", "ventas.ver"]);
  if (!auth.ok) return auth.response;
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
          include: { product: true },
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
      productId: d.productId,
      name: d.product.name,
      quantity: d.quantity,
      unitPrice: Number(d.unitPrice),
      subtotal: Number(d.subtotal),
      itemStatus: d.itemStatus,
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
      editable: !CLOSED_STATUSES.includes(order.status)
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
  const auth = await authorize(["pedidos.editar", "ventas.crear"]);
  if (!auth.ok) return auth.response;
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

    if (existingOrder.status === "Closed" || existingOrder.status === "Cancelled") {
      return Response.json(
        { error: "Operación rechazada: El pedido ya se encuentra cerrado o cancelado." },
        { status: 400 }
      );
    }

    const productIds = items.map((it) => resolveProductId(it));
    const productsDb = await prisma.product.findMany({
      where: { id: { in: productIds }, active: true, sellable: true }
    });
    const productsMap = new Map(productsDb.map((pl) => [pl.id, pl]));

    for (const item of items) {
      const productId = resolveProductId(item);
      const quantity = resolveQuantity(item);
      if (!productsMap.has(productId)) {
        return Response.json({ error: `El producto con ID ${productId} no es válido.` }, { status: 400 });
      }
      if (!quantity || quantity < 1) {
        return Response.json({ error: "La cantidad de cada producto debe ser mayor a 0." }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      // Si el pedido ya estaba Servido y se adicionan o modifican platos,
      // actualizamos el estado del pedido a Preparing para avisar a Cocina/Despacho
      let newOrderStatus = existingOrder.status;
      if (existingOrder.status === "Served" || existingOrder.status === "Ready") {
        newOrderStatus = "Preparing";
        await tx.salesOrder.update({
          where: { id },
          data: { status: newOrderStatus }
        });
      }

      // Stock: solo se mueve la diferencia entre lo que tenía el pedido y lo que queda.
      const previousItems = await tx.orderItem.findMany({
        where: { orderId: id },
        select: { productId: true, quantity: true }
      });
      const previousTotals = totalsByProduct(previousItems);
      const nextTotals = totalsByProduct(
        items.map((it) => ({ productId: resolveProductId(it), quantity: resolveQuantity(it) }))
      );

      await tx.orderItem.deleteMany({
        where: { orderId: id }
      });

      const createdItemByProduct = new Map<number, number>();
      for (const item of items) {
        const product = productsMap.get(resolveProductId(item))!;
        const quantity = Math.floor(resolveQuantity(item));
        const unitPrice = Number(product.price);
        const subtotal = Math.round(unitPrice * quantity * 100) / 100;
        const itemNotes = item.notes ?? item.observations;
        const itemStatus = (item as any).itemStatus;

        const createdItem = await tx.orderItem.create({
          data: {
            orderId: id,
            productId: product.id,
            quantity,
            unitPrice,
            subtotal,
            itemStatus: itemStatus || (existingOrder.status === "Served" || existingOrder.status === "Ready" ? "Pending" : existingOrder.status),
            notes: itemNotes ? itemNotes.trim().slice(0, 100) : null
          }
        });
        createdItemByProduct.set(product.id, createdItem.id);
      }

      for (const [productId, nextQty] of nextTotals) {
        const delta = nextQty - (previousTotals.get(productId) ?? 0);
        if (delta > 0) {
          await deductProductStock(
            tx,
            { productId, quantity: delta, orderItemId: createdItemByProduct.get(productId) },
            `Venta pedido ${existingOrder.code} (edición)`
          );
        } else if (delta < 0) {
          await restoreProductStock(tx, { productId, quantity: -delta }, `Devolución pedido ${existingOrder.code} (edición)`);
        }
      }
      for (const [productId, previousQty] of previousTotals) {
        if (!nextTotals.has(productId)) {
          await restoreProductStock(tx, { productId, quantity: previousQty }, `Devolución pedido ${existingOrder.code} (edición)`);
        }
      }

      const notes = body.notes ?? body.observation;
      if (typeof notes === "string" && existingOrder.tables.length > 0) {
        await tx.orderTable.updateMany({
          where: { orderId: id },
          data: { notes: notes.trim().slice(0, 100) }
        });
      }
    });

    return Response.json({ message: "Pedido actualizado exitosamente." });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("[api/orders/[id]] Error al editar pedido:", error);
    return Response.json({ error: "No se pudo actualizar el pedido." }, { status: 500 });
  }
}

// Transición de estado del pedido (Received -> Preparing -> Ready -> Served)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize(["pedidos.editar", "cocina.editar", "ventas.crear"]);
  if (!auth.ok) return auth.response;
  try {
    const { id: idParam } = await params;
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      return Response.json({ error: "ID de pedido inválido." }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const rawStatus = body?.status;

    // Map Spanish aliases → English status values
    const statusAliases: Record<string, string> = {
      Recibido: "Received",
      Preparando: "Preparing",
      "Listo para servir": "Ready",
      Listo: "Ready",
      Servido: "Served",
      Cancelado: "Cancelled",
      Received: "Received",
      Preparing: "Preparing",
      Ready: "Ready",
      Served: "Served",
      Cancelled: "Cancelled",
    };
    const newStatus = statusAliases[rawStatus] ?? rawStatus;

    const validStatuses = ["Received", "Preparing", "Ready", "Served", "Cancelled"];
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
      const reason = typeof (body?.reason) === "string"
        ? String(body?.reason).trim()
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
          data: { itemStatus: "Served" }
        });
      }

      if (newStatus === "Cancelled" && order.status !== "Cancelled") {
        const user =
          typeof (body?.user) === "string" && String(body?.user).trim()
            ? String(body?.user).trim()
            : "Personal";
        const reason = typeof (body?.reason) === "string"
          ? String(body?.reason).trim()
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
          await restoreProductStock(
            tx,
            { productId: d.productId, quantity: d.quantity },
            `Devolución por cancelación del pedido ${order.code}`
          );
        }
      }
    });

    try {
      broadcastRealtimeEvent("ORDER_STATUS_CHANGED", {
        orderId: id,
        newStatus,
        previousStatus: order.status,
      });

      if (newStatus === "Cancelled" || newStatus === "Ready" || newStatus === "Served") {
        broadcastRealtimeEvent("TABLE_UPDATED", {
          orderId: id,
          reason: newStatus,
        });
      }
    } catch (rtErr) {
      console.warn("[api/orders/[id]] Advertencia al emitir evento en tiempo real:", rtErr);
    }

    return Response.json({ message: `Estado del pedido actualizado a ${newStatus}.` });
  } catch (error) {
    console.error("[api/orders/[id]/status] Error al actualizar estado:", error);
    return Response.json({ error: "No se pudo actualizar el estado del pedido." }, { status: 500 });
  }
}
