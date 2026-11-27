import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listDiningTables,
  createOrReactivateDiningTable,
  getDiningTableById,
  updateDiningTable,
  deactivateDiningTable,
  listBasicDiningTables,
} from "@/lib/services/sales/dining-tables.service";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from "@/lib/http/route-handler";

const m = vi.hoisted(() => ({
  diningTableFindMany: vi.fn(),
  diningTableFindUnique: vi.fn(),
  diningTableCreate: vi.fn(),
  diningTableUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    diningTable: {
      findMany: m.diningTableFindMany,
      findUnique: m.diningTableFindUnique,
      create: m.diningTableCreate,
      update: m.diningTableUpdate,
    },
  },
}));

describe("DiningTablesService (Dominio de Mesas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listDiningTables", () => {
    it("debe listar mesas calculando ocupación, comandas activas y métricas del salón", async () => {
      const mockDate = new Date("2026-11-01T12:00:00Z");
      m.diningTableFindMany.mockResolvedValueOnce([
        {
          id: 1,
          number: 1,
          capacity: 4,
          active: true,
          orders: [
            {
              id: 10,
              notes: "Cerca a la ventana",
              order: {
                id: 101,
                code: "ORD-101",
                orderType: "DineIn",
                orderedAt: mockDate,
                status: "Preparing",
                items: [
                  {
                    id: 1,
                    productId: 5,
                    quantity: 2,
                    unitPrice: 25.0,
                    subtotal: 50.0,
                    itemStatus: "Pending",
                    notes: "Sin sal",
                    product: { name: "1/4 Pollo" },
                  },
                ],
              },
            },
          ],
        },
        {
          id: 2,
          number: 2,
          capacity: 2,
          active: true,
          orders: [],
        },
      ]);

      const result = await listDiningTables();

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        id: 1,
        number: 1,
        occupied: true,
        active: true,
      });
      expect(result.data[0].activeOrder).toMatchObject({
        id: 101,
        code: "ORD-101",
        total: 50.0,
      });
      expect(result.data[1]).toMatchObject({
        id: 2,
        number: 2,
        occupied: false,
        activeOrder: null,
      });
      expect(result.summary).toEqual({
        total: 2,
        available: 1,
        occupied: 1,
        inactive: 0,
      });
    });
  });

  describe("listBasicDiningTables", () => {
    it("debe listar solo mesas activas ordenadas por número", async () => {
      m.diningTableFindMany.mockResolvedValueOnce([
        { id: 1, number: 1, capacity: 4, active: true },
      ]);

      const result = await listBasicDiningTables();
      expect(result).toEqual([{ id: 1, number: 1, capacity: 4, active: true }]);
      expect(m.diningTableFindMany).toHaveBeenCalledWith({
        select: { id: true, number: true, capacity: true, active: true },
        orderBy: { number: "asc" },
      });
    });
  });

  describe("createOrReactivateDiningTable", () => {
    it("debe lanzar ValidationError si faltan campos obligatorios", async () => {
      await expect(
        createOrReactivateDiningTable({ number: 0, capacity: 4 })
      ).rejects.toThrow(ValidationError);
      await expect(
        createOrReactivateDiningTable({ number: 1, capacity: 0 })
      ).rejects.toThrow(ValidationError);
    });

    it("debe lanzar ConflictError si la mesa ya existe y está activa", async () => {
      m.diningTableFindUnique.mockResolvedValueOnce({
        id: 1,
        number: 10,
        active: true,
      });

      await expect(
        createOrReactivateDiningTable({ number: 10, capacity: 4 })
      ).rejects.toThrow(ConflictError);
    });

    it("debe reactivar y actualizar la mesa si ya existía inactiva", async () => {
      m.diningTableFindUnique.mockResolvedValueOnce({
        id: 5,
        number: 10,
        active: false,
      });
      m.diningTableUpdate.mockResolvedValueOnce({
        id: 5,
        number: 10,
        capacity: 6,
        active: true,
      });

      const result = await createOrReactivateDiningTable({
        number: 10,
        capacity: 6,
      });

      expect(result.reactivated).toBe(true);
      expect(result.table.capacity).toBe(6);
      expect(m.diningTableUpdate).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { capacity: 6, active: true },
        select: { id: true, number: true, capacity: true, active: true },
      });
    });

    it("debe crear una nueva mesa si no existía previamente", async () => {
      m.diningTableFindUnique.mockResolvedValueOnce(null);
      m.diningTableCreate.mockResolvedValueOnce({
        id: 7,
        number: 12,
        capacity: 4,
        active: true,
      });

      const result = await createOrReactivateDiningTable({
        number: 12,
        capacity: 4,
      });

      expect(result.reactivated).toBe(false);
      expect(result.table.id).toBe(7);
      expect(m.diningTableCreate).toHaveBeenCalledWith({
        data: { number: 12, capacity: 4, active: true },
        select: { id: true, number: true, capacity: true, active: true },
      });
    });
  });

  describe("getDiningTableById", () => {
    it("debe lanzar NotFoundError si la mesa no existe", async () => {
      m.diningTableFindUnique.mockResolvedValueOnce(null);
      await expect(getDiningTableById(99)).rejects.toThrow(NotFoundError);
    });

    it("debe retornar la mesa encontrada", async () => {
      m.diningTableFindUnique.mockResolvedValueOnce({
        id: 1,
        number: 1,
        capacity: 4,
        active: true,
      });

      const result = await getDiningTableById(1);
      expect(result.id).toBe(1);
      expect(result.number).toBe(1);
      expect(result.capacity).toBe(4);
    });
  });

  describe("updateDiningTable", () => {
    it("debe lanzar NotFoundError si la mesa a actualizar no existe", async () => {
      m.diningTableFindUnique.mockResolvedValueOnce(null);
      await expect(updateDiningTable(99, { capacity: 4 })).rejects.toThrow(
        NotFoundError
      );
    });

    it("debe lanzar ConflictError si se intenta cambiar a un número ya existente", async () => {
      m.diningTableFindUnique
        .mockResolvedValueOnce({ id: 1, number: 1, capacity: 4, active: true }) // existing table in getDiningTableById
        .mockResolvedValueOnce({ id: 2, number: 2, capacity: 4, active: true }); // duplicate check

      await expect(updateDiningTable(1, { number: 2 })).rejects.toThrow(
        ConflictError
      );
    });

    it("debe actualizar exitosamente los campos de la mesa", async () => {
      m.diningTableFindUnique.mockResolvedValueOnce({
        id: 1,
        number: 1,
        capacity: 4,
        active: true,
      });
      m.diningTableUpdate.mockResolvedValueOnce({
        id: 1,
        number: 1,
        capacity: 8,
        active: true,
      });

      const result = await updateDiningTable(1, { capacity: 8 });
      expect(result.capacity).toBe(8);
      expect(m.diningTableUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { capacity: 8 },
        select: { id: true, number: true, capacity: true, active: true },
      });
    });
  });

  describe("deactivateDiningTable", () => {
    it("debe lanzar NotFoundError si la mesa no existe", async () => {
      m.diningTableFindUnique.mockResolvedValueOnce(null);
      await expect(deactivateDiningTable(99)).rejects.toThrow(NotFoundError);
    });

    it("debe lanzar ValidationError si la mesa tiene comandas activas", async () => {
      m.diningTableFindUnique.mockResolvedValueOnce({
        id: 1,
        number: 1,
        orders: [{ id: 50 }],
      });

      await expect(deactivateDiningTable(1)).rejects.toThrow(ValidationError);
    });

    it("debe desactivar lógicamente la mesa marcando active = false", async () => {
      m.diningTableFindUnique.mockResolvedValueOnce({
        id: 1,
        number: 1,
        orders: [],
      });
      m.diningTableUpdate.mockResolvedValueOnce({
        id: 1,
        number: 1,
        capacity: 4,
        active: false,
      });

      const result = await deactivateDiningTable(1);
      expect(result.active).toBe(false);
      expect(m.diningTableUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { active: false },
        select: { id: true, number: true, capacity: true, active: true },
      });
    });
  });
});
