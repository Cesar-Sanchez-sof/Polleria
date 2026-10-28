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
} = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  logAuditMock: vi.fn(),
  periodFindFirstMock: vi.fn(),
  periodFindUniqueMock: vi.fn(),
  periodFindManyMock: vi.fn(),
  periodCreateMock: vi.fn(),
  periodUpdateMock: vi.fn(),
}));

vi.mock("@/lib/auth/permissions", () => ({
  authorize: authorizeMock,
}));

vi.mock("@/lib/services/audit.service", () => ({
  logAudit: logAuditMock,
  requestIp: () => "127.0.0.1",
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accountingPeriod: {
      findFirst: periodFindFirstMock,
      findUnique: periodFindUniqueMock,
      findMany: periodFindManyMock,
      create: periodCreateMock,
      update: periodUpdateMock,
    },
  },
}));

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
      periodFindUniqueMock.mockResolvedValueOnce({ id: 5, status: "OPEN" });
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
      periodFindUniqueMock.mockResolvedValueOnce({ id: 5, status: "CLOSED" });
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
  });
});
