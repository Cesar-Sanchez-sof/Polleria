import { prisma } from "@/lib/prisma";
import {
  deductProductStock,
  restoreProductStock,
  totalsByProduct,
} from "@/lib/services/product-stock.service";
import { isBeverage } from "@/lib/utils/product-category";
import { broadcastRealtimeEvent } from "@/lib/realtime/event-emitter";
import {
  ValidationError,
  ConflictError,
  NotFoundError,
} from "@/lib/http/route-handler";

export const CLOSED_STATUSES = ["Closed", "Cancelled"];

export interface OrderItemInput {
  productId?: number;
  product_id?: number;
  quantity?: number;
  notes?: string;
  observations?: string;
}

export interface TableSummaryDto {
  id: number;
  number: number;
}

export interface MappedOrderItemDto {
  id: number;
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  itemStatus: string;
  notes: string;
}

export interface MappedOrderDto {
  id: number;
  code: string;
  orderType: string;
  orderedAt: string;
  status: string;
  table: TableSummaryDto | null;
  notes: string;
  items: MappedOrderItemDto[];
  total: number;
  editable: boolean;
}

export interface CreateOrderInput {
  orderType?: string;
  order_type?: string;
  tableId?: number;
  table_id?: number;
  additionalTables?: number[];
  additional_tables?: number[];
  notes?: string;
  observation?: string;
  items?: OrderItemInput[];
}

export interface UpdateOrderInput {
  status?: string;
  items?: OrderItemInput[];
  notes?: string;
  observation?: string;
  tableId?: number;
}

export interface DrinkDispatchItemDto {
  itemId: number;
  orderId: number;
  orderCode: string;
  orderType: string;
  tableId: number | null;
  tableNumber: number | null;
  tableName: string;
  orderedAt: string;
  productId: number;
  name: string;
  quantity: number;
  notes: string;
  itemStatus: string;
  isDelivered: boolean;
  orderStatus: string;
}

export interface DrinksDispatchResult {
  data: DrinkDispatchItemDto[];
  summary: {
    total: number;
    totalPending: number;
    totalDelivered: number;
    activeTables: number;
  };
}

export interface UpdateDrinkStatusInput {
  itemId?: number;
  id?: number;
  itemIds?: number[];
  orderId?: number;
  status?: "Pending" | "Delivered" | string;
}

function resolveProductId(item: OrderItemInput): number {
  return Number(item.productId ?? item.product_id);
}

function resolveQuantity(item: OrderItemInput): number {
  return Number(item.quantity);
}

export function mapOrderResponse(p: {
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
    productId: number;
    quantity: number;
    unitPrice: { toString(): string } | number;
    subtotal: { toString(): string } | number;
    itemStatus: string;
    notes: string | null;
    product: { name: string };
  }>;
}): MappedOrderDto {
  const pm = p.tables.find((t) => !t.notes?.includes("[Anexa a Mesa")) ?? p.tables[0] ?? null;
  const items = p.items.map((d) => ({
    id: d.id,
    productId: d.productId,
    name: d.product.name,
    quantity: d.quantity,
    unitPrice: Number(d.unitPrice),
    subtotal: Number(d.subtotal),
    itemStatus: d.itemStatus,
    notes: d.notes ?? "",
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
    editable: !CLOSED_STATUSES.includes(p.status),
  };
}

/**
 * Consulta la lista de pedidos con filtros opcionales de tipo y estado.
 */
export async function listOrders(filters?: {
  orderType?: string | null;
  status?: string | null;
}): Promise<MappedOrderDto[]> {
  const orderType = filters?.orderType;
  const status = filters?.status;

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
        include: { table: true },
      },
      items: {
        include: { product: true },
        orderBy: { id: "asc" },
      },
    },
  });

  return ordersDb.map(mapOrderResponse);
}

/**
 * Registra un nuevo pedido en salón o para llevar ejecutando las transacciones de mesas y stock.
 */
