import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  cashRegisterFindFirst: vi.fn(),
  cashRegisterCreate: vi.fn(),
  cashSessionFindFirst: vi.fn(),
  cashSessionFindUnique: vi.fn(),
  cashSessionCreate: vi.fn(),
  cashSessionUpdate: vi.fn(),
  cashMovementFindMany: vi.fn(),
  cashMovementCreate: vi.fn(),
  salesInvoiceFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  postCashSessionOpeningJournalEntry: vi.fn(),
  postCashMovementExpenseJournalEntry: vi.fn(),
  postCashSessionClosingJournalEntries: vi.fn(),
  currentSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cashRegister: {
      findFirst: m.cashRegisterFindFirst,
      create: m.cashRegisterCreate,
    },
    cashSession: {
      findFirst: m.cashSessionFindFirst,
      findUnique: m.cashSessionFindUnique,
      create: m.cashSessionCreate,
      update: m.cashSessionUpdate,
    },
    cashMovement: {
      findMany: m.cashMovementFindMany,
      create: m.cashMovementCreate,
    },
    salesInvoice: {
      findMany: m.salesInvoiceFindMany,
    },
    user: {
      findUnique: m.userFindUnique,
      findFirst: m.userFindFirst,
    },
  },
}));

vi.mock("@/lib/auth/current-session", () => ({
  currentSession: m.currentSession,
}));

vi.mock("@/lib/services/accounting-posting.service", () => ({
  postCashSessionOpeningJournalEntry: m.postCashSessionOpeningJournalEntry,
  postCashMovementExpenseJournalEntry: m.postCashMovementExpenseJournalEntry,
  postCashSessionClosingJournalEntries: m.postCashSessionClosingJournalEntries,
}));

import { GET as getCashSession, POST as postOpenCashSession } from "@/app/api/cash-sessions/route";
import { GET as getMovements, POST as postMovement } from "@/app/api/cash-sessions/movements/route";
import { POST as postCloseSession } from "@/app/api/cash-sessions/[id]/close/route";

