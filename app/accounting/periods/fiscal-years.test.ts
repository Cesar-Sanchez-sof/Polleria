import { describe, expect, it } from "vitest";
import {
  availableFiscalYears,
  currentFiscalYear,
  filterByFiscalYear,
  fiscalYearOf,
  formatDate,
  groupByFiscalYear,
  statusLabel,
  type AccountingPeriod,
} from "./fiscal-years";

function period(
  id: number,
  startDate: string,
  endDate: string,
  status: string
): AccountingPeriod {
  return { id, startDate, endDate, status };
}

const periodos: AccountingPeriod[] = [
  period(1, "2025-12-01T00:00:00.000Z", "2025-12-31T23:59:59.999Z", "CLOSED"),
  period(2, "2026-02-01T00:00:00.000Z", "2026-02-28T23:59:59.999Z", "OPEN"),
  period(3, "2026-01-01T00:00:00.000Z", "2026-01-31T23:59:59.999Z", "OPEN"),
  period(4, "2025-01-01T00:00:00.000Z", "2025-01-31T23:59:59.999Z", "CLOSED"),
];

describe("año fiscal", () => {
  it("deriva el año fiscal del startDate en UTC", () => {
    expect(fiscalYearOf("2026-01-01T00:00:00.000Z")).toBe(2026);
    expect(fiscalYearOf("2025-12-31T23:59:59.999Z")).toBe(2025);
  });

  it("devuelve NaN para fechas inválidas", () => {
    expect(Number.isNaN(fiscalYearOf("no-es-fecha"))).toBe(true);
  });

  it("usa el año en curso por defecto", () => {
    expect(currentFiscalYear(new Date("2026-10-14T12:00:00.000Z"))).toBe(2026);
  });
});

describe("groupByFiscalYear", () => {
  it("agrupa los períodos por año y ordena años de mayor a menor", () => {
    const grupos = groupByFiscalYear(periodos);

    expect(grupos.map((g) => g.year)).toEqual([2026, 2025]);
    expect(grupos[0].periods.map((p) => p.id)).toEqual([3, 2]);
    expect(grupos[1].periods.map((p) => p.id)).toEqual([4, 1]);
  });

  it("cuenta los períodos abiertos y cerrados de cada año", () => {
    const grupos = groupByFiscalYear(periodos);

    expect(grupos[0]).toMatchObject({ open: 2, closed: 0 });
    expect(grupos[1]).toMatchObject({ open: 0, closed: 2 });
  });

  it("devuelve una lista vacía sin períodos", () => {
    expect(groupByFiscalYear([])).toEqual([]);
  });

  it("descarta períodos con fecha inválida", () => {
    const grupos = groupByFiscalYear([period(9, "mala-fecha", "2026-01-31T23:59:59.999Z", "OPEN")]);

    expect(grupos).toEqual([]);
  });

  it("no muta la lista recibida", () => {
    const copia = [...periodos];
    groupByFiscalYear(periodos);
    expect(periodos).toEqual(copia);
  });
});

describe("filterByFiscalYear", () => {
  it("filtra por el año fiscal indicado", () => {
    expect(filterByFiscalYear(periodos, 2025).map((p) => p.id)).toEqual([1, 4]);
  });

  it("devuelve todo el listado cuando no se indica año", () => {
    expect(filterByFiscalYear(periodos, null)).toHaveLength(4);
    expect(filterByFiscalYear(periodos, NaN)).toHaveLength(4);
  });

  it("devuelve una lista vacía para un año sin períodos", () => {
    expect(filterByFiscalYear(periodos, 2024)).toEqual([]);
  });
});

describe("availableFiscalYears", () => {
  it("incluye los años de los períodos y el año en curso", () => {
    const anios = availableFiscalYears(periodos, new Date("2026-10-14T12:00:00.000Z"));

    expect(anios).toEqual([2026, 2025]);
  });

  it("agrega el año en curso aunque no tenga períodos", () => {
    const anios = availableFiscalYears([], new Date("2030-05-01T12:00:00.000Z"));

    expect(anios).toEqual([2030]);
  });
});

describe("etiquetas y formato", () => {
  it("traduce los estados del período", () => {
    expect(statusLabel("OPEN")).toBe("Abierto");
    expect(statusLabel("CLOSED")).toBe("Cerrado");
    expect(statusLabel("OTRO")).toBe("OTRO");
  });

  it("formatea la fecha usando UTC para no desplazar el día", () => {
    expect(formatDate("2026-01-01T00:00:00.000Z")).toBe("01/01/2026");
  });
});
