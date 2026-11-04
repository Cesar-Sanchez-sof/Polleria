import { InventoryMovementType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/http/errors";

type Tx = Prisma.TransactionClient;

export class InsufficientStockError extends ConflictError {
  constructor(
    public readonly productName: string,
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(
      `Stock insuficiente de «${productName}»: quedan ${available} unidad(es) y se piden ${requested}.`
    );
    this.name = "InsufficientStockError";
  }
}

export interface StockLine {
  productId: number;
  quantity: number;
  /** Línea del pedido que originó el movimiento (para rastrearlo en el Kardex). */
  orderItemId?: number;
}

/**
 * Descuenta stock de forma atómica (nunca queda negativo) y registra el movimiento de venta en el Kardex.
 * Lanza `InsufficientStockError` si no alcanza.
 */
export async function deductProductStock(tx: Tx, line: StockLine, reason: string): Promise<void> {
  const quantity = Math.floor(line.quantity);
  if (quantity < 1) return;

  const updated = await tx.$queryRaw<Array<{ average_cost: Prisma.Decimal }>>`
    UPDATE "product"
    SET "current_stock" = "current_stock" - ${quantity}
    WHERE "id" = ${line.productId} AND "current_stock" >= ${quantity}
    RETURNING "average_cost"`;

  if (updated.length === 0) {
    const product = await tx.product.findUnique({
      where: { id: line.productId },
      select: { name: true, currentStock: true },
    });
    throw new InsufficientStockError(
      product?.name ?? `#${line.productId}`,
      Number(product?.currentStock ?? 0),
      quantity,
    );
  }

  await tx.inventoryMovement.create({
    data: {
      productId: line.productId,
      orderItemId: line.orderItemId,
      movementType: InventoryMovementType.Sale,
      quantity,
      unitCost: updated[0].average_cost,
      reason,
    },
  });
}

/**
 * Devuelve stock (pedido cancelado o con menos unidades). Se registra como ajuste positivo:
 * en el Kardex los ajustes suman con su signo, a diferencia de `Sale`, que siempre resta.
 */
export async function restoreProductStock(tx: Tx, line: StockLine, reason: string): Promise<void> {
  const quantity = Math.floor(line.quantity);
  if (quantity < 1) return;

  await tx.product.update({
    where: { id: line.productId },
    data: { currentStock: { increment: quantity } },
  });
  await tx.inventoryMovement.create({
    data: {
      productId: line.productId,
      movementType: InventoryMovementType.Adjustment,
      quantity,
      reason,
    },
  });
}

/** Total de unidades por producto de una lista de líneas. */
export function totalsByProduct(lines: ReadonlyArray<{ productId: number; quantity: number }>): Map<number, number> {
  const totals = new Map<number, number>();
  for (const line of lines) {
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + Math.floor(line.quantity));
  }
  return totals;
}

export interface InventoryAdjustmentInput {
  productId: number;
  newStock: number;
  reason?: string;
  unitCost?: number;
}

/**
 * Registra un ajuste de inventario manual (diferencia física vs teórica en Kardex).
 */
export async function adjustProductStockService(input: InventoryAdjustmentInput) {
  const { productId, newStock, reason = "Ajuste manual de inventario", unitCost } = input;

  if (!productId || productId <= 0) {
    throw new ValidationError("ID de producto inválido.");
  }
  if (newStock < 0 || Number.isNaN(newStock)) {
    throw new ValidationError("El stock final no puede ser negativo.");
  }

  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError("Producto no encontrado.");
    }

    const current = Number(product.currentStock);
    const difference = newStock - current;

    if (difference === 0) {
      return { product, movement: null, difference: 0 };
    }

    const finalUnitCost =
      unitCost !== undefined && unitCost !== null
        ? unitCost
        : Number(product.averageCost || product.lastCost || 0);

    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: {
        currentStock: newStock,
        lastCost: finalUnitCost,
      },
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        productId,
        movementType: InventoryMovementType.Adjustment,
        quantity: Math.abs(difference),
        unitCost: finalUnitCost,
        reason: `${reason} (${difference > 0 ? "+" : ""}${difference})`,
      },
    });

    return { product: updatedProduct, movement, difference };
  });
}
