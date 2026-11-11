import { describe, it, expect } from "vitest";
import {
  calculateDeltaPercentage,
  calculateWaterfallData,
  calculateParetoData,
  calculateMatrixPivot,
} from "@/lib/dashboards/client-calculations";
import { resolvePreviousRange, resolveDateRange } from "@/lib/dashboards/date-utils";
import {
  visualTypeSchema,
  widgetConfigSchema,
  createDefaultWidgetConfig,
  type VisualType,
} from "@/lib/dashboards/widget-schema";
import {
  VISUAL_REGISTRY,
  getVisualRegistryEntry,
  migrateWidgetConfigByRole,
} from "@/lib/dashboards/visual-registry";

describe("UI Parte C2: Cálculos de Cliente", () => {
  describe("1. Cascada (Waterfall)", () => {
    it("calcula bases flotantes para valores positivos y negativos, y total final", () => {
      const rows = [
        { concepto: "Ventas Iniciales", monto: 100 },
        { concepto: "Costos Fijos", monto: -30 },
        { concepto: "Ventas Adicionales", monto: 50 },
        { concepto: "Descuentos", monto: -20 },
      ];

      const waterfall = calculateWaterfallData(rows, "concepto", "monto", "Total Final");

      expect(waterfall.length).toBe(5); // 4 pasos + 1 total

      // Paso 1: +100
      expect(waterfall[0]).toEqual({
        category: "Ventas Iniciales",
        value: 100,
        base: 0,
        displayValue: 100,
        type: "positive",
      });

      // Paso 2: -30 (acumulado previo 100 -> nuevo acumulado 70, base flotante 70)
      expect(waterfall[1]).toEqual({
        category: "Costos Fijos",
        value: 30,
        base: 70,
        displayValue: -30,
        type: "negative",
      });

      // Paso 3: +50 (acumulado previo 70 -> base flotante 70, nuevo acumulado 120)
      expect(waterfall[2]).toEqual({
        category: "Ventas Adicionales",
        value: 50,
        base: 70,
        displayValue: 50,
        type: "positive",
      });

      // Paso 4: -20 (acumulado previo 120 -> nuevo acumulado 100, base flotante 100)
      expect(waterfall[3]).toEqual({
        category: "Descuentos",
        value: 20,
        base: 100,
        displayValue: -20,
        type: "negative",
      });

      // Paso 5: Total final (100)
      expect(waterfall[4]).toEqual({
        category: "Total Final",
        value: 100,
        base: 0,
        displayValue: 100,
        isTotal: true,
        type: "total",
      });
    });
  });

  describe("2. Diagrama de Pareto", () => {
    it("fuerza orden descendente y calcula porcentajes acumulados de 0% a 100%", () => {
      // Datos no ordenados
      const rows = [
        { plato: "Chaufa de Pollo", cantidad: 30 },
        { plato: "1/4 Pollo a la Brasa", cantidad: 50 },
        { plato: "Porción de Papas", cantidad: 5 },
        { plato: "Mostrito Clásico", cantidad: 15 },
      ];

      const pareto = calculateParetoData(rows, "plato", "cantidad");

      expect(pareto.length).toBe(4);

      // Total = 50 + 30 + 15 + 5 = 100
      expect(pareto[0].category).toBe("1/4 Pollo a la Brasa");
      expect(pareto[0].value).toBe(50);
      expect(pareto[0].cumulativeValue).toBe(50);
      expect(pareto[0].cumulativePercentage).toBe(50.0);

      expect(pareto[1].category).toBe("Chaufa de Pollo");
      expect(pareto[1].value).toBe(30);
      expect(pareto[1].cumulativeValue).toBe(80);
      expect(pareto[1].cumulativePercentage).toBe(80.0);

      expect(pareto[2].category).toBe("Mostrito Clásico");
      expect(pareto[2].value).toBe(15);
      expect(pareto[2].cumulativeValue).toBe(95);
      expect(pareto[2].cumulativePercentage).toBe(95.0);

      expect(pareto[3].category).toBe("Porción de Papas");
      expect(pareto[3].value).toBe(5);
      expect(pareto[3].cumulativeValue).toBe(100);
      expect(pareto[3].cumulativePercentage).toBe(100.0);
    });
  });

  describe("3. Pivotaje de Matriz Dinámica", () => {
    it("realiza pivot con totales de fila, columna y gran total", () => {
      const rows = [
        { mozo: "Juan", canal: "Salon", total: 100 },
        { mozo: "Juan", canal: "Delivery", total: 40 },
        { mozo: "Maria", canal: "Salon", total: 80 },
        { mozo: "Maria", canal: "Delivery", total: 60 },
      ];

      const pivot = calculateMatrixPivot(rows, "mozo", "canal", ["total"]);

      expect(pivot.exceeded).toBe(false);
      expect(pivot.rowKeys).toEqual(["Juan", "Maria"]);
      expect(pivot.colKeys).toEqual(["Delivery", "Salon"]);

      // Celdas
      expect(pivot.grid["Juan"]["Salon"]["total"]).toBe(100);
      expect(pivot.grid["Juan"]["Delivery"]["total"]).toBe(40);
      expect(pivot.grid["Maria"]["Salon"]["total"]).toBe(80);
      expect(pivot.grid["Maria"]["Delivery"]["total"]).toBe(60);

      // Totales de fila
      expect(pivot.rowTotals["Juan"]["total"]).toBe(140);
      expect(pivot.rowTotals["Maria"]["total"]).toBe(140);

      // Totales de columna
      expect(pivot.colTotals["Salon"]["total"]).toBe(180);
      expect(pivot.colTotals["Delivery"]["total"]).toBe(100);

      // Gran total
      expect(pivot.grandTotals["total"]).toBe(280);
    });

    it("activa exceeded si supera el tope de 500 celdas y trunca la cuadrícula", () => {
      // 30 filas x 20 columnas = 600 celdas (> 500)
      const bigRows: Record<string, unknown>[] = [];
      for (let r = 0; r < 30; r++) {
        for (let c = 0; c < 20; c++) {
          bigRows.push({ fila: `Fila ${r}`, col: `Col ${c}`, val: 1 });
        }
      }

      const pivot = calculateMatrixPivot(bigRows, "fila", "col", ["val"]);
      expect(pivot.exceeded).toBe(true);
      expect(pivot.totalCells).toBe(600);
      expect(pivot.displayedRowCount * pivot.displayedColCount).toBeLessThanOrEqual(500);
    });
  });

  describe("4. Delta % en KPI con Tendencia (kpiTrend)", () => {
    it("calcula delta positivo (up) y formateo correcto", () => {
      const res = calculateDeltaPercentage(115, 100);
      expect(res.direction).toBe("up");
      expect(res.percent).toBe(15.0);
      expect(res.formatted).toBe("+15.0%");
    });

    it("calcula delta negativo (down) y formateo correcto", () => {
      const res = calculateDeltaPercentage(80, 100);
      expect(res.direction).toBe("down");
      expect(res.percent).toBe(-20.0);
      expect(res.formatted).toBe("-20.0%");
    });

    it("calcula delta cero (flat)", () => {
      const res = calculateDeltaPercentage(100, 100);
      expect(res.direction).toBe("flat");
      expect(res.percent).toBe(0);
      expect(res.formatted).toBe("0.0%");
    });

    it("devuelve '—' y direction 'none' si el valor anterior es 0 o no numérico", () => {
      const resZero = calculateDeltaPercentage(100, 0);
      expect(resZero.formatted).toBe("—");
      expect(resZero.direction).toBe("none");
      expect(resZero.percent).toBeNull();

      const resNaN = calculateDeltaPercentage(100, NaN);
      expect(resNaN.formatted).toBe("—");
      expect(resNaN.direction).toBe("none");
    });
  });

  describe("5. resolvePreviousRange (Período anterior con mismo largo en Lima)", () => {
    // Reloj fijo en 03:00:00Z del 1 de diciembre = 22:00:00 del 30 de noviembre en Lima (UTC-5)
    const fixedNow = new Date("2026-12-01T03:00:00Z");

    it("today: período actual 2026-11-30 -> previo 2026-11-29 (1 día)", () => {
      const current = resolveDateRange({ field: "fecha", preset: "today" }, fixedNow);
      expect(current).toEqual(["2026-11-30", "2026-11-30"]);

      const prev = resolvePreviousRange({ field: "fecha", preset: "today" }, fixedNow);
      expect(prev).toEqual(["2026-11-29", "2026-11-29"]);
    });

    it("last7: período actual 24-nov al 30-nov (7 días) -> previo 17-nov al 23-nov (7 días)", () => {
      const current = resolveDateRange({ field: "fecha", preset: "last7" }, fixedNow);
      expect(current).toEqual(["2026-11-24", "2026-11-30"]);

      const prev = resolvePreviousRange({ field: "fecha", preset: "last7" }, fixedNow);
      expect(prev).toEqual(["2026-11-17", "2026-11-23"]);
    });

    it("thisMonth: mes hasta hoy (1-30 nov) vs mismo tramo mes anterior (1-30 oct con clamp)", () => {
      const current = resolveDateRange({ field: "fecha", preset: "thisMonth" }, fixedNow);
      expect(current).toEqual(["2026-11-01", "2026-11-30"]);

      const prev = resolvePreviousRange({ field: "fecha", preset: "thisMonth" }, fixedNow);
      expect(prev).toEqual(["2026-10-01", "2026-10-30"]);
    });

    it("custom: rango 2026-05-10 al 2026-05-15 (6 días) -> previo 2026-05-04 al 2026-05-09 (6 días)", () => {
      const customRange = {
        field: "fecha",
        preset: "custom" as const,
        from: "2026-05-10",
        to: "2026-05-15",
      };
      const prev = resolvePreviousRange(customRange, fixedNow);
      expect(prev).toEqual(["2026-05-04", "2026-05-09"]);
    });
  });

  describe("6. Registro y Esquemas de los 7 Nuevos Tipos C2", () => {
    const c2Types: VisualType[] = [
      "kpiTrend",
      "multiCard",
      "scatter",
      "waterfall",
      "pareto",
      "heatmap",
      "matrix",
    ];

    it("todos los 26 tipos están en el enum zod visualTypeSchema", () => {
      expect(visualTypeSchema.options.length).toBe(26);
      for (const t of c2Types) {
        expect(visualTypeSchema.options).toContain(t);
      }
    });

    it.each(c2Types)("el tipo %s está registrado con pozos válidos y pasa Zod", (vType) => {
      const entry = VISUAL_REGISTRY[vType];
      expect(entry, `VISUAL_REGISTRY debe contener ${vType}`).toBeDefined();
      expect(entry.id).toBe(vType);
      expect(entry.wells.length).toBeGreaterThan(0);
      expect(entry.defaultSize.w).toBeGreaterThan(0);
      expect(entry.defaultSize.h).toBeGreaterThan(0);

      const base = createDefaultWidgetConfig("column", `Test ${vType}`, "ventas");
      const migrated = migrateWidgetConfigByRole(base, vType);
      const parsed = widgetConfigSchema.safeParse(migrated);
      expect(parsed.success, `Zod debe validar config de ${vType}`).toBe(true);
      if (parsed.success) {
        expect(parsed.data.visualType).toBe(vType);
      }
    });

    it("scatter registra pozos de x, y, size y migra series adecuadamente", () => {
      const base = createDefaultWidgetConfig("column", "Correlación Ventas", "ventas");
      base.data.values = [
        { field: "total", agg: "sum" },
        { field: "cantidad", agg: "sum" },
        { field: "margen", agg: "avg" },
      ];

      const scatter = migrateWidgetConfigByRole(base, "scatter");
      expect(scatter.visualType).toBe("scatter");
      expect(scatter.data.values[0]?.series).toBe("x");
      expect(scatter.data.values[1]?.series).toBe("y");
      expect(scatter.data.values[2]?.series).toBe("size");
    });

    it("heatmap y widgetDataConfigSchema soportan legendGranularity y compare", () => {
      const config = createDefaultWidgetConfig("heatmap", "Pedidos por Hora y Día", "pedidos");
      config.data.axis = "fechaHora";
      config.data.granularity = "hourOfDay";
      config.data.legend = "fechaHora";
      config.data.legendGranularity = "weekday";
      config.data.compare = "previousPeriod";

      const parsed = widgetConfigSchema.safeParse(config);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.data.legendGranularity).toBe("weekday");
        expect(parsed.data.data.compare).toBe("previousPeriod");
      }
    });
  });
});
