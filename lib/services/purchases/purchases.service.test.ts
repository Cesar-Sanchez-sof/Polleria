/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupplier } from "./supplier";
import { lookupDocument } from "./document-lookup";
import { createProduct, registerInventoryAdjustment, updateProductMinimum, updateProductUnit, setProductStatus } from "./product";
import { createPurchaseOrder, registerUnifiedPurchase } from "./purchase-order";
import { createPurchaseVoucher } from "./invoices";
import {
  registerTransformation,
  createTransformationRecipe,
  toggleTransformationRecipe,
  deleteTransformationRecipe,
  executeTransformation,
  annulTransformation,
} from "./transformation";
import {
  postTransformationJournalEntries,
  reverseTransformationJournalEntries,
} from "@/lib/services/accounting-posting.service";
import {
  registerPurchaseWithoutVoucher,
  annulInformalPurchase,
} from "./purchase-without-voucher";
import { ProductType, InventoryMovementType, InformalPurchaseType, ExpenseCategory, AffectationIgv } from "@prisma/client";

vi.mock("@/lib/services/accounting-posting.service", () => ({
  postPurchaseJournalEntries: vi.fn().mockResolvedValue([1, 2, 3, 4]),
  postPurchasePaymentJournalEntry: vi.fn().mockResolvedValue(10),
  postInformalPurchaseJournalEntry: vi.fn().mockResolvedValue(101),
  annulInformalPurchaseJournalEntry: vi.fn().mockResolvedValue(102),
  postTransformationJournalEntries: vi.fn().mockResolvedValue([201]),
  reverseTransformationJournalEntries: vi.fn().mockResolvedValue([202]),
  inventoryAccountCode: (product: { type: string; hasRecipe: boolean }) =>
    product.type === "RawMaterial" ? "241" : product.hasRecipe ? "211" : "201",
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
    product: {
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
    purchaseOrderItem: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
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
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    transformationItem: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
      count: vi.fn(),
    },
    productRecipe: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    informalPurchase: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
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

    it("lookupDocument debe rechazar documentos con longitud inválida", async () => {
      const res = await lookupDocument("123");
      expect(res.success).toBe(false);
      expect(res.error).toBe("El documento debe tener 8 u 11 dígitos");
    });

    it("lookupDocument debe consultar DNI y retornar datos estructurados", async () => {
      const originalFetch = global.fetch;
      const originalEnv = process.env.JSON_PE_TOKEN;
      process.env.JSON_PE_TOKEN = "test-token";

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            nombres: "JUAN CARLOS",
            apellido_paterno: "PEREZ",
            apellido_materno: "GOMEZ",
          },
        }),
      } as any);

      try {
        const res = await lookupDocument("12345678");
        expect(res.success).toBe(true);
        expect(res.data?.documentType).toBe("DNI");
        expect(res.data?.businessName).toBe("JUAN CARLOS PEREZ GOMEZ");
        expect(res.data?.firstName).toBe("JUAN CARLOS");
        expect(res.data?.lastName).toBe("PEREZ GOMEZ");
      } finally {
        global.fetch = originalFetch;
        process.env.JSON_PE_TOKEN = originalEnv;
      }
    });

    it("lookupDocument debe consultar RUC y retornar datos estructurados", async () => {
      const originalFetch = global.fetch;
      const originalEnv = process.env.JSON_PE_TOKEN;
      process.env.JSON_PE_TOKEN = "test-token";

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            nombre_o_razon_social: "DISTRIBUIDORA AVICOLA SAC",
            direccion_completa: "AV. LOS POLLOS 123",
            distrito: "LOS OLIVOS",
            provincia: "LIMA",
            departamento: "LIMA",
            estado: "ACTIVO",
          },
        }),
      } as any);

      try {
        const res = await lookupDocument("20123456789");
        expect(res.success).toBe(true);
        expect(res.data?.documentType).toBe("RUC");
        expect(res.data?.businessName).toBe("DISTRIBUIDORA AVICOLA SAC");
        expect(res.data?.address).toBe("AV. LOS POLLOS 123");
        expect(res.data?.district).toBe("LOS OLIVOS");
        expect(res.data?.province).toBe("LIMA");
        expect(res.data?.department).toBe("LIMA");
        expect(res.data?.status).toBe("ACTIVO");
      } finally {
        global.fetch = originalFetch;
        process.env.JSON_PE_TOKEN = originalEnv;
      }
    });

    it("lookupDocument debe manejar error 429 de cuota agotada gracefully", async () => {
      const originalFetch = global.fetch;
      const originalEnv = process.env.JSON_PE_TOKEN;
      process.env.JSON_PE_TOKEN = "test-token";

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      } as any);

      try {
        const res = await lookupDocument("20123456789");
        expect(res.success).toBe(false);
        expect(res.error).toBe("Consulta temporalmente no disponible. Intenta más tarde.");
      } finally {
        global.fetch = originalFetch;
        process.env.JSON_PE_TOKEN = originalEnv;
      }
    });

    it("lookupDocument debe manejar timeout / abort gracefully", async () => {
      const originalFetch = global.fetch;
      const originalEnv = process.env.JSON_PE_TOKEN;
      process.env.JSON_PE_TOKEN = "test-token";

      global.fetch = vi.fn().mockRejectedValue({
        name: "AbortError",
      });

      try {
        const res = await lookupDocument("20123456789");
        expect(res.success).toBe(false);
        expect(res.error).toBe("La consulta tardó demasiado. Intenta de nuevo.");
      } finally {
        global.fetch = originalFetch;
        process.env.JSON_PE_TOKEN = originalEnv;
      }
    });
  });

  describe("Módulo 5: Insumos y Ajuste de Inventario", () => {
    it("debe crear un insumo con currentStock inicial en 0 y afectacionIgv", async () => {
      (prisma.product.create as any).mockResolvedValue({
        id: 1,
        name: "Pollo Entero",
        affectationIgv: AffectationIgv.Included,
        currentStock: 0,
      });

      await createProduct({
        name: "Pollo Entero",
        unitOfMeasure: "KG",
        affectationIgv: AffectationIgv.Included,
      });

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Pollo Entero",
          affectationIgv: AffectationIgv.Included,
          currentStock: 0,
        }),
      });
    });

    it("debe registrar un ajuste de inventario recalculando el stock", async () => {
      (prisma.product.findUnique as any).mockResolvedValue({
        id: 1,
        currentStock: 10,
      });
      (prisma.inventoryMovement.create as any).mockResolvedValue({ id: 1 });
      (prisma.product.update as any).mockResolvedValue({
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
      expect(res.product.currentStock).toBe(15);
    });

    it("debe actualizar el stock mínimo de un insumo exitosamente", async () => {
      (prisma.product.findUnique as any).mockResolvedValue({
        id: 1,
        name: "Pollo Entero",
        minimumStock: 5,
      });
      (prisma.product.update as any).mockResolvedValue({
        id: 1,
        name: "Pollo Entero",
        minimumStock: 10,
      });

      const res = await updateProductMinimum(1, 10);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { minimumStock: 10 },
      });
      expect(res.minimumStock).toBe(10);
    });

    it("debe lanzar error si el stock mínimo es negativo", async () => {
      await expect(updateProductMinimum(1, -5)).rejects.toThrow(
        "El stock mínimo no puede ser negativo"
      );
    });

    it("debe actualizar la unidad de medida del insumo", async () => {
      (prisma.product.findUnique as any).mockResolvedValue({
        id: 1,
        name: "Pollo Entero",
        unitOfMeasure: "KG",
      });
      (prisma.product.update as any).mockResolvedValue({
        id: 1,
        name: "Pollo Entero",
        unitOfMeasure: "UNID",
      });

      const res = await updateProductUnit(1, "UNID");

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { unitOfMeasure: "UNID" },
      });
      expect(res.unitOfMeasure).toBe("UNID");
    });

    it("debe lanzar error si la unidad de medida está vacía", async () => {
      await expect(updateProductUnit(1, "   ")).rejects.toThrow(
        "La unidad de medida es obligatoria"
      );
    });

    it("debe lanzar error si el insumo no existe al actualizar la unidad de medida", async () => {
      (prisma.product.findUnique as any).mockResolvedValue(null);

      await expect(updateProductUnit(999, "UNID")).rejects.toThrow(
        "Insumo no encontrado"
      );
    });

    it("debe cambiar el estado active del insumo a false (desactivar)", async () => {
      (prisma.product.findUnique as any).mockResolvedValue({
        id: 1,
        name: "Pollo Entero",
        active: true,
      });
      (prisma.product.update as any).mockResolvedValue({
        id: 1,
        name: "Pollo Entero",
        active: false,
      });

      const res = await setProductStatus(1, false);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { active: false },
      });
      expect(res.active).toBe(false);
    });

    it("debe lanzar error si el insumo no existe al cambiar su estado", async () => {
      (prisma.product.findUnique as any).mockResolvedValue(null);

      await expect(setProductStatus(999, false)).rejects.toThrow(
        "Insumo no encontrado"
      );
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
        items: [{ productId: 1, quantityOrdered: 10, unitPrice: 15 }],
      });

      expect(res.status).toBe("Pending");
    });
  });

  describe("Módulo 4: Comprobantes y Facturas", () => {
    it("debe crear comprobante al contado y generar su pago automático", async () => {
      (prisma.purchaseInvoice.findFirst as any).mockResolvedValue(null);
      (prisma.purchaseOrder.findUnique as any).mockResolvedValue({
        id: 1,
        items: [
          { quantityReceived: 10, unitPrice: 10 },
        ],
      });
      (prisma.purchaseInvoice.create as any).mockResolvedValue({ id: 5, totalAmount: 118 });
      (prisma.paymentType.findUnique as any).mockResolvedValue({ id: 1, name: "Efectivo" });

      await createPurchaseVoucher({
        supplierId: 1,
        purchaseOrderId: 1,
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
    it("debe registrar transformación descontando materia prima, incrementando producto terminado y asentando 241 → 211", async () => {
      (prisma.transformation.create as any).mockResolvedValue({ id: 50 });
      (prisma.product.findUnique as any)
        .mockResolvedValueOnce({ id: 1, currentStock: 20, averageCost: 10, type: "RawMaterial" })
        .mockResolvedValueOnce({ id: 2, currentStock: 0, type: "FinishedProduct" });
      (prisma.productRecipe.findMany as any).mockResolvedValueOnce([]);

      await registerTransformation({
        consumptions: [{ productId: 1, quantity: 5 }],
        produced: [{ productId: 2, quantity: 4 }],
      });

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { currentStock: 15 },
      });
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { currentStock: 4 },
      });
      // 5 × S/ 10 de materia prima (241) pasan a productos terminados
      expect(postTransformationJournalEntries).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          transformationId: 50,
          consumed: [{ accountCode: "241", amount: 50 }],
        })
      );
    });

    it("debe crear una receta con varios ingredientes (1/4 pollo = pollo + papas)", async () => {
      (prisma.product.findUnique as any).mockResolvedValueOnce({ id: 2, name: "1/4 Pollo a la Brasa" });
      (prisma.productRecipe.count as any).mockResolvedValue(0);
      (prisma.productRecipe.findFirst as any).mockResolvedValue(null);
      (prisma.product.findMany as any).mockResolvedValueOnce([{ id: 1 }, { id: 3 }]);
      (prisma.productRecipe.findMany as any).mockResolvedValueOnce([
        { id: 1, productId: 2, ingredientId: 1, quantityRequired: 0.25, active: true },
        { id: 2, productId: 2, ingredientId: 3, quantityRequired: 0.2, active: true },
      ]);

      const res = await createTransformationRecipe({
        productId: 2,
        ingredients: [
          { ingredientId: 1, quantityRequired: 0.25 },
          { ingredientId: 3, quantityRequired: 0.2 },
        ],
      });

      expect(res).toHaveLength(2);
      expect(prisma.productRecipe.createMany).toHaveBeenCalledWith({
        data: [
          { productId: 2, ingredientId: 1, quantityRequired: 0.25, active: true },
          { productId: 2, ingredientId: 3, quantityRequired: 0.2, active: true },
        ],
      });
    });

    it("debe rechazar recetas sin ingredientes, repetidos, con el propio producto o cantidades <= 0", async () => {
      await expect(createTransformationRecipe({ productId: 2, ingredients: [] })).rejects.toThrow(
        "Debe agregar al menos un ingrediente a la receta"
      );
      await expect(
        createTransformationRecipe({ productId: 1, ingredients: [{ ingredientId: 1, quantityRequired: 1 }] })
      ).rejects.toThrow("El producto no puede ser ingrediente de sí mismo");
      await expect(
        createTransformationRecipe({
          productId: 2,
          ingredients: [
            { ingredientId: 1, quantityRequired: 1 },
            { ingredientId: 1, quantityRequired: 2 },
          ],
        })
      ).rejects.toThrow("Hay ingredientes repetidos en la receta");
      await expect(
        createTransformationRecipe({ productId: 2, ingredients: [{ ingredientId: 1, quantityRequired: 0 }] })
      ).rejects.toThrow("La cantidad de cada ingrediente debe ser mayor a 0");
    });

    it("debe rechazar crear una receta si el producto ya tiene una", async () => {
      (prisma.product.findUnique as any).mockResolvedValueOnce({ id: 2, name: "Presas de pollo" });
      (prisma.productRecipe.count as any).mockResolvedValue(1);

      await expect(
        createTransformationRecipe({ productId: 2, ingredients: [{ ingredientId: 1, quantityRequired: 0.125 }] })
      ).rejects.toThrow("Este producto ya tiene una receta");
    });

    it("debe rechazar una receta circular (el ingrediente ya se elabora con el producto)", async () => {
      (prisma.product.findUnique as any).mockResolvedValueOnce({ id: 2, name: "Presas de pollo" });
      (prisma.productRecipe.count as any).mockResolvedValue(0);
      (prisma.productRecipe.findFirst as any).mockResolvedValue({ id: 9 });

      await expect(
        createTransformationRecipe({ productId: 2, ingredients: [{ ingredientId: 1, quantityRequired: 1 }] })
      ).rejects.toThrow("Receta circular");
    });

    it("debe ejecutar la receta de varios ingredientes, descontar cada uno, costear el producto y asentar 241 → 211", async () => {
      (prisma.productRecipe.findMany as any)
        .mockResolvedValueOnce([
          { id: 1, productId: 2, ingredientId: 1, quantityRequired: 0.25, active: true },
          { id: 2, productId: 2, ingredientId: 3, quantityRequired: 0.2, active: true },
        ])
        .mockResolvedValueOnce([]); // ningún ingrediente se elabora con receta propia
      (prisma.product.findUnique as any)
        .mockResolvedValueOnce({ id: 2, name: "1/4 Pollo", currentStock: 0, averageCost: 0, type: "FinishedProduct" }) // producido
        .mockResolvedValueOnce({ id: 1, name: "Pollo entero", currentStock: 48, averageCost: 10, lastCost: 10, type: "RawMaterial" })
        .mockResolvedValueOnce({ id: 3, name: "Papas", currentStock: 5, averageCost: 3, lastCost: 3, type: "RawMaterial" });

      (prisma.transformation.create as any).mockResolvedValue({ id: 10 });
      (prisma.transformationItem.create as any)
        .mockResolvedValueOnce({ id: 101 }) // consumo pollo
        .mockResolvedValueOnce({ id: 102 }) // consumo papas
        .mockResolvedValueOnce({ id: 103 }); // producido

      const res = await executeTransformation(2, 4, "Producción del turno mañana");

      expect(res.id).toBe(10);
      // Pollo: 0.25 × 4 = 1 → 48 - 1 = 47. Papas: 0.2 × 4 = 0.8 → 5 - 0.8 = 4.2
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 }, data: { currentStock: 47 } })
      );
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 3 }, data: { currentStock: 4.2 } })
      );
      // Valor consumido: 1 × 10 + 0.8 × 3 = 12.4. Costo unitario del producido: 12.4 / 4 = 3.1
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 2 },
          data: { currentStock: 4, lastCost: 3.1, averageCost: 3.1 },
        })
      );
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 1,
            transformationItemId: 101,
            movementType: "TransformationOut",
            quantity: 1,
            unitCost: 10,
          }),
        })
      );
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 2,
            transformationItemId: 103,
            movementType: "TransformationIn",
            quantity: 4,
            unitCost: 3.1,
          }),
        })
      );
      // Asiento en el diario general: Debe 211 / Haber 241 por el valor consumido
      expect(postTransformationJournalEntries).toHaveBeenCalledTimes(1);
      const posted = (postTransformationJournalEntries as any).mock.calls[0][1];
      expect(posted.transformationId).toBe(10);
      expect(posted.label).toBe("TR-10");
      expect(posted.consumed).toHaveLength(2);
      expect(posted.consumed.every((c: any) => c.accountCode === "241")).toBe(true);
      expect(posted.consumed.reduce((sum: number, c: any) => sum + c.amount, 0)).toBeCloseTo(12.4, 2);
    });

    it("debe enviar a la cuenta 211 el insumo que ya es un producto transformado", async () => {
      (prisma.productRecipe.findMany as any)
        .mockResolvedValueOnce([{ id: 1, productId: 5, ingredientId: 2, quantityRequired: 1, active: true }])
        .mockResolvedValueOnce([{ productId: 2 }]); // el ingrediente tiene receta propia
      (prisma.product.findUnique as any)
        .mockResolvedValueOnce({ id: 5, name: "Combo", currentStock: 0, averageCost: 0, type: "FinishedProduct" })
        .mockResolvedValueOnce({ id: 2, name: "1/4 Pollo", currentStock: 10, averageCost: 4, type: "FinishedProduct" });
      (prisma.transformation.create as any).mockResolvedValue({ id: 11 });
      (prisma.transformationItem.create as any).mockResolvedValue({ id: 1 });

      await executeTransformation(5, 2);

      const posted = (postTransformationJournalEntries as any).mock.calls[0][1];
      expect(posted.consumed).toEqual([{ accountCode: "211", amount: 8 }]);
    });

    it("debe rechazar la ejecución si falta stock de algún ingrediente y no mover nada", async () => {
      (prisma.productRecipe.findMany as any).mockResolvedValueOnce([
        { id: 1, productId: 2, ingredientId: 1, quantityRequired: 1, active: true },
        { id: 2, productId: 2, ingredientId: 3, quantityRequired: 0.2, active: true },
      ]);
      (prisma.product.findUnique as any)
        .mockResolvedValueOnce({ id: 2, name: "Presas", currentStock: 0, averageCost: 0 })
        .mockResolvedValueOnce({ id: 1, name: "Pollo entero", currentStock: 3, averageCost: 10 })
        .mockResolvedValueOnce({ id: 3, name: "Papas", currentStock: 50, averageCost: 3 });

      await expect(executeTransformation(2, 5)).rejects.toThrow(
        "Stock insuficiente. Pollo entero: disponibles 3, necesarios 5"
      );
      expect(prisma.transformation.create).not.toHaveBeenCalled();
      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(postTransformationJournalEntries).not.toHaveBeenCalled();
    });

    it("debe rechazar la ejecución de una receta inexistente o desactivada", async () => {
      (prisma.productRecipe.findMany as any).mockResolvedValueOnce([]);
      await expect(executeTransformation(2, 1)).rejects.toThrow("Receta no encontrada o inactiva");

      (prisma.productRecipe.findMany as any).mockResolvedValueOnce([
        { id: 1, productId: 2, ingredientId: 1, quantityRequired: 1, active: false },
      ]);
      await expect(executeTransformation(2, 1)).rejects.toThrow("Receta no encontrada o inactiva");
    });

    it("debe desactivar una receta completa y bloquear su eliminación si ya fue usada", async () => {
      (prisma.productRecipe.updateMany as any).mockResolvedValue({ count: 2 });
      await toggleTransformationRecipe(2, false);
      expect(prisma.productRecipe.updateMany).toHaveBeenCalledWith({
        where: { productId: 2 },
        data: { active: false },
      });

      (prisma.productRecipe.count as any).mockResolvedValue(2);
      (prisma.transformationItem.count as any).mockResolvedValue(3);
      await expect(deleteTransformationRecipe(2)).rejects.toThrow(
        "No se puede eliminar la receta porque ya tiene registros de ejecución histórica"
      );
      expect(prisma.productRecipe.deleteMany).not.toHaveBeenCalled();
    });

    it("debe anular una transformación exitosamente revirtiendo stock y el asiento del diario", async () => {
      (prisma.transformation.findUnique as any).mockResolvedValue({
        id: 10,
        annulled: false,
        items: [
          {
            id: 101,
            productId: 1,
            itemType: "Consumo",
            quantity: 5,
            unitCost: 10,
          },
          {
            id: 102,
            productId: 2,
            itemType: "Producido",
            quantity: 40,
            unitCost: 1.25,
          },
        ],
      });

      (prisma.product.findUnique as any).mockResolvedValue({
        id: 2,
        currentStock: 45,
      });

      (prisma.transformation.update as any).mockResolvedValue({
        id: 10,
        annulled: true,
        annulmentReason: "Error de cantidad",
      });

      const res = await annulTransformation(10, "Error de cantidad", 1);

      expect(res.id).toBe(10);
      expect(res.annulled).toBe(true);

      // 1. Reversión consumo: devolver materia prima (TransformationIn, quantity: 5)
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 1,
            transformationItemId: 101,
            movementType: "TransformationIn",
            quantity: 5,
          }),
        })
      );
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { currentStock: { increment: 5 } },
        })
      );

      // 2. Reversión producido: descontar producto terminado (TransformationOut, quantity: 40)
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 2,
            transformationItemId: 102,
            movementType: "TransformationOut",
            quantity: 40,
          }),
        })
      );
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 2 },
          data: { currentStock: { decrement: 40 } },
        })
      );

      // 3. Asiento inverso en el diario
      expect(reverseTransformationJournalEntries).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ transformationId: 10, label: "TR-10", reason: "Error de cantidad" })
      );

      // 4. Update transformation
      expect(prisma.transformation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: expect.objectContaining({
            annulled: true,
            annulmentReason: "Error de cantidad",
          }),
        })
      );
    });

    it("debe rechazar anulación si el stock del producto terminado es insuficiente", async () => {
      (prisma.transformation.findUnique as any).mockResolvedValue({
        id: 10,
        annulled: false,
        items: [
          {
            id: 101,
            productId: 1,
            itemType: "Consumo",
            quantity: 5,
          },
          {
            id: 102,
            productId: 2,
            itemType: "Producido",
            quantity: 40,
          },
        ],
      });

      // Stock de producto terminado es 10, menor a los 40 requeridos para revertir
      (prisma.product.findUnique as any).mockResolvedValue({
        id: 2,
        currentStock: 10,
      });

      await expect(annulTransformation(10, "Error en lote")).rejects.toThrow(
        "Stock insuficiente para revertir el producto terminado. Stock actual: 10, necesario: 40"
      );
      expect(reverseTransformationJournalEntries).not.toHaveBeenCalled();
    });

    it("debe rechazar anulación si ya está anulada", async () => {
      (prisma.transformation.findUnique as any).mockResolvedValue({
        id: 10,
        annulled: true,
        items: [],
      });

      await expect(annulTransformation(10, "Intento duplicado")).rejects.toThrow(
        "Esta transformación ya está anulada"
      );
    });

    it("debe rechazar anulación si el motivo está vacío", async () => {
      await expect(annulTransformation(10, "   ")).rejects.toThrow(
        "El motivo de anulación es obligatorio"
      );
    });
  });

  describe("Módulo 7: Compra sin comprobante", () => {
    it("debe registrar compra de insumo (InventoryItem), linkear InventoryMovement y actualizar currentStock, lastCost y averageCost", async () => {
      (prisma.product.findUnique as any).mockResolvedValue({
        id: 1,
        currentStock: 10,
        averageCost: 8,
      });
      (prisma.informalPurchase.create as any).mockResolvedValue({ id: 101 });

      const res = await registerPurchaseWithoutVoucher({
        purchaseType: InformalPurchaseType.InventoryItem,
        productId: 1,
        quantity: 5,
        amountPaid: 50,
      });

      expect(res.id).toBe(101);
      expect(prisma.informalPurchase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purchaseType: InformalPurchaseType.InventoryItem,
            productId: 1,
            quantity: 5,
            amountPaid: 50,
            annulled: false,
          }),
        })
      );
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 1,
            informalPurchaseId: 101,
            movementType: "InformalPurchase",
            quantity: 5,
            unitCost: 10,
          }),
        })
      );
      // Promedio ponderado: (10 * 8 + 5 * 10) / 15 = 130 / 15 = 8.67
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          currentStock: 15,
          lastCost: 10,
          averageCost: 8.67,
        },
      });
    });

    it("debe registrar un gasto operativo (OperatingExpense) sin modificar inventario", async () => {
      (prisma.informalPurchase.create as any).mockResolvedValue({ id: 102 });

      const res = await registerPurchaseWithoutVoucher({
        purchaseType: InformalPurchaseType.OperatingExpense,
        expenseCategory: ExpenseCategory.EventServices,
        itemDescription: "Cantante aniversario",
        amountPaid: 300,
      });

      expect(res.id).toBe(102);
      expect(prisma.informalPurchase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purchaseType: InformalPurchaseType.OperatingExpense,
            expenseCategory: ExpenseCategory.EventServices,
            itemDescription: "Cantante aniversario",
            productId: null,
            amountPaid: 300,
          }),
        })
      );
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it("debe validar campos requeridos para InventoryItem", async () => {
      await expect(
        registerPurchaseWithoutVoucher({
          purchaseType: InformalPurchaseType.InventoryItem,
          quantity: 5,
          amountPaid: 50,
        })
      ).rejects.toThrow("Debe seleccionar un insumo");

      await expect(
        registerPurchaseWithoutVoucher({
          purchaseType: InformalPurchaseType.InventoryItem,
          productId: 1,
          quantity: 0,
          amountPaid: 50,
        })
      ).rejects.toThrow("La cantidad debe ser mayor a 0");

      await expect(
        registerPurchaseWithoutVoucher({
          purchaseType: InformalPurchaseType.InventoryItem,
          productId: 1,
          quantity: 5,
          amountPaid: 0,
        })
      ).rejects.toThrow("El monto pagado debe ser mayor a 0");
    });

    it("debe validar campos requeridos para OperatingExpense", async () => {
      await expect(
        registerPurchaseWithoutVoucher({
          purchaseType: InformalPurchaseType.OperatingExpense,
          itemDescription: "",
          expenseCategory: ExpenseCategory.CasualStaff,
          amountPaid: 100,
        })
      ).rejects.toThrow("La descripción del gasto es obligatoria");

      await expect(
        registerPurchaseWithoutVoucher({
          purchaseType: InformalPurchaseType.OperatingExpense,
          itemDescription: "Mozo eventual",
          amountPaid: 100,
        })
      ).rejects.toThrow("Debe seleccionar una categoría de gasto");

      await expect(
        registerPurchaseWithoutVoucher({
          purchaseType: InformalPurchaseType.OperatingExpense,
          itemDescription: "Mozo eventual",
          expenseCategory: ExpenseCategory.CasualStaff,
          amountPaid: 0,
        })
      ).rejects.toThrow("El monto pagado debe ser mayor a 0");
    });

    it("debe anular una compra de insumo con stock suficiente revirtiendo el stock", async () => {
      (prisma.informalPurchase.findUnique as any).mockResolvedValue({
        id: 101,
        purchaseType: InformalPurchaseType.InventoryItem,
        productId: 1,
        quantity: 5,
        amountPaid: 50,
        annulled: false,
      });
      (prisma.product.findUnique as any).mockResolvedValue({
        id: 1,
        currentStock: 20,
      });
      (prisma.informalPurchase.update as any).mockResolvedValue({
        id: 101,
        annulled: true,
      });

      const res = await annulInformalPurchase(101, "Error de tipeo");

      expect(res.annulled).toBe(true);
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 1,
            informalPurchaseId: 101,
            quantity: -5,
            reason: expect.stringContaining("Error de tipeo"),
          }),
        })
      );
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { currentStock: 15 },
      });
      expect(prisma.informalPurchase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 101 },
          data: expect.objectContaining({
            annulled: true,
            annulmentReason: "Error de tipeo",
          }),
        })
      );
    });

    it("debe rechazar anulación si el stock actual es insuficiente para revertir", async () => {
      (prisma.informalPurchase.findUnique as any).mockResolvedValue({
        id: 101,
        purchaseType: InformalPurchaseType.InventoryItem,
        productId: 1,
        quantity: 10,
        amountPaid: 100,
        annulled: false,
      });
      (prisma.product.findUnique as any).mockResolvedValue({
        id: 1,
        currentStock: 3,
      });

      await expect(
        annulInformalPurchase(101, "Error de registro")
      ).rejects.toThrow("Stock insuficiente para revertir. Stock actual: 3, necesario: 10");
    });

    it("debe anular un gasto operativo sin modificar stock ni inventario", async () => {
      (prisma.informalPurchase.findUnique as any).mockResolvedValue({
        id: 102,
        purchaseType: InformalPurchaseType.OperatingExpense,
        productId: null,
        amountPaid: 300,
        annulled: false,
      });
      (prisma.informalPurchase.update as any).mockResolvedValue({
        id: 102,
        annulled: true,
      });

      const res = await annulInformalPurchase(102, "Evento cancelado");

      expect(res.annulled).toBe(true);
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(prisma.informalPurchase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 102 },
          data: expect.objectContaining({
            annulled: true,
            annulmentReason: "Evento cancelado",
          }),
        })
      );
    });

    it("debe rechazar anulación si la compra ya está anulada o no tiene motivo", async () => {
      await expect(annulInformalPurchase(101, "")).rejects.toThrow(
        "El motivo de anulación es obligatorio"
      );

      (prisma.informalPurchase.findUnique as any).mockResolvedValue({
        id: 101,
        annulled: true,
      });

      await expect(
        annulInformalPurchase(101, "Reintentando")
      ).rejects.toThrow("Esta compra ya está anulada");
    });
  });

  describe("Módulo 2b: Añadir Compra Unificada", () => {
    it("compra al contado con 1 insumo Included", async () => {
      (prisma.purchaseInvoice.findUnique as any).mockResolvedValue(null);
      (prisma.purchaseOrder.findUnique as any).mockResolvedValue(null);
      (prisma.purchaseOrder.create as any).mockResolvedValue({
        id: 1,
        status: "FullyReceived",
        items: [{ id: 10, productId: 1, quantityReceived: 5, unitPrice: 10 }],
      });
      (prisma.purchaseInvoice.create as any).mockResolvedValue({ id: 1 });
      (prisma.product.findUnique as any).mockResolvedValue({ id: 1, currentStock: 10, averageCost: 9 });

      await registerUnifiedPurchase({
        supplierId: 1,
        voucherType: "Factura",
        series: "F001",
        number: 123,
        issuedAt: new Date(),
        paymentCondition: "Contado",
        paymentTypeId: 1,
        items: [
          { productId: 1, quantity: 5, unitPrice: 10, affectationIgv: "Included" },
        ],
      });

      expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "FullyReceived",
          }),
        })
      );
      expect(prisma.purchaseInvoice.create).toHaveBeenCalled();
      expect(prisma.purchasePayment.create).toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purchaseOrderItemId: 10,
            movementType: "Purchase",
          }),
        })
      );
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            currentStock: 15,
            averageCost: 8.82, 
          }),
        })
      );
    });

    it("compra al crédito", async () => {
      (prisma.purchaseInvoice.findUnique as any).mockResolvedValue(null);
      (prisma.purchaseOrder.create as any).mockResolvedValue({
        id: 2,
        status: "FullyReceived",
        items: [{ id: 11, productId: 1, quantityReceived: 5, unitPrice: 10 }],
      });
      (prisma.purchaseInvoice.create as any).mockResolvedValue({ id: 2 });
      (prisma.product.findUnique as any).mockResolvedValue({ id: 1, currentStock: 10, averageCost: 9 });

      await registerUnifiedPurchase({
        supplierId: 1,
        voucherType: "Factura",
        series: "F002",
        number: 124,
        issuedAt: new Date(),
        paymentCondition: "Credito",
        items: [
          { productId: 1, quantity: 5, unitPrice: 10, affectationIgv: "Excluded" },
        ],
      });

      expect(prisma.purchasePayment.create).not.toHaveBeenCalled();
      expect(prisma.product.update).toHaveBeenCalled();
    });

    it("compra con IGV mixto (1 Included + 1 Excluded)", async () => {
      (prisma.purchaseInvoice.findUnique as any).mockResolvedValue(null);
      (prisma.purchaseOrder.create as any).mockResolvedValue({
        id: 3,
        status: "FullyReceived",
        items: [
          { id: 12, productId: 1, quantityReceived: 1, unitPrice: 100 },
          { id: 13, productId: 2, quantityReceived: 1, unitPrice: 50 },
        ],
      });
      (prisma.purchaseInvoice.create as any).mockResolvedValue({ id: 3 });
      (prisma.product.findUnique as any).mockResolvedValue({ id: 1, currentStock: 0, averageCost: 0 });

      await registerUnifiedPurchase({
        supplierId: 1,
        voucherType: "Factura",
        series: "F003",
        number: 125,
        issuedAt: new Date(),
        paymentCondition: "Credito",
        items: [
          { productId: 1, quantity: 1, unitPrice: 100, affectationIgv: "Included" },
          { productId: 2, quantity: 1, unitPrice: 50, affectationIgv: "Excluded" },
        ],
      });

      expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ subtotalLine: 84.75 }),
                expect.objectContaining({ subtotalLine: 50 }),
              ]),
            }),
          }),
        })
      );
    });

    it("validación - items vacíos lanza error", async () => {
      await expect(
        registerUnifiedPurchase({
          supplierId: 1,
          voucherType: "Factura",
          series: "F004",
          number: 126,
          issuedAt: new Date(),
          paymentCondition: "Contado",
          paymentTypeId: 1,
          items: [],
        })
      ).rejects.toThrow("La orden debe tener al menos una línea de insumo");
    });

    it("debe pasar items diferenciados con productType y cuadre a postPurchaseJournalEntries", async () => {
      const { postPurchaseJournalEntries } = await import("@/lib/services/accounting-posting.service");
      (prisma.purchaseInvoice.findUnique as any).mockResolvedValue(null);
      (prisma.purchaseOrder.create as any).mockResolvedValue({
        id: 4,
        status: "FullyReceived",
        items: [
          {
            id: 20,
            productId: 1,
            quantityReceived: 2,
            unitPrice: 10,
            subtotalLine: 20,
            product: { type: "RawMaterial" },
          },
          {
            id: 21,
            productId: 2,
            quantityReceived: 1,
            unitPrice: 30,
            subtotalLine: 30,
            product: { type: "FinishedProduct" },
          },
        ],
      });
      (prisma.purchaseInvoice.create as any).mockResolvedValue({ id: 4 });
      (prisma.product.findUnique as any).mockResolvedValue({ id: 1, currentStock: 0, averageCost: 0 });

      await registerUnifiedPurchase({
        supplierId: 1,
        voucherType: "Factura",
        series: "F005",
        number: 127,
        issuedAt: new Date(),
        paymentCondition: "Credito",
        items: [
          { productId: 1, quantity: 2, unitPrice: 10, affectationIgv: "Excluded" },
          { productId: 2, quantity: 1, unitPrice: 30, affectationIgv: "Excluded" },
        ],
      });

      expect(postPurchaseJournalEntries).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          purchaseInvoiceId: 4,
          subtotal: 50,
          items: [
            { productType: "RawMaterial", subtotalLine: 20 },
            { productType: "FinishedProduct", subtotalLine: 30 },
          ],
        })
      );
    });
  });
});
