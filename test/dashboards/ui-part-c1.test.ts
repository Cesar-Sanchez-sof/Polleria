import { describe, it, expect } from "vitest";
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

describe("UI Parte C1: Registro Central de Visualizaciones (visual-registry.ts)", () => {
  it("todos los visualTypes del esquema Zod están registrados, tienen wells válidos, defaultSize y format", () => {
    const allTypes = visualTypeSchema.options;
    expect(allTypes.length).toBe(19);

    for (const vType of allTypes) {
      const entry = VISUAL_REGISTRY[vType];
      expect(entry, `El visualType ${vType} debe existir en VISUAL_REGISTRY`).toBeDefined();
      expect(entry.id).toBe(vType);
      expect(entry.label).toBeTruthy();
      expect(entry.category).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.icon).toBeDefined();

      // Wells
      expect(entry.wells.length).toBeGreaterThan(0);
      for (const w of entry.wells) {
        expect(["axis", "legend", "values", "values_column", "values_line"]).toContain(w.role);
        expect(["dimension", "measure"]).toContain(w.accepts);
        expect(w.label).toBeTruthy();
        expect(w.min).toBeGreaterThanOrEqual(0);
      }

      // Default Size
      expect(entry.defaultSize.w).toBeGreaterThan(0);
      expect(entry.defaultSize.h).toBeGreaterThan(0);

      // Format Options
      expect(typeof entry.format.axes).toBe("boolean");
      expect(typeof entry.format.legend).toBe("boolean");
      expect(typeof entry.format.dataLabels).toBe("boolean");
      expect(typeof entry.format.gridlines).toBe("boolean");
    }
  });

  it("función auxiliar getVisualRegistryEntry devuelve la entrada correcta o fallback a column", () => {
    expect(getVisualRegistryEntry("combo").id).toBe("combo");
    expect(getVisualRegistryEntry("gauge").id).toBe("gauge");
    expect(getVisualRegistryEntry("invalid" as unknown as VisualType).id).toBe("column");
  });
});

describe("UI Parte C1: Validación Zod de los 10 Nuevos Tipos de Visual", () => {
  const newTypes: VisualType[] = [
    "stackedColumn",
    "percentColumn",
    "stackedBar",
    "percentBar",
    "stackedArea",
    "combo",
    "radar",
    "funnel",
    "treemap",
    "gauge",
  ];

  it.each(newTypes)("el tipo %s pasa widgetConfigSchema.safeParse", (vType) => {
    const base = createDefaultWidgetConfig("column", `Prueba ${vType}`, "ventas");
    const migrated = migrateWidgetConfigByRole(base, vType);

    const parseResult = widgetConfigSchema.safeParse(migrated);
    expect(parseResult.success, `Fallo al validar Zod para ${vType}`).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.visualType).toBe(vType);
    }
  });

  it("combo valida valores con series 'column' y 'line', y eje secundario", () => {
    const config = createDefaultWidgetConfig("column", "Ventas vs Margen", "ventas");
    const combo = migrateWidgetConfigByRole(config, "combo");

    combo.data.values = [
      { field: "total", agg: "sum", series: "column" },
      { field: "subtotal", agg: "avg", series: "line" },
    ];
    combo.format.axes = {
      ...combo.format.axes,
      xTitle: "Mes",
      yTitle: "Total Ventas (S/)",
      secondaryYTitle: "Promedio Subtotal (S/)",
      showSecondaryY: true,
      showGrid: true,
    };

    const parsed = widgetConfigSchema.safeParse(combo);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data.values[0].series).toBe("column");
      expect(parsed.data.data.values[1].series).toBe("line");
      expect(parsed.data.format.axes.showSecondaryY).toBe(true);
      expect(parsed.data.format.axes.secondaryYTitle).toBe("Promedio Subtotal (S/)");
    }
  });

  it("gauge valida min, max y target en format.gauge", () => {
    const config = createDefaultWidgetConfig("column", "Meta de Ventas", "ventas");
    const gauge = migrateWidgetConfigByRole(config, "gauge");

    gauge.format.gauge = {
      min: 0,
      max: 50000,
      target: 35000,
    };
    gauge.format.numberFormat = {
      prefix: "S/ ",
      decimals: 2,
      compact: false,
    };

    const parsed = widgetConfigSchema.safeParse(gauge);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.format.gauge?.min).toBe(0);
      expect(parsed.data.format.gauge?.max).toBe(50000);
      expect(parsed.data.format.gauge?.target).toBe(35000);
      expect(parsed.data.format.numberFormat.prefix).toBe("S/ ");
    }
  });
});

