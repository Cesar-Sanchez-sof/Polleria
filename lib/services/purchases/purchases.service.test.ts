/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupplier } from "./supplier";
import { createSupply, registerInventoryAdjustment } from "./supply";
import { createPurchaseOrder } from "./purchase-order";
import { receivePurchase } from "./receiving";
import { createPurchaseVoucher } from "./invoices";
import { registerTransformation } from "./transformation";
import { registerPurchaseWithoutVoucher } from "./purchase-without-voucher";

vi.mock("@/lib/services/accounting-posting.service", () => ({
  postPurchaseJournalEntries: vi.fn().mockResolvedValue([1, 2, 3, 4]),
  postPurchasePaymentJournalEntry: vi.fn().mockResolvedValue(10),
}));

// Mock Prisma Client
vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    supplier: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    supply: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    purchaseOrder: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    purchaseReceipt: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    purchaseReceiptItem: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    inventoryMovement: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    purchaseInvoice: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    purchasePayment: {
      create: vi.fn(),
    },
    paymentType: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    transformation: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    transformationItem: {
      create: vi.fn(),
    },
    informalPurchase: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    employee: {
      findUnique: vi.fn().mockResolvedValue({ id: 1, firstName: "Test" }),
      findFirst: vi.fn().mockResolvedValue({ id: 1, firstName: "Test" }),
      upsert: vi.fn().mockResolvedValue({ id: 1, firstName: "Test" }),
    },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

import { prisma } from "@/lib/prisma";

