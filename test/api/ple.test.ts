import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { PleSnapshot } from "@/lib/ple/snapshot";

const { loadMock } = vi.hoisted(() => ({ loadMock: vi.fn() }));

vi.mock("@/lib/services/ple.service", () => ({ loadPleSnapshot: loadMock }));

import { GET } from "@/app/api/ple/[book]/route";

function snapshot(ruc = "20608976543"): PleSnapshot {
  return {
    taxpayer: { ruc, name: "POLLERIA" },
    period: { year: 2026, month: 10 },
    salesInvoices: [
      {
        id: 1,
        voucherType: "Factura",
        series: "F001",
        number: 1,
        issuedAt: "2026-10-05",
        subtotal: 100,
        igv: 18,
        total: 118,
        status: "Issued",
        customer: { documentNumber: "20200008554", name: "CLIENTE S.A.C." },
      },
    ],
    purchaseInvoices: [],
    journalEntries: [
      {
        id: 1,
        code: "MISC/2026/10/0001",
        date: "2026-10-05",
        description: "Sale",
        active: true,
        salesInvoiceId: 1,
        purchaseInvoiceId: null,
        lines: [
          { accountCode: "121", description: null, debit: 118, credit: 0 },
          { accountCode: "401", description: null, debit: 0, credit: 18 },
          { accountCode: "701", description: null, debit: 0, credit: 100 },
        ],
      },
    ],
    accounts: [],
  };
}

function request(query: string): NextRequest {
  return { nextUrl: new URL(`http://localhost/api/ple/sales-register${query}`) } as NextRequest;
}

const ctx = (book: string) => ({ params: Promise.resolve({ book }) });

describe("GET /api/ple/[book]", () => {
  beforeEach(() => loadMock.mockReset());

  it("rejects unknown books", async () => {
    const response = await GET(request("?year=2026&month=10"), ctx("nope"));
    expect(response.status).toBe(400);
  });

  it("validates year and month", async () => {
    expect((await GET(request("?year=2026&month=13"), ctx("sales-register"))).status).toBe(400);
    expect((await GET(request("?month=10"), ctx("sales-register"))).status).toBe(400);
  });

  it("asks for the RUC when it is missing", async () => {
    loadMock.mockResolvedValue(snapshot(""));
    const response = await GET(request("?year=2026&month=10"), ctx("sales-register"));
    expect(response.status).toBe(409);
  });

  it("returns a preview with file name and totals", async () => {
    loadMock.mockResolvedValue(snapshot());
    const response = await GET(request("?year=2026&month=10"), ctx("sales-register"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.fileName).toBe("LE2060897654320261000140100001111.TXT");
    expect(body.recordCount).toBe(1);
    expect(body.totals.total).toBe(118);
  });

  it("includes columns and rows in the preview", async () => {
    loadMock.mockResolvedValue(snapshot());
    const body = await (
      await GET(request("?year=2026&month=10"), ctx("sales-register"))
    ).json();
    expect(body.columns).toHaveLength(34);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0][1]).toBe("MISC/2026/10/0001");
    expect(body.truncated).toBe(false);
  });

  it("downloads a CSV review copy with the field labels", async () => {
    loadMock.mockResolvedValue(snapshot());
    const response = await GET(
      request("?year=2026&month=10&mode=download&format=csv"),
      ctx("sales-register")
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain(".csv");
    const text = await response.text();
    expect(text).toContain("1. Period,2. Unique operation code (CUO)");
    expect(text).toContain("20261000,MISC/2026/10/0001,M1,05/10/2026");
  });

  it("downloads the TXT when there are no errors", async () => {
    loadMock.mockResolvedValue(snapshot());
    const response = await GET(
      request("?year=2026&month=10&mode=download"),
      ctx("sales-register")
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain(
      "LE2060897654320261000140100001111.TXT"
    );
    const text = await response.text();
    expect(text.startsWith("20261000|MISC/2026/10/0001|M1|05/10/2026|")).toBe(true);
  });

  it("blocks the download when the book has errors", async () => {
    const broken = snapshot();
    broken.salesInvoices[0].customer = { documentNumber: "", name: "" };
    loadMock.mockResolvedValue(broken);
    const response = await GET(
      request("?year=2026&month=10&mode=download"),
      ctx("sales-register")
    );
    expect(response.status).toBe(422);
    expect((await response.json()).issues.length).toBeGreaterThan(0);
  });
});
