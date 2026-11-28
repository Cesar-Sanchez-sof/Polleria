import { describe, it, expect, beforeEach } from "vitest";
import {
  widgetConfigSchema,
  createDefaultWidgetConfig,
  type WidgetConfig,
} from "@/lib/dashboards/widget-schema";
import {
  evaluateConditionalColor,
  calculateBarCategoryGap,
  calculateDonutAngles,
  calculateFillOpacity,
  calculateYAxisDomain,
} from "@/lib/dashboards/format-utils";
import {
  getVisualRegistryEntry,
} from "@/lib/dashboards/visual-registry";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";

describe("E2: Formato Avanzado y Corrección de Modo Vista Previa (Lectura)", () => {
  beforeEach(() => {
    useDashboardEditorStore.getState().resetStore();
  });

  describe("1. Corrección Modo Lectura / Preview Mode", () => {
    it("inicia con isPreviewMode en false y permite alternar a true sin perder widgets", () => {
      const store = useDashboardEditorStore.getState();
      expect(store.isPreviewMode).toBe(false);

      const id = store.addWidget({ title: "Visual de Prueba" });
      expect(useDashboardEditorStore.getState().widgets.length).toBe(1);

      // Activar vista previa
      useDashboardEditorStore.getState().togglePreviewMode();
      expect(useDashboardEditorStore.getState().isPreviewMode).toBe(true);
      expect(useDashboardEditorStore.getState().widgets.length).toBe(1);
      expect(useDashboardEditorStore.getState().widgets[0].id).toBe(id);

      // Desactivar vista previa (volver a edición)
      useDashboardEditorStore.getState().togglePreviewMode();
      expect(useDashboardEditorStore.getState().isPreviewMode).toBe(false);
      expect(useDashboardEditorStore.getState().widgets.length).toBe(1);
    });
  });

  describe("2. Retrocompatibilidad del Esquema Zod (widgetFormatConfigSchema)", () => {
    it("un config guardado ANTIGUO (sin chartSpecific, referenceLine ni conditionalColors) sigue parseando correctamente", () => {
      const legacyConfig = {
        visualType: "column" as const,
        data: {
          dataset: "ventas",
          values: [{ field: "total", agg: "sum" as const }],
        },
        format: {
          title: { show: true, text: "Ventas Totales", fontSize: 14, color: "#1e293b", align: "left" },
          colors: { palette: "polleria", series: ["#b91c1c", "#f97316"] },
          dataLabels: { show: false, color: "#64748b", fontSize: 11 },
          legend: { show: true, position: "top" as const },
          axes: {
            xTitle: "Mes",
            yTitle: "Soles",
            secondaryYTitle: "",
            showSecondaryY: false,
            showGrid: true, // showGrid no renombrado
          },
          background: { color: "#ffffff" },
          border: { show: true, color: "#e2e8f0", radius: 12, width: 1 },
          numberFormat: { decimals: 2, prefix: "S/ ", compact: false },
          gauge: { min: 0 },
        },
      };

      const result = widgetConfigSchema.safeParse(legacyConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.format.axes.showGrid).toBe(true);
        expect(result.data.format.chartSpecific).toBeDefined();
        expect(result.data.format.referenceLine?.show).toBe(false);
        expect(result.data.format.conditionalColors).toEqual([]);
      }
    });

    it("valida y acepta configs con todos los campos nuevos de Formato Avanzado E2", () => {
      const advancedConfig: WidgetConfig = {
        visualType: "bar",
        data: {
          dataset: "ventas",
          values: [{ field: "total", agg: "sum" }],
        },
        format: {
          ...createDefaultWidgetConfig("bar").format,
          chartSpecific: {
            bar: { borderRadius: 8, barWidth: 80 },
            lineArea: { strokeWidth: 4, curveType: "linear", showDots: false, fillOpacity: 50 },
            donut: { innerRadius: 75, startAngle: 180 },
          },
          axes: {
            xTitle: "Categoría",
            yTitle: "Monto",
            secondaryYTitle: "",
            showSecondaryY: false,
            showGrid: true,
            showGridX: true,
            showGridY: true,
            yAxisMin: 100,
            yAxisMax: 5000,
            labelRotation: 45,
          },
          dataLabels: {
            show: true,
            position: "center",
            color: "#ffffff",
            fontSize: 12,
          },
          referenceLine: {
            show: true,
            value: 2500,
            label: "Meta Q1",
            color: "#10b981",
          },
          conditionalColors: [
            { condition: "greaterThan", threshold: 4000, color: "#10b981" },
            { condition: "between", threshold: 2000, threshold2: 4000, color: "#f59e0b" },
            { condition: "lessThan", threshold: 2000, color: "#ef4444" },
          ],
        },
      };

      const result = widgetConfigSchema.safeParse(advancedConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.format.chartSpecific?.bar?.barWidth).toBe(80);
        expect(result.data.format.axes.labelRotation).toBe(45);
        expect(result.data.format.referenceLine?.value).toBe(2500);
        expect(result.data.format.conditionalColors?.length).toBe(3);
      }
    });
  });

  describe("3. Función pura evaluateConditionalColor (la primera que cumpla gana)", () => {
    const rules = [
      { condition: "greaterThan" as const, threshold: 500, color: "#emerald" },
      { condition: "between" as const, threshold: 100, threshold2: 500, color: "#amber" },
      { condition: "lessThan" as const, threshold: 100, color: "#rose" },
    ];

    it("evalúa greaterThan correctamente", () => {
      const color = evaluateConditionalColor(600, rules, "#default");
      expect(color).toBe("#emerald");
    });

    it("evalúa between correctamente respetando ambos límites", () => {
      const color1 = evaluateConditionalColor(300, rules, "#default");
      expect(color1).toBe("#amber");

      const colorBorder = evaluateConditionalColor(100, rules, "#default");
      expect(colorBorder).toBe("#amber");
    });

    it("evalúa lessThan correctamente", () => {
      const color = evaluateConditionalColor(50, rules, "#default");
      expect(color).toBe("#rose");
    });

    it("la primera regla que cumpla gana la evaluación prioritaria", () => {
      const overlappingRules = [
        { condition: "greaterThan" as const, threshold: 100, color: "#first" },
        { condition: "greaterThan" as const, threshold: 200, color: "#second" },
      ];
      // 300 cumple ambas, pero #first está antes
      expect(evaluateConditionalColor(300, overlappingRules, "#default")).toBe("#first");
    });

    it("retorna defaultColor si no hay reglas o ninguna coincide", () => {
      expect(evaluateConditionalColor(50, [], "#default")).toBe("#default");
      expect(evaluateConditionalColor(null, rules, "#default")).toBe("#default");
      expect(evaluateConditionalColor(undefined, rules, "#default")).toBe("#default");
    });
  });

  describe("4. Helpers de conversión numérica y geométrica", () => {
    it("calculateBarCategoryGap: aproxima barWidth como (100 - barWidth)%", () => {
      expect(calculateBarCategoryGap(70)).toBe("30%");
      expect(calculateBarCategoryGap(100)).toBe("0%");
      expect(calculateBarCategoryGap(20)).toBe("80%");
      // Clamping entre 10 y 100
      expect(calculateBarCategoryGap(5)).toBe("90%");
      expect(calculateBarCategoryGap(120)).toBe("0%");
    });

    it("calculateDonutAngles: ajusta endAngle = startAngle - 360", () => {
      const a90 = calculateDonutAngles(90);
      expect(a90.startAngle).toBe(90);
      expect(a90.endAngle).toBe(-270);

      const a180 = calculateDonutAngles(180);
      expect(a180.startAngle).toBe(180);
      expect(a180.endAngle).toBe(-180);

      const a0 = calculateDonutAngles(0);
      expect(a0.startAngle).toBe(0);
      expect(a0.endAngle).toBe(-360);
    });

    it("calculateFillOpacity: convierte porcentaje 0-100 a decimal 0-1", () => {
      expect(calculateFillOpacity(20)).toBe(0.2);
      expect(calculateFillOpacity(100)).toBe(1);
      expect(calculateFillOpacity(0)).toBe(0);
      expect(calculateFillOpacity(50)).toBe(0.5);
    });

    it("calculateYAxisDomain: valida min < max y devuelve tupla correcta", () => {
      expect(calculateYAxisDomain(10, 100)).toEqual([10, 100]);
      // Si min >= max, fallback a auto
      expect(calculateYAxisDomain(100, 10)).toEqual(["auto", "auto"]);
      expect(calculateYAxisDomain(50, 50)).toEqual(["auto", "auto"]);
      expect(calculateYAxisDomain(10, undefined)).toEqual([10, "auto"]);
      expect(calculateYAxisDomain(undefined, 200)).toEqual(["auto", 200]);
      expect(calculateYAxisDomain(undefined, undefined)).toBeUndefined();
    });
  });

  describe("5. Capacidades del Registro por Tipo de Gráfico (formatCaps)", () => {
    it("column y bar tienen chartSpecific 'bar', referenceLine y conditionalColors activos", () => {
      const colEntry = getVisualRegistryEntry("column");
      expect(colEntry.formatCaps.chartSpecific).toBe("bar");
      expect(colEntry.formatCaps.referenceLine).toBe(true);
      expect(colEntry.formatCaps.conditionalColors).toBe(true);
      expect(colEntry.formatCaps.dataLabelPositions).toEqual(["top", "center", "bottom"]);

      const barEntry = getVisualRegistryEntry("bar");
      expect(barEntry.formatCaps.chartSpecific).toBe("bar");
      expect(barEntry.formatCaps.referenceLine).toBe(true);
      expect(barEntry.formatCaps.conditionalColors).toBe(true);
      expect(barEntry.formatCaps.dataLabelPositions).toEqual(["top", "center", "bottom"]);
    });

    it("percentColumn y percentBar NO tienen referenceLine ni yAxisRange", () => {
      const pCol = getVisualRegistryEntry("percentColumn");
      expect(pCol.formatCaps.referenceLine).toBe(false);
      expect(pCol.formatCaps.yAxisRange).toBe(false);
      expect(pCol.formatCaps.conditionalColors).toBe(false);

      const pBar = getVisualRegistryEntry("percentBar");
      expect(pBar.formatCaps.referenceLine).toBe(false);
      expect(pBar.formatCaps.yAxisRange).toBe(false);
    });

    it("line y area tienen chartSpecific 'lineArea', referenceLine true y conditionalColors false", () => {
      const lineEntry = getVisualRegistryEntry("line");
      expect(lineEntry.formatCaps.chartSpecific).toBe("lineArea");
      expect(lineEntry.formatCaps.referenceLine).toBe(true);
      expect(lineEntry.formatCaps.conditionalColors).toBe(false);
      expect(lineEntry.formatCaps.dataLabelPositions).toEqual(["top", "bottom"]);

      const areaEntry = getVisualRegistryEntry("area");
      expect(areaEntry.formatCaps.chartSpecific).toBe("lineArea");
      expect(areaEntry.formatCaps.referenceLine).toBe(true);
      expect(areaEntry.formatCaps.conditionalColors).toBe(false);
    });

    it("pie y donut tienen chartSpecific 'donut', referenceLine false y conditionalColors false", () => {
      const pie = getVisualRegistryEntry("pie");
      expect(pie.formatCaps.chartSpecific).toBe("donut");
      expect(pie.formatCaps.referenceLine).toBe(false);
      expect(pie.formatCaps.conditionalColors).toBe(false);
      expect(pie.formatCaps.dataLabelPositions).toEqual(["outside", "center"]);

      const donut = getVisualRegistryEntry("donut");
      expect(donut.formatCaps.chartSpecific).toBe("donut");
      expect(donut.formatCaps.referenceLine).toBe(false);
      expect(donut.formatCaps.conditionalColors).toBe(false);
    });

    it("visuales apilados tienen posición de etiqueta única 'center'", () => {
      const stackedCol = getVisualRegistryEntry("stackedColumn");
      expect(stackedCol.formatCaps.dataLabelPositions).toEqual(["center"]);

      const stackedBar = getVisualRegistryEntry("stackedBar");
      expect(stackedBar.formatCaps.dataLabelPositions).toEqual(["center"]);

      const stackedArea = getVisualRegistryEntry("stackedArea");
      expect(stackedArea.formatCaps.dataLabelPositions).toEqual(["center"]);
    });

    it("card, kpiTrend, gauge y table tienen conditionalColors true", () => {
      expect(getVisualRegistryEntry("card").formatCaps.conditionalColors).toBe(true);
      expect(getVisualRegistryEntry("kpiTrend").formatCaps.conditionalColors).toBe(true);
      expect(getVisualRegistryEntry("gauge").formatCaps.conditionalColors).toBe(true);
      expect(getVisualRegistryEntry("table").formatCaps.conditionalColors).toBe(true);
    });
  });
});
