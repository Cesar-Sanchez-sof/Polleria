import { describe, expect, it, vi } from "vitest";
import {
  deductProductStock,
  InsufficientStockError,
  restoreProductStock,
  totalsByProduct,
} from "./product-stock.service";

function fakeTx(overrides: {
  updatedRows?: Array<{ average_cost: number }>;
  product?: { name: string; currentStock: number } | null;
}) {
  return {
    $queryRaw: vi.fn().mockResolvedValue(overrides.updatedRows ?? []),
    product: {
      findUnique: vi.fn().mockResolvedValue(overrides.product ?? null),
      update: vi.fn().mockResolvedValue({}),
    },
    inventoryMovement: { create: vi.fn().mockResolvedValue({}) },
  };
}

describe("deductProductStock", () => {
  it("descuenta y registra un movimiento de venta con el costo promedio", async () => {
    const tx = fakeTx({ updatedRows: [{ average_cost: 2.5 }] });

    await deductProductStock(tx as never, { productId: 7, quantity: 3, orderItemId: 11 }, "Venta pedido PED-1");

    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: {
        productId: 7,
        orderItemId: 11,
        movementType: "Sale",
        quantity: 3,
        unitCost: 2.5,
        reason: "Venta pedido PED-1",
      },
    });
  });

  it("lanza InsufficientStockError con el stock disponible cuando no alcanza", async () => {
    const tx = fakeTx({ updatedRows: [], product: { name: "1/4 Pollo a la Brasa", currentStock: 2 } });

    const attempt = deductProductStock(tx as never, { productId: 7, quantity: 3 }, "Venta");

    await expect(attempt).rejects.toBeInstanceOf(InsufficientStockError);
    await expect(attempt).rejects.toThrow("quedan 2 unidad(es) y se piden 3");
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it("no hace nada con cantidades menores a 1", async () => {
    const tx = fakeTx({});

    await deductProductStock(tx as never, { productId: 7, quantity: 0 }, "Venta");

    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("restoreProductStock", () => {
  it("suma el stock y lo registra como ajuste positivo (los ajustes suman en el Kardex)", async () => {
    const tx = fakeTx({});

    await restoreProductStock(tx as never, { productId: 7, quantity: 2 }, "Devolución");

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { currentStock: { increment: 2 } },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: { productId: 7, movementType: "Adjustment", quantity: 2, reason: "Devolución" },
    });
  });
});

describe("totalsByProduct", () => {
  it("suma las unidades de las líneas del mismo producto", () => {
    const totals = totalsByProduct([
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
      { productId: 1, quantity: 3 },
    ]);

    expect(totals.get(1)).toBe(5);
    expect(totals.get(2)).toBe(1);
  });
});
