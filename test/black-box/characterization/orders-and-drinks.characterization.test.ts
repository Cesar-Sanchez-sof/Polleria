import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  salesOrderFindMany: vi.fn(),
  salesOrderFindUnique: vi.fn(),
  salesOrderCreate: vi.fn(),
  salesOrderUpdate: vi.fn(),
  diningTableFindUnique: vi.fn(),
  diningTableFindMany: vi.fn(),
  diningTableUpdate: vi.fn(),
  productFindMany: vi.fn(),
  orderItemUpdateMany: vi.fn(),
  orderItemFindMany: vi.fn(),
  orderItemUpdate: vi.fn(),
  orderItemCreate: vi.fn(),
  orderTableCreate: vi.fn(),
  cashSessionFindFirst: vi.fn(),
  transaction: vi.fn(),
  deductProductStock: vi.fn(),
  restoreProductStock: vi.fn(),
  broadcastRealtimeEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesOrder: {
      findMany: m.salesOrderFindMany,
      findUnique: m.salesOrderFindUnique,
      create: m.salesOrderCreate,
      update: m.salesOrderUpdate,
    },
    diningTable: {
      findUnique: m.diningTableFindUnique,
      findMany: m.diningTableFindMany,
      update: m.diningTableUpdate,
    },
    product: {
      findMany: m.productFindMany,
    },
    orderItem: {
      updateMany: m.orderItemUpdateMany,
      findMany: m.orderItemFindMany,
      update: m.orderItemUpdate,
      create: m.orderItemCreate,
    },
    orderTable: {
      create: m.orderTableCreate,
    },
    cashSession: {
      findFirst: m.cashSessionFindFirst,
    },
    $transaction: m.transaction,
  },
}));

vi.mock("@/lib/services/inventory/product-stock.service", () => ({
  deductProductStock: m.deductProductStock,
  restoreProductStock: m.restoreProductStock,
  InsufficientStockError: class InsufficientStockError extends Error {},
}));

vi.mock("@/lib/realtime/event-emitter", () => ({
  broadcastRealtimeEvent: m.broadcastRealtimeEvent,
}));

import { GET as getOrders, POST as postOrders } from "@/app/api/orders/route";
import {
  GET as getOrderById,
  PUT as putOrderById,
  DELETE as deleteOrderById,
} from "@/app/api/orders/[id]/route";
import {
  GET as getDrinks,
  PATCH as patchDrinks,
} from "@/app/api/orders/drinks/route";