export async function createOrder(data: CreateOrderInput): Promise<{
  message: string;
  order: MappedOrderDto | null;
}> {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Petición no válida.");
  }

  // Validar que exista una sesión de caja abierta antes de registrar pedidos
  const activeCashSession = await (prisma as any).cashSession.findFirst({
    where: { status: "OPEN" },
  }).catch(() => null);

  if (!activeCashSession) {
    throw new ValidationError(
      "No se puede registrar pedidos porque la caja se encuentra cerrada. Debe realizar la apertura de turno primero."
    );
  }

  const rawOrderType = data.orderType ?? data.order_type;
  const orderType = rawOrderType === "Llevar" ? "Llevar" : "Mesa";
  const tableId = Number(data.tableId ?? data.table_id) || null;
  const additionalTablesRaw = data.additionalTables ?? data.additional_tables;
  const additionalTables = Array.isArray(additionalTablesRaw)
    ? (additionalTablesRaw.map(Number).filter((n: number) => !Number.isNaN(n) && n !== tableId) as number[])
    : [];
  const tableNote = typeof (data.notes ?? data.observation) === "string"
    ? String(data.notes ?? data.observation).trim()
    : null;
  const items = Array.isArray(data.items) ? data.items : [];

  if (orderType === "Mesa" && (!tableId || Number.isNaN(tableId))) {
    throw new ValidationError("Debe seleccionar una mesa válida para el pedido en mesa.");
  }

  if (items.length === 0) {
    throw new ValidationError("El pedido debe contener al menos un producto.");
  }

  // Si es en mesa, verificar que la mesa principal existe y que no tiene un pedido activo ya registrado
  if (orderType === "Mesa" && tableId) {
    const table = await prisma.diningTable.findUnique({
      where: { id: tableId },
      include: {
        orders: {
          where: {
            order: {
              status: { notIn: CLOSED_STATUSES },
            },
          },
        },
      },
    });

    if (!table) {
      throw new NotFoundError("La mesa especificada no existe.");
    }

    if (table.orders.length > 0) {
      throw new ValidationError(`La Mesa ${table.number} ya tiene un pedido activo en curso.`);
    }

    // Validar mesas adicionales unidas
    if (additionalTables.length > 0) {
      const additionalTablesDb = await prisma.diningTable.findMany({
        where: { id: { in: additionalTables } },
        include: {
          orders: {
            where: {
              order: {
                status: { notIn: CLOSED_STATUSES },
              },
            },
          },
        },
      });

      for (const m of additionalTablesDb) {
        if (m.orders.length > 0 || !m.active) {
          throw new ValidationError(
            `La mesa adicional Mesa ${m.number} ya está ocupada o tiene un pedido activo.`
          );
        }
      }
    }
  }

  // Validar productos y obtener precios oficiales de la base de datos
  const productIds = items.map((it) => resolveProductId(it));
  const productsDb = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true, sellable: true },
  });

  const productsMap = new Map(productsDb.map((pl) => [pl.id, pl]));

  for (const item of items) {
    const productId = resolveProductId(item);
    const quantity = resolveQuantity(item);
    if (!productsMap.has(productId)) {
      throw new ValidationError(
        `El producto con ID ${productId} no existe, no está activo o no se vende.`
      );
    }
    if (!quantity || quantity < 1) {
      throw new ValidationError("La cantidad de cada producto debe ser al menos 1.");
    }
  }

  // Generar código único para el pedido (PED-XXXXXX)
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const codeTimestamp = Date.now().toString().slice(-4);
  const code = `PED-${codeTimestamp}${randomSuffix}`;

  const result = await prisma.$transaction(
    async (tx) => {
      const newOrder = await tx.salesOrder.create({
        data: {
          code,
          orderType,
          status: "Received",
          orderedAt: new Date(),
        },
      });

      if (orderType === "Mesa" && tableId) {
        const mainTableRecord = await tx.diningTable.findUnique({
          where: { id: tableId },
          select: { number: true },
        });
        const mainNum = mainTableRecord?.number ?? tableId;

        const mainNote =
          additionalTables.length > 0
            ? `[Mesas unidas: ${additionalTables.join(", ")}]${tableNote ? ` - ${tableNote}` : ""}`
            : tableNote || "";

        await tx.orderTable.create({
          data: {
            orderId: newOrder.id,
            tableId,
            notes: mainNote,
          },
        });

        await tx.diningTable.update({
          where: { id: tableId },
          data: { active: true },
        });

        for (const addTableId of additionalTables) {
          await tx.orderTable.create({
            data: {
              orderId: newOrder.id,
              tableId: addTableId,
              notes: `[Anexa a Mesa ${mainNum}]`,
            },
          });

          await tx.diningTable.update({
            where: { id: addTableId },
            data: { active: true },
          });
        }
      }

      for (const item of items) {
        const productId = resolveProductId(item);
        const quantity = resolveQuantity(item);
        const product = productsMap.get(productId)!;
        const unitPrice = Number(product.price);
        const subtotal = unitPrice * quantity;
        const itemNotes = item.notes ?? item.observations;

        const createdItem = await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: product.id,
            quantity,
            unitPrice,
            subtotal,
            itemStatus: "Pending",
            notes: itemNotes ? itemNotes.trim().slice(0, 100) : null,
          },
        });

        // El stock baja con el pedido: si no alcanza, toda la transacción se revierte.
        await deductProductStock(
          tx,
          { productId: product.id, quantity, orderItemId: createdItem.id },
          `Venta pedido ${code}`
        );
      }

      return newOrder;
    },
    {
      maxWait: 10000,
      timeout: 30000,
    }
  );

  const fullOrder = await prisma.salesOrder.findUnique({
    where: { id: result.id },
    include: {
      tables: { include: { table: true } },
      items: { include: { product: true } },
    },
  });

  const mappedOrder = fullOrder ? mapOrderResponse(fullOrder) : null;

  try {
    broadcastRealtimeEvent("ORDER_CREATED", {
      order: mappedOrder,
      orderId: result.id,
      orderCode: code,
      orderType,
    });

    if (orderType === "Mesa") {
      broadcastRealtimeEvent("TABLE_UPDATED", {
        tableId,
        reason: "NUEVA_COMANDA",
        orderId: result.id,
      });
    }
  } catch (rtErr) {
    console.warn("[orders.service] Advertencia al emitir evento en tiempo real:", rtErr);
  }

  return {
    message: "Pedido registrado con éxito.",
    order: mappedOrder,
  };
}

