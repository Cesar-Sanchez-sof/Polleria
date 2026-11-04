import { prisma } from "@/lib/prisma";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from "@/lib/http/route-handler";

export const CLOSED_STATUSES = ["Closed", "Cancelled"];

export interface TableItemSummary {
  total: number;
  available: number;
  occupied: number;
  inactive: number;
}

export interface TableOrderItem {
  id: number;
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  itemStatus: string;
  notes: string;
}

export interface TableActiveOrder {
  id: number;
  orderTableId: number;
  code: string;
  orderType: string;
  orderedAt: string;
  status: string;
  tableNotes: string;
  items: TableOrderItem[];
  total: number;
  editable: boolean;
  isAnnexed: boolean;
}

export interface DiningTableDto {
  id: number;
  number: number;
  capacity: number;
  active: boolean;
  occupied: boolean;
  activeOrder: TableActiveOrder | null;
}

export interface ListDiningTablesResult {
  data: DiningTableDto[];
  summary: TableItemSummary;
}

export interface BasicDiningTable {
  id: number;
  number: number;
  capacity: number;
  active: boolean;
}

/**
 * Consulta todas las mesas del salón con sus comandas activas y métricas de ocupación.
 */
export async function listDiningTables(options?: {
  includeInactive?: boolean;
}): Promise<ListDiningTablesResult> {
  const includeInactive = options?.includeInactive ?? false;

  const tablesDb = await prisma.diningTable.findMany({
    where: includeInactive
      ? undefined
      : {
          OR: [
            { active: true },
            { orders: { some: { order: { status: { notIn: CLOSED_STATUSES } } } } },
          ],
        },
    orderBy: { number: "asc" },
    include: {
      orders: {
        where: {
          order: {
            status: { notIn: CLOSED_STATUSES },
          },
        },
        include: {
          order: {
            include: {
              items: {
                include: { product: true },
                orderBy: { id: "asc" },
              },
            },
          },
        },
      },
    },
  });

  const tables: DiningTableDto[] = tablesDb.map((m) => {
    const activeTableOrder = m.orders[0] ?? null;
    const order = activeTableOrder?.order ?? null;

    let activeOrder: TableActiveOrder | null = null;
    if (order) {
      const items: TableOrderItem[] = order.items.map((d) => ({
        id: d.id,
        productId: d.productId,
        name: d.product.name,
        quantity: d.quantity,
        unitPrice: Number(d.unitPrice),
        subtotal: Number(d.subtotal),
        itemStatus: d.itemStatus,
        notes: d.notes ?? "",
      }));

      const calculatedTotal = items.reduce((acc, it) => acc + it.subtotal, 0);

      activeOrder = {
        id: order.id,
        orderTableId: activeTableOrder.id,
        code: order.code,
        orderType: order.orderType,
        orderedAt: order.orderedAt.toISOString(),
        status: order.status,
        tableNotes: activeTableOrder.notes ?? "",
        items,
        total: calculatedTotal,
        editable: !CLOSED_STATUSES.includes(order.status),
        isAnnexed: Boolean(activeTableOrder.notes?.includes("[Anexa a Mesa")),
      };
    }

    return {
      id: m.id,
      number: m.number,
      capacity: m.capacity,
      active: m.active || Boolean(activeOrder),
      occupied: Boolean(activeOrder),
      activeOrder,
    };
  });

  const occupied = tables.filter((m) => m.occupied).length;
  const available = tables.filter((m) => m.active && !m.occupied).length;
  const inactive = tables.filter((m) => !m.active).length;

  return {
    data: tables,
    summary: {
      total: tables.length,
      available,
      occupied,
      inactive,
    },
  };
}

/**
 * Obtiene la lista simplificada de mesas para cálculo de aforos y asignación de salones.
 */
export async function listBasicDiningTables(): Promise<BasicDiningTable[]> {
  return prisma.diningTable.findMany({
    select: { id: true, number: true, capacity: true, active: true },
    orderBy: { number: "asc" },
  });
}

/**
 * Registra una nueva mesa o reactiva una existente que estuviese desactivada.
 */
