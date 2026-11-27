import { describe, it, expect } from "vitest";
import { sortDimensionKeys, calculateMatrixPivot } from "@/lib/dashboards/client-calculations";

describe("Ronda D1 - Item 4: Orden de Columnas en Heatmap y Matrix", () => {
  it("ordena días de la semana (weekday) estrictamente de Lunes a Domingo, nunca por orden de aparición", () => {
    const randomWeekdays = ["Viernes", "Domingo", "Lunes", "Miércoles", "Martes", "Sábado", "Jueves"];
    const sorted = sortDimensionKeys(randomWeekdays);
    expect(sorted).toEqual([
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ]);
  });

  it("ordena horas del día (hourOfDay) de 00:00 a 23:00 en orden numérico", () => {
    const randomHours = ["23:00", "04:00", "00:00", "12:00", "19:00", "01:00"];
    const sorted = sortDimensionKeys(randomHours);
    expect(sorted).toEqual(["00:00", "01:00", "04:00", "12:00", "19:00", "23:00"]);
  });

  it("ordena fechas en estricto orden cronológico ascendente (YYYY-MM-DD)", () => {
    const randomDates = ["2026-11-15", "2026-11-01", "2026-11-30", "2026-11-10", "2026-11-05"];
    const sorted = sortDimensionKeys(randomDates);
    expect(sorted).toEqual([
      "2026-11-01",
      "2026-11-05",
      "2026-11-10",
      "2026-11-15",
      "2026-11-30",
    ]);
  });

  it("calculateMatrixPivot ordena colKeys por weekday y rowKeys por hourOfDay", () => {
    const fixtureRows = [
      { hora: "21:00", dia: "Viernes", pedidos: 15 },
      { hora: "12:00", dia: "Lunes", pedidos: 10 },
      { hora: "19:00", dia: "Sábado", pedidos: 25 },
      { hora: "12:00", dia: "Domingo", pedidos: 8 },
      { hora: "01:00", dia: "Martes", pedidos: 2 },
    ];

    const pivot = calculateMatrixPivot(fixtureRows, "hora", "dia", ["pedidos"]);

    // Filas deben estar ordenadas 01:00 -> 12:00 -> 19:00 -> 21:00
    expect(pivot.rowKeys).toEqual(["01:00", "12:00", "19:00", "21:00"]);

    // Columnas deben estar ordenadas Lunes -> Martes -> Viernes -> Sábado -> Domingo
    expect(pivot.colKeys).toEqual(["Lunes", "Martes", "Viernes", "Sábado", "Domingo"]);
  });
});
