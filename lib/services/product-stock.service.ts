import { InventoryMovementType, type Prisma } from "@prisma/client";

/**
 * Stock de productos vendidos. El stock vive en `product.current_stock` (el mismo que alimenta el Kardex):
 * la transformación y las compras lo suben, las ventas lo bajan. Todas las funciones reciben la
 * transacción del pedido para que descuento y pedido se confirmen (o se deshagan) juntos.
 */
type Tx = Prisma.TransactionClient;

export class InsufficientStockError extends Error {
  constructor(
    public readonly productName: string,
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(
      `Stock insuficiente de «${productName}»: quedan ${available} unidad(es) y se piden ${requested}.`,
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
