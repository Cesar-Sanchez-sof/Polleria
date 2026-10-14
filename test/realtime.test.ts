import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  realtimeHub,
  broadcastRealtimeEvent,
  subscribeToRealtimeEvents,
  RealtimeEvent,
} from "../lib/realtime/event-emitter";
import { GET as realtimeGET, POST as realtimePOST } from "../app/api/realtime/route";
import { NextRequest } from "next/server";

describe("Módulo Realtime (WebSockets / SSE) - Pruebas Unitarias", () => {
  beforeEach(() => {
    realtimeHub.reset();
  });

  describe("RealtimeHub Bus de Eventos en Memoria", () => {
    it("debe suscribir listeners y recibir eventos transmitidos", () => {
      const receivedEvents: RealtimeEvent[] = [];

      const unsubscribe = subscribeToRealtimeEvents((event) => {
        receivedEvents.push(event);
      });

      broadcastRealtimeEvent("ORDER_CREATED", {
        orderId: 10,
        orderCode: "PED-010",
        orderType: "Mesa",
      });

      broadcastRealtimeEvent("TABLE_UPDATED", {
        tableId: 3,
        reason: "NUEVA_COMANDA",
      });

      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0].type).toBe("ORDER_CREATED");
      expect(receivedEvents[0].payload.orderCode).toBe("PED-010");
      expect(receivedEvents[1].type).toBe("TABLE_UPDATED");

      unsubscribe();

      broadcastRealtimeEvent("DRINK_DISPATCHED", {
        itemId: 5,
        targetStatus: "Delivered",
      });

      // El listener ya no debe recibir más eventos tras desuscribirse
      expect(receivedEvents).toHaveLength(2);
    });

    it("debe mantener un historial de eventos recientes en búfer circular", () => {
      for (let i = 1; i <= 35; i++) {
        broadcastRealtimeEvent("ORDER_STATUS_CHANGED", { iteration: i });
      }

      const recent = realtimeHub.getRecentEvents(10);
      expect(recent).toHaveLength(10);
      expect(recent[recent.length - 1].payload.iteration).toBe(35);
      expect(recent[0].payload.iteration).toBe(26);
    });

    it("debe gestionar clientes SSE activos y desconexiones", () => {
      const mockController = {
        enqueue: vi.fn(),
        close: vi.fn(),
      } as any;

      expect(realtimeHub.getActiveClientCount()).toBe(0);

      const removeClient = realtimeHub.addSSEClient(mockController);
      expect(realtimeHub.getActiveClientCount()).toBe(1);

      broadcastRealtimeEvent("PAYMENT_RECEIVED", {
        orderId: 99,
        voucherCode: "B001-000100",
        total: 54.0,
      });

      expect(mockController.enqueue).toHaveBeenCalledTimes(1);

      removeClient();
      expect(realtimeHub.getActiveClientCount()).toBe(0);
    });
  });

  describe("Route Handlers /api/realtime", () => {
    it("debe emitir un evento vía POST /api/realtime y devolver 200", async () => {
      const req = new NextRequest("http://localhost:3000/api/realtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ORDER_CREATED",
          payload: { id: 101, code: "PED-101" },
        }),
      });

      const res = await realtimePOST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.event.type).toBe("ORDER_CREATED");
      expect(json.event.payload.code).toBe("PED-101");
    });

    it("debe rechazar POST /api/realtime con 400 si falta el campo 'type'", async () => {
      const req = new NextRequest("http://localhost:3000/api/realtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { foo: "bar" },
        }),
      });

      const res = await realtimePOST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("Debe especificar un tipo de evento");
    });

    it("debe iniciar una conexión Server-Sent Events vía GET /api/realtime con cabeceras correctas", async () => {
      const controller = new AbortController();
      const req = new NextRequest("http://localhost:3000/api/realtime", {
        method: "GET",
        signal: controller.signal,
      });

      const res = await realtimeGET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/event-stream");
      expect(res.headers.get("Cache-Control")).toContain("no-cache");
      expect(res.headers.get("Connection")).toBe("keep-alive");

      controller.abort();
    });
  });
});