/**
 * Consulta un pedido por su ID con todos sus detalles formateados.
 */
export async function getOrderById(id: number): Promise<MappedOrderDto> {
  if (!id || Number.isNaN(id)) {
    throw new ValidationError("ID de pedido inválido.");
  }

  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      tables: { include: { table: true } },
      items: {
        include: { product: true },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!order) {
    throw new NotFoundError("Pedido no encontrado.");
  }

  return mapOrderResponse(order);
}

/**
 * Actualiza un pedido en curso agregando ítems o modificando estado.
 */
export async function updateOrder(
  id: number,
  data: UpdateOrderInput
): Promise<MappedOrderDto> {
  if (!id || Number.isNaN(id)) {
    throw new ValidationError("ID de pedido inválido.");
  }

  const existingOrder = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      tables: true,
    },
  });

  if (!existingOrder) {
    throw new NotFoundError("Pedido no encontrado.");
  }

  if (CLOSED_STATUSES.includes(existingOrder.status)) {
    throw new ValidationError("No se puede modificar un pedido finalizado o cancelado.");
  }

  const newStatus = data.status;
  const newItems = Array.isArray(data.items) ? data.items : [];

  if (newItems.length > 0) {
    const productIds = newItems.map((it) => resolveProductId(it));
    const productsDb = await prisma.product.findMany({
      where: { id: { in: productIds }, active: true, sellable: true },
    });
    const productsMap = new Map(productsDb.map((pl) => [pl.id, pl]));

    await prisma.$transaction(async (tx) => {
      if (newStatus && newStatus !== existingOrder.status) {
        await tx.salesOrder.update({
          where: { id },
          data: { status: newStatus },
        });
      }

      for (const item of newItems) {
        const productId = resolveProductId(item);
        const quantity = resolveQuantity(item);
        const product = productsMap.get(productId);
        if (!product || quantity < 1) continue;

        const unitPrice = Number(product.price);
        const subtotal = unitPrice * quantity;
        const itemNotes = item.notes ?? item.observations;

        const createdItem = await tx.orderItem.create({
          data: {
            orderId: id,
            productId: product.id,
            quantity,
            unitPrice,
            subtotal,
            itemStatus: "Pending",
            notes: itemNotes ? itemNotes.trim().slice(0, 100) : null,
          },
        });

        await deductProductStock(
          tx,
          { productId: product.id, quantity, orderItemId: createdItem.id },
          `Adición al pedido ${existingOrder.code}`
        );
      }
    });
  } else if (newStatus && newStatus !== existingOrder.status) {
    await prisma.salesOrder.update({
      where: { id },
      data: { status: newStatus },
    });
  }

  const updated = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      tables: { include: { table: true } },
      items: { include: { product: true }, orderBy: { id: "asc" } },
    },
  });

  const mapped = mapOrderResponse(updated!);
  try {
    broadcastRealtimeEvent("ORDER_STATUS_CHANGED", {
      orderId: id,
      orderCode: updated!.code,
      status: updated!.status,
      order: mapped,
    });
  } catch (rtErr) {
    console.warn("[orders.service] Error al emitir evento en tiempo real:", rtErr);
  }

  return mapped;
}

