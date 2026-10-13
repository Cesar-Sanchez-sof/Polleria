import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBeverage } from "@/lib/utils/dish-category";

export const dynamic = "force-dynamic";

const CLOSED_STATUSES = ["Closed", "Cancelled"];

/**
 * @openapi
 * /api/orders/drinks:
 *   get:
 *     tags:
 *       - Drinks
 *     summary: Lista las bebidas de comandas activas organizadas por mesa
 *   patch:
 *     tags:
 *       - Drinks
 *     summary: Cambia el estado de entrega de una bebida (Pending / Delivered)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filterStatus = searchParams.get("status"); // "Pending" | "Delivered" | "all"
    const tableParam = searchParams.get("table");

    const activeOrders = await prisma.salesOrder.findMany({
      where: {
        status: { notIn: CLOSED_STATUSES },
      },
      orderBy: { id: "desc" },
      include: {
        tables: {
          include: { table: true },
        },
        items: {
          include: { dish: true },
          orderBy: { id: "asc" },
        },
      },
    });

    const drinksList: Array<{
      itemId: number;
      orderId: number;
      orderCode: string;
      orderType: string;
      tableId: number | null;
      tableNumber: number | null;
      tableName: string;
      orderedAt: string;
      dishId: number;
      name: string;
      quantity: number;
      notes: string;
      dishStatus: string;
      isDelivered: boolean;
      orderStatus: string;
    }> = [];

    for (const order of activeOrders) {
      const pm =
        order.tables.find((t) => !t.notes?.includes("[Anexa a Mesa")) ??
        order.tables[0] ??
        null;
      const tableNumber = pm?.table?.number ?? null;
      const tableName =
        order.orderType === "Llevar"
          ? `Para Llevar (${order.code})`
          : tableNumber !== null
          ? `Mesa ${tableNumber}`
          : "Sin Mesa";

      if (tableParam && String(tableNumber) !== tableParam && !tableName.includes(tableParam)) {
        continue;
      }

      for (const item of order.items) {
        if (isBeverage(item.dish.name, item.dish.description)) {
          const isDelivered = item.dishStatus === "Delivered" || item.dishStatus === "Served";

          if (filterStatus === "Pending" && isDelivered) continue;
          if (filterStatus === "Delivered" && !isDelivered) continue;

          drinksList.push({
            itemId: item.id,
            orderId: order.id,
            orderCode: order.code,
            orderType: order.orderType,
            tableId: pm?.table?.id ?? null,
            tableNumber,
            tableName,
            orderedAt: order.orderedAt.toISOString(),
            dishId: item.dishId,
            name: item.dish.name,
            quantity: item.quantity,
            notes: item.notes ?? "",
            dishStatus: item.dishStatus,
            isDelivered,
            orderStatus: order.status,
          });
        }
      }
    }

    // Métricas para el mozo
    const totalPending = drinksList.filter((d) => !d.isDelivered).length;
    const totalDelivered = drinksList.filter((d) => d.isDelivered).length;
    const activeTables = Array.from(new Set(drinksList.filter((d) => !d.isDelivered).map((d) => d.tableName))).length;

    return Response.json({
      data: drinksList,
      summary: {
        total: drinksList.length,
        totalPending,
        totalDelivered,
        activeTables,
      },
    });
  } catch (error) {
    console.error("[api/orders/drinks] Error al listar bebidas:", error);
    return Response.json(
      { error: "No se pudieron obtener las bebidas para despacho." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Datos de petición inválidos." }, { status: 400 });
    }

    const targetStatus = body.status === "Pending" ? "Pending" : "Delivered";

    // 1. Caso actualización de múltiples ítems
    if (Array.isArray(body.itemIds) && body.itemIds.length > 0) {
      const ids = body.itemIds.map((n: unknown) => Number(n)).filter((n: number) => !Number.isNaN(n));
      const res = await prisma.orderItem.updateMany({
        where: { id: { in: ids } },
        data: { dishStatus: targetStatus },
      });
      return Response.json({
        success: true,
        updatedCount: res.count,
        status: targetStatus,
        message: `${res.count} bebida(s) actualizadas a estado '${targetStatus}'.`,
      });
    }

    // 2. Caso actualización de todas las bebidas de una comanda
    if (body.orderId) {
      const orderId = Number(body.orderId);
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId },
        include: { dish: true },
      });

      const drinkItemIds = orderItems
        .filter((it) => isBeverage(it.dish.name, it.dish.description))
        .map((it) => it.id);

      if (drinkItemIds.length === 0) {
        return Response.json({ error: "La orden no cuenta con bebidas registradas." }, { status: 404 });
      }

      const res = await prisma.orderItem.updateMany({
        where: { id: { in: drinkItemIds } },
        data: { dishStatus: targetStatus },
      });

      return Response.json({
        success: true,
        updatedCount: res.count,
        status: targetStatus,
        message: `Todas las bebidas del pedido #${orderId} se marcaron como '${targetStatus}'.`,
      });
    }

    // 3. Caso actualización de un ítem individual
    const itemId = Number(body.itemId ?? body.id);
    if (!itemId || Number.isNaN(itemId)) {
      return Response.json({ error: "Se requiere un ID de ítem válido." }, { status: 400 });
    }

    const updated = await prisma.orderItem.update({
      where: { id: itemId },
      data: { dishStatus: targetStatus },
    });

    return Response.json({
      success: true,
      item: updated,
      status: targetStatus,
      message: `Bebida actualizada a estado '${targetStatus}'.`,
    });
  } catch (error) {
    console.error("[api/orders/drinks] Error al actualizar estado de bebida:", error);
    return Response.json(
      { error: "No se pudo actualizar el estado de la bebida." },
      { status: 500 }
    );
  }
}