describe("Characterization: Orders & Drinks Domain Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) =>
      cb({
        salesOrder: {
          create: m.salesOrderCreate,
          update: m.salesOrderUpdate,
          findUnique: m.salesOrderFindUnique,
        },
        diningTable: {
          findUnique: m.diningTableFindUnique,
          update: m.diningTableUpdate,
        },
        orderTable: {
          create: m.orderTableCreate,
        },
        orderItem: {
          create: m.orderItemCreate,
        },
      })
    );
  });

  describe("GET /api/orders", () => {
    it("debe retornar la lista de pedidos formateada con totales y estado editable", async () => {
      const mockDate = new Date("2026-11-01T12:00:00Z");
      m.salesOrderFindMany.mockResolvedValueOnce([
        {
          id: 10,
          code: "PED-1001",
          orderType: "Mesa",
          orderedAt: mockDate,
          status: "Received",
          tables: [
            {
              notes: "Mesa VIP",
              table: { id: 1, number: 5 },
            },
          ],
          items: [
            {
              id: 101,
              productId: 20,
              quantity: 2,
              unitPrice: 25.0,
              subtotal: 50.0,
              itemStatus: "Pending",
              notes: "Sin sal",
              product: { name: "1/4 Pollo" },
            },
          ],
        },
      ]);

      const req = new NextRequest("http://localhost:3000/api/orders?status=active");
      const res = await getOrders(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toHaveLength(1);
      expect(json.data[0]).toMatchObject({
        id: 10,
        code: "PED-1001",
        orderType: "Mesa",
        status: "Received",
        total: 50,
        editable: true,
        table: { id: 1, number: 5 },
        notes: "Mesa VIP",
      });
    });
  });

  describe("POST /api/orders", () => {
    it("debe rechazar 400 si no hay sesión de caja abierta", async () => {
      m.cashSessionFindFirst.mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/orders", {
        method: "POST",
        body: JSON.stringify({
          orderType: "Mesa",
          tableId: 1,
          items: [{ productId: 5, quantity: 1 }],
        }),
      });

      const res = await postOrders(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("la caja se encuentra cerrada");
    });

    it("debe rechazar 400 si falta mesa en pedido tipo Mesa", async () => {
      m.cashSessionFindFirst.mockResolvedValueOnce({ id: 1, status: "OPEN" });

      const req = new NextRequest("http://localhost:3000/api/orders", {
        method: "POST",
        body: JSON.stringify({
          orderType: "Mesa",
          items: [{ productId: 5, quantity: 1 }],
        }),
      });

      const res = await postOrders(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("Debe seleccionar una mesa válida");
    });

    it("debe rechazar 400 si la mesa principal ya tiene una comanda activa", async () => {
      m.cashSessionFindFirst.mockResolvedValueOnce({ id: 1, status: "OPEN" });
      m.diningTableFindUnique.mockResolvedValueOnce({
        id: 1,
        number: 5,
        orders: [{ id: 10 }],
      });

      const req = new NextRequest("http://localhost:3000/api/orders", {
        method: "POST",
        body: JSON.stringify({
          orderType: "Mesa",
          tableId: 1,
          items: [{ productId: 5, quantity: 1 }],
        }),
      });

      const res = await postOrders(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("ya tiene un pedido activo");
    });

    it("debe crear exitosamente un pedido con productos válidos y descontar stock", async () => {
      m.cashSessionFindFirst.mockResolvedValueOnce({ id: 1, status: "OPEN" });
      m.diningTableFindUnique.mockResolvedValueOnce({
        id: 1,
        number: 5,
        orders: [],
      });
      m.productFindMany.mockResolvedValueOnce([
        { id: 20, name: "1/4 Pollo", price: 25.0, active: true, sellable: true },
      ]);
      m.salesOrderCreate.mockResolvedValueOnce({
        id: 50,
        code: "PED-9999",
        orderType: "Mesa",
        status: "Received",
      });
      m.orderItemCreate.mockResolvedValueOnce({
        id: 101,
        orderId: 50,
        productId: 20,
        quantity: 1,
        unitPrice: 25.0,
        subtotal: 25.0,
      });
      m.salesOrderFindUnique.mockResolvedValueOnce({
        id: 50,
        code: "PED-9999",
        orderType: "Mesa",
        orderedAt: new Date("2026-11-01T12:00:00Z"),
        status: "Received",
        tables: [{ notes: "", table: { id: 1, number: 5 } }],
        items: [
          {
            id: 101,
            productId: 20,
            quantity: 1,
            unitPrice: 25.0,
            subtotal: 25.0,
            itemStatus: "Pending",
            notes: null,
            product: { name: "1/4 Pollo" },
          },
        ],
      });

      const req = new NextRequest("http://localhost:3000/api/orders", {
        method: "POST",
        body: JSON.stringify({
          orderType: "Mesa",
          tableId: 1,
          items: [{ productId: 20, quantity: 1 }],
        }),
      });

      const res = await postOrders(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.message).toBe("Pedido registrado con éxito.");
      expect(json.order.id).toBe(50);
      expect(m.deductProductStock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ productId: 20, quantity: 1, orderItemId: 101 }),
        expect.stringContaining("PED-")
      );
      expect(m.broadcastRealtimeEvent).toHaveBeenCalled();
    });
  });

  describe("GET /api/orders/[id]", () => {
    it("debe retornar 404 si el pedido no existe", async () => {
      m.salesOrderFindUnique.mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/orders/999");
      const res = await getOrderById(req, {
        params: Promise.resolve({ id: "999" }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toContain("Pedido no encontrado");
    });

    it("debe retornar el detalle formateado del pedido existente", async () => {
      m.salesOrderFindUnique.mockResolvedValueOnce({
        id: 15,
        code: "PED-15",
        orderType: "Mesa",
        orderedAt: new Date("2026-11-01T14:00:00Z"),
        status: "Preparing",
        tables: [{ notes: null, table: { id: 2, number: 3 } }],
        items: [
          {
            id: 10,
            productId: 5,
            quantity: 1,
            unitPrice: 30,
            subtotal: 30,
            itemStatus: "Preparing",
            notes: null,
            product: { name: "1/2 Pollo" },
          },
        ],
      });

      const req = new NextRequest("http://localhost:3000/api/orders/15");
      const res = await getOrderById(req, {
        params: Promise.resolve({ id: "15" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.id).toBe(15);
      expect(json.status).toBe("Preparing");
      expect(json.total).toBe(30);
      expect(json.editable).toBe(true);
    });
  });

  describe("GET y PATCH /api/orders/drinks", () => {
    it("GET debe listar bebidas agrupadas por orden y estado", async () => {
      m.salesOrderFindMany.mockResolvedValueOnce([
        {
          id: 1,
          code: "PED-01",
          orderType: "Mesa",
          orderedAt: new Date("2026-11-01T12:00:00Z"),
          tables: [{ notes: "", table: { id: 1, number: 2 } }],
          items: [
            {
              id: 201,
              productId: 10,
              quantity: 2,
              unitPrice: 15.0,
              subtotal: 30.0,
              itemStatus: "Pending",
              notes: "Helada",
              product: { name: "Jarra de Chicha Morada 1L" },
            },
          ],
        },
      ]);

      const req = new NextRequest("http://localhost:3000/api/orders/drinks");
      const res = await getDrinks(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toContain("Chicha Morada");
      expect(json.summary).toMatchObject({
        total: 1,
        totalPending: 1,
        totalDelivered: 0,
      });
    });

    it("PATCH debe actualizar el estado de una bebida a Delivered", async () => {
      m.orderItemUpdate.mockResolvedValueOnce({
        id: 201,
        orderId: 1,
        itemStatus: "Delivered",
        product: { name: "Inca Kola 1.5L" },
      });

      const req = new NextRequest("http://localhost:3000/api/orders/drinks", {
        method: "PATCH",
        body: JSON.stringify({
          itemId: 201,
          status: "Delivered",
        }),
      });

      const res = await patchDrinks(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(m.orderItemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 201 },
          data: { itemStatus: "Delivered" },
        })
      );
    });
  });
});
