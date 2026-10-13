import { describe, it, expect, beforeEach } from "vitest";
import {
  getRestaurantGlobalConfig,
  updateRestaurantInfo,
  updatePrinterConfig,
  listDiningAreas,
  saveDiningArea,
  deleteDiningArea,
  type DiningArea,
} from "../lib/services/restaurant-config.service";

describe("Test Suite: Módulos de Configuración (Salones, Datos Restaurante, Comprobantes e Impresión)", () => {
  describe("Módulo 1: Salones y Áreas", () => {
    it("debe listar los salones configurados con sus niveles y mesas asignadas", () => {
      const areas = listDiningAreas();
      expect(Array.isArray(areas)).toBe(true);
      expect(areas.length).toBeGreaterThan(0);

      const principal = areas.find((a) => a.name.includes("Principal"));
      expect(principal).toBeDefined();
      expect(principal?.level).toContain("Piso");
      expect(Array.isArray(principal?.tableNumbers)).toBe(true);
    });

    it("debe permitir registrar un nuevo salón con nivel y color distintivo", () => {
      const nuevoSalon: DiningArea = {
        id: "area-test-terraza",
        name: "Terraza Panorámica Test",
        level: "Piso 3",
        description: "Mesas al aire libre con vista a la ciudad",
        tableNumbers: [15, 16],
        active: true,
        color: "amber",
      };

      const listaActualizada = saveDiningArea(nuevoSalon);
      const guardado = listaActualizada.find((a) => a.id === "area-test-terraza");

      expect(guardado).toBeDefined();
      expect(guardado?.name).toBe("Terraza Panorámica Test");
      expect(guardado?.tableNumbers).toEqual([15, 16]);
    });

    it("debe permitir actualizar la asignación de mesas a un salón existente", () => {
      const area = listDiningAreas().find((a) => a.id === "area-test-terraza");
      expect(area).toBeDefined();

      const actualizado = saveDiningArea({
        ...area!,
        tableNumbers: [15, 16, 17, 18],
      });

      const encontrado = actualizado.find((a) => a.id === "area-test-terraza");
      expect(encontrado?.tableNumbers).toEqual([15, 16, 17, 18]);
      expect(encontrado?.tableNumbers.length).toBe(4);
    });

    it("debe permitir eliminar un salón de pruebas de forma segura", () => {
      const listaTrasEliminar = deleteDiningArea("area-test-terraza");
      const existe = listaTrasEliminar.some((a) => a.id === "area-test-terraza");
      expect(existe).toBe(false);
    });
  });

  describe("Módulo 2: Datos del Restaurante / Empresa", () => {
    it("debe retornar la identidad fiscal y comercial oficial", () => {
      const config = getRestaurantGlobalConfig();
      expect(config.restaurant.name).toBeDefined();
      expect(config.restaurant.ruc).toBeDefined();
      expect(config.restaurant.ruc.length).toBe(11);
      expect(config.restaurant.commercialName).toBeDefined();
      expect(config.restaurant.ticketFooter).toBeDefined();
    });

    it("debe actualizar correctamente los datos de contacto y pie de ticket", () => {
      const updated = updateRestaurantInfo({
        commercialName: "El Buen Sabor a la Brasa - Sede Central",
        phone: "+51 999 888 777",
        ticketFooter: "¡Gracias por su visita! Síguenos en Instagram @elbuensabor",
      });

      expect(updated.commercialName).toBe("El Buen Sabor a la Brasa - Sede Central");
      expect(updated.phone).toBe("+51 999 888 777");
      expect(updated.ticketFooter).toContain("@elbuensabor");

      // Restauramos nombre comercial base
      updateRestaurantInfo({
        commercialName: "El Buen Sabor a la Brasa",
      });
    });
  });

  describe("Módulo 3: Comprobantes, Series e Impresoras Térmicas", () => {
    it("debe tener configuradas las series estándar B001, F001 y T001", () => {
      const config = getRestaurantGlobalConfig();
      expect(config.printers.series.boleta).toMatch(/^B\d{3}$/);
      expect(config.printers.series.factura).toMatch(/^F\d{3}$/);
      expect(config.printers.series.ticket).toMatch(/^T\d{3}$/);
      expect(config.printers.paperWidth).toMatch(/^(80mm|58mm)$/);
    });

    it("debe permitir actualizar parámetros de comanderas y auto-corte de papel", () => {
      const updated = updatePrinterConfig({
        paperWidth: "80mm",
        autoCut: true,
        autoPrintVoucher: true,
        kitchenPrinter: {
          name: "Comandera Térmica Cocina Central",
          ipOrPort: "192.168.1.200:9100",
          active: true,
          autoPrintOnOrder: true,
        },
      });

      expect(updated.paperWidth).toBe("80mm");
      expect(updated.autoCut).toBe(true);
      expect(updated.kitchenPrinter.name).toBe("Comandera Térmica Cocina Central");
      expect(updated.kitchenPrinter.active).toBe(true);
    });

    it("debe permitir alternar el ancho de papel entre 80mm y 58mm", () => {
      const config58 = updatePrinterConfig({ paperWidth: "58mm" });
      expect(config58.paperWidth).toBe("58mm");

      const config80 = updatePrinterConfig({ paperWidth: "80mm" });
      expect(config80.paperWidth).toBe("80mm");
    });
  });
});
