import { describe, it, expect } from "vitest";
import {
  VISUAL_REGISTRY,
  getVisualRegistryEntry,
  validateFieldForWell,
  type VisualWellDefinition,
} from "@/lib/dashboards/visual-registry";
import { setDraggedField, getDraggedField } from "@/lib/dashboards/drag-state";
import type { CatalogField } from "@/lib/hooks/use-visual-data";

describe("UI: Validación al soltar un campo según el registro (wells.accepts y max)", () => {
  const dimTexto: CatalogField = {
    id: "cliente",
    label: "Cliente",
    kind: "dimension",
    dataType: "string",
  };

  const dimFecha: CatalogField = {
    id: "fecha",
    label: "Fecha de Emisión",
    kind: "dimension",
    dataType: "date",
    hasTime: false,
  };

  const medidaTotal: CatalogField = {
    id: "total",
    label: "Total Ventas",
    kind: "measure",
    dataType: "number",
  };

  const medidaCantidad: CatalogField = {
    id: "cantidad",
    label: "Cantidad",
    kind: "measure",
    dataType: "number",
  };

  describe("1. Validación de 'accepts' ('dimension' vs 'measure')", () => {
    const wellAxis: VisualWellDefinition = {
      role: "axis",
      label: "Eje (Dimensión)",
      accepts: "dimension",
      min: 1,
      max: 1,
    };

    const wellValues: VisualWellDefinition = {
      role: "values",
      label: "Valores (Medidas)",
      accepts: "measure",
      min: 1,
    };

    it("un pozo que acepta dimensión permite campos tipo dimension (texto o fecha)", () => {
      const resTexto = validateFieldForWell(wellAxis, dimTexto, 0);
      expect(resTexto.valid).toBe(true);
      expect(resTexto.error).toBeUndefined();

      const resFecha = validateFieldForWell(wellAxis, dimFecha, 0);
      expect(resFecha.valid).toBe(true);
    });

    it("un pozo que acepta dimensión RECHAZA una medida numérica", () => {
      const res = validateFieldForWell(wellAxis, medidaTotal, 0);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("solo acepta dimensiones, no medidas");
    });

    it("un pozo que acepta medida permite campos tipo measure", () => {
      const res = validateFieldForWell(wellValues, medidaTotal, 0);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("un pozo que acepta medida RECHAZA una dimensión no numérica", () => {
      const res = validateFieldForWell(wellValues, dimTexto, 0);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("solo acepta medidas numéricas, no dimensiones");
    });
  });

  describe("2. Validación de 'max' (límite máximo de campos en el pozo)", () => {
    it("pozo con max: 1 permite soltar otro campo del mismo tipo para REEMPLAZARLO", () => {
      const wellSingleAxis: VisualWellDefinition = {
        role: "axis",
        label: "Eje",
        accepts: "dimension",
        min: 1,
        max: 1,
      };

      // Primer campo: count = 0 -> Válido
      const res1 = validateFieldForWell(wellSingleAxis, dimTexto, 0);
      expect(res1.valid).toBe(true);

      // Segundo campo: count = 1 -> Válido porque max: 1 reemplaza al existente
      const res2 = validateFieldForWell(wellSingleAxis, dimFecha, 1);
      expect(res2.valid).toBe(true);

      // Pero rechaza si el tipo es incompatible (medida en pozo de dimensión)
      const res3 = validateFieldForWell(wellSingleAxis, medidaTotal, 1);
      expect(res3.valid).toBe(false);
      expect(res3.error).toContain("solo acepta dimensiones");
    });

    it("pozo con max > 1 (ej: max: 2) rechaza al superar el límite", () => {
      const wellMax2: VisualWellDefinition = {
        role: "values",
        label: "Valores",
        accepts: "measure",
        min: 1,
        max: 2,
      };

      expect(validateFieldForWell(wellMax2, medidaTotal, 0).valid).toBe(true);
      expect(validateFieldForWell(wellMax2, medidaCantidad, 1).valid).toBe(true);
      const res = validateFieldForWell(wellMax2, medidaTotal, 2);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("solo admite un máximo de 2 campo(s)");
    });

    it("pozo sin max (unlimited) permite agregar 1, 2, 3 o más medidas", () => {
      const wellMultiValues: VisualWellDefinition = {
        role: "values",
        label: "Valores",
        accepts: "measure",
        min: 1,
        // max undefined
      };

      expect(validateFieldForWell(wellMultiValues, medidaTotal, 0).valid).toBe(true);
      expect(validateFieldForWell(wellMultiValues, medidaCantidad, 1).valid).toBe(true);
      expect(validateFieldForWell(wellMultiValues, medidaTotal, 5).valid).toBe(true);
    });
  });

  describe("3. Validación aplicada a los tipos del VISUAL_REGISTRY", () => {
    it("pie: values tiene max: 1 y permite reemplazar la medida existente", () => {
      const pieEntry = getVisualRegistryEntry("pie");
      const pieValuesWell = pieEntry.wells.find((w) => w.role === "values")!;
      expect(pieValuesWell.max).toBe(1);

      // 1er campo permitido
      expect(validateFieldForWell(pieValuesWell, medidaTotal, 0).valid).toBe(true);

      // 2do campo también permitido (reemplazo al soltar)
      const res = validateFieldForWell(pieValuesWell, medidaCantidad, 1);
      expect(res.valid).toBe(true);

      // Pero rechaza dimensión
      expect(validateFieldForWell(pieValuesWell, dimTexto, 1).valid).toBe(false);
    });

    it("donut: values tiene max: 1 y permite reemplazo por otra medida", () => {
      const donutEntry = getVisualRegistryEntry("donut");
      const donutValuesWell = donutEntry.wells.find((w) => w.role === "values")!;
      expect(donutValuesWell.max).toBe(1);

      expect(validateFieldForWell(donutValuesWell, medidaTotal, 1).valid).toBe(true);
      expect(validateFieldForWell(donutValuesWell, dimTexto, 0).valid).toBe(false);
    });

    it("card y gauge: values tiene max: 1 y permite reemplazo, pero rechaza dimensiones", () => {
      const cardEntry = getVisualRegistryEntry("card");
      const cardValuesWell = cardEntry.wells.find((w) => w.role === "values")!;
      expect(cardValuesWell.max).toBe(1);

      // Rechaza dimensión
      expect(validateFieldForWell(cardValuesWell, dimTexto, 0).valid).toBe(false);
      // Acepta 1 medida inicial
      expect(validateFieldForWell(cardValuesWell, medidaTotal, 0).valid).toBe(true);
      // Permite reemplazo al soltar otra medida
      expect(validateFieldForWell(cardValuesWell, medidaCantidad, 1).valid).toBe(true);

      const gaugeEntry = getVisualRegistryEntry("gauge");
      const gaugeValuesWell = gaugeEntry.wells.find((w) => w.role === "values")!;
      expect(gaugeValuesWell.max).toBe(1);
      expect(validateFieldForWell(gaugeValuesWell, medidaCantidad, 1).valid).toBe(true);
      expect(validateFieldForWell(gaugeValuesWell, dimFecha, 0).valid).toBe(false);
    });

    it("column y bar: values no tiene max y permite múltiples medidas", () => {
      const colEntry = getVisualRegistryEntry("column");
      const colValuesWell = colEntry.wells.find((w) => w.role === "values")!;
      expect(colValuesWell.max).toBeUndefined();

      expect(validateFieldForWell(colValuesWell, medidaTotal, 0).valid).toBe(true);
      expect(validateFieldForWell(colValuesWell, medidaCantidad, 1).valid).toBe(true);
      expect(validateFieldForWell(colValuesWell, medidaTotal, 2).valid).toBe(true);
    });

    it("combo: values_column y values_line aceptan medidas y rechazan dimensiones", () => {
      const comboEntry = getVisualRegistryEntry("combo");
      const colWell = comboEntry.wells.find((w) => w.role === "values_column")!;
      const lineWell = comboEntry.wells.find((w) => w.role === "values_line")!;

      expect(colWell.accepts).toBe("measure");
      expect(lineWell.accepts).toBe("measure");

      expect(validateFieldForWell(colWell, medidaTotal, 0).valid).toBe(true);
      expect(validateFieldForWell(colWell, dimTexto, 0).valid).toBe(false);

      expect(validateFieldForWell(lineWell, medidaCantidad, 0).valid).toBe(true);
      expect(validateFieldForWell(lineWell, dimFecha, 0).valid).toBe(false);
    });

    it("todos los pozos en todos los 19 visuales cumplen con la especificación de accepts", () => {
      for (const [vType, entry] of Object.entries(VISUAL_REGISTRY)) {
        for (const well of entry.wells) {
          expect(
            ["dimension", "measure"],
            `Pozo ${well.role} en ${vType} debe tener accepts 'dimension' o 'measure'`
          ).toContain(well.accepts);

          if (well.accepts === "dimension") {
            expect(validateFieldForWell(well, dimTexto, 0).valid).toBe(true);
            expect(validateFieldForWell(well, medidaTotal, 0).valid).toBe(false);
          } else {
            expect(validateFieldForWell(well, medidaTotal, 0).valid).toBe(true);
            expect(validateFieldForWell(well, dimTexto, 0).valid).toBe(false);
          }
        }
      }
    });
  });

  describe("4. Estado de Drag & Drop (drag-state.ts)", () => {
    it("setDraggedField almacena el campo y getDraggedField lo recupera y limpia", () => {
      expect(getDraggedField()).toBeNull();

      setDraggedField(dimTexto);
      expect(getDraggedField()).toEqual(dimTexto);

      setDraggedField(null);
      expect(getDraggedField()).toBeNull();
    });
  });
});
