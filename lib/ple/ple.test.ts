import { describe, expect, it } from "vitest";
import { buildPleFileName } from "./file-name";
import { formatCents, formatDate, formatMoney, sanitizeText, toCents } from "./format";
import { generatePleBook } from "./generate";
import { purchaseStatus } from "./books/purchases-register";
import type { PleSnapshot } from "./snapshot";

const RUC = "20608976543";

function entryLines(total: number, igv: number, subtotal: number) {
  return [
    { accountCode: "121", description: "Cuentas por cobrar", debit: total, credit: 0 },
    { accountCode: "401", description: "IGV por pagar", debit: 0, credit: igv },
    { accountCode: "701", description: "Ventas netas", debit: 0, credit: subtotal },
  ];
}

function buildSnapshot(): PleSnapshot {
  return {
    taxpayer: { ruc: RUC, name: "POLLERIA S.A.C." },
    period: { year: 2026, month: 10 },
    salesInvoices: [
      {
        id: 1,
        voucherType: "Factura",
        series: "F001",
        number: 157,
        issuedAt: "2026-10-05",
        subtotal: 100,
        igv: 18,
        total: 118,
        status: "Issued",
        customer: { documentNumber: "20200008554", name: "GRUPO NUNEZ S.R.L." },
      },
      {
        id: 2,
        voucherType: "Boleta",
        series: "B001",
        number: 946,
        issuedAt: "2026-10-05",
        subtotal: 85.17,
        igv: 15.33,
        total: 100.5,
        status: "Issued",
        customer: { documentNumber: "00000000", name: "Cliente Varios" },
      },
      {
        id: 3,
        voucherType: "Boleta",
        series: "B001",
        number: 947,
        issuedAt: "2026-10-06",
        subtotal: 0,
        igv: 0,
        total: 0,
        status: "Annulled",
        customer: null,
      },
    ],
    purchaseInvoices: [
      {
        id: 10,
        voucherType: "Factura",
        series: "F010",
        number: 33,
        issuedAt: "2026-10-03",
        subtotal: 200,
        igv: 36,
        total: 236,
        active: true,
        supplier: { documentNumber: "20100070970", name: "SUPERMERCADOS S.A." },
      },
      {
        id: 11,
        voucherType: "Factura",
        series: "F020",
        number: 8,
        issuedAt: "2026-08-28",
        subtotal: 50,
        igv: 9,
        total: 59,
        active: true,
        supplier: { documentNumber: "20100070970", name: "SUPERMERCADOS S.A." },
      },
      {
        id: 12,
        voucherType: "Boleta",
        series: "B050",
        number: 5,
        issuedAt: "2026-10-04",
        subtotal: 0,
        igv: 0,
        total: 20,
        active: true,
        supplier: { documentNumber: "", name: "Bodega" },
      },
    ],
    journalEntries: [
      {
        id: 100,
        code: "MISC/2026/10/0001",
        date: "2026-10-05",
        description: "Provision of Factura F001-157",
        active: true,
        salesInvoiceId: 1,
        purchaseInvoiceId: null,
        lines: entryLines(118, 18, 100),
      },
      {
        id: 101,
        code: "MISC/2026/10/0002",
        date: "2026-10-05",
        description: "Collection F001-157",
        active: true,
        salesInvoiceId: 1,
        purchaseInvoiceId: null,
        lines: [
          { accountCode: "101", description: "Cash in", debit: 118, credit: 0 },
          { accountCode: "121", description: "Receivable settled", debit: 0, credit: 118 },
        ],
      },
      {
        id: 102,
        code: "MISC/2026/10/0003",
        date: "2026-10-05",
        description: "Provision of Boleta B001-946",
        active: true,
        salesInvoiceId: 2,
        purchaseInvoiceId: null,
        lines: entryLines(100.5, 15.33, 85.17),
      },
      {
        id: 103,
        code: "MISC/2026/10/0004",
        date: "2026-10-03",
        description: "Purchase F010-33",
        active: true,
        salesInvoiceId: null,
        purchaseInvoiceId: 10,
        lines: [
          { accountCode: "601", description: "Purchases", debit: 200, credit: 0 },
          { accountCode: "167", description: "IGV credit", debit: 36, credit: 0 },
          { accountCode: "421", description: "Payables", debit: 0, credit: 236 },
        ],
      },
      {
        id: 104,
        code: "MISC/2026/10/0005",
        date: "2026-10-04",
        description: "Purchase F020-8 (registered late)",
        active: true,
        salesInvoiceId: null,
        purchaseInvoiceId: 11,
        lines: [
          { accountCode: "601", description: "Purchases", debit: 50, credit: 0 },
          { accountCode: "167", description: "IGV credit", debit: 9, credit: 0 },
          { accountCode: "421", description: "Payables", debit: 0, credit: 59 },
        ],
      },
      {
        id: 105,
        code: "MISC/2026/10/0006",
        date: "2026-10-04",
        description: "Purchase B050-5",
        active: true,
        salesInvoiceId: null,
        purchaseInvoiceId: 12,
        lines: [
          { accountCode: "659", description: "Other expenses", debit: 20, credit: 0 },
          { accountCode: "421", description: "Payables", debit: 0, credit: 20 },
        ],
      },
    ],
    accounts: [
      { code: "101", name: "Caja" },
      { code: "121", name: "Facturas por cobrar" },
      { code: "167", name: "IGV credito fiscal" },
      { code: "401", name: "IGV por pagar" },
      { code: "421", name: "Facturas por pagar" },
      { code: "601", name: "Mercaderias" },
      { code: "659", name: "Otros gastos de gestion" },
      { code: "701", name: "Ventas de mercaderias" },
    ],
  };
}

