"use server";

import { prisma } from "@/lib/prisma";
import { InventoryMovementType, Prisma } from "@prisma/client";
import { exigirPermiso } from "@/lib/auth/permisos";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de filtros
// ─────────────────────────────────────────────────────────────────────────────

export interface GetInventoryMovementsFilters {
  /** Busca por nombre de insumo (contains, case-insensitive) */
  search?: string;
  /** Fecha de inicio del rango */
  startDate?: Date;
  /** Fecha de fin del rango */
  endDate?: Date;
  /** ID del insumo */
  supplyId?: number;
  /** Tipo de movimiento (enum Prisma) */
  movementType?: InventoryMovementType;
  /** Página (1-based, default 1) */
  page?: number;
  /** Registros por página (default 15) */
  pageSize?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Include reutilizable para los includes de Prisma
// ─────────────────────────────────────────────────────────────────────────────

const movementInclude = {
  supply: {
    select: { name: true, unitOfMeasure: true },
  },
  purchaseOrderItem: {
    include: {
      purchaseOrder: {
        include: {
          invoices: true, // PurchaseInvoice[] — tomamos el primero
        },
      },
    },
  },
  transformationItem: {
    include: {
      transformation: { select: { id: true } },
    },
  },
  orderItem: {
    include: {
      order: {
        include: {
          tables: {
            include: {
              table: { select: { number: true } }, // DiningTable.number
            },
          },
        },
      },
    },
  },
  informalPurchase: {
    select: { id: true },
  },
} satisfies Prisma.InventoryMovementInclude;

// Tipo inferido a partir del include anterior
type MovementWithIncludes = Prisma.InventoryMovementGetPayload<{
  include: typeof movementInclude;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Tipo de item enriquecido que devolvemos al frontend
// ─────────────────────────────────────────────────────────────────────────────

export type EnrichedInventoryMovement = MovementWithIncludes & {
  /** Referencia legible: comprobante, TR-X, CM-X, mesa, o null */
  reference: string | null;
  /**
   * Saldo acumulado del insumo hasta este movimiento.
   * Solo se calcula cuando se filtra por supplyId; de lo contrario undefined.
   */
  saldoCorrido?: number;
};

export interface PaginatedInventoryMovements {
  items: EnrichedInventoryMovement[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

function buildWhere(
  filters: GetInventoryMovementsFilters
): Prisma.InventoryMovementWhereInput {
  const where: Prisma.InventoryMovementWhereInput = {};

  if (filters.search?.trim()) {
    where.supply = {
      name: { contains: filters.search.trim(), mode: "insensitive" },
    };
  }

  if (filters.startDate || filters.endDate) {
    where.movedAt = {
      ...(filters.startDate ? { gte: filters.startDate } : {}),
      ...(filters.endDate ? { lte: filters.endDate } : {}),
    };
  }

  if (filters.supplyId) where.supplyId = filters.supplyId;
  if (filters.movementType) where.movementType = filters.movementType;

  return where;
}

/**
 * Deriva la referencia legible para un movimiento de inventario.
 *
 * Reglas:
 * - purchaseOrderItemId → "<tipo> <serie>-<número>" del comprobante asociado
 * - transformationItemId → "TR-<id>"
 * - orderItemId → "Mesa <número>" (primer mesa de la orden)
 * - informalPurchaseId → "CM-<id>"
 * - Merma / Ajuste (ninguna FK externa) → null
 */
function deriveReference(m: MovementWithIncludes): string | null {
  if (m.purchaseOrderItemId && m.purchaseOrderItem?.purchaseOrder) {
    const invoices = m.purchaseOrderItem.purchaseOrder.invoices;
    if (invoices.length > 0) {
      const inv = invoices[0];
      return `${inv.voucherType} ${inv.series}-${inv.number}`.trim();
    }
    // Tiene OC pero aún no tiene comprobante
    return `OC-${m.purchaseOrderItem.purchaseOrder.id}`;
  }

  if (m.transformationItemId && m.transformationItem?.transformation) {
    return `TR-${m.transformationItem.transformation.id}`;
  }

  if (m.orderItemId && m.orderItem?.order) {
    const firstTable = m.orderItem.order.tables?.[0];
    if (firstTable?.table) {
      return `Mesa ${firstTable.table.number}`;
    }
    return `Pedido ${m.orderItem.order.code}`;
  }

  if (m.informalPurchaseId && m.informalPurchase) {
    return `CM-${m.informalPurchase.id}`;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Función principal exportada
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna los movimientos de inventario paginados y enriquecidos.
 *
 * @param filters - Filtros opcionales: search, startDate, endDate,
 *                  supplyId, movementType, page, pageSize.
 */
export async function getInventoryMovementsPaginated(
  filters: GetInventoryMovementsFilters = {}
): Promise<PaginatedInventoryMovements> {
  await exigirPermiso("inventario.ver");
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize =
    filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 15;
  const skip = (page - 1) * pageSize;

  const where = buildWhere(filters);

  try {
    // 1️⃣ Paginación + conteo en paralelo
    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        include: movementInclude,
        orderBy: { movedAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    // 2️⃣ saldoCorrido — solo cuando se filtra por un insumo específico
    let runningBalances: Record<number, number> = {};
    if (filters.supplyId) {
      // Trae todos los movimientos del insumo ordenados cronológicamente (movedAt ASC, id ASC)
      const allForSupply = await prisma.inventoryMovement.findMany({
        where: { supplyId: filters.supplyId },
        orderBy: [{ movedAt: "asc" }, { id: "asc" }],
        select: { id: true, quantity: true, movementType: true },
      });

      let cumulative = 0;
      for (const rec of allForSupply) {
        const rawQty = Number(rec.quantity);
        // Si el tipo es salida o merma y la cantidad guardada es positiva, resta
        // Si ya viene negativa (ej: anulación de compra menor o ajuste negativo), mantiene su signo
        if (
          (rec.movementType === InventoryMovementType.TransformationOut ||
            rec.movementType === InventoryMovementType.Sale ||
            rec.movementType === InventoryMovementType.Shrinkage) &&
          rawQty > 0
        ) {
          cumulative -= rawQty;
        } else {
          cumulative += rawQty;
        }
        runningBalances[rec.id] = cumulative;
      }
    }

    // 3️⃣ Enriquecer items con reference y saldoCorrido
    const items: EnrichedInventoryMovement[] = movements.map((m) => ({
      ...m,
      reference: deriveReference(m),
      ...(filters.supplyId !== undefined && {
        saldoCorrido: runningBalances[m.id] ?? 0,
      }),
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    console.error("[getInventoryMovementsPaginated] Error:", error);
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 0,
    };
  }
}
