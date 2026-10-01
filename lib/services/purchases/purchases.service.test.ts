/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupplier } from "./supplier";
import { createSupply, registerInventoryAdjustment } from "./supply";
import { createPurchaseOrder } from "./purchase-order";
import { receivePurchase } from "./receiving";
import { createPurchaseVoucher } from "./invoices";
import { registerTransformation } from "./transformation";
import { registerPurchaseWithoutVoucher } from "./purchase-without-voucher";

// Mock Prisma Client
vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    proveedor: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    insumo: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    orden_compra: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    recepcion_compra: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    detalle_recepcion_compra: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    movimiento_inventario: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    comprobante_compra: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    pago_compra: {
      create: vi.fn(),
    },
    transformacion: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    detalle_transformacion: {
      create: vi.fn(),
    },
    compra_sin_comprobante: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    empleado: {
      findUnique: vi.fn().mockResolvedValue({ id_empleado: 1, primer_nombre: "Test" }),
      findFirst: vi.fn().mockResolvedValue({ id_empleado: 1, primer_nombre: "Test" }),
      upsert: vi.fn().mockResolvedValue({ id_empleado: 1, primer_nombre: "Test" }),
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
      (prisma.proveedor.findUnique as any).mockResolvedValue(null);
      (prisma.proveedor.create as any).mockResolvedValue({
        id_proveedor: 1,
        ruc: "20123456789",
        razon_social: "Distribuidora Beto S.A.C.",
      });

      const res = await createSupplier({
        ruc: "20123456789",
        razon_social: "Distribuidora Beto S.A.C.",
      });

      expect(res.id_proveedor).toBe(1);
      expect(prisma.proveedor.create).toHaveBeenCalled();
    });

    it("debe lanzar error si el documento no tiene 8 u 11 dígitos", async () => {
      await expect(
        createSupplier({
          ruc: "123",
          razon_social: "Test",
        })
      ).rejects.toThrow("El documento debe tener 8 dígitos (DNI) u 11 dígitos (RUC)");
    });
  });

  describe("Módulo 5: Insumos y Ajuste de Inventario", () => {
    it("debe crear un insumo con stock_actual inicial en 0", async () => {
      (prisma.insumo.create as any).mockResolvedValue({
        id_insumo: 1,
        nombre: "Pollo Entero",
        stock_actual: 0,
      });

      await createSupply({
        nombre: "Pollo Entero",
        unidad_medida: "KG",
      });

      expect(prisma.insumo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nombre: "Pollo Entero",
          stock_actual: 0,
        }),
      });
    });

    it("debe registrar un ajuste de inventario recalculando el stock", async () => {
      (prisma.insumo.findUnique as any).mockResolvedValue({
        id_insumo: 1,
        stock_actual: 10,
      });
      (prisma.movimiento_inventario.create as any).mockResolvedValue({ id: 1 });
      (prisma.insumo.update as any).mockResolvedValue({
        id_insumo: 1,
        stock_actual: 15,
      });

      const res = await registerInventoryAdjustment(1, 15, "Ajuste por conteo físico");

      expect(prisma.movimiento_inventario.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cantidad: 5,
          motivo: "Ajuste por conteo físico",
        }),
      });
      expect(res.supply.stock_actual).toBe(15);
    });
  });

  describe("Módulo 2: Órdenes de Compra", () => {
    it("debe crear una orden de compra en estado Pendiente", async () => {
      (prisma.orden_compra.count as any).mockResolvedValue(0);
      (prisma.orden_compra.findUnique as any).mockResolvedValue(null);
      (prisma.orden_compra.create as any).mockResolvedValue({
        id_orden_compra: 1,
        numero_orden: "OC-2026-00001",
        estado: "Pendiente",
      });

      const res = await createPurchaseOrder({
        id_proveedor: 1,
        detalles: [{ id_insumo: 1, cantidad_pedida: 10, precio_unitario: 15 }],
      });

      expect(res.estado).toBe("Pendiente");
    });
  });

  describe("Módulo 3: Recepción de Compra", () => {
    it("debe recepcionar compra y actualizar stock", async () => {
      (prisma.orden_compra.findUnique as any).mockResolvedValue({
        id_orden_compra: 1,
        numero_orden: "OC-2026-00001",
        detalles_orden: [
          { id_detalle_orden_compra: 10, id_insumo: 1, cantidad_pedida: 10, precio_unitario: 15 },
        ],
      });
      (prisma.recepcion_compra.create as any).mockResolvedValue({ id_recepcion: 100 });
      (prisma.detalle_recepcion_compra.create as any).mockResolvedValue({ id_detalle_recepcion_compra: 1 });
      (prisma.movimiento_inventario.create as any).mockResolvedValue({});
      (prisma.insumo.findUnique as any).mockResolvedValue({ id_insumo: 1, stock_actual: 5 });
      (prisma.insumo.update as any).mockResolvedValue({});
      (prisma.detalle_recepcion_compra.findMany as any).mockResolvedValue([
        { id_detalle_orden_compra: 10, cantidad_recibida: 10 },
      ]);
      (prisma.orden_compra.update as any).mockResolvedValue({});

      const res = await receivePurchase({
        id_orden_compra: 1,
        detalles: [{ id_detalle_orden_compra: 10, cantidad_recibida: 10 }],
      });

      expect(res.id_recepcion).toBe(100);
      expect(prisma.insumo.update).toHaveBeenCalledWith({
        where: { id_insumo: 1 },
        data: { stock_actual: 15 },
      });
    });
  });

  describe("Módulo 4: Comprobantes y Facturas", () => {
    it("debe crear comprobante al contado y generar su pago automático", async () => {
      (prisma.comprobante_compra.findFirst as any).mockResolvedValue(null);
      (prisma.recepcion_compra.findUnique as any).mockResolvedValue({
        id_recepcion: 1,
        detalles_recepcion_compra: [
          { cantidad_recibida: 10, detalle_orden_compra: { precio_unitario: 10 } },
        ],
      });
      (prisma.comprobante_compra.create as any).mockResolvedValue({ id_comprobante_compra: 5, monto_total: 118 });

      await createPurchaseVoucher({
        id_proveedor: 1,
        id_recepcion: 1,
        tipo_comprobante: "Factura",
        serie: "F001",
        numero: 123,
        condicion_pago: "Contado",
        id_tipo_pago: 1,
      });

      expect(prisma.pago_compra.create).toHaveBeenCalled();
    });
  });

  describe("Módulo 6: Transformación", () => {
    it("debe registrar transformación descontando materia prima e incrementando producto terminado", async () => {
      (prisma.transformacion.create as any).mockResolvedValue({ id_transformacion: 50 });
      (prisma.insumo.findUnique as any)
        .mockResolvedValueOnce({ id_insumo: 1, stock_actual: 20 })
        .mockResolvedValueOnce({ id_insumo: 2, stock_actual: 0 });

      await registerTransformation({
        consumos: [{ id_insumo: 1, cantidad: 5 }],
        producidos: [{ id_insumo: 2, cantidad: 4 }],
      });

      expect(prisma.insumo.update).toHaveBeenCalledWith({
        where: { id_insumo: 1 },
        data: { stock_actual: 15 },
      });
      expect(prisma.insumo.update).toHaveBeenCalledWith({
        where: { id_insumo: 2 },
        data: { stock_actual: 4 },
      });
    });
  });

  describe("Módulo 7: Compra sin comprobante", () => {
    it("debe registrar compra sin comprobante y actualizar el inventario", async () => {
      (prisma.insumo.findUnique as any).mockResolvedValue({ id_insumo: 1, stock_actual: 10 });
      (prisma.compra_sin_comprobante.create as any).mockResolvedValue({ id_compra_menor: 1 });

      await registerPurchaseWithoutVoucher({
        id_insumo: 1,
        cantidad: 5,
        monto_pagado: 50,
      });

      expect(prisma.insumo.update).toHaveBeenCalledWith({
        where: { id_insumo: 1 },
        data: { stock_actual: 15 },
      });
    });
  });
});