describe("Characterization: Cash Sessions Domain Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.currentSession.mockResolvedValue({ userId: 1, username: "cajero1", role: "CASHIER" });
    m.userFindUnique.mockResolvedValue({ id: 1, username: "cajero1" });
  });

  describe("GET /api/cash-sessions", () => {
    it("debe retornar estado de caja abierta con cálculos de ventas y movimientos", async () => {
      m.cashRegisterFindFirst.mockResolvedValueOnce({
        id: 1,
        name: "Caja Principal - Salón",
        code: "CAJA-01",
        active: true,
      });

      const mockOpenedAt = new Date("2026-11-01T08:00:00Z");
      m.cashSessionFindFirst.mockResolvedValueOnce({
        id: 10,
        cashRegisterId: 1,
        openedAt: mockOpenedAt,
        openedBy: { id: 1, username: "cajero1" },
        initialAmount: 200,
        salesCash: 500,
        salesOther: 150,
        totalSales: 650,
        notesOpening: "Arqueo inicial",
        status: "OPEN",
        movements: [
          {
            id: 1,
            sessionId: 10,
            type: "EXPENSE",
            amount: 50,
            reason: "Compra de verduras de urgencia",
            createdAt: new Date("2026-11-01T10:00:00Z"),
          },
        ],
      });

      m.salesInvoiceFindMany.mockResolvedValueOnce([]);

      const req = new NextRequest("http://localhost:3000/api/cash-sessions");
      const res = await getCashSession(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.isOpened).toBe(true);
      expect(json.activeSession).toMatchObject({
        id: 10,
        openedBy: "cajero1",
        initialAmount: 200,
        salesCash: 500,
        totalSales: 650,
        totalExpenses: 50,
        expectedAmount: 650, // 200 + 500 - 50
        status: "OPEN",
      });
    });

    it("debe retornar isOpened: false si no hay sesión abierta", async () => {
      m.cashRegisterFindFirst.mockResolvedValueOnce({
        id: 1,
        name: "Caja Principal - Salón",
        code: "CAJA-01",
        active: true,
      });
      m.cashSessionFindFirst.mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/cash-sessions");
      const res = await getCashSession(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.isOpened).toBe(false);
      expect(json.activeSession).toBeNull();
    });
  });

  describe("POST /api/cash-sessions (Apertura)", () => {
    it("debe rechazar 400 si la caja ya cuenta con una sesión abierta", async () => {
      m.cashRegisterFindFirst.mockResolvedValueOnce({ id: 1, name: "Caja Principal" });
      m.cashSessionFindFirst.mockResolvedValueOnce({ id: 5, status: "OPEN" });

      const req = new NextRequest("http://localhost:3000/api/cash-sessions", {
        method: "POST",
        body: JSON.stringify({ initialAmount: 150 }),
      });

      const res = await postOpenCashSession(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("ya tiene una sesión abierta activa");
    });

    it("debe abrir sesión exitosamente y registrar asiento contable", async () => {
      m.cashRegisterFindFirst.mockResolvedValueOnce({ id: 1, name: "Caja Principal" });
      m.cashSessionFindFirst.mockResolvedValueOnce(null);
      m.cashSessionCreate.mockResolvedValueOnce({
        id: 12,
        cashRegisterId: 1,
        openedById: 1,
        initialAmount: 250,
        status: "OPEN",
        openedBy: { id: 1, username: "cajero1" },
        openedAt: new Date("2026-11-01T08:00:00Z"),
      });
      m.postCashSessionOpeningJournalEntry.mockResolvedValueOnce(701);

      const req = new NextRequest("http://localhost:3000/api/cash-sessions", {
        method: "POST",
        body: JSON.stringify({
          initialAmount: 250,
          notesOpening: "Turno mañana",
        }),
      });

      const res = await postOpenCashSession(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.message).toBe("Caja abierta exitosamente y comunicada a contabilidad.");
      expect(json.session.id).toBe(12);
      expect(json.journalEntryId).toBe(701);
      expect(m.postCashSessionOpeningJournalEntry).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ sessionId: 12, initialAmount: 250 })
      );
    });
  });

  describe("POST /api/cash-sessions/movements", () => {
    it("debe registrar un egreso de caja y disparar asiento de gasto", async () => {
      m.cashSessionFindUnique.mockResolvedValueOnce({
        id: 12,
        status: "OPEN",
        initialAmount: 100,
        salesCash: 50,
        movements: [],
      });
      m.cashMovementCreate.mockResolvedValueOnce({
        id: 88,
        sessionId: 12,
        type: "EXPENSE",
        amount: 35.5,
        reason: "Taxi para insumos",
        createdAt: new Date("2026-11-01T11:00:00Z"),
      });
      m.postCashMovementExpenseJournalEntry.mockResolvedValueOnce(705);

      const req = new NextRequest("http://localhost:3000/api/cash-sessions/movements", {
        method: "POST",
        body: JSON.stringify({
          sessionId: 12,
          type: "EXPENSE",
          amount: 35.5,
          reason: "Taxi para insumos",
        }),
      });

      const res = await postMovement(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.movement.id).toBe(88);
      expect(json.journalEntryId).toBe(705);
      expect(m.postCashMovementExpenseJournalEntry).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ sessionId: 12, amount: 35.5 })
      );
    });
  });

  describe("POST /api/cash-sessions/[id]/close (Cierre y Arqueo)", () => {
    it("debe cerrar la sesión, calcular sobrante/faltante y registrar asientos de cierre", async () => {
      const mockOpenedAt = new Date("2026-11-01T08:00:00Z");
      const mockClosedAt = new Date("2026-11-01T23:00:00Z");

      m.cashSessionFindUnique.mockResolvedValueOnce({
        id: 12,
        status: "OPEN",
        openedAt: mockOpenedAt,
        initialAmount: 200,
        salesCash: 600,
        salesOther: 200,
        totalSales: 800,
        movements: [
          {
            id: 1,
            sessionId: 12,
            type: "EXPENSE",
            amount: 50,
            reason: "Gasolina",
            createdAt: mockOpenedAt,
          },
        ],
        invoices: [{ total: 600 }],
        cashRegister: { name: "Caja Principal" },
        openedBy: { id: 1, username: "cajero1" },
      });

      m.cashSessionUpdate.mockResolvedValueOnce({
        id: 12,
        status: "CLOSED",
        openedAt: mockOpenedAt,
        closedAt: mockClosedAt,
        closedById: 1,
        finalCounted: 760,
        difference: 10,
        closedBy: { id: 1, username: "cajero1" },
        openedBy: { id: 1, username: "cajero1" },
      });

      m.postCashSessionClosingJournalEntries.mockResolvedValueOnce([801, 802]);

      const req = new NextRequest("http://localhost:3000/api/cash-sessions/12/close", {
        method: "POST",
        body: JSON.stringify({
          countedAmount: 760,
          notesClosing: "Cuadre final perfecto con S/ 10 de sobrante",
        }),
      });

      const res = await postCloseSession(req, {
        params: Promise.resolve({ id: "12" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe("Cierre y arqueo de caja registrado y enviado a contabilidad exitosamente.");
      expect(json.journalEntryIds).toEqual([801, 802]);
      expect(m.postCashSessionClosingJournalEntries).toHaveBeenCalled();
    });
  });
});
