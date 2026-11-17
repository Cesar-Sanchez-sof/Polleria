import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  useDashboardEditorStore,
  MAX_HISTORY,
  compactLayoutVertical,
} from "@/lib/store/dashboard-editor-store";
import { widgetConfigSchema } from "@/lib/dashboards/widget-schema";

describe("E1: Historial, Toolbar y Store del Editor de Dashboards", () => {
  beforeEach(() => {
    useDashboardEditorStore.getState().resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("1. Historial (tope de snapshots a 30)", () => {
    it("mantiene un tope estricto de 30 snapshots de widgets al encadenar mutaciones", () => {
      const store = useDashboardEditorStore.getState();
      store.setWidgets([]);

      expect(useDashboardEditorStore.getState().history.length).toBe(1);

      // Agregamos 35 widgets secuenciales
      for (let i = 0; i < 35; i++) {
        useDashboardEditorStore.getState().addWidget({
          title: `Visual ${i + 1}`,
        });
      }

      const finalState = useDashboardEditorStore.getState();
      expect(finalState.history.length).toBe(MAX_HISTORY);
      expect(finalState.history.length).toBe(30);
      expect(finalState.historyIndex).toBe(29);
      expect(finalState.canUndo).toBe(true);
      expect(finalState.canRedo).toBe(false);
    });

    it("permite deshacer y rehacer recorriendo la pila de historial", () => {
      const store = useDashboardEditorStore.getState();
      store.setWidgets([]);

      const id1 = store.addWidget({ title: "Visual 1" });
      const id2 = store.addWidget({ title: "Visual 2" });

      expect(useDashboardEditorStore.getState().widgets.length).toBe(2);

      // Deshacer una vez: vuelve a tener 1 widget
      useDashboardEditorStore.getState().undo();
      expect(useDashboardEditorStore.getState().widgets.length).toBe(1);
      expect(useDashboardEditorStore.getState().widgets[0].id).toBe(id1);
      expect(useDashboardEditorStore.getState().canUndo).toBe(true);
      expect(useDashboardEditorStore.getState().canRedo).toBe(true);

      // Deshacer otra vez: vuelve a tener 0 widgets
      useDashboardEditorStore.getState().undo();
      expect(useDashboardEditorStore.getState().widgets.length).toBe(0);
      expect(useDashboardEditorStore.getState().canUndo).toBe(false);
      expect(useDashboardEditorStore.getState().canRedo).toBe(true);

      // Rehacer: recupera Visual 1
      useDashboardEditorStore.getState().redo();
      expect(useDashboardEditorStore.getState().widgets.length).toBe(1);
      expect(useDashboardEditorStore.getState().widgets[0].id).toBe(id1);

      // Rehacer: recupera Visual 2
      useDashboardEditorStore.getState().redo();
      expect(useDashboardEditorStore.getState().widgets.length).toBe(2);
      expect(useDashboardEditorStore.getState().widgets[1].id).toBe(id2);
      expect(useDashboardEditorStore.getState().canRedo).toBe(false);
    });
  });

  describe("2. Historial (coalescencia y debounce de 500 ms)", () => {
    it("agrupa múltiples cambios de texto/título dentro de 500 ms en una sola entrada de historial", () => {
      vi.useFakeTimers();

      const store = useDashboardEditorStore.getState();
      store.setWidgets([]);
      const widgetId = store.addWidget({ title: "Inicial" });

      const historyCountBeforeTyping = useDashboardEditorStore.getState().history.length;

      // Simula escritura rápida en el input de título
      useDashboardEditorStore.getState().updateWidgetTitle(widgetId, "V");
      useDashboardEditorStore.getState().updateWidgetTitle(widgetId, "Ve");
      useDashboardEditorStore.getState().updateWidgetTitle(widgetId, "Ven");
      useDashboardEditorStore.getState().updateWidgetTitle(widgetId, "Ventas");

      // El widget en pantalla refleja el cambio inmediatamente
      expect(useDashboardEditorStore.getState().widgets[0].title).toBe("Ventas");

      // Pero aún no ha creado snapshots adicionales antes de los 500ms
      expect(useDashboardEditorStore.getState().history.length).toBe(historyCountBeforeTyping);

      // Avanzamos 250ms (no debe disparar todavía)
      vi.advanceTimersByTime(250);
      expect(useDashboardEditorStore.getState().history.length).toBe(historyCountBeforeTyping);

      // Avanzamos los 250ms restantes (total 500ms tras la última pulsación)
      vi.advanceTimersByTime(250);

      // Ahora sí se generó exactamente 1 entrada nueva coalescida
      expect(useDashboardEditorStore.getState().history.length).toBe(historyCountBeforeTyping + 1);
      expect(useDashboardEditorStore.getState().widgets[0].title).toBe("Ventas");

      // Si hacemos Undo, regresa directo a 'Inicial'
      useDashboardEditorStore.getState().undo();
      expect(useDashboardEditorStore.getState().widgets[0].title).toBe("Inicial");
    });

    it("agrupa cambios de formato y color con debounce de 500 ms", () => {
      vi.useFakeTimers();

      const store = useDashboardEditorStore.getState();
      store.setWidgets([]);
      const widgetId = store.addWidget({ title: "Grafico Color" });

      const countBefore = useDashboardEditorStore.getState().history.length;

      // Cambios continuos de color en paleta
      useDashboardEditorStore.getState().updateWidgetFormat(widgetId, {
        background: { color: "#111111" },
      });
      useDashboardEditorStore.getState().updateWidgetFormat(widgetId, {
        background: { color: "#222222" },
      });
      useDashboardEditorStore.getState().updateWidgetFormat(widgetId, {
        background: { color: "#333333" },
      });

      expect(useDashboardEditorStore.getState().history.length).toBe(countBefore);

      vi.advanceTimersByTime(500);

      expect(useDashboardEditorStore.getState().history.length).toBe(countBefore + 1);
      expect(
        useDashboardEditorStore.getState().widgets[0].config.format.background.color
      ).toBe("#333333");
    });
  });

  describe("3. Duplicar: Clon profundo sin referencias compartidas", () => {
    it("duplica el widget debajo del original, lo selecciona y garantiza independencia total de memoria", () => {
      const store = useDashboardEditorStore.getState();
      store.setWidgets([]);

      const origId = store.addWidget({
        title: "Original",
        x: 2,
        y: 4,
        w: 6,
        h: 3,
      });

      store.selectWidget(origId);

      const duplicatedId = store.duplicateWidget(origId);
      expect(duplicatedId).toBeTruthy();
      expect(duplicatedId).not.toBe(origId);

      const state = useDashboardEditorStore.getState();
      expect(state.widgets.length).toBe(2);
      expect(state.selectedWidgetId).toBe(duplicatedId);

      const orig = state.widgets.find((w) => w.id === origId)!;
      const dup = state.widgets.find((w) => w.id === duplicatedId)!;

      // Posicionado debajo del original: y = orig.y + orig.h
      expect(dup.x).toBe(orig.x);
      expect(dup.y).toBe(orig.y + orig.h);
      expect(dup.w).toBe(orig.w);
      expect(dup.h).toBe(orig.h);

      // Comprobar que no comparten referencias de objetos en memoria
      expect(dup.config).not.toBe(orig.config);
      expect(dup.config.format).not.toBe(orig.config.format);
      expect(dup.config.data).not.toBe(orig.config.data);

      // Mutación profunda en el duplicado no altera el original
      dup.config.format.title.text = "Modificado en Clón";
      expect(orig.config.format.title.text).not.toBe("Modificado en Clón");
    });
  });

  describe("4. Bloquear: Persiste en config.layout.locked", () => {
    it("el visual bloqueado no se elimina con removeWidget hasta desbloquearlo", () => {
      const store = useDashboardEditorStore.getState();
      store.setWidgets([]);

      const wId = store.addWidget({ title: "Visual a Bloquear" });

      // Por defecto no está bloqueado
      let widget = useDashboardEditorStore.getState().widgets.find((w) => w.id === wId)!;
      expect(Boolean(widget.config.layout?.locked)).toBe(false);

      // Bloquear
      store.toggleLockWidget(wId);
      widget = useDashboardEditorStore.getState().widgets.find((w) => w.id === wId)!;
      expect(widget.config.layout?.locked).toBe(true);

      // Intento de eliminación: no debe surtir efecto
      store.removeWidget(wId);
      expect(useDashboardEditorStore.getState().widgets.some((w) => w.id === wId)).toBe(true);

      // Desbloquear
      store.toggleLockWidget(wId);
      widget = useDashboardEditorStore.getState().widgets.find((w) => w.id === wId)!;
      expect(widget.config.layout?.locked).toBe(false);

      // Ahora sí se elimina
      store.removeWidget(wId);
      expect(useDashboardEditorStore.getState().widgets.some((w) => w.id === wId)).toBe(false);
    });

    it("el schema Zod valida correctamente config con layout.locked opcional", () => {
      const configWithLock = {
        visualType: "column" as const,
        data: {
          dataset: "ventas",
          values: [{ field: "total", agg: "sum" as const }],
        },
        format: {
          title: { show: true, text: "Ventas", fontSize: 14, color: "#1e293b", align: "left" },
          colors: { palette: "polleria", series: ["#ef4444"] },
          dataLabels: { show: false, color: "#64748b", fontSize: 11 },
          legend: { show: true, position: "top" as const },
          axes: { xTitle: "", yTitle: "", secondaryYTitle: "", showSecondaryY: false, showGrid: true },
          background: { color: "#ffffff" },
          border: { show: false, color: "#e2e8f0", radius: 12, width: 1 },
          numberFormat: { decimals: 2, prefix: "S/ ", compact: false },
          gauge: { min: 0 },
        },
        layout: {
          locked: true,
        },
      };

      const parseResult = widgetConfigSchema.safeParse(configWithLock);
      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        expect(parseResult.data.layout?.locked).toBe(true);
      }
    });
  });

  describe("5. Indicador 'Sin guardar' (isDirty)", () => {
    it("se apaga al guardar y al deshacer exactamente hasta el estado guardado", () => {
      const store = useDashboardEditorStore.getState();
      store.setWidgets([]);

      expect(useDashboardEditorStore.getState().isDirty).toBe(false);

      // Acción 1: agregar widget -> pasa a sin guardar
      const wId = store.addWidget({ title: "Visual 1" });
      expect(useDashboardEditorStore.getState().isDirty).toBe(true);

      // Simula guardado exitoso
      store.markAsSaved();
      expect(useDashboardEditorStore.getState().isDirty).toBe(false);

      // Acción 2: agregar segundo widget -> sin guardar
      store.addWidget({ title: "Visual 2" });
      expect(useDashboardEditorStore.getState().isDirty).toBe(true);

      // Deshacer hasta el estado guardado -> vuelve a estar guardado (isDirty false)
      store.undo();
      expect(useDashboardEditorStore.getState().isDirty).toBe(false);
      expect(useDashboardEditorStore.getState().widgets.length).toBe(1);

      // Deshacer más allá del estado guardado -> vuelve a estar dirty
      store.undo();
      expect(useDashboardEditorStore.getState().isDirty).toBe(true);
      expect(useDashboardEditorStore.getState().widgets.length).toBe(0);

      // Rehacer de nuevo al estado guardado -> isDirty vuelve a false
      store.redo();
      expect(useDashboardEditorStore.getState().isDirty).toBe(false);
      expect(useDashboardEditorStore.getState().widgets.length).toBe(1);
    });
  });

  describe("6. Auto-ajustar (Compactación vertical)", () => {
    it("compacta verticalmente sin solapar y conserva anchos y columnas", () => {
      const store = useDashboardEditorStore.getState();
      store.setWidgets([
        { id: "w1", title: "W1", x: 0, y: 10, w: 4, h: 3 },
        { id: "w2", title: "W2", x: 0, y: 20, w: 4, h: 2 },
        { id: "w3", title: "W3", x: 4, y: 15, w: 6, h: 4 },
      ]);

      const widgets = useDashboardEditorStore.getState().widgets;
      const compacted = compactLayoutVertical(widgets);

      const c1 = compacted.find((w) => w.id === "w1")!;
      const c2 = compacted.find((w) => w.id === "w2")!;
      const c3 = compacted.find((w) => w.id === "w3")!;

      // W1 sube a y=0
      expect(c1.y).toBe(0);
      expect(c1.x).toBe(0);
      expect(c1.w).toBe(4);

      // W2 sube justo debajo de W1: y = 0 + 3 = 3
      expect(c2.y).toBe(3);
      expect(c2.x).toBe(0);
      expect(c2.w).toBe(4);

      // W3 está en columna 4 (sin colisión con col 0), sube a y=0
      expect(c3.y).toBe(0);
      expect(c3.x).toBe(4);
      expect(c3.w).toBe(6);
    });
  });

  describe("7. Barra Definitiva: Inserción de texto, separador e imagen con historial", () => {
    it("inserta widgets estáticos (text, divider, image) y permite deshacer con undo()", () => {
      const store = useDashboardEditorStore.getState();
      store.setWidgets([]);

      const textId = store.addTextWidget();
      expect(useDashboardEditorStore.getState().widgets.length).toBe(1);
      const textWidget = useDashboardEditorStore.getState().widgets[0];
      expect(textWidget.id).toBe(textId);
      expect(textWidget.type).toBe("text");
      expect((textWidget.config as Record<string, unknown>).content).toBe("Escribe un texto aquí...");

      const dividerId = store.addDividerWidget();
      expect(useDashboardEditorStore.getState().widgets.length).toBe(2);
      const divWidget = useDashboardEditorStore.getState().widgets[1];
      expect(divWidget.id).toBe(dividerId);
      expect(divWidget.type).toBe("divider");
      expect(divWidget.w).toBe(12);
      expect(divWidget.h).toBe(1);

      const imgId = store.addImageWidget("https://example.com/logo.png");
      expect(useDashboardEditorStore.getState().widgets.length).toBe(3);
      const imgWidget = useDashboardEditorStore.getState().widgets[2];
      expect(imgWidget.id).toBe(imgId);
      expect(imgWidget.type).toBe("image");
      expect((imgWidget.config as Record<string, unknown>).content).toBe("https://example.com/logo.png");

      // Deshacer imagen
      store.undo();
      expect(useDashboardEditorStore.getState().widgets.length).toBe(2);
      // Deshacer separador
      store.undo();
      expect(useDashboardEditorStore.getState().widgets.length).toBe(1);
      // Deshacer texto
      store.undo();
      expect(useDashboardEditorStore.getState().widgets.length).toBe(0);
    });
  });

  describe("8. Barra Definitiva: Selección múltiple, alineación y distribución", () => {
    it("soporta selección múltiple con Ctrl/Shift (multi=true)", () => {
      const store = useDashboardEditorStore.getState();
      store.setWidgets([
        { id: "w1", title: "W1", x: 0, y: 0, w: 3, h: 2 },
        { id: "w2", title: "W2", x: 4, y: 0, w: 3, h: 2 },
        { id: "w3", title: "W3", x: 8, y: 0, w: 3, h: 2 },
      ]);

      store.selectWidget("w1", false);
      expect(useDashboardEditorStore.getState().selectedWidgetIds).toEqual(["w1"]);

      store.selectWidget("w2", true);
      expect(useDashboardEditorStore.getState().selectedWidgetIds).toEqual(["w1", "w2"]);

      store.selectWidget("w1", true); // deselecciona w1
      expect(useDashboardEditorStore.getState().selectedWidgetIds).toEqual(["w2"]);
    });

    it("alinea a la izquierda, centro y derecha los widgets seleccionados", () => {
      const store = useDashboardEditorStore.getState();
      store.setWidgets([
        { id: "w1", title: "W1", x: 2, y: 0, w: 2, h: 2 },
        { id: "w2", title: "W2", x: 6, y: 0, w: 2, h: 2 },
      ]);

      store.selectWidgets(["w1", "w2"]);

      // Alinear derecha primero: maxRight = 8, w = 2 -> x = 6
      store.alignRight();
      const stateRight = useDashboardEditorStore.getState();
      expect(stateRight.widgets.find((w) => w.id === "w1")?.x).toBe(6);
      expect(stateRight.widgets.find((w) => w.id === "w2")?.x).toBe(6);

      // Ahora mover w2 y alinear izquierda -> x = min(2, 6) = 2
      useDashboardEditorStore.getState().updateWidgetLayout("w1", { x: 2, y: 0, w: 2, h: 2 }, true);
      useDashboardEditorStore.getState().selectWidgets(["w1", "w2"]);
      useDashboardEditorStore.getState().alignLeft();
      const stateLeft = useDashboardEditorStore.getState();
      expect(stateLeft.widgets.find((w) => w.id === "w1")?.x).toBe(2);
      expect(stateLeft.widgets.find((w) => w.id === "w2")?.x).toBe(2);
    });

    it("distribuye horizontalmente 3 widgets seleccionados", () => {
      const store = useDashboardEditorStore.getState();
      store.setWidgets([
        { id: "w1", title: "W1", x: 0, y: 0, w: 2, h: 2 },
        { id: "w2", title: "W2", x: 1, y: 0, w: 2, h: 2 },
        { id: "w3", title: "W3", x: 8, y: 0, w: 2, h: 2 },
      ]);

      store.selectWidgets(["w1", "w2", "w3"]);
      store.distributeHorizontally();

      const widgets = useDashboardEditorStore.getState().widgets;
      expect(widgets.find((w) => w.id === "w1")?.x).toBe(0);
      expect(widgets.find((w) => w.id === "w2")?.x).toBe(4);
      expect(widgets.find((w) => w.id === "w3")?.x).toBe(8);
    });
  });

  describe("9. Barra Definitiva: Agrupación, Copiar/Pegar y Zoom", () => {
    it("asigna groupId compartido al agrupar y lo elimina al desagrupar", () => {
      const store = useDashboardEditorStore.getState();
      store.setWidgets([
        { id: "w1", title: "W1", x: 0, y: 0, w: 4, h: 2 },
        { id: "w2", title: "W2", x: 4, y: 0, w: 4, h: 2 },
      ]);

      store.selectWidgets(["w1", "w2"]);
      store.groupSelectedWidgets();

      let ws = useDashboardEditorStore.getState().widgets;
      const g1 = (ws[0].config as Record<string, unknown>).groupId;
      const g2 = (ws[1].config as Record<string, unknown>).groupId;
      expect(g1).toBeDefined();
      expect(g1).toBe(g2);

      store.ungroupSelectedWidgets();
      ws = useDashboardEditorStore.getState().widgets;
      expect((ws[0].config as Record<string, unknown>).groupId).toBeUndefined();
      expect((ws[1].config as Record<string, unknown>).groupId).toBeUndefined();
    });

    it("copia al portapapeles y pega clones desplazados", () => {
      const store = useDashboardEditorStore.getState();
      store.setWidgets([
        { id: "orig", title: "Original", x: 2, y: 3, w: 4, h: 2 },
      ]);

      store.selectWidget("orig", false);
      store.copySelectedWidgets();
      expect(useDashboardEditorStore.getState().clipboard.length).toBe(1);

      store.pasteWidgets();
      const ws = useDashboardEditorStore.getState().widgets;
      expect(ws.length).toBe(2);
      const pasted = ws.find((w) => w.id !== "orig")!;
      expect(pasted.title).toBe("Original");
      expect(pasted.x).toBe(3); // x + 1
      expect(pasted.y).toBe(4); // y + 1
    });

    it("controla el zoom dentro del rango 50% a 150%", () => {
      const store = useDashboardEditorStore.getState();
      store.resetZoom();
      expect(useDashboardEditorStore.getState().zoom).toBe(100);

      // Zoom in
      store.zoomIn();
      expect(useDashboardEditorStore.getState().zoom).toBe(110);

      // Max limit 150
      for (let i = 0; i < 10; i++) store.zoomIn();
      expect(useDashboardEditorStore.getState().zoom).toBe(150);

      // Min limit 50
      for (let i = 0; i < 20; i++) store.zoomOut();
      expect(useDashboardEditorStore.getState().zoom).toBe(50);

      store.resetZoom();
      expect(useDashboardEditorStore.getState().zoom).toBe(100);
    });
  });
});
