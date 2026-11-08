import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductType } from "@prisma/client";

const m = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  recipeCreate: vi.fn(),
  recipeDeleteMany: vi.fn(),
  movementCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const db = {
    product: {
      findMany: m.findMany,
      findUnique: m.findUnique,
      create: m.create,
      update: m.update,
    },
    productRecipe: {
      create: m.recipeCreate,
      deleteMany: m.recipeDeleteMany,
    },
    inventoryMovement: {
      count: m.movementCount,
    },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { prisma: db };
});

import {
  listProductsService,
  getProductByIdService,
  createProductService,
  updateProductService,
  setProductActiveService,
  deleteProductService,
} from "@/lib/services/inventory/products.service";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/http/errors";

describe("Products Service (lib/services/products.service)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listProductsService", () => {
    it("debe listar productos con stock numérico y categoría determinada", async () => {
      m.findMany.mockResolvedValueOnce([
        {
          id: 1,
          name: "1/4 Pollo a la Brasa",
          description: "Con papas fritas y ensalada",
          type: ProductType.FinishedProduct,
          unitOfMeasure: "UND",
          sellable: true,
          price: 24.5,
          active: true,
          currentStock: 15,
          minimumStock: 5,
          lastCost: 10,
          averageCost: 10,
        },
      ]);

      const result = await listProductsService({ sellable: "true" });
      expect(result.total).toBe(1);
      expect(result.data[0]).toMatchObject({
        id: 1,
        name: "1/4 Pollo a la Brasa",
        stock: 15,
        price: 24.5,
        available: true,
      });
      expect(m.findMany).toHaveBeenCalledTimes(1);
    });

    it("debe filtrar por texto y categoría correctamente", async () => {
      m.findMany.mockResolvedValueOnce([
        {
          id: 2,
          name: "Inca Kola 500ml",
          description: "Gaseosa helada",
          type: ProductType.FinishedProduct,
          unitOfMeasure: "UND",
          sellable: true,
          price: 5.0,
          active: true,
          currentStock: 30,
          minimumStock: 10,
          lastCost: 2.5,
          averageCost: 2.5,
        },
      ]);

      const result = await listProductsService({ q: "Inca", category: "bebidas" });
      expect(result.data[0].category).toBe("bebidas");
    });
  });

  describe("getProductByIdService", () => {
    it("debe lanzar ValidationError si el ID es inválido o no numérico", async () => {
      await expect(getProductByIdService(0)).rejects.toBeInstanceOf(ValidationError);
      await expect(getProductByIdService(-5)).rejects.toBeInstanceOf(ValidationError);
    });

    it("debe lanzar NotFoundError si el producto no existe en la BD", async () => {
      m.findUnique.mockResolvedValueOnce(null);
      await expect(getProductByIdService(999)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("debe retornar el producto formateado con receta", async () => {
      m.findUnique.mockResolvedValueOnce({
        id: 10,
        name: "Pollo Entero",
        price: 75.0,
        currentStock: 20,
        minimumStock: 5,
        recipe: [],
      });

      const res = await getProductByIdService(10);
      expect(res.id).toBe(10);
      expect(res.stock).toBe(20);
      expect(res.recipe).toEqual([]);
    });
  });

  describe("createProductService", () => {
    it("debe rechazar si falta el nombre del producto", async () => {
      await expect(
        createProductService({ name: "", price: 20, sellable: true })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("debe rechazar si es vendible y el precio es menor o igual a 0", async () => {
      await expect(
        createProductService({ name: "Plato", price: 0, sellable: true })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("debe crear el producto y sus líneas de receta atómicamente", async () => {
      m.create.mockResolvedValueOnce({
        id: 50,
        name: "Mostrito Brasa",
        price: 28.0,
        sellable: true,
      });

      const res = await createProductService({
        name: "Mostrito Brasa",
        price: 28.0,
        sellable: true,
        recipe: [{ ingredientId: 2, quantityRequired: 1.5 }],
      });

      expect(res.id).toBe(50);
      expect(m.create).toHaveBeenCalledTimes(1);
      expect(m.recipeCreate).toHaveBeenCalledWith({
        data: { productId: 50, ingredientId: 2, quantityRequired: 1.5 },
      });
    });
  });

  describe("updateProductService", () => {
    it("debe lanzar NotFoundError si el producto no existe", async () => {
      m.findUnique.mockResolvedValueOnce(null);
      await expect(updateProductService(999, { name: "Nuevo" })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("debe rechazar cambio de ProductType si el producto ya cuenta con movimientos en Kardex", async () => {
      m.findUnique.mockResolvedValueOnce({
        id: 15,
        type: ProductType.FinishedProduct,
      });
      m.movementCount.mockResolvedValueOnce(3); // 3 movimientos existentes

      await expect(
        updateProductService(15, { type: ProductType.RawMaterial })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("debe actualizar el producto y regenerar la receta en transacción", async () => {
      m.findUnique
        .mockResolvedValueOnce({ id: 15, type: ProductType.FinishedProduct })
        .mockResolvedValueOnce({ id: 15, name: "Pollo Editado", recipe: [] });
      m.movementCount.mockResolvedValueOnce(0);

      const res = await updateProductService(15, {
        name: "Pollo Editado",
        recipe: [{ ingredientId: 3, quantityRequired: 2 }],
      });

      expect(m.update).toHaveBeenCalledTimes(1);
      expect(m.recipeDeleteMany).toHaveBeenCalledWith({ where: { productId: 15 } });
      expect(m.recipeCreate).toHaveBeenCalledWith({
        data: { productId: 15, ingredientId: 3, quantityRequired: 2 },
      });
      expect(res?.name).toBe("Pollo Editado");
    });
  });

  describe("setProductActiveService y deleteProductService", () => {
    it("debe activar o pausar un producto", async () => {
      m.findUnique.mockResolvedValueOnce({ id: 8, name: "Gaseosa" });
      m.update.mockResolvedValueOnce({ id: 8, active: false });

      const res = await setProductActiveService(8, false);
      expect(res.active).toBe(false);
      expect(m.update).toHaveBeenCalledWith({ where: { id: 8 }, data: { active: false } });
    });

    it("debe realizar baja lógica al eliminar producto", async () => {
      m.findUnique.mockResolvedValueOnce({ id: 8, name: "Gaseosa" });
      m.update.mockResolvedValueOnce({ id: 8, active: false });

      const res = await deleteProductService(8);
      expect(res.active).toBe(false);
      expect(m.update).toHaveBeenCalledWith({ where: { id: 8 }, data: { active: false } });
    });
  });
});