describe("format helpers", () => {
  it("converts to cents without floating point drift", () => {
    expect(toCents(1.005)).toBe(101);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(formatCents(-1234)).toBe("-12.34");
    expect(formatMoney(5)).toBe("5.00");
  });

  it("formats ISO dates as DD/MM/YYYY", () => {
    expect(formatDate("2026-10-05")).toBe("05/10/2026");
    expect(formatDate("bad")).toBe("");
  });

  it("removes layout breaking characters and truncates", () => {
    expect(sanitizeText("A|B & C\nD", 50).text).toBe("A B C D");
    expect(sanitizeText("abcdef", 3)).toEqual({ text: "abc", truncated: true });
  });
});

describe("buildPleFileName", () => {
  it("builds the 33 character name for the sales register", () => {
    const name = buildPleFileName({
      book: "sales-register",
      ruc: RUC,
      year: 2026,
      month: 10,
      hasContent: true,
    });
    expect(name).toBe("LE2060897654320261000140100001111.TXT");
    expect(name.length - 4).toBe(33);
  });

  it("flags empty books with content indicator 0", () => {
    const name = buildPleFileName({
      book: "general-journal",
      ruc: RUC,
      year: 2026,
      month: 1,
      hasContent: false,
    });
    expect(name).toBe("LE2060897654320260100050100001011.TXT");
  });

  it("rejects an invalid RUC", () => {
    expect(() =>
      buildPleFileName({ book: "cash-book", ruc: "123", year: 2026, month: 1, hasContent: true })
    ).toThrow();
  });
});

describe("sales register 14.1", () => {
  const result = generatePleBook("sales-register", buildSnapshot());
  const lines = result.content.split("\r\n").filter(Boolean);

  it("has no errors and one line per voucher", () => {
    expect(result.hasErrors).toBe(false);
    expect(lines).toHaveLength(3);
  });

  it("writes the invoice with 34 fields and a trailing separator", () => {
    const cells = lines[0].split("|");
    expect(cells).toHaveLength(35); // 34 fields + empty after the trailing separator
    expect(cells[0]).toBe("20261000");
    expect(cells[1]).toBe("MISC/2026/10/0001");
    expect(cells[2]).toBe("M1");
    expect(cells[3]).toBe("05/10/2026");
    expect(cells[5]).toBe("01");
    expect(cells[6]).toBe("F001");
    expect(cells[7]).toBe("00000157");
    expect(cells[9]).toBe("6");
    expect(cells[10]).toBe("20200008554");
    expect(cells[13]).toBe("100.00");
    expect(cells[15]).toBe("18.00");
    expect(cells[23]).toBe("118.00");
    expect(cells[24]).toBe("PEN");
    expect(cells[33]).toBe("1");
  });

  it("omits the customer of boletas below 700 without a valid document", () => {
    const cells = lines[1].split("|");
    expect(cells[5]).toBe("03");
    expect(cells[9]).toBe("");
    expect(cells[10]).toBe("");
    expect(cells[11]).toBe("");
  });

  it("reports annulled vouchers with status 2 and no amounts", () => {
    const cells = lines[2].split("|");
    expect(cells[33]).toBe("2");
    expect(cells[3]).toBe("");
    expect(cells[23]).toBe("0.00");
  });

  it("errors when an invoice has no RUC", () => {
    const snapshot = buildSnapshot();
    snapshot.salesInvoices[0].customer = { documentNumber: "12345678", name: "Juan" };
    const broken = generatePleBook("sales-register", snapshot);
    expect(broken.hasErrors).toBe(true);
    expect(broken.issues[0].message).toMatch(/RUC/);
  });
});

describe("purchases register 8.1", () => {
  const result = generatePleBook("purchases-register", buildSnapshot());
  const lines = result.content.split("\r\n").filter(Boolean);

  it("has no errors and 41 fields", () => {
    expect(result.hasErrors).toBe(false);
    expect(lines).toHaveLength(3);
    expect(lines[0].split("|")).toHaveLength(42);
  });

  it("uses status 1 for a same-period invoice with credit in fields 14 and 15", () => {
    const cells = lines.find((line) => line.includes("F010"))!.split("|");
    expect(cells[40]).toBe("1");
    expect(cells[13]).toBe("200.00");
    expect(cells[14]).toBe("36.00");
    expect(cells[22]).toBe("236.00");
  });

  it("uses status 6 for an invoice issued in a previous month", () => {
    const cells = lines.find((line) => line.includes("F020"))!.split("|");
    expect(cells[40]).toBe("6");
  });

  it("puts boletas in non-taxed acquisitions with status 0", () => {
    const cells = lines.find((line) => line.includes("B050"))!.split("|");
    expect(cells[40]).toBe("0");
    expect(cells[13]).toBe("");
    expect(cells[19]).toBe("20.00");
    expect(cells[22]).toBe("20.00");
  });

  it("computes the status window", () => {
    expect(purchaseStatus("01", "2026-10-01", 2026, 10)).toBe("1");
    expect(purchaseStatus("01", "2025-10-30", 2026, 10)).toBe("6");
    expect(purchaseStatus("01", "2025-09-30", 2026, 10)).toBe("7");
    expect(purchaseStatus("01", "2026-11-01", 2026, 10)).toBeNull();
    expect(purchaseStatus("03", "2026-10-01", 2026, 10)).toBe("0");
  });
});