export async function createOrReactivateDiningTable(data: {
  number: number;
  capacity?: number;
}): Promise<{ table: BasicDiningTable; reactivated: boolean; message: string }> {
  const number = Number(data.number);
  const capacity = Number(data.capacity ?? 4);

  if (!number || Number.isNaN(number) || number <= 0) {
    throw new ValidationError("El número de mesa debe ser un entero positivo mayor a cero.");
  }

  if (Number.isNaN(capacity) || capacity < 1 || capacity > 30) {
    throw new ValidationError("La capacidad de comensales debe estar entre 1 y 30 personas.");
  }

  const existingTable = await prisma.diningTable.findUnique({
    where: { number },
  });

  if (existingTable) {
    if (existingTable.active) {
      throw new ConflictError(`Ya existe una mesa activa registrada con el número ${number}.`);
    }

    const reactivated = await prisma.diningTable.update({
      where: { id: existingTable.id },
      data: {
        active: true,
        capacity,
      },
      select: { id: true, number: true, capacity: true, active: true },
    });

    return {
      table: reactivated,
      reactivated: true,
      message: `Mesa #${number} reactivada con éxito.`,
    };
  }

  const newTable = await prisma.diningTable.create({
    data: {
      number,
      capacity,
      active: true,
    },
    select: { id: true, number: true, capacity: true, active: true },
  });

  return {
    table: newTable,
    reactivated: false,
    message: `Mesa #${number} registrada exitosamente.`,
  };
}

/**
 * Obtiene una mesa por su ID.
 */
export async function getDiningTableById(id: number): Promise<BasicDiningTable> {
  const table = await prisma.diningTable.findUnique({
    where: { id },
    select: { id: true, number: true, capacity: true, active: true },
  });

  if (!table) {
    throw new NotFoundError("Mesa no encontrada.");
  }

  return table;
}

/**
 * Actualiza los parámetros de una mesa existente (número, capacidad, estado activo).
 */
export async function updateDiningTable(
  id: number,
  data: {
    number?: number;
    capacity?: number;
    active?: boolean;
  }
): Promise<BasicDiningTable> {
  const table = await getDiningTableById(id);

  const newNumber = data.number !== undefined ? Number(data.number) : undefined;
  const newCapacity = data.capacity !== undefined ? Number(data.capacity) : undefined;
  const newActive = data.active !== undefined ? Boolean(data.active) : undefined;

  if (newNumber !== undefined && (Number.isNaN(newNumber) || newNumber <= 0)) {
    throw new ValidationError("El número de mesa debe ser un entero positivo.");
  }

  if (newCapacity !== undefined && (Number.isNaN(newCapacity) || newCapacity < 1 || newCapacity > 30)) {
    throw new ValidationError("La capacidad debe estar entre 1 y 30 comensales.");
  }

  if (newNumber !== undefined && newNumber !== table.number) {
    const duplicate = await prisma.diningTable.findUnique({
      where: { number: newNumber },
    });
    if (duplicate && duplicate.id !== id) {
      throw new ConflictError(`Ya existe otra mesa con el número ${newNumber}.`);
    }
  }

  return prisma.diningTable.update({
    where: { id },
    data: {
      ...(newNumber !== undefined ? { number: newNumber } : {}),
      ...(newCapacity !== undefined ? { capacity: newCapacity } : {}),
      ...(newActive !== undefined ? { active: newActive } : {}),
    },
    select: { id: true, number: true, capacity: true, active: true },
  });
}

/**
 * Desactiva una mesa del salón (Soft delete). Impide la desactivación si hay comandas activas.
 */
export async function deactivateDiningTable(id: number): Promise<BasicDiningTable> {
  const tableWithOrders = await prisma.diningTable.findUnique({
    where: { id },
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

  if (!tableWithOrders) {
    throw new NotFoundError("Mesa no encontrada.");
  }

  if (tableWithOrders.orders.length > 0) {
    throw new ValidationError(
      `No se puede desactivar la Mesa #${tableWithOrders.number} porque tiene comandas activas en curso.`
    );
  }

  return prisma.diningTable.update({
    where: { id },
    data: { active: false },
    select: { id: true, number: true, capacity: true, active: true },
  });
}
