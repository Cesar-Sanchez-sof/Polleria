import { describe, it, expect, vi, beforeEach } from "vitest";
import { isBeverage, determineCategory } from "@/lib/utils/dish-category";
import { NextRequest } from "next/server";

// Mock de Prisma para probar las rutas de despacho de bebidas
vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesOrder: {
      findMany: vi.fn(),
    },
    orderItem: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET as getDrinks, PATCH as patchDrinks } from "@/app/api/orders/drinks/route";

describe("Módulo de Despacho de Bebidas por Mozo y Exclusión de Cocina", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Clasificación Automática de Bebidas vs Comida", () => {
    it("debe identificar correctamente bebidas peruanas y comerciales comunes", () => {
      expect(isBeverage("Inca Kola 1.5L")).toBe(true);
      expect(isBeverage("Inka Kola Gordita 500ml")).toBe(true);
      expect(isBeverage("Coca Cola 1.5L")).toBe(true);
      expect(isBeverage("Sprite 500ml")).toBe(true);
      expect(isBeverage("Fanta Naranja 500ml")).toBe(true);
      expect(isBeverage("Jarra de Chicha Morada 1L")).toBe(true);
      expect(isBeverage("Jarra de Maracuyá 1L")).toBe(true);
      expect(isBeverage("Vaso de Limonada Frozen")).toBe(true);
      expect(isBeverage("Agua Mineral 600ml sin gas")).toBe(true);
      expect(isBeverage("Cerveza Cusqueña Trigo")).toBe(true);
      expect(isBeverage("Pilsen Callao 630ml")).toBe(true);
    });

    it("NO debe clasificar platos de cocina ni adicionales como bebidas", () => {
      expect(isBeverage("1/4 Pollo a la Brasa")).toBe(false);
      expect(isBeverage("1 Pollo a la Brasa Entero")).toBe(false);
      expect(isBeverage("Mostrito Brasa Clásico")).toBe(false);
      expect(isBeverage("Porción de Papas Fritas")).toBe(false);
      expect(isBeverage("Tequeños Brasa (8 unidades)")).toBe(false);
      expect(isBeverage("Porción de Arroz Chaufa de Pollo")).toBe(false);
      expect(isBeverage("Ensalada Clásica Familiar")).toBe(false);
      expect(isBeverage("Alitas Broaster")).toBe(false);
    });

    it("debe categorizar platos correctamente en 'pollos', 'adicionales' y 'bebidas'", () => {
      expect(determineCategory("1/4 Pollo a la Brasa")).toBe("pollos");
      expect(determineCategory("Mostrito Especial")).toBe("pollos");
      expect(determineCategory("Porción de Papas Fritas")).toBe("adicionales");
      expect(determineCategory("Tequeños Brasa (8 unidades)")).toBe("adicionales");
      expect(determineCategory("Inca Kola 1.5L")).toBe("bebidas");
      expect(determineCategory("Jarra de Chicha Morada 1L")).toBe("bebidas");
    });
  });

  describe("2. Lógica de Exclusión en Cocina (KDS)", () => {
    it("debe permitir filtrar ítems para que el cocinero solo reciba platos que requieren cocción", () => {
      const kitchenOrderItems = [
        { name: "1/4 Pollo a la Brasa", quantity: 2 },
        { name: "Inca Kola 1.5L", quantity: 1 },
        { name: "Porción de Papas Fritas", quantity: 1 },
        { name: "Jarra de Chicha Morada 1L", quantity: 1 },
      ];

      const kitchenItems = kitchenOrderItems.filter((it) => !isBeverage(it.name));
      const waiterDrinks = kitchenOrderItems.filter((it) => isBeverage(it.name));

      expect(kitchenItems.length).toBe(2);
      expect(kitchenItems.map((c) => c.name)).toEqual([
        "1/4 Pollo a la Brasa",
        "Porción de Papas Fritas",
      ]);

      expect(waiterDrinks.length).toBe(2);
      expect(waiterDrinks.map((m) => m.name)).toEqual([
        "Inca Kola 1.5L",
        "Jarra de Chicha Morada 1L",
      ]);
    });

    it("una orden que solo contiene bebidas no debe exigir trabajo a cocina", () => {
      const orderOnlyDrinks = [
        { name: "Inca Kola 1.5L", quantity: 2 },
        { name: "Cerveza Cusqueña", quantity: 1 },
      ];

      const hasWorkKitchen = orderOnlyDrinks.some((it) => !isBeverage(it.name));
      expect(hasWorkKitchen).toBe(false);
    });
  });

  describe("3. Endpoint API /api/orders/drinks", () => {
    it("GET debe devolver las bebidas agrupadas por mesa con sus estados y metadatos", async () => {
      const mockOrders = [
        {
          id: 10,
          code: "ORD-010",
          orderType: "Mesa",
          orderedAt: new Date("2026-10-13T12:00:00Z"),
          status: "Preparing",
          tables: [
            {
              notes: "Atención rápida",
              table: { id: 2, number: 2 },
            },
          ],
          items: [
            {
              id: 101,
              dishId: 1,
              quantity: 1,
              notes: "bien cocido",
              dishStatus: "Preparing",
              dish: { name: "1/4 Pollo a la Brasa", description: null },
            },
            {
              id: 102,
              dishId: 10,
              quantity: 2,
              notes: "bien helada con vasos",
              dishStatus: "Pending",
              dish: { name: "Inca Kola 1.5L", description: "Gaseosa personal" },
            },
          ],
        },
      ];

      (prisma.salesOrder.findMany as any).mockResolvedValue(mockOrders);

      const req = new NextRequest("http://localhost:3000/api/orders/drinks");
      const res = await getDrinks(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.length).toBe(1);
      expect(json.data[0].itemId).toBe(102);
      expect(json.data[0].name).toBe("Inca Kola 1.5L");
      expect(json.data[0].tableName).toBe("Mesa 2");
      expect(json.data[0].quantity).toBe(2);
      expect(json.data[0].isDelivered).toBe(false);
      expect(json.summary.totalPending).toBe(1);
    });

    it("PATCH debe cambiar el estado de la bebida a 'Delivered' (Entregado)", async () => {
      (prisma.orderItem.update as any).mockResolvedValue({
        id: 102,
        dishStatus: "Delivered",
      });

      const req = new NextRequest("http://localhost:3000/api/orders/drinks", {
        method: "PATCH",
        body: JSON.stringify({ itemId: 102, status: "Delivered" }),
      });

      const res = await patchDrinks(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.status).toBe("Delivered");
      expect(prisma.orderItem.update).toHaveBeenCalledWith({
        where: { id: 102 },
        data: { dishStatus: "Delivered" },
      });
    });

    it("PATCH debe permitir marcar todas las bebidas de una comanda a la vez", async () => {
      (prisma.orderItem.findMany as any).mockResolvedValue([
        { id: 201, dish: { name: "1/4 Pollo a la Brasa" } },
        { id: 202, dish: { name: "Inca Kola 1.5L" } },
        { id: 203, dish: { name: "Jarra de Chicha 1L" } },
      ]);
      (prisma.orderItem.updateMany as any).mockResolvedValue({ count: 2 });

      const req = new NextRequest("http://localhost:3000/api/orders/drinks", {
        method: "PATCH",
        body: JSON.stringify({ orderId: 10, status: "Delivered" }),
      });

      const res = await patchDrinks(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.updatedCount).toBe(2);
      expect(prisma.orderItem.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [202, 203] } },
        data: { dishStatus: "Delivered" },
      });
    });
  });

  describe("4. Manejo de Temperatura de Bebidas (Helada vs Sin Helar)", () => {
    it("debe registrar y discriminar ítems de la misma bebida con diferente temperatura", () => {
      interface KitchenOrderItem {
        dishId: number;
        name: string;
        quantity: number;
        notes: string;
      }

      const orderItems: KitchenOrderItem[] = [];

      const addItemWithTemp = (
        dish: { id: number; name: string },
        temp: "Helada" | "Sin helar",
        extra = "",
      ) => {
        const finalNote = extra.trim() ? `${temp} - ${extra.trim()}` : temp;
        const idx = orderItems.findIndex(
          (it) => it.dishId === dish.id && it.notes === finalNote,
        );
        if (idx >= 0) {
          orderItems[idx].quantity += 1;
        } else {
          orderItems.push({
            dishId: dish.id,
            name: dish.name,
            quantity: 1,
            notes: finalNote,
          });
        }
      };

      const inkaKola = { id: 10, name: "Inca Kola 1.5L" };

      // Cliente pide 1 Inca Kola helada
      addItemWithTemp(inkaKola, "Helada");
      expect(orderItems.length).toBe(1);
      expect(orderItems[0].notes).toBe("Helada");
      expect(orderItems[0].quantity).toBe(1);

      // Mismo cliente pide 1 Inca Kola sin helar
      addItemWithTemp(inkaKola, "Sin helar");
      expect(orderItems.length).toBe(2);
      expect(orderItems[1].notes).toBe("Sin helar");
      expect(orderItems[1].quantity).toBe(1);

      // Pide otra helada (debe acumular en la línea de helada)
      addItemWithTemp(inkaKola, "Helada");
      expect(orderItems.length).toBe(2);
      expect(orderItems[0].quantity).toBe(2);
      expect(orderItems[1].quantity).toBe(1);
    });
  });
});
