import { describe, it, expect, vi } from "vitest";
import { GET, POST } from "../app/api/checkout/yape/route";
import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";

describe("Endpoint Público de Simulación y Cobro Yape (/api/checkout/yape)", () => {
  it("debe rechazar GET si no se provee orderId", async () => {
    const req = new NextRequest("http://localhost:3000/api/checkout/yape");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("ID de pedido válido");
  });

  it("debe retornar 404 si el pedido no existe", async () => {
    const req = new NextRequest("http://localhost:3000/api/checkout/yape?orderId=999999");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("debe retornar los datos del pedido y del comercio para mostrar la vista de Yapear", async () => {
    // Buscar un pedido existente
    const order = await prisma.salesOrder.findFirst({
      where: { items: { some: {} } },
    });

    if (order) {
      const req = new NextRequest(`http://localhost:3000/api/checkout/yape?orderId=${order.id}`);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.orderId).toBe(order.id);
      expect(json.code).toBe(order.code);
      expect(json.total).toBeGreaterThan(0);
      expect(json.merchantName).toBeDefined();
      expect(json.phoneClean).toBeDefined();
      expect(json.items).toBeInstanceOf(Array);
    }
  });

  it("debe rechazar POST si no se provee orderId", async () => {
    const req = new NextRequest("http://localhost:3000/api/checkout/yape", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
