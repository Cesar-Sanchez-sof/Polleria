import { describe, expect, it, vi } from "vitest";
import { ClosedPeriodError } from "@/lib/accounting/closing";
import { postPayrollJournalEntry, postPayrollPaymentJournalEntry } from "@/lib/services/accounting-posting.service";

const ACCOUNTS: Record<string, number> = { "621": 1, "627": 2, "4031": 3, "4032": 4, "407": 5, "141": 6, "411": 7, "101": 8, "104": 9 };

function fakeTx(periodStatus: "OPEN" | "CLOSED" = "OPEN") {
  const created: Array<{ data: Record<string, unknown> }> = [];
  const tx = {
    accountingAccount: {
      findMany: vi.fn(async ({ where }: { where: { code: { in: string[] } } }) =>
        where.code.in.map((code) => ({ id: ACCOUNTS[code], code })),
      ),
      upsert: vi.fn(),
    },
    accountingPeriod: {
      findFirst: vi.fn(async () => ({ id: 5, status: periodStatus })),
      create: vi.fn(),
    },
    journalEntry: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        created.push(args);
        return { id: 99 };
      }),
    },
  };
  return { tx: tx as never, created };
}

type Line = { accountId: number; debit: number; credit: number };
const totals = (lines: Line[]) => ({
  debit: Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100,
  credit: Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100) / 100,
});

const base = {
  payrollId: 10,
  employeeName: "Ana Pérez",
  month: 11,
  year: 2026,
  entryDate: new Date(Date.UTC(2026, 10, 30)),
};

describe("postPayrollJournalEntry", () => {
  it("registra un asiento que cuadra, con el gasto, el aporte del empleador y lo que se debe", async () => {
    const { tx, created } = fakeTx();
    const id = await postPayrollJournalEntry(tx, {
      ...base,
      grossPay: 2000,
      pensionSystem: "ONP",
      pensionAmount: 260,
      advances: 300,
      netPay: 1440,
      employerContribution: 180,
    });
    expect(id).toBe(99);
    const data = created[0].data as { payrollId: number; periodId: number; book: string; entryDetails: { create: Line[] } };
    expect(data).toMatchObject({ payrollId: 10, periodId: 5, book: "Operaciones varias" });
    const lines = data.entryDetails.create;
    const t = totals(lines);
    expect(t.debit).toBe(2180);
    expect(t.credit).toBe(2180);
    expect(lines).toContainEqual(expect.objectContaining({ accountId: 1, debit: 2000 })); // 621
    expect(lines).toContainEqual(expect.objectContaining({ accountId: 2, debit: 180 })); // 627
    expect(lines).toContainEqual(expect.objectContaining({ accountId: 4, credit: 260 })); // ONP
    expect(lines).toContainEqual(expect.objectContaining({ accountId: 6, credit: 300 })); // anticipos
    expect(lines).toContainEqual(expect.objectContaining({ accountId: 7, credit: 1440 })); // neto
  });

  it("con AFP acredita la cuenta de la AFP y omite las líneas en cero", async () => {
    const { tx, created } = fakeTx();
    await postPayrollJournalEntry(tx, {
      ...base,
      grossPay: 1230,
      pensionSystem: "AFP",
      pensionAmount: 158.92,
      advances: 0,
      netPay: 1071.08,
      employerContribution: 110.7,
    });
    const lines = (created[0].data as { entryDetails: { create: Line[] } }).entryDetails.create;
    expect(lines.some((l) => l.accountId === 5 && l.credit === 158.92)).toBe(true);
    expect(lines.some((l) => l.accountId === 6)).toBe(false);
    expect(totals(lines).debit).toBe(totals(lines).credit);
  });

  it("sin aporte de pensión ni del empleador (practicante sin EsSalud) sigue cuadrando", async () => {
    const { tx, created } = fakeTx();
    await postPayrollJournalEntry(tx, {
      ...base,
      grossPay: 1000,
      pensionSystem: "None",
      pensionAmount: 0,
      advances: 0,
      netPay: 1000,
      employerContribution: 0,
    });
    const lines = (created[0].data as { entryDetails: { create: Line[] } }).entryDetails.create;
    expect(lines).toHaveLength(2);
    expect(totals(lines)).toEqual({ debit: 1000, credit: 1000 });
  });

  it("no registra nada en un periodo contable cerrado", async () => {
    const { tx, created } = fakeTx("CLOSED");
    await expect(
      postPayrollJournalEntry(tx, {
        ...base,
        grossPay: 2000,
        pensionSystem: "ONP",
        pensionAmount: 260,
        advances: 0,
        netPay: 1740,
        employerContribution: 180,
      }),
    ).rejects.toBeInstanceOf(ClosedPeriodError);
    expect(created).toHaveLength(0);
  });

  it("rechaza un asiento que no cuadra", async () => {
    const { tx } = fakeTx();
    await expect(
      postPayrollJournalEntry(tx, {
        ...base,
        grossPay: 2000,
        pensionSystem: "ONP",
        pensionAmount: 260,
        advances: 0,
        netPay: 1000, // debería ser 1740
        employerContribution: 180,
      }),
    ).rejects.toThrow(/no cuadra/);
  });
});

describe("postPayrollPaymentJournalEntry", () => {
  it("el efectivo sale de caja y cancela Remuneraciones por pagar", async () => {
    const { tx, created } = fakeTx();
    await postPayrollPaymentJournalEntry(tx, { ...base, amount: 1740, method: "Efectivo" });
    const data = created[0].data as { book: string; entryDetails: { create: Line[] } };
    expect(data.book).toBe("Caja y bancos");
    expect(data.entryDetails.create).toEqual([
      expect.objectContaining({ accountId: 7, debit: 1740, credit: 0 }),
      expect.objectContaining({ accountId: 8, debit: 0, credit: 1740 }),
    ]);
  });

  it("una transferencia sale de bancos", async () => {
    const { tx, created } = fakeTx();
    await postPayrollPaymentJournalEntry(tx, { ...base, amount: 1740, method: "Transferencia bancaria" });
    const lines = (created[0].data as { entryDetails: { create: Line[] } }).entryDetails.create;
    expect(lines[1]).toMatchObject({ accountId: 9, credit: 1740 });
  });
});