describe("Modulo Compras Services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Módulo 1: Proveedores", () => {
    it("debe crear un proveedor si el RUC es válido y no duplicado", async () => {
      (prisma.supplier.findUnique as any).mockResolvedValue(null);
      (prisma.supplier.create as any).mockResolvedValue({
        id: 1,
        ruc: "20123456789",
        businessName: "Distribuidora Beto S.A.C.",
      });

      const res = await createSupplier({
        ruc: "20123456789",
        businessName: "Distribuidora Beto S.A.C.",
      });

      expect(res.id).toBe(1);
      expect(prisma.supplier.create).toHaveBeenCalled();
    });

    it("debe lanzar error si el documento no tiene 8 u 11 dígitos", async () => {
      await expect(
        createSupplier({
          ruc: "123",
          businessName: "Test",
        })
      ).rejects.toThrow("El documento debe tener 8 dígitos (DNI) u 11 dígitos (RUC)");
    });
  });

  describe("Módulo 5: Insumos y Ajuste de Inventario", () => {
    it("debe crear un insumo con currentStock inicial en 0", async () => {
      (prisma.supply.create as any).mockResolvedValue({
        id: 1,
        name: "Pollo Entero",
        currentStock: 0,
      });

      await createSupply({
        name: "Pollo Entero",
        unitOfMeasure: "KG",
      });

      expect(prisma.supply.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Pollo Entero",
          currentStock: 0,
        }),
      });
    });

    it("debe registrar un ajuste de inventario recalculando el stock", async () => {
      (prisma.supply.findUnique as any).mockResolvedValue({
        id: 1,
        currentStock: 10,
      });
      (prisma.inventoryMovement.create as any).mockResolvedValue({ id: 1 });
      (prisma.supply.update as any).mockResolvedValue({
        id: 1,
        currentStock: 15,
      });

      const res = await registerInventoryAdjustment(1, 15, "Ajuste por conteo físico");

      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quantity: 5,
          reason: "Ajuste por conteo físico",
        }),
      });
      expect(res.supply.currentStock).toBe(15);
    });
  });

  describe("Módulo 2: Órdenes de Compra", () => {
    it("debe crear una orden de compra en estado Pending", async () => {
      (prisma.purchaseOrder.count as any).mockResolvedValue(0);
      (prisma.purchaseOrder.findUnique as any).mockResolvedValue(null);
      (prisma.purchaseOrder.create as any).mockResolvedValue({
        id: 1,
        orderNumber: "OC-2026-00001",
        status: "Pending",
      });

      const res = await createPurchaseOrder({
        supplierId: 1,
        items: [{ supplyId: 1, quantityOrdered: 10, unitPrice: 15 }],
      });

      expect(res.status).toBe("Pending");
    });
  });

  describe("Módulo 3: Recepción de Compra", () => {
    it("debe recepcionar compra y actualizar stock", async () => {
      (prisma.purchaseOrder.findUnique as any).mockResolvedValue({
        id: 1,
        orderNumber: "OC-2026-00001",
        items: [
          { id: 10, supplyId: 1, quantityOrdered: 10, unitPrice: 15 },
        ],
      });
      (prisma.purchaseReceipt.create as any).mockResolvedValue({ id: 100 });
      (prisma.purchaseReceiptItem.create as any).mockResolvedValue({ id: 1 });
      (prisma.inventoryMovement.create as any).mockResolvedValue({});
      (prisma.supply.findUnique as any).mockResolvedValue({ id: 1, currentStock: 5 });
      (prisma.supply.update as any).mockResolvedValue({});
      (prisma.purchaseReceiptItem.findMany as any).mockResolvedValue([
        { purchaseOrderItemId: 10, quantityReceived: 10 },
      ]);
      (prisma.purchaseOrder.update as any).mockResolvedValue({});

      const res = await receivePurchase({
        purchaseOrderId: 1,
        items: [{ purchaseOrderItemId: 10, quantityReceived: 10 }],
      });

      expect(res.id).toBe(100);
      expect(prisma.supply.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { currentStock: 15 },
      });
    });
  });

  describe("Módulo 4: Comprobantes y Facturas", () => {
    it("debe crear comprobante al contado y generar su pago automático", async () => {
      (prisma.purchaseInvoice.findFirst as any).mockResolvedValue(null);
      (prisma.purchaseReceipt.findUnique as any).mockResolvedValue({
        id: 1,
        items: [
          { quantityReceived: 10, purchaseOrderItem: { unitPrice: 10 } },
        ],
      });
      (prisma.purchaseInvoice.create as any).mockResolvedValue({ id: 5, totalAmount: 118 });
      (prisma.paymentType.findUnique as any).mockResolvedValue({ id: 1, name: "Efectivo" });

      await createPurchaseVoucher({
        supplierId: 1,
        receiptId: 1,
        voucherType: "Factura",
        series: "F001",
        number: 123,
        paymentCondition: "Contado",
        paymentTypeId: 1,
      });

      expect(prisma.purchasePayment.create).toHaveBeenCalled();
    });
  });

  describe("Módulo 6: Transformación", () => {
    it("debe registrar transformación descontando materia prima e incrementando producto terminado", async () => {
      (prisma.transformation.create as any).mockResolvedValue({ id: 50 });
      (prisma.supply.findUnique as any)
        .mockResolvedValueOnce({ id: 1, currentStock: 20 })
        .mockResolvedValueOnce({ id: 2, currentStock: 0 });

      await registerTransformation({
        consumos: [{ supplyId: 1, quantity: 5 }],
        producidos: [{ supplyId: 2, quantity: 4 }],
      });

      expect(prisma.supply.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { currentStock: 15 },
      });
      expect(prisma.supply.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { currentStock: 4 },
      });
    });
  });

  describe("Módulo 7: Compra sin comprobante", () => {
    it("debe registrar compra sin comprobante y actualizar el inventario", async () => {
      (prisma.supply.findUnique as any).mockResolvedValue({ id: 1, currentStock: 10 });
      (prisma.informalPurchase.create as any).mockResolvedValue({ id: 1 });

      await registerPurchaseWithoutVoucher({
        supplyId: 1,
        quantity: 5,
        amountPaid: 50,
      });

      expect(prisma.supply.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { currentStock: 15 },
      });
    });
  });
});
