import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
/**
 * @openapi
 * /api/tables:
 *   get:
 *     tags:
 *       - Tables
 *     summary: Listar mesas del salón
 */

const CLOSED_STATUSES = ["Closed", "Cancelled"];

export async function GET(_request: NextRequest) {
  try {
    const tablesDb = await prisma.diningTable.findMany({
      orderBy: { number: "asc" },
      include: {
        orders: {
          where: {
            order: {
              status: { notIn: CLOSED_STATUSES }
            }
          },
          include: {
            order: {
              include: {
                items: {
                  include: { dish: true },
                  orderBy: { id: "asc" }
                }
              }
            }
          }
        }
      }
    });

    const tables = tablesDb.map((m) => {
      // Si tiene pedido activo (no cerrado ni cancelado), la mesa está ocupada
      const activeTableOrder = m.orders[0] ?? null;
      const order = activeTableOrder?.order ?? null;

      let activeOrder = null;
      if (order) {
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

        const calculatedTotal = items.reduce((acc, it) => acc + it.subtotal, 0);

        activeOrder = {
          id: order.id,
          orderTableId: activeTableOrder.id,
          code: order.code,
          orderType: order.orderType,
          orderedAt: order.orderedAt.toISOString(),
          status: order.status, // "Received" | "Preparing" | "Served"
          tableNotes: activeTableOrder.notes ?? "",
          items,
          total: calculatedTotal,
          // La edición se permite siempre y cuando el pedido NO esté servido ni cerrado
          editable: order.status !== "Served" && order.status !== "Closed"
        };
      }

      return {
        id: m.id,
        number: m.number,
        capacity: m.capacity,
        occupied: Boolean(activeOrder),
        activeOrder
      };
    });

    const occupied = tables.filter((m) => m.occupied).length;
    const available = tables.length - occupied;

    return Response.json({
      data: tables,
      summary: {
        total: tables.length,
        available,
        occupied
      }
    });
  } catch (error) {
    console.error("[api/tables] Error al listar mesas:", error);
    return Response.json(
      { error: "No se pudo obtener la información de las mesas." },
      { status: 500 }
    );
  }
}
