import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryMovementType, type Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  productFindUnique: vi.fn(),
  productUpdate: vi.fn(),
  movementCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const db = {
    $queryRaw: m.queryRaw,
    product: {
      findUnique: m.productFindUnique,
      update: m.productUpdate,
    },
    inventoryMovement: {
      create: m.movementCreate,
    },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { prisma: db };
});

import {
  deductProductStock,
  restoreProductStock,
  totalsByProduct,
  adjustProductStockService,
  InsufficientStockError,
} from "@/lib/services/inventory/inventory.service";
import { ValidationError, NotFoundError } from "@/lib/http/errors";

describe("Inventory Service (lib/services/inventory.service)", () => {
  const mockTx = {
    $queryRaw: m.queryRaw,
    product: {
      findUnique: m.productFindUnique,
      update: m.productUpdate,
    },
    inventoryMovement: {
      create: m.movementCreate,
    },
  } as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deductProductStock", () => {
    it("debe descontar stock atómicamente y registrar movimiento de venta", async () => {
      m.queryRaw.mockResolvedValueOnce([{ average_cost: 12.5 }]);

      await deductProductStock(mockTx, { productId: 4, quantity: 2, orderItemId: 101 }, "Venta comanda PED-101");

      expect(m.queryRaw).toHaveBeenCalledTimes(1);
      expect(m.movementCreate).toHaveBeenCalledWith({
        data: {
          productId: 4,
          orderItemId: 101,
          movementType: InventoryMovementType.Sale,
          quantity: 2,
          unitCost: 12.5,
          reason: "Venta comanda PED-101",
        },
      });
    });

    it("debe lanzar InsufficientStockError si el UPDATE atómico retorna 0 filas", async () => {
      m.queryRaw.mockResolvedValueOnce([]); // No alcanzó el stock
      m.productFindUnique.mockResolvedValueOnce({ name: "1/2 Pollo", currentStock: 1 });

      await expect(
        deductProductStock(mockTx, { productId: 7, quantity: 5 }, "Venta")
      ).rejects.toBeInstanceOf(InsufficientStockError);
    });

    it("debe ignorar cantidades menores a 1", async () => {
      await deductProductStock(mockTx, { productId: 1, quantity: 0 }, "Prueba");
      expect(m.queryRaw).not.toHaveBeenCalled();
    });
  });

  describe("restoreProductStock", () => {
    it("debe incrementar el stock y registrar movimiento de ajuste positivo", async () => {
      await restoreProductStock(mockTx, { productId: 3, quantity: 4 }, "Pedido cancelado");

      expect(m.productUpdate).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { currentStock: { increment: 4 } },
      });
      expect(m.movementCreate).toHaveBeenCalledWith({
        data: {
          productId: 3,
          movementType: InventoryMovementType.Adjustment,
          quantity: 4,
          reason: "Pedido cancelado",
        },
      });
    });
  });

  describe("totalsByProduct", () => {
    it("debe sumarizar correctamente cantidades agrupadas por productId", () => {
      const lines = [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
        { productId: 1, quantity: 3.5 },
      ];
      const result = totalsByProduct(lines);
      expect(result.get(1)).toBe(5);
      expect(result.get(2)).toBe(1);
    });
  });

  describe("adjustProductStockService", () => {
    it("debe validar productId y stock no negativo", async () => {
      await expect(
        adjustProductStockService({ productId: 0, newStock: 10 })
      ).rejects.toBeInstanceOf(ValidationError);

      await expect(
        adjustProductStockService({ productId: 5, newStock: -3 })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("debe lanzar NotFoundError si el producto no existe", async () => {
      m.productFindUnique.mockResolvedValueOnce(null);
      await expect(
        adjustProductStockService({ productId: 99, newStock: 10 })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("debe registrar ajuste positivo si el stock físico supera al actual", async () => {
      m.productFindUnique.mockResolvedValueOnce({
        id: 5,
        currentStock: 10,
        averageCost: 8.0,
      });
      m.productUpdate.mockResolvedValueOnce({ id: 5, currentStock: 14 });

      const res = await adjustProductStockService({
        productId: 5,
        newStock: 14,
        reason: "Conteo físico fin de mes",
      });

      expect(res.difference).toBe(4);
      expect(m.movementCreate).toHaveBeenCalledWith({
        data: {
          productId: 5,
          movementType: InventoryMovementType.Adjustment,
          quantity: 4,
          unitCost: 8.0,
          reason: "Conteo físico fin de mes (+4)",
        },
      });
    });

    it("no debe generar movimiento si la diferencia es 0", async () => {
      m.productFindUnique.mockResolvedValueOnce({
        id: 5,
        currentStock: 10,
      });

      const res = await adjustProductStockService({
        productId: 5,
        newStock: 10,
      });

      expect(res.difference).toBe(0);
      expect(res.movement).toBeNull();
      expect(m.movementCreate).not.toHaveBeenCalled();
    });
  });
});