describe("UI Parte C1: Migración por Rol en al menos 6 Pares de Tipos", () => {
  it("Par 1: column -> stackedColumn -> combo conserva eje, leyenda y distribuye valores entre columnas y líneas", () => {
    const base = createDefaultWidgetConfig("column", "Ventas y Comandas", "ventas");
    base.data.axis = "fecha";
    base.data.legend = "tipoComprobante";
    base.data.values = [
      { field: "total", agg: "sum" },
      { field: "id", agg: "count" },
    ];

    // 1. column -> stackedColumn
    const stacked = migrateWidgetConfigByRole(base, "stackedColumn");
    expect(stacked.visualType).toBe("stackedColumn");
    expect(stacked.data.axis).toBe("fecha");
    expect(stacked.data.legend).toBe("tipoComprobante");
    expect(stacked.data.values).toEqual([
      { field: "total", agg: "sum" },
      { field: "id", agg: "count" },
    ]);

    // 2. stackedColumn -> combo
    const combo = migrateWidgetConfigByRole(stacked, "combo");
    expect(combo.visualType).toBe("combo");
    expect(combo.data.axis).toBe("fecha");
    expect(combo.data.values[0]).toEqual({ field: "total", agg: "sum", series: "column" });
    expect(combo.data.values[1]).toEqual({ field: "id", agg: "count", series: "line" });
  });

  it("Par 2: combo -> line consolida los valores eliminando la distinción de serie", () => {
    const combo = createDefaultWidgetConfig("column", "Combo", "ventas");
    combo.visualType = "combo";
    combo.data.axis = "fecha";
    combo.data.values = [
      { field: "total", agg: "sum", series: "column" },
      { field: "igv", agg: "sum", series: "line" },
    ];

    const line = migrateWidgetConfigByRole(combo, "line");
    expect(line.visualType).toBe("line");
    expect(line.data.axis).toBe("fecha");
    expect(line.data.values).toEqual([
      { field: "total", agg: "sum" },
      { field: "igv", agg: "sum" },
    ]);
  });

  it("Par 3: bar -> stackedBar -> percentBar conserva eje, leyenda, valores y sort", () => {
    const bar = createDefaultWidgetConfig("bar", "Top Platos", "platos_vendidos");
    bar.data.axis = "producto";
    bar.data.legend = "categoria";
    bar.data.values = [{ field: "cantidad", agg: "sum" }];
    bar.data.sort = { by: "cantidad_sum", dir: "desc" };
    bar.data.limit = 10;

    const stackedBar = migrateWidgetConfigByRole(bar, "stackedBar");
    expect(stackedBar.visualType).toBe("stackedBar");
    expect(stackedBar.data.axis).toBe("producto");
    expect(stackedBar.data.legend).toBe("categoria");
    expect(stackedBar.data.sort).toEqual({ by: "cantidad_sum", dir: "desc" });
    expect(stackedBar.data.limit).toBe(10);

    const percentBar = migrateWidgetConfigByRole(stackedBar, "percentBar");
    expect(percentBar.visualType).toBe("percentBar");
    expect(percentBar.data.axis).toBe("producto");
    expect(percentBar.data.legend).toBe("categoria");
    expect(percentBar.data.sort).toEqual({ by: "cantidad_sum", dir: "desc" });
  });

  it("Par 4: column -> funnel conserva eje como categoría, descarta leyenda, recorta a 1 medida y asigna sort desc", () => {
    const col = createDefaultWidgetConfig("column", "Embudo Ventas", "ventas");
    col.data.axis = "tipoComprobante";
    col.data.legend = "serie";
    col.data.values = [
      { field: "total", agg: "sum" },
      { field: "igv", agg: "sum" },
    ];
    delete col.data.sort;

    const funnel = migrateWidgetConfigByRole(col, "funnel");
    expect(funnel.visualType).toBe("funnel");
    expect(funnel.data.axis).toBe("tipoComprobante");
    expect(funnel.data.legend).toBeUndefined(); // Embudo no soporta leyenda
    expect(funnel.data.values).toEqual([{ field: "total", agg: "sum" }]); // Recorta a 1 medida
    expect(funnel.data.sort).toEqual({ by: "total_sum", dir: "desc" }); // Orden desc por defecto
  });

  it("Par 5: funnel -> treemap conserva categoría, medida y descarta títulos de eje", () => {
    const funnel = createDefaultWidgetConfig("column", "Treemap Platos", "platos_vendidos");
    funnel.visualType = "funnel";
    funnel.data.axis = "producto";
    funnel.data.values = [{ field: "cantidad", agg: "sum" }];
    funnel.format.axes = { ...funnel.format.axes, xTitle: "Plato", yTitle: "Cantidad" };

    const treemap = migrateWidgetConfigByRole(funnel, "treemap");
    expect(treemap.visualType).toBe("treemap");
    expect(treemap.data.axis).toBe("producto");
    expect(treemap.data.values).toEqual([{ field: "cantidad", agg: "sum" }]);
    expect(treemap.format.axes.xTitle).toBe("");
    expect(treemap.format.axes.yTitle).toBe("");
  });

  it("Par 6: area -> stackedArea -> radar conserva eje, leyenda y todas las medidas", () => {
    const area = createDefaultWidgetConfig("area", "Desempeño", "ventas");
    area.data.axis = "fecha";
    area.data.legend = "tipoComprobante";
    area.data.values = [
      { field: "total", agg: "sum" },
      { field: "subtotal", agg: "sum" },
    ];

    const stackedArea = migrateWidgetConfigByRole(area, "stackedArea");
    expect(stackedArea.visualType).toBe("stackedArea");
    expect(stackedArea.data.axis).toBe("fecha");
    expect(stackedArea.data.legend).toBe("tipoComprobante");

    const radar = migrateWidgetConfigByRole(stackedArea, "radar");
    expect(radar.visualType).toBe("radar");
    expect(radar.data.axis).toBe("fecha");
    expect(radar.data.legend).toBe("tipoComprobante");
    expect(radar.data.values.length).toBe(2);
  });

  it("Par 7: card -> gauge -> card conserva medida única y preserva número de formato", () => {
    const card = createDefaultWidgetConfig("card", "KPI Ventas", "ventas");
    card.data.axis = undefined;
    card.data.values = [{ field: "total", agg: "sum" }];
    card.format.numberFormat = { prefix: "$ ", decimals: 1, compact: true };

    const gauge = migrateWidgetConfigByRole(card, "gauge");
    expect(gauge.visualType).toBe("gauge");
    expect(gauge.data.axis).toBeUndefined();
    expect(gauge.data.values).toEqual([{ field: "total", agg: "sum" }]);
    expect(gauge.format.numberFormat?.prefix).toBe("$ ");

    const backToCard = migrateWidgetConfigByRole(gauge, "card");
    expect(backToCard.visualType).toBe("card");
    expect(backToCard.data.values).toEqual([{ field: "total", agg: "sum" }]);
    expect(backToCard.format.numberFormat?.prefix).toBe("$ ");
  });
});
