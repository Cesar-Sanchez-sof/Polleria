import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const {
  authorizeMock,
  logAuditMock,
  periodFindFirstMock,
  periodFindUniqueMock,
  periodFindManyMock,
  periodCreateMock,
  periodUpdateMock,
  detailGroupByMock,
  entryFindManyMock,
  entryUpdateManyMock,
  entryCreateMock,
  cashSessionCountMock,
  accountFindManyMock,
} = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  logAuditMock: vi.fn(),
  periodFindFirstMock: vi.fn(),
  periodFindUniqueMock: vi.fn(),
  periodFindManyMock: vi.fn(),
  periodCreateMock: vi.fn(),
  periodUpdateMock: vi.fn(),
  detailGroupByMock: vi.fn(),
  entryFindManyMock: vi.fn(),
  entryUpdateManyMock: vi.fn(),
  entryCreateMock: vi.fn(),
  cashSessionCountMock: vi.fn(),
  accountFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/permissions", () => ({
  authorize: authorizeMock,
}));

vi.mock("@/lib/services/security/audit.service", () => ({
  logAudit: logAuditMock,
  requestIp: () => "127.0.0.1",
}));

vi.mock("@/lib/prisma", () => {
  const client: Record<string, unknown> = {
    accountingPeriod: {
      findFirst: periodFindFirstMock,
      findUnique: periodFindUniqueMock,
      findMany: periodFindManyMock,
      create: periodCreateMock,
      update: periodUpdateMock,
    },
    journalEntryDetail: { groupBy: detailGroupByMock },
    journalEntry: { findMany: entryFindManyMock, updateMany: entryUpdateManyMock, create: entryCreateMock },
    cashSession: { count: cashSessionCountMock },
    accountingAccount: { findMany: accountFindManyMock },
  };
  client.$transaction = async (fn: (tx: unknown) => unknown) => fn(client);
  return { prisma: client };
});

import { POST, PATCH } from "@/app/api/accounting-periods/route";
import { NextResponse } from "next/server";

function createJsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("Accounting Periods API - Autenticación y Autorización (DEF-201)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/accounting-periods", () => {
    it("retorna 403 y no crea período si el usuario no tiene permiso", async () => {
      authorizeMock.mockResolvedValueOnce({
        ok: false,
        response: NextResponse.json(
          { error: "No tienes permiso para realizar esta acción" },
          { status: 403 }
        ),
      });

      const req = createJsonRequest("http://localhost/api/accounting-periods", "POST", {
        month: 11,
        year: 2026,
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      expect(periodCreateMock).not.toHaveBeenCalled();
      expect(logAuditMock).not.toHaveBeenCalled();
      expect(authorizeMock).toHaveBeenCalledWith("periodos.crear");
    });

    it("crea período registrando el ID real del usuario y registra auditoría con actor real", async () => {
      authorizeMock.mockResolvedValueOnce({
        ok: true,
        session: { userId: 42, username: "contador_real", role: "Contador" },
        superuser: false,
      });
      periodFindFirstMock.mockResolvedValueOnce(null);
      periodCreateMock.mockImplementationOnce(async ({ data }) => ({
        id: 101,
        ...data,
      }));

      const req = createJsonRequest("http://localhost/api/accounting-periods", "POST", {
        month: 11,
        year: 2026,
      });

      const res = await POST(req);
      expect(res.status).toBe(201);

      // Verifica que no se use id: 3 fijo sino el ID real de la sesión (42)
      expect(periodCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 42,
            status: "OPEN",
          }),
        })
      );

      // Verifica bitácora con actor real
      expect(logAuditMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: { userId: 42, username: "contador_real" },
          action: "CREATE",
          entityId: 101,
        })
      );
    });
  });

  describe("PATCH /api/accounting-periods", () => {
    beforeEach(() => {
      detailGroupByMock.mockResolvedValue([]);
      entryFindManyMock.mockResolvedValue([]);
      entryUpdateManyMock.mockResolvedValue({ count: 0 });
      cashSessionCountMock.mockResolvedValue(0);
    });

    it("retorna 403 y no modifica período si el usuario no tiene permiso", async () => {
      authorizeMock.mockResolvedValueOnce({
        ok: false,
        response: NextResponse.json(
          { error: "No tienes permiso para realizar esta acción" },
          { status: 403 }
        ),
      });

      const req = createJsonRequest("http://localhost/api/accounting-periods", "PATCH", {
        periodId: 5,
        reopen: false,
      });

      const res = await PATCH(req);
      expect(res.status).toBe(403);
      expect(periodUpdateMock).not.toHaveBeenCalled();
      expect(logAuditMock).not.toHaveBeenCalled();
      expect(authorizeMock).toHaveBeenCalledWith("periodos.editar");
    });

    it("cierra período registrando el ID real del usuario en closedById y auditoría", async () => {
      authorizeMock.mockResolvedValueOnce({
        ok: true,
        session: { userId: 99, username: "admin_real", role: "ADMIN" },
        superuser: true,
      });
      periodFindUniqueMock.mockResolvedValueOnce({ id: 5, status: "OPEN", endDate: new Date("2026-10-31") });
      periodUpdateMock.mockImplementationOnce(async ({ data }) => ({
        id: 5,
        ...data,
      }));

      const req = createJsonRequest("http://localhost/api/accounting-periods", "PATCH", {
        periodId: 5,
        reopen: false,
      });

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      // closedById debe ser el usuario 99, no el 3 fijo
      expect(periodUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5 },
          data: expect.objectContaining({
            status: "CLOSED",
            closedById: 99,
          }),
        })
      );

      expect(logAuditMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: { userId: 99, username: "admin_real" },
          action: "STATUS_CHANGE",
          entityId: 5,
        })
      );
    });

    it("reabre período limpiando closedById a null", async () => {
      authorizeMock.mockResolvedValueOnce({
        ok: true,
        session: { userId: 99, username: "admin_real", role: "ADMIN" },
        superuser: true,
      });
      periodFindUniqueMock.mockResolvedValueOnce({ id: 5, status: "CLOSED", endDate: new Date("2026-10-31") });
      periodUpdateMock.mockImplementationOnce(async ({ data }) => ({
        id: 5,
        ...data,
      }));

      const req = createJsonRequest("http://localhost/api/accounting-periods", "PATCH", {
        periodId: 5,
        reopen: true,
      });

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      expect(periodUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5 },
          data: expect.objectContaining({
            status: "OPEN",
            closedById: null,
            closedAt: null,
          }),
        })
      );
    });

    function adminSession() {
      authorizeMock.mockResolvedValueOnce({
        ok: true,
        session: { userId: 99, username: "admin_real", role: "ADMIN" },
        superuser: true,
      });
    }

    it("no cierra el período si hay un asiento descuadrado y lo informa con 409", async () => {
      adminSession();
      periodFindUniqueMock.mockResolvedValueOnce({ id: 5, status: "OPEN", endDate: new Date("2026-10-31") });
      detailGroupByMock.mockResolvedValueOnce([{ entryId: 7, _sum: { debit: 100, credit: 90 } }]);
      entryFindManyMock.mockResolvedValueOnce([{ id: 7, code: "MISC/2026/10/0007" }]).mockResolvedValueOnce([]);

      const res = await PATCH(createJsonRequest("http://localhost/api/accounting-periods", "PATCH", { periodId: 5 }));
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.issues[0]).toContain("MISC/2026/10/0007");
      expect(periodUpdateMock).not.toHaveBeenCalled();
    });

    it("no cierra el período si queda una sesión de caja abierta", async () => {
      adminSession();
      periodFindUniqueMock.mockResolvedValueOnce({ id: 5, status: "OPEN", endDate: new Date("2026-10-31") });
      cashSessionCountMock.mockResolvedValueOnce(1);

      const res = await PATCH(createJsonRequest("http://localhost/api/accounting-periods", "PATCH", { periodId: 5 }));

      expect(res.status).toBe(409);
      expect(periodUpdateMock).not.toHaveBeenCalled();
    });

    it("al cerrar diciembre registra el asiento de cierre del ejercicio", async () => {
      adminSession();
      periodFindUniqueMock.mockResolvedValueOnce({ id: 12, status: "OPEN", endDate: new Date("2026-12-31") });
      // 1ª llamada: revisión de asientos (sin problemas); 2ª: saldos de resultados del año
      detailGroupByMock.mockResolvedValueOnce([]).mockResolvedValueOnce([
        { accountId: 70, _sum: { debit: 0, credit: 1000 } },
        { accountId: 69, _sum: { debit: 400, credit: 0 } },
      ]);
      accountFindManyMock
        .mockResolvedValueOnce([
          { id: 70, type: "Ingreso" },
          { id: 69, type: "Costo" },
        ])
        .mockResolvedValueOnce([{ id: 59, code: "591" }]);
      entryFindManyMock.mockResolvedValue([]);
      entryCreateMock.mockResolvedValueOnce({ id: 500 });
      periodUpdateMock.mockImplementationOnce(async ({ data }) => ({ id: 12, ...data }));

      const res = await PATCH(createJsonRequest("http://localhost/api/accounting-periods", "PATCH", { periodId: 12 }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.closingEntry.result).toBe(600);
      const created = entryCreateMock.mock.calls[0][0].data;
      expect(created.book).toBe("Cierre del ejercicio");
      expect(created.entryDetails.create).toEqual([
        expect.objectContaining({ accountId: 70, debit: 1000, credit: 0 }),
        expect.objectContaining({ accountId: 69, debit: 0, credit: 400 }),
        expect.objectContaining({ accountId: 59, debit: 0, credit: 600 }),
      ]);
    });

    it("al reabrir anula el asiento de cierre del ejercicio", async () => {
      adminSession();
      periodFindUniqueMock.mockResolvedValueOnce({ id: 12, status: "CLOSED", endDate: new Date("2026-12-31") });
      entryUpdateManyMock.mockResolvedValueOnce({ count: 1 });
      periodUpdateMock.mockImplementationOnce(async ({ data }) => ({ id: 12, ...data }));

      const res = await PATCH(
        createJsonRequest("http://localhost/api/accounting-periods", "PATCH", { periodId: 12, reopen: true }),
      );

      expect(res.status).toBe(200);
      expect(entryUpdateManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { periodId: 12, book: "Cierre del ejercicio", status: true } }),
      );
    });
  });
});
