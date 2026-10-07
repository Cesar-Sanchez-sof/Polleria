import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { reserveOrderStock, releaseDishStock } from "@/lib/services/redis-stock.service";

export const dynamic = "force-dynamic";
/**
 * @openapi
 * /api/orders:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Listar pedidos
 *   post:
 *     tags:
 *       - Orders
 *     summary: Crear un nuevo pedido
 */

interface OrderItemInput {
  dishId?: number;
  id_plato?: number;
  quantity?: number;
  cantidad?: number;
  notes?: string;
  observaciones?: string;
}

const CLOSED_STATUSES = ["Closed", "Cancelled"];

function resolveDishId(item: OrderItemInput): number {
  return Number(item.dishId ?? item.id_plato);
}

function resolveQuantity(item: OrderItemInput): number {
  return Number(item.quantity ?? item.cantidad);
}

function mapOrderResponse(p: {
  id: number;
  code: string;
  orderType: string;
  orderedAt: Date;
  status: string;
  tables: Array<{
    notes: string | null;
    table: { id: number; number: number };
  }>;
  items: Array<{
    id: number;
    dishId: number;
    quantity: number;
    unitPrice: { toString(): string } | number;
    subtotal: { toString(): string } | number;
    dishStatus: string;
    notes: string | null;
    dish: { name: string };
  }>;
}) {
  const pm = p.tables[0] ?? null;
  const items = p.items.map((d) => ({
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

  return {
    id: p.id,
    code: p.code,
    orderType: p.orderType,
    orderedAt: p.orderedAt.toISOString(),
    status: p.status,
    table: pm ? { id: pm.table.id, number: pm.table.number } : null,
    notes: pm?.notes ?? "",
    items,
    total,
    editable: !CLOSED_STATUSES.includes(p.status)
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orderType = searchParams.get("orderType") ?? searchParams.get("tipo");
    const status = searchParams.get("status") ?? searchParams.get("estado");

    const whereFilter: Record<string, unknown> = {};
    if (orderType) {
      whereFilter.orderType = orderType;
    }
    if (status === "active" || status === "activos") {
      whereFilter.status = { notIn: CLOSED_STATUSES };
    } else if (status) {
      whereFilter.status = status;
    }

    const ordersDb = await prisma.salesOrder.findMany({
      where: whereFilter,
      orderBy: { id: "desc" },
      include: {
        tables: {
          include: { table: true }
        },
        items: {
          include: { dish: true },
          orderBy: { id: "asc" }
        }
      }
    });

    const orders = ordersDb.map(mapOrderResponse);

    return Response.json({ data: orders });
  } catch (error) {
    console.error("[api/orders] Error al listar pedidos:", error);
    return Response.json(
      { error: "No se pudieron obtener los pedidos." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Petición no válida." }, { status: 400 });
    }

    // Validar que exista una sesión de caja abierta antes de registrar pedidos
    const activeCashSession = await (prisma as any).cashSession.findFirst({
      where: { status: "OPEN" },
    }).catch(() => null);

    if (!activeCashSession) {
      return Response.json(
        { error: "No se puede registrar pedidos porque la caja se encuentra cerrada. Debe realizar la apertura de turno primero." },
        { status: 400 }
      );
    }

    const rawOrderType = body.orderType ?? body.tipo_pedido;
    const orderType = rawOrderType === "Llevar" ? "Llevar" : "Mesa";
    const tableId = Number(body.tableId ?? body.id_mesa) || null;
    const additionalTablesRaw = body.additionalTables ?? body.mesas_adicionales;
    const additionalTables = Array.isArray(additionalTablesRaw)
      ? (additionalTablesRaw.map(Number).filter((n: number) => !Number.isNaN(n) && n !== tableId) as number[])
      : [];
    const tableNote = typeof (body.notes ?? body.observacion) === "string"
      ? String(body.notes ?? body.observacion).trim()
      : null;
    const items = Array.isArray(body.items) ? (body.items as OrderItemInput[]) : [];

    if (orderType === "Mesa" && (!tableId || Number.isNaN(tableId))) {
      return Response.json({ error: "Debe seleccionar una mesa válida para el pedido en mesa." }, { status: 400 });
    }

    if (items.length === 0) {
      return Response.json({ error: "El pedido debe contener al menos un producto." }, { status: 400 });
    }

    // Si es en mesa, verificar que la mesa principal existe y que no tiene un pedido activo ya registrado
    if (orderType === "Mesa" && tableId) {
      const table = await prisma.diningTable.findUnique({
        where: { id: tableId },
        include: {
          orders: {
            where: {
              order: {
                status: { notIn: CLOSED_STATUSES }
              }
            }
          }
        }
      });

      if (!table) {
        return Response.json({ error: "La mesa especificada no existe." }, { status: 404 });
      }

      if (table.orders.length > 0) {
        return Response.json(
          { error: `La Mesa ${table.number} ya tiene un pedido activo en curso.` },
          { status: 400 }
        );
      }

      // Validar mesas adicionales unidas
      if (additionalTables.length > 0) {
        const additionalTablesDb = await prisma.diningTable.findMany({
          where: { id: { in: additionalTables } },
          include: {
            orders: {
              where: {
                order: {
                  status: { notIn: CLOSED_STATUSES }
                }
              }
            }
          }
        });

        for (const m of additionalTablesDb) {
          if (m.orders.length > 0 || !m.active) {
            return Response.json(
              { error: `La mesa adicional Mesa ${m.number} ya está ocupada o tiene un pedido activo.` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Validar productos y obtener precios oficiales de la base de datos
    const dishIds = items.map((it) => resolveDishId(it));
    const dishesDb = await prisma.dish.findMany({
      where: { id: { in: dishIds }, active: true }
    });

    const dishesMap = new Map(dishesDb.map((pl) => [pl.id, pl]));

    for (const item of items) {
      const dishId = resolveDishId(item);
      const quantity = resolveQuantity(item);
      if (!dishesMap.has(dishId)) {
        return Response.json(
          { error: `El producto con ID ${dishId} no existe o no está activo.` },
          { status: 400 }
        );
      }
      if (!quantity || quantity < 1) {
        return Response.json(
          { error: "La cantidad de cada producto debe ser al menos 1." },
          { status: 400 }
        );
      }
    }

    // Verificación y reserva atómica de stock en Redis Cloud
    const reservationItems = items.map((it) => {
      const dishId = resolveDishId(it);
      return {
        idPlato: dishId,
        cantidad: Math.floor(resolveQuantity(it)),
        nombre: dishesMap.get(dishId)?.name,
      };
    });

    const reservationResult = await reserveOrderStock(reservationItems);
    if (!reservationResult.success) {
      return Response.json(
        { error: reservationResult.error || "Stock insuficiente para atender el pedido." },
        { status: 400 }
      );
    }

    // Generar código único para el pedido (PED-XXXXXX)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const codeTimestamp = Date.now().toString().slice(-4);
    const code = `PED-${codeTimestamp}${randomSuffix}`;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.salesOrder.create({
          data: {
            code,
            orderType,
            status: "Received",
            orderedAt: new Date()
          }
        });

        if (orderType === "Mesa" && tableId) {
          let finalNote = tableNote;
          if (additionalTables.length > 0) {
            const linkedTables = await tx.diningTable.findMany({
              where: { id: { in: additionalTables } },
              select: { number: true }
            });
            const nums = linkedTables.map((m) => m.number).sort((a, b) => a - b).join(", ");
            const tag = `[Mesas unidas: ${nums}]`;
            finalNote = tableNote ? `${tableNote} ${tag}` : tag;
          }

          await tx.orderTable.create({
            data: {
              tableId,
              orderId: newOrder.id,
              notes: finalNote
            }
          });
          // La mesa permanece activa en el salón (active: true);
          // su estado ocupado se determina por tener una comanda activa vinculada.
        }

        for (const item of items) {
          const dish = dishesMap.get(resolveDishId(item))!;
          const quantity = Math.floor(resolveQuantity(item));
          const unitPrice = Number(dish.price);
          const subtotal = Math.round(unitPrice * quantity * 100) / 100;
          const itemNotes = item.notes ?? item.observaciones;

          await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              dishId: dish.id,
              quantity,
              unitPrice,
              subtotal,
              dishStatus: "Pending",
              notes: itemNotes ? itemNotes.trim().slice(0, 100) : null
            }
          });
        }

        return newOrder;
      });

      const fullOrder = await prisma.salesOrder.findUnique({
        where: { id: result.id },
        include: {
          tables: { include: { table: true } },
          items: { include: { dish: true } }
        }
      });

      return Response.json(
        {
          message: "Pedido registrado con éxito.",
          order: fullOrder ? mapOrderResponse(fullOrder) : null
        },
        { status: 201 }
      );
    } catch (dbError) {
      for (const item of reservationItems) {
        await releaseDishStock(item.idPlato, item.cantidad).catch(() => {});
      }
      throw dbError;
    }
  } catch (error) {
    console.error("[api/orders] Error al crear pedido:", error);
    return Response.json(
      { error: "No se pudo registrar el pedido. Intente nuevamente." },
      { status: 500 }
    );
  }
}
