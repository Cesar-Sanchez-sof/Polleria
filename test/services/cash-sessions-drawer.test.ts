import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  registerFindFirst: vi.fn(),
  sessionFindFirst: vi.fn(),
  sessionFindUnique: vi.fn(),
  sessionCreate: vi.fn(),
  sessionUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  notify: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cashRegister: { findFirst: m.registerFindFirst },
    cashSession: { findFirst: m.sessionFindFirst, findUnique: m.sessionFindUnique, create: m.sessionCreate, update: m.sessionUpdate },
    user: { findUnique: m.userFindUnique, findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/auth/current-session", () => ({ currentSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/services/accounting/accounting-posting.service", () => ({
  postCashSessionOpeningJournalEntry: vi.fn().mockResolvedValue(1),
  postCashMovementExpenseJournalEntry: vi.fn(),
  postCashSessionClosingJournalEntries: vi.fn().mockResolvedValue([2]),
}));
vi.mock("@/lib/services/integrations/cash-drawer.service", () => ({ notifyCashDrawer: m.notify }));
vi.mock("@/lib/services/security/audit.service", () => ({ logAudit: m.logAudit }));

import { closeCashSession, openCashSession, openDrawerNoSale } from "@/lib/services/sales/cash-sessions.service";

const register = { id: 1, name: "Caja Principal - Salón", code: "CAJA-01", active: true };
const device = { ok: true, mode: "simulated", event: "OPEN_SESSION", message: "ok", ticket: "t", at: "x" };

beforeEach(() => {
  vi.clearAllMocks();
  m.registerFindFirst.mockResolvedValue(register);
  m.userFindUnique.mockResolvedValue({ id: 1 });
  m.notify.mockResolvedValue(device);
});

describe("apertura de caja con caja registradora física", () => {
  it("abre la gaveta con el fondo inicial y devuelve el resultado del dispositivo", async () => {
    m.sessionFindFirst.mockResolvedValue(null);
    const openedAt = new Date("2026-11-11T13:00:00Z");
    m.sessionCreate.mockResolvedValue({ id: 7, openedAt, openedBy: { id: 1, username: "andy" } });
    const r = await openCashSession({ initialAmount: 120, userId: 1 });
    expect(m.notify).toHaveBeenCalledWith("OPEN_SESSION", expect.objectContaining({ sessionId: 7, cashier: "andy", initialAmount: 120, registerName: register.name }));
    expect(r.device).toEqual(device);
  });

  it("no abre la gaveta si ya hay una sesión abierta", async () => {
    m.sessionFindFirst.mockResolvedValue({ id: 3 });
    await expect(openCashSession({ initialAmount: 50, userId: 1 })).rejects.toThrow(/ya tiene una sesión abierta/);
    expect(m.notify).not.toHaveBeenCalled();
  });
});

describe("cierre de caja con caja registradora física", () => {
  const existing = {
    id: 7,
    status: "OPEN",
    openedAt: new Date("2026-11-11T13:00:00Z"),
    initialAmount: 100,
    salesCash: 500,
    cashRegister: register,
    openedBy: { id: 1, username: "andy" },
    movements: [{ id: 1, sessionId: 7, type: "EXPENSE", amount: 50, reason: "hielo", createdAt: new Date() }],
  };

  it("guarda esperado y contado con los campos reales del esquema y manda el ticket de cierre", async () => {
    m.sessionFindUnique.mockResolvedValue(existing);
    m.sessionUpdate.mockImplementation(async ({ data }) => ({ id: 7, closedAt: data.closedAt, closedBy: { id: 1, username: "andy" }, notesClosing: null }));
    const r = await closeCashSession(7, { countedAmount: 540, userId: 1 });

    const data = m.sessionUpdate.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "CLOSED", expectedAmount: 550, countedAmount: 540, difference: -10 });
    expect(data).not.toHaveProperty("finalCounted");
    expect(m.sessionFindUnique.mock.calls[0][0].include).not.toHaveProperty("invoices");
    expect(m.notify).toHaveBeenCalledWith("CLOSE_SESSION", expect.objectContaining({ expectedAmount: 550, countedAmount: 540, difference: -10, expenses: 50 }));
    expect(r.device).toEqual(device);
  });
});

describe("gaveta sin venta", () => {
  const actor = { userId: 1, username: "andy" };

  it("exige un motivo y una caja abierta", async () => {
    await expect(openDrawerNoSale({ reason: " " }, actor)).rejects.toThrow(/motivo/);
    m.sessionFindFirst.mockResolvedValue(null);
    await expect(openDrawerNoSale({ reason: "dar vuelto" }, actor)).rejects.toThrow(/abre la caja/);
    expect(m.notify).not.toHaveBeenCalled();
  });

  it("abre la gaveta y queda en la bitácora de auditoría", async () => {
    m.sessionFindFirst.mockResolvedValue({ id: 7 });
    await openDrawerNoSale({ reason: "cambiar billetes" }, actor);
    expect(m.notify).toHaveBeenCalledWith("NO_SALE", expect.objectContaining({ reason: "cambiar billetes", sessionId: 7 }));
    expect(m.logAudit).toHaveBeenCalledWith(expect.objectContaining({ module: "Caja", entity: "Gaveta", entityId: 7 }));
  });
});
