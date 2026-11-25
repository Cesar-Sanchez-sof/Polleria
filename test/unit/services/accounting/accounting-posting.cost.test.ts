import { describe, expect, it, vi } from "vitest";
import { buildSaleCostLines, type SaleCostItem } from "@/lib/services/accounting/accounting-posting.service";

function item(overrides: Partial<Omit<SaleCostItem, "product">> & { product?: Partial<SaleCostItem["product"]> } = {}): SaleCostItem {
  const { product, ...rest } = overrides;
  return {
    quantity: 1,
    recordedUnitCost: null,
    ...rest,
    product: { type: "FinishedProduct", averageCost: 0, recipe: [], ...product },
  };
}

describe("buildSaleCostLines", () => {
  it("usa el costo anotado al vender, no un porcentaje de la venta", () => {
    const lines = buildSaleCostLines([item({ quantity: 3, recordedUnitCost: 2.5, product: { averageCost: 9 } })]);
    expect(lines).toEqual([{ accountCode: "201", amount: 7.5 }]);
  });

  it("si no hay costo anotado usa el costo promedio del producto", () => {
    expect(buildSaleCostLines([item({ quantity: 2, product: { averageCost: 4 } })])).toEqual([
      { accountCode: "201", amount: 8 },
    ]);
  });

  it("si tampoco hay promedio usa el costo de la receta", () => {
    const lines = buildSaleCostLines([
      item({
        quantity: 2,
        product: { recipe: [{ quantityRequired: 0.5, unitCost: 10 }, { quantityRequired: 1, unitCost: 1 }] },
      }),
    ]);
    expect(lines).toEqual([{ accountCode: "211", amount: 12 }]);
  });

  it("separa por cuenta de inventario en un orden fijo", () => {
    const lines = buildSaleCostLines([
      item({ recordedUnitCost: 1, product: { type: "RawMaterial" } }),
      item({ recordedUnitCost: 2, product: { recipe: [{ quantityRequired: 1, unitCost: 1 }] } }),
      item({ recordedUnitCost: 3 }),
    ]);
    expect(lines).toEqual([
      { accountCode: "201", amount: 3 },
      { accountCode: "211", amount: 2 },
      { accountCode: "241", amount: 1 },
    ]);
  });

  it("un producto sin costo conocido no genera asiento", () => {
    expect(buildSaleCostLines([item({ quantity: 5 })])).toEqual([]);
  });
});

describe("periodo cerrado", () => {
  it("un asiento automático no entra en un periodo cerrado", async () => {
    const { postSaleJournalEntries } = await import("@/lib/services/accounting/accounting-posting.service");
    const { ClosedPeriodError } = await import("@/lib/accounting/closing");
    const create = vi.fn();
    const tx = {
      accountingAccount: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn().mockResolvedValue({ id: 1, code: "x" }) },
      accountingPeriod: { findFirst: vi.fn().mockResolvedValue({ id: 3, status: "CLOSED" }) },
      journalEntry: { create, findMany: vi.fn().mockResolvedValue([]) },
    } as never;

    await expect(
      postSaleJournalEntries(tx, {
        salesInvoiceId: 1,
        voucherCode: "B001-000001",
        subtotal: 100,
        igv: 18,
        total: 118,
        paymentMethodName: "Efectivo",
      }),
    ).rejects.toBeInstanceOf(ClosedPeriodError);
    expect(create).not.toHaveBeenCalled();
  });
});
