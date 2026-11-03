import { describe, expect, it } from "vitest";
import { buildClosingLines, findEntryIssues, isYearEndPeriod } from "./closing";

describe("isYearEndPeriod", () => {
  it("solo diciembre cierra el ejercicio", () => {
    expect(isYearEndPeriod(new Date("2026-12-31T23:59:59Z"))).toBe(true);
    expect(isYearEndPeriod(new Date("2026-11-30T23:59:59Z"))).toBe(false);
  });
});

describe("findEntryIssues", () => {
  it("no reporta nada cuando todo cuadra", () => {
    expect(findEntryIssues([{ code: "A", debit: 100, credit: 100 }])).toEqual([]);
  });

  it("reporta asientos descuadrados y vacíos", () => {
    const issues = findEntryIssues([{ code: "MISC/1", debit: 100, credit: 99.5 }], ["MISC/2"]);
    expect(issues).toHaveLength(2);
    expect(issues[0]).toContain("MISC/1");
    expect(issues[1]).toContain("MISC/2");
  });

  it("tolera diferencias menores a un céntimo", () => {
    expect(findEntryIssues([{ code: "A", debit: 10.004, credit: 10 }])).toEqual([]);
  });

  it("acorta la lista de códigos cuando son muchos", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ code: `E${i}`, debit: 2, credit: 1 }));
    expect(findEntryIssues(many)[0]).toContain("y 2 más");
  });
});

describe("buildClosingLines", () => {
  const RETAINED = 59;

  it("cierra ingresos y gastos y deja la utilidad en resultados acumulados", () => {
    const closing = buildClosingLines(
      [
        { accountId: 1, type: "Ingreso", debit: 0, credit: 1000 },
        { accountId: 2, type: "Costo", debit: 400, credit: 0 },
        { accountId: 3, type: "Gasto", debit: 150, credit: 0 },
        { accountId: 9, type: "Activo", debit: 500, credit: 0 },
      ],
      RETAINED,
    )!;

    expect(closing.result).toBe(450);
    expect(closing.lines.map((l) => l.accountId)).toEqual([1, 2, 3, RETAINED]);
    expect(closing.lines.find((l) => l.accountId === RETAINED)).toMatchObject({ credit: 450, debit: 0 });
    const debit = closing.lines.reduce((s, l) => s + l.debit, 0);
    const credit = closing.lines.reduce((s, l) => s + l.credit, 0);
    expect(debit).toBe(credit);
  });

  it("registra la pérdida al debe de resultados acumulados", () => {
    const closing = buildClosingLines(
      [
        { accountId: 1, type: "Ingreso", debit: 0, credit: 100 },
        { accountId: 2, type: "Gasto", debit: 250, credit: 0 },
      ],
      RETAINED,
    )!;

    expect(closing.result).toBe(-150);
    expect(closing.lines.find((l) => l.accountId === RETAINED)).toMatchObject({ debit: 150, credit: 0 });
  });

  it("devuelve null si no hay saldos de resultados", () => {
    expect(buildClosingLines([{ accountId: 9, type: "Activo", debit: 10, credit: 0 }], RETAINED)).toBeNull();
    expect(buildClosingLines([{ accountId: 1, type: "Ingreso", debit: 5, credit: 5 }], RETAINED)).toBeNull();
  });
});