describe("general journal 5.1 and ledger 6.1", () => {
  const journal = generatePleBook("general-journal", buildSnapshot());
  const lines = journal.content.split("\r\n").filter(Boolean);

  const saleLines = lines.filter((line) => line.includes("MISC/2026/10/0001"));

  it("emits one 21-field line per accounting line", () => {
    expect(journal.hasErrors).toBe(false);
    expect(journal.recordCount).toBe(16);
    expect(lines[0].split("|")).toHaveLength(22);
  });

  it("balances debit and credit", () => {
    expect(journal.totals.debit).toBe(journal.totals.credit);
  });

  it("links the sale receivable line with the register through the structured data", () => {
    const cells = saleLines[0].split("|");
    expect(cells[2]).toBe("M1");
    expect(cells[19]).toBe("140100&20261000&MISC/2026/10/0001&M1");
    const sales = generatePleBook("sales-register", buildSnapshot()).content.split("\r\n")[0];
    const salesCells = sales.split("|");
    expect(`140100&${salesCells[0]}&${salesCells[1]}&${salesCells[2]}`).toBe(cells[19]);
  });

  it("links the purchase payable line with 080100", () => {
    const line = lines.find((l) => l.includes("MISC/2026/10/0004") && l.includes("&M3"))!;
    expect(line.split("|")[19]).toBe("080100&20261000&MISC/2026/10/0004&M3");
  });

  it("uses voucher type 00 for entries without voucher and the invoice for the others", () => {
    expect(saleLines[0].split("|")[9]).toBe("01");
    expect(saleLines[0].split("|")[11]).toBe("00000157");
    expect(saleLines[0].split("|")[7]).toBe("6");
  });

  it("rejects unbalanced entries", () => {
    const snapshot = buildSnapshot();
    snapshot.journalEntries[0].lines[0].debit = 119;
    const broken = generatePleBook("general-journal", snapshot);
    expect(broken.hasErrors).toBe(true);
    expect(broken.issues.some((issue) => /unbalanced/.test(issue.message))).toBe(true);
  });

  it("skips annulled entries", () => {
    const snapshot = buildSnapshot();
    snapshot.journalEntries[1].active = false;
    expect(generatePleBook("general-journal", snapshot).recordCount).toBe(14);
  });

  it("orders the ledger by account", () => {
    const ledger = generatePleBook("general-ledger", buildSnapshot());
    const accounts = ledger.content
      .split("\r\n")
      .filter(Boolean)
      .map((line) => line.split("|")[3]);
    expect(accounts).toEqual([...accounts].sort((a, b) => Number(a) - Number(b)));
    expect(ledger.fileName).toContain("060100");
  });
});

describe("chart of accounts 5.3", () => {
  it("lists the used accounts with the PCGE plan code", () => {
    const result = generatePleBook("chart-of-accounts", buildSnapshot());
    const lines = result.content.split("\r\n").filter(Boolean);
    expect(result.hasErrors).toBe(false);
    expect(lines[0]).toBe("20261000|101|Caja|01||||1|");
    expect(lines).toHaveLength(8);
  });

  it("errors when a used account is missing from the plan", () => {
    const snapshot = buildSnapshot();
    snapshot.accounts = snapshot.accounts.filter((account) => account.code !== "101");
    expect(generatePleBook("chart-of-accounts", snapshot).hasErrors).toBe(true);
  });
});

describe("cash book 1.1", () => {
  it("emits the lines of cash accounts only", () => {
    const result = generatePleBook("cash-book", buildSnapshot());
    const lines = result.content.split("\r\n").filter(Boolean);
    expect(result.hasErrors).toBe(false);
    expect(lines).toHaveLength(1);
    const cells = lines[0].split("|");
    expect(cells).toHaveLength(20);
    expect(cells[3]).toBe("101");
    expect(cells[15]).toBe("118.00");
    expect(cells[16]).toBe("0.00");
  });
});

describe("empty month", () => {
  it("returns an empty file with content indicator 0", () => {
    const snapshot = buildSnapshot();
    snapshot.salesInvoices = [];
    snapshot.purchaseInvoices = [];
    snapshot.journalEntries = [];
    const result = generatePleBook("sales-register", snapshot);
    expect(result.recordCount).toBe(0);
    expect(result.fileName).toBe("LE2060897654320261000140100001011.TXT");
  });
});
