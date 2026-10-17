import { describe, expect, it } from "vitest";
import { simulateSireSubmission } from "./local-simulator";
import type { PleSnapshot } from "@/lib/ple/snapshot";

function snapshot(): PleSnapshot {
  return {
    taxpayer: { ruc: "20608976543", name: "POLLERIA" },
    period: { year: 2026, month: 10 },
    salesInvoices: [{
      id: 1, voucherType: "Factura", series: "F001", number: 1, issuedAt: "2026-10-05",
      subtotal: 100, igv: 18, total: 118, status: "Issued",
      customer: { documentNumber: "20200008554", name: "CLIENTE S.A.C." },
    }],
    purchaseInvoices: [],
    journalEntries: [{
      id: 1, code: "MISC/2026/10/0001", date: "2026-10-05", description: "Sale", active: true,
      salesInvoiceId: 1, purchaseInvoiceId: null,
      lines: [{ accountCode: "121", description: null, debit: 118, credit: 0 }],
    }],
    accounts: [],
  };
}

describe("local SIRE simulator", () => {
  it("validates a sales register without contacting SUNAT", () => {
    const result = simulateSireSubmission("sales-register", snapshot());
    expect(result).toMatchObject({
      environment: "local-test", register: "RVIE", period: "202610", status: "validated",
      ticket: "LOCAL-RVIE-202610-OK", recordCount: 1,
    });
    expect(result.payload.content).toContain("F001");
  });

  it("reports validation failures as a rejected local submission", () => {
    const data = snapshot();
    data.salesInvoices[0].customer = { documentNumber: "", name: "" };
    const result = simulateSireSubmission("sales-register", data);
    expect(result.status).toBe("rejected");
    expect(result.ticket).toBe("LOCAL-RVIE-202610-ERR");
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(true);
  });
});