/**
 * Cancela un pedido en curso, revierte su stock y libera la mesa.
 */
export async function cancelOrder(id: number): Promise<{ message: string }> {
  if (!id || Number.isNaN(id)) {
    throw new ValidationError("ID de pedido inválido.");
  }

  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      tables: true,
      items: {
        where: { itemStatus: { notIn: ["Cancelled"] } },
      },
    },
  });

  if (!order) {
    throw new NotFoundError("Pedido no encontrado.");
  }

  if (CLOSED_STATUSES.includes(order.status)) {
    throw new ValidationError("No se puede cancelar un pedido que ya está cerrado o cancelado.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.salesOrder.update({
      where: { id },
      data: { status: "Cancelled" },
    });

    await tx.orderItem.updateMany({
      where: { orderId: id },
      data: { itemStatus: "Cancelled" },
    });

    const totals = totalsByProduct(
      order.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
      }))
    );

    for (const [productId, quantity] of totals.entries()) {
      await restoreProductStock(
        tx,
        { productId, quantity },
        `Cancelación comanda ${order.code}`
      );
    }
  });

  try {
    broadcastRealtimeEvent("ORDER_STATUS_CHANGED", {
      orderId: id,
      orderCode: order.code,
      status: "Cancelled",
    });

    if (order.tables.length > 0) {
      for (const t of order.tables) {
        broadcastRealtimeEvent("TABLE_UPDATED", {
          tableId: t.tableId,
          reason: "COMANDA_CANCELADA",
          orderId: id,
        });
      }
    }
  } catch (rtErr) {
    console.warn("[orders.service] Error al emitir evento en tiempo real:", rtErr);
  }

  return { message: `Pedido ${order.code} cancelado exitosamente.` };
}

/**
 * Lista las bebidas activas para despacho en barra organizadas por salón y mesa.
 */
