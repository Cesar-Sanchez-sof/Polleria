/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupplier } from "./supplier";
import { createSupply, registerInventoryAdjustment, updateSupplyMinimum, setSupplyStatus } from "./supply";
import { createPurchaseOrder, registerUnifiedPurchase } from "./purchase-order";
import { createPurchaseVoucher } from "./invoices";
import {
  registerTransformation,
  createTransformationRecipe,
  executeTransformation,
  annulTransformation,
} from "./transformation";
import {
  registerPurchaseWithoutVoucher,
  annulInformalPurchase,
} from "./purchase-without-voucher";
import { InformalPurchaseType, ExpenseCategory, AffectationIgv } from "@prisma/client";

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
    },
    transformationRecipe: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
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
  });

  describe("Módulo 5: Insumos y Ajuste de Inventario", () => {
    it("debe crear un insumo con currentStock inicial en 0 y afectacionIgv", async () => {
      (prisma.supply.create as any).mockResolvedValue({
        id: 1,
        name: "Pollo Entero",
        affectationIgv: AffectationIgv.Included,
        currentStock: 0,
      });

      await createSupply({
        name: "Pollo Entero",
        unitOfMeasure: "KG",
        affectationIgv: AffectationIgv.Included,
      });

      expect(prisma.supply.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Pollo Entero",
          affectationIgv: AffectationIgv.Included,
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

    it("debe actualizar el stock mínimo de un insumo exitosamente", async () => {
      (prisma.supply.findUnique as any).mockResolvedValue({
        id: 1,
        name: "Pollo Entero",
        minimumStock: 5,
      });
      (prisma.supply.update as any).mockResolvedValue({
        id: 1,
        name: "Pollo Entero",
        minimumStock: 10,
      });

      const res = await updateSupplyMinimum(1, 10);

      expect(prisma.supply.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { minimumStock: 10 },
      });
      expect(res.minimumStock).toBe(10);
    });

    it("debe lanzar error si el stock mínimo es negativo", async () => {
      await expect(updateSupplyMinimum(1, -5)).rejects.toThrow(
        "El stock mínimo no puede ser negativo"
      );
    });

    it("debe lanzar error si el insumo no existe al actualizar stock mínimo", async () => {
      (prisma.supply.findUnique as any).mockResolvedValue(null);

      await expect(updateSupplyMinimum(999, 10)).rejects.toThrow(
        "Insumo no encontrado"
      );
    });

    it("debe cambiar el estado active del insumo a false (desactivar)", async () => {
      (prisma.supply.findUnique as any).mockResolvedValue({
        id: 1,
        name: "Pollo Entero",
        active: true,
      });
      (prisma.supply.update as any).mockResolvedValue({
        id: 1,
        name: "Pollo Entero",
        active: false,
      });

      const res = await setSupplyStatus(1, false);

      expect(prisma.supply.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { active: false },
      });
      expect(res.active).toBe(false);
    });

    it("debe lanzar error si el insumo no existe al cambiar su estado", async () => {
      (prisma.supply.findUnique as any).mockResolvedValue(null);

      await expect(setSupplyStatus(999, false)).rejects.toThrow(
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
        items: [{ supplyId: 1, quantityOrdered: 10, unitPrice: 15 }],
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

    it("debe crear una receta de transformación validando insumos y cantidades", async () => {
      (prisma.supply.findUnique as any)
        .mockResolvedValueOnce({ id: 2, name: "Presas de pollo", type: "FinishedProduct" })
        .mockResolvedValueOnce({ id: 1, name: "Pollo entero", type: "RawMaterial" });
      (prisma.transformationRecipe.findUnique as any).mockResolvedValue(null);
      (prisma.transformationRecipe.create as any).mockResolvedValue({
        id: 1,
        producedSupplyId: 2,
        consumedSupplyId: 1,
        producedQuantity: 8,
        requiredQuantity: 1,
        active: true,
      });

      const res = await createTransformationRecipe({
        producedSupplyId: 2,
        consumedSupplyId: 1,
        producedQuantity: 8,
        requiredQuantity: 1,
      });

      expect(res.id).toBe(1);
      expect(prisma.transformationRecipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            producedSupplyId: 2,
            consumedSupplyId: 1,
            producedQuantity: 8,
            requiredQuantity: 1,
            active: true,
          }),
        })
      );
    });

    it("debe rechazar receta si producido y consumido son el mismo insumo o cantidades <= 0", async () => {
      await expect(
        createTransformationRecipe({
          producedSupplyId: 1,
          consumedSupplyId: 1,
          producedQuantity: 8,
          requiredQuantity: 1,
        })
      ).rejects.toThrow("El insumo producido no puede ser el mismo que el consumido");

      await expect(
        createTransformationRecipe({
          producedSupplyId: 2,
          consumedSupplyId: 1,
          producedQuantity: 0,
          requiredQuantity: 1,
        })
      ).rejects.toThrow("La cantidad producida debe ser mayor a 0");
    });

    it("debe rechazar receta duplicada si ya existe combinación", async () => {
      (prisma.supply.findUnique as any)
        .mockResolvedValueOnce({ id: 2, name: "Presas de pollo" })
        .mockResolvedValueOnce({ id: 1, name: "Pollo entero" });
      (prisma.transformationRecipe.findUnique as any).mockResolvedValue({ id: 99 });

      await expect(
        createTransformationRecipe({
          producedSupplyId: 2,
          consumedSupplyId: 1,
          producedQuantity: 8,
          requiredQuantity: 1,
        })
      ).rejects.toThrow("Ya existe una receta para esta combinación de insumos");
    });

    it("debe ejecutar receta por lote, descontar stock consumido, aumentar producido y actualizar averageCost", async () => {
      (prisma.transformationRecipe.findUnique as any).mockResolvedValue({
        id: 1,
        consumedSupplyId: 1,
        producedSupplyId: 2,
        requiredQuantity: 1,
        producedQuantity: 8,
        active: true,
      });
      (prisma.supply.findUnique as any)
        .mockResolvedValueOnce({ id: 1, currentStock: 48, averageCost: 10, lastCost: 10 }) // consumed
        .mockResolvedValueOnce({ id: 2, currentStock: 0, averageCost: 0, lastCost: 0 }); // produced

      (prisma.transformation.create as any).mockResolvedValue({ id: 10 });
      (prisma.transformationItem.create as any)
        .mockResolvedValueOnce({ id: 101 }) // consumo item
        .mockResolvedValueOnce({ id: 102 }); // producido item

      const res = await executeTransformation(1, 5, "Producción del turno mañana");

      expect(res.id).toBe(10);
      // Consumido: 5 * 1 = 5. Stock: 48 - 5 = 43
      expect(prisma.supply.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { currentStock: 43 },
        })
      );
      // Producido: 5 * 8 = 40. Valor consumido: 5 * 10 = 50. Costo unitario: 50 / 40 = 1.25.
      // Nuevo promedio ponderado: (0*0 + 40*1.25)/40 = 1.25
      expect(prisma.supply.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 2 },
          data: {
            currentStock: 40,
            lastCost: 1.25,
            averageCost: 1.25,
          },
        })
      );
      // InventoryMovement out & in
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            supplyId: 1,
            transformationItemId: 101,
            movementType: "TransformationOut",
            quantity: 5,
            unitCost: 10,
          }),
        })
      );
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            supplyId: 2,
            transformationItemId: 102,
            movementType: "TransformationIn",
            quantity: 40,
            unitCost: 1.25,
          }),
        })
      );
    });

    it("debe rechazar ejecución si el stock del insumo consumido es insuficiente", async () => {
      (prisma.transformationRecipe.findUnique as any).mockResolvedValue({
        id: 1,
        consumedSupplyId: 1,
        producedSupplyId: 2,
        requiredQuantity: 1,
        producedQuantity: 8,
        active: true,
      });
      (prisma.supply.findUnique as any).mockResolvedValueOnce({
        id: 1,
        currentStock: 3,
        averageCost: 10,
      });

      await expect(executeTransformation(1, 5)).rejects.toThrow(
        "Stock insuficiente. Disponibles: 3, necesarios: 5"
      );
    });

    it("debe anular una transformación exitosamente revirtiendo stock con movimientos inversos", async () => {
      (prisma.transformation.findUnique as any).mockResolvedValue({
        id: 10,
        anulado: false,
        items: [
          {
            id: 101,
            supplyId: 1,
            itemType: "Consumo",
            quantity: 5,
            unitCost: 10,
          },
          {
            id: 102,
            supplyId: 2,
            itemType: "Producido",
            quantity: 40,
            unitCost: 1.25,
          },
        ],
      });

      (prisma.supply.findUnique as any).mockResolvedValue({
        id: 2,
        currentStock: 45,
      });

      (prisma.transformation.update as any).mockResolvedValue({
        id: 10,
        anulado: true,
        motivoAnulacion: "Error de cantidad",
      });

      const res = await annulTransformation(10, "Error de cantidad", 1);

      expect(res.id).toBe(10);
      expect(res.anulado).toBe(true);

      // 1. Reversión consumo: devolver materia prima (TransformationIn, quantity: 5)
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            supplyId: 1,
            transformationItemId: 101,
            movementType: "TransformationIn",
            quantity: 5,
          }),
        })
      );
      expect(prisma.supply.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { currentStock: { increment: 5 } },
        })
      );

      // 2. Reversión producido: descontar producto terminado (TransformationOut, quantity: 40)
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            supplyId: 2,
            transformationItemId: 102,
            movementType: "TransformationOut",
            quantity: 40,
          }),
        })
      );
      expect(prisma.supply.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 2 },
          data: { currentStock: { decrement: 40 } },
        })
      );

      // 3. Update transformation
      expect(prisma.transformation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: expect.objectContaining({
            anulado: true,
            motivoAnulacion: "Error de cantidad",
          }),
        })
      );
    });

    it("debe rechazar anulación si el stock del producto terminado es insuficiente", async () => {
      (prisma.transformation.findUnique as any).mockResolvedValue({
        id: 10,
        anulado: false,
        items: [
          {
            id: 101,
            supplyId: 1,
            itemType: "Consumo",
            quantity: 5,
          },
          {
            id: 102,
            supplyId: 2,
            itemType: "Producido",
            quantity: 40,
          },
        ],
      });

      // Stock de producto terminado es 10, menor a los 40 requeridos para revertir
      (prisma.supply.findUnique as any).mockResolvedValue({
        id: 2,
        currentStock: 10,
      });

      await expect(annulTransformation(10, "Error en lote")).rejects.toThrow(
        "Stock insuficiente para revertir el producto terminado. Stock actual: 10, necesario: 40"
      );
    });

    it("debe rechazar anulación si ya está anulada", async () => {
      (prisma.transformation.findUnique as any).mockResolvedValue({
        id: 10,
        anulado: true,
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
      (prisma.supply.findUnique as any).mockResolvedValue({
        id: 1,
        currentStock: 10,
        averageCost: 8,
      });
      (prisma.informalPurchase.create as any).mockResolvedValue({ id: 101 });

      const res = await registerPurchaseWithoutVoucher({
        purchaseType: InformalPurchaseType.InventoryItem,
        supplyId: 1,
        quantity: 5,
        amountPaid: 50,
      });

      expect(res.id).toBe(101);
      expect(prisma.informalPurchase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purchaseType: InformalPurchaseType.InventoryItem,
            supplyId: 1,
            quantity: 5,
            amountPaid: 50,
            anulado: false,
          }),
        })
      );
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            supplyId: 1,
            informalPurchaseId: 101,
            movementType: "InformalPurchase",
            quantity: 5,
            unitCost: 10,
          }),
        })
      );
      // Promedio ponderado: (10 * 8 + 5 * 10) / 15 = 130 / 15 = 8.67
      expect(prisma.supply.update).toHaveBeenCalledWith({
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
            supplyId: null,
            amountPaid: 300,
          }),
        })
      );
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.supply.update).not.toHaveBeenCalled();
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
          supplyId: 1,
          quantity: 0,
          amountPaid: 50,
        })
      ).rejects.toThrow("La cantidad debe ser mayor a 0");

      await expect(
        registerPurchaseWithoutVoucher({
          purchaseType: InformalPurchaseType.InventoryItem,
          supplyId: 1,
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
        supplyId: 1,
        quantity: 5,
        amountPaid: 50,
        anulado: false,
      });
      (prisma.supply.findUnique as any).mockResolvedValue({
        id: 1,
        currentStock: 20,
      });
      (prisma.informalPurchase.update as any).mockResolvedValue({
        id: 101,
        anulado: true,
      });

      const res = await annulInformalPurchase(101, "Error de tipeo");

      expect(res.anulado).toBe(true);
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            supplyId: 1,
            informalPurchaseId: 101,
            quantity: -5,
            reason: expect.stringContaining("Error de tipeo"),
          }),
        })
      );
      expect(prisma.supply.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { currentStock: 15 },
      });
      expect(prisma.informalPurchase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 101 },
          data: expect.objectContaining({
            anulado: true,
            motivoAnulacion: "Error de tipeo",
          }),
        })
      );
    });

    it("debe rechazar anulación si el stock actual es insuficiente para revertir", async () => {
      (prisma.informalPurchase.findUnique as any).mockResolvedValue({
        id: 101,
        purchaseType: InformalPurchaseType.InventoryItem,
        supplyId: 1,
        quantity: 10,
        amountPaid: 100,
        anulado: false,
      });
      (prisma.supply.findUnique as any).mockResolvedValue({
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
        supplyId: null,
        amountPaid: 300,
        anulado: false,
      });
      (prisma.informalPurchase.update as any).mockResolvedValue({
        id: 102,
        anulado: true,
      });

      const res = await annulInformalPurchase(102, "Evento cancelado");

      expect(res.anulado).toBe(true);
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.supply.update).not.toHaveBeenCalled();
      expect(prisma.informalPurchase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 102 },
          data: expect.objectContaining({
            anulado: true,
            motivoAnulacion: "Evento cancelado",
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
        anulado: true,
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
        items: [{ id: 10, supplyId: 1, quantityReceived: 5, unitPrice: 10 }],
      });
      (prisma.purchaseInvoice.create as any).mockResolvedValue({ id: 1 });
      (prisma.supply.findUnique as any).mockResolvedValue({ id: 1, currentStock: 10, averageCost: 9 });

      await registerUnifiedPurchase({
        supplierId: 1,
        voucherType: "Factura",
        series: "F001",
        number: 123,
        issuedAt: new Date(),
        paymentCondition: "Contado",
        paymentTypeId: 1,
        items: [
          { supplyId: 1, quantity: 5, unitPrice: 10, affectationIgv: "Included" },
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
      expect(prisma.supply.update).toHaveBeenCalledWith(
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
        items: [{ id: 11, supplyId: 1, quantityReceived: 5, unitPrice: 10 }],
      });
      (prisma.purchaseInvoice.create as any).mockResolvedValue({ id: 2 });
      (prisma.supply.findUnique as any).mockResolvedValue({ id: 1, currentStock: 10, averageCost: 9 });

      await registerUnifiedPurchase({
        supplierId: 1,
        voucherType: "Factura",
        series: "F002",
        number: 124,
        issuedAt: new Date(),
        paymentCondition: "Credito",
        items: [
          { supplyId: 1, quantity: 5, unitPrice: 10, affectationIgv: "Excluded" },
        ],
      });

      expect(prisma.purchasePayment.create).not.toHaveBeenCalled();
      expect(prisma.supply.update).toHaveBeenCalled();
    });

    it("compra con IGV mixto (1 Included + 1 Excluded)", async () => {
      (prisma.purchaseInvoice.findUnique as any).mockResolvedValue(null);
      (prisma.purchaseOrder.create as any).mockResolvedValue({
        id: 3,
        status: "FullyReceived",
        items: [
          { id: 12, supplyId: 1, quantityReceived: 1, unitPrice: 100 },
          { id: 13, supplyId: 2, quantityReceived: 1, unitPrice: 50 },
        ],
      });
      (prisma.purchaseInvoice.create as any).mockResolvedValue({ id: 3 });
      (prisma.supply.findUnique as any).mockResolvedValue({ id: 1, currentStock: 0, averageCost: 0 });

      await registerUnifiedPurchase({
        supplierId: 1,
        voucherType: "Factura",
        series: "F003",
        number: 125,
        issuedAt: new Date(),
        paymentCondition: "Credito",
        items: [
          { supplyId: 1, quantity: 1, unitPrice: 100, affectationIgv: "Included" },
          { supplyId: 2, quantity: 1, unitPrice: 50, affectationIgv: "Excluded" },
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
  });
});
