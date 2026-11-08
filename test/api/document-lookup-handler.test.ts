import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/document-lookup/route";
import * as docLookupService from "@/lib/services/integrations/document-lookup.service";

describe("Document Lookup API Handler (app/api/document-lookup)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/document-lookup", () => {
    it("debe retornar 200 con datos de identidad para DNI válido", async () => {
      vi.spyOn(docLookupService, "lookupIdentityDocument").mockResolvedValueOnce({
        type: "dni",
        number: "47829103",
        fullName: "JUAN CARLOS PÉREZ RODRÍGUEZ",
        source: "simulado",
      });

      const req = new NextRequest("http://localhost:3000/api/document-lookup?tipo=dni&numero=47829103");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.fullName).toBe("JUAN CARLOS PÉREZ RODRÍGUEZ");
    });

    it("debe retornar 400 si falta el número de documento", async () => {
      const req = new NextRequest("http://localhost:3000/api/document-lookup?tipo=dni&numero=");
      const res = await GET(req);
      expect(res.status).toBe(400);
    });

    it("debe retornar 400 si el DNI tiene formato inválido", async () => {
      const req = new NextRequest("http://localhost:3000/api/document-lookup?tipo=dni&numero=123");
      const res = await GET(req);
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/document-lookup", () => {
    it("debe retornar 200 al consultar RUC válido", async () => {
      vi.spyOn(docLookupService, "lookupIdentityDocument").mockResolvedValueOnce({
        type: "ruc",
        number: "20601234567",
        fullName: "INVERSIONES GASTRONÓMICAS PERÚ S.A.C.",
        businessName: "INVERSIONES GASTRONÓMICAS PERÚ S.A.C.",
        source: "simulado",
      });

      const req = new NextRequest("http://localhost:3000/api/document-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ruc", number: "20601234567" }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.businessName).toBe("INVERSIONES GASTRONÓMICAS PERÚ S.A.C.");
    });

    it("debe retornar 400 si el RUC tiene longitud incorrecta", async () => {
      const req = new NextRequest("http://localhost:3000/api/document-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ruc", number: "20123" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });
});