export async function listDrinksDispatch(filters?: {
  status?: string | null;
  table?: string | null;
}): Promise<DrinksDispatchResult> {
  const filterStatus = filters?.status;
  const tableParam = filters?.table;

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
        include: { product: true },
        orderBy: { id: "asc" },
      },
    },
  });

  const drinksList: DrinkDispatchItemDto[] = [];

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
      if (isBeverage(item.product.name, (item.product as any).description)) {
        const isDelivered = item.itemStatus === "Delivered" || item.itemStatus === "Served";

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
          productId: item.productId,
          name: item.product.name,
          quantity: item.quantity,
          notes: item.notes ?? "",
          itemStatus: item.itemStatus,
          isDelivered,
          orderStatus: order.status,
        });
      }
    }
  }

  const totalPending = drinksList.filter((d) => !d.isDelivered).length;
  const totalDelivered = drinksList.filter((d) => d.isDelivered).length;
  const activeTables = Array.from(
    new Set(drinksList.filter((d) => !d.isDelivered).map((d) => d.tableName))
  ).length;

  return {
    data: drinksList,
    summary: {
      total: drinksList.length,
      totalPending,
      totalDelivered,
      activeTables,
    },
  };
}

/**
 * Actualiza el estado de una o varias bebidas en el flujo de despacho del mozo.
 */
export async function updateDrinkItemStatus(data: UpdateDrinkStatusInput): Promise<{
  success: boolean;
  updatedCount: number;
  status: string;
  message: string;
}> {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Datos de petición inválidos.");
  }

  const targetStatus = data.status === "Pending" ? "Pending" : "Delivered";

  // 1. Caso actualización de múltiples ítems
  if (Array.isArray(data.itemIds) && data.itemIds.length > 0) {
    const ids = data.itemIds.map((n) => Number(n)).filter((n) => !Number.isNaN(n));
    const res = await prisma.orderItem.updateMany({
      where: { id: { in: ids } },
      data: { itemStatus: targetStatus },
    });
    return {
      success: true,
      updatedCount: res.count,
      status: targetStatus,
      message: `${res.count} bebida(s) actualizadas a estado '${targetStatus}'.`,
    };
  }

  // 2. Caso actualización de todas las bebidas de una comanda
  if (data.orderId) {
    const orderId = Number(data.orderId);
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId },
      include: { product: true },
    });

    const drinkItemIds = orderItems
      .filter((it) => isBeverage(it.product.name, (it.product as any).description))
      .map((it) => it.id);

    if (drinkItemIds.length === 0) {
      throw new NotFoundError("La orden no cuenta con bebidas registradas.");
    }

    const res = await prisma.orderItem.updateMany({
      where: { id: { in: drinkItemIds } },
      data: { itemStatus: targetStatus },
    });

    try {
      broadcastRealtimeEvent("DRINK_DISPATCHED", {
        orderId,
        targetStatus,
        count: res.count,
      });
    } catch (rtErr) {
      console.warn("[orders.service] Error al emitir evento en tiempo real:", rtErr);
    }

    return {
      success: true,
      updatedCount: res.count,
      status: targetStatus,
      message: `Todas las bebidas del pedido #${orderId} se marcaron como '${targetStatus}'.`,
    };
  }

  // 3. Caso actualización de un ítem individual
  const itemId = Number(data.itemId ?? data.id);
  if (!itemId || Number.isNaN(itemId)) {
    throw new ValidationError("Se requiere un ID de ítem válido.");
  }

  const updated = await prisma.orderItem.update({
    where: { id: itemId },
    data: { itemStatus: targetStatus },
  });

  try {
    broadcastRealtimeEvent("DRINK_DISPATCHED", {
      itemId,
      orderId: updated.orderId,
      targetStatus,
    });
  } catch (rtErr) {
    console.warn("[orders.service] Error al emitir evento en tiempo real:", rtErr);
  }

  return {
    success: true,
    updatedCount: 1,
    status: targetStatus,
    message: `Bebida actualizada a estado '${targetStatus}'.`,
  };
}
