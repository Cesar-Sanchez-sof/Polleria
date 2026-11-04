import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getProducts, POST as postProduct } from "@/app/api/products/route";
import {
  GET as getProductById,
  PUT as putProduct,
  PATCH as patchProduct,
  DELETE as deleteProduct,
} from "@/app/api/products/[id]/route";
import * as productsService from "@/lib/services/products.service";

type SingleProduct = Awaited<ReturnType<typeof productsService.getProductByIdService>>;
type CreatedProduct = Awaited<ReturnType<typeof productsService.createProductService>>;
type UpdatedProduct = Awaited<ReturnType<typeof productsService.updateProductService>>;
type ActiveProduct = Awaited<ReturnType<typeof productsService.setProductActiveService>>;
type DeletedProduct = Awaited<ReturnType<typeof productsService.deleteProductService>>;
type ProductList = Awaited<ReturnType<typeof productsService.listProductsService>>;

describe("Products API Route Handlers (app/api/products)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/products", () => {
    it("debe retornar 200 con la lista de productos", async () => {
      vi.spyOn(productsService, "listProductsService").mockResolvedValueOnce({
        data: [{ id: 1, name: "1/4 Pollo", price: 25 }] as unknown as ProductList["data"],
        total: 1,
      });

      const req = new NextRequest("http://localhost:3000/api/products?sellable=true");
      const res = await getProducts(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.total).toBe(1);
      expect(json.data[0].name).toBe("1/4 Pollo");
    });
  });

  describe("POST /api/products", () => {
    it("debe retornar 201 al crear producto exitosamente", async () => {
      vi.spyOn(productsService, "createProductService").mockResolvedValueOnce({
        id: 10,
        name: "Pollo a la Brasa",
        price: 70,
      } as unknown as CreatedProduct);

      const req = new NextRequest("http://localhost:3000/api/products", {
        method: "POST",
        body: JSON.stringify({ name: "Pollo a la Brasa", price: 70 }),
      });
      const res = await postProduct(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.id).toBe(10);
      expect(json.message).toContain("Pollo a la Brasa");
    });
  });

  describe("GET /api/products/[id]", () => {
    it("debe retornar 200 con el producto si existe", async () => {
      vi.spyOn(productsService, "getProductByIdService").mockResolvedValueOnce({
        id: 5,
        name: "Inca Kola 1.5L",
      } as unknown as SingleProduct);

      const req = new NextRequest("http://localhost:3000/api/products/5");
      const res = await getProductById(req, { params: Promise.resolve({ id: "5" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.id).toBe(5);
    });

    it("debe retornar 400 si el parámetro id no es numérico", async () => {
      const req = new NextRequest("http://localhost:3000/api/products/abc");
      const res = await getProductById(req, { params: Promise.resolve({ id: "abc" }) });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/products/[id]", () => {
    it("debe retornar 200 con el producto actualizado", async () => {
      vi.spyOn(productsService, "updateProductService").mockResolvedValueOnce({
        id: 5,
        name: "Inca Kola 1.5L Zero",
      } as unknown as UpdatedProduct);

      const req = new NextRequest("http://localhost:3000/api/products/5", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Inca Kola 1.5L Zero" }),
      });
      const res = await putProduct(req, { params: Promise.resolve({ id: "5" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.name).toBe("Inca Kola 1.5L Zero");
    });
  });

  describe("PATCH /api/products/[id]", () => {
    it("debe retornar 200 al cambiar estado de activación", async () => {
      vi.spyOn(productsService, "setProductActiveService").mockResolvedValueOnce({
        id: 5,
        name: "Inca Kola",
        active: false,
      } as unknown as ActiveProduct);

      const req = new NextRequest("http://localhost:3000/api/products/5", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      const res = await patchProduct(req, { params: Promise.resolve({ id: "5" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.active).toBe(false);
    });
  });

  describe("DELETE /api/products/[id]", () => {
    it("debe retornar 200 al dar de baja lógica al producto", async () => {
      vi.spyOn(productsService, "deleteProductService").mockResolvedValueOnce({
        id: 5,
        name: "Inca Kola",
        active: false,
      } as unknown as DeletedProduct);

      const req = new NextRequest("http://localhost:3000/api/products/5", {
        method: "DELETE",
      });
      const res = await deleteProduct(req, { params: Promise.resolve({ id: "5" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain("desactivado de la carta");
    });
  });
});
