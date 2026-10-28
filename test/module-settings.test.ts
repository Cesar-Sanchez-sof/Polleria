import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  diningAreaMock,
  printerConfigMock,
  restaurantConfigMock,
  auditLogMock,
  setInMemoryAreas,
  setInMemoryPrinterConfig,
} = vi.hoisted(() => {
  let inMemoryAreas: any[] = [];
  let inMemoryPrinterConfig: any = null;

  const diningAreaMock = {
    findMany: vi.fn(async () => [...inMemoryAreas]),
    createMany: vi.fn(async ({ data }: { data: any[] }) => {
      inMemoryAreas.push(...data);
      return { count: data.length };
    }),
    upsert: vi.fn(async ({ where, create, update }: any) => {
      const idx = inMemoryAreas.findIndex((a) => a.id === where.id);
      if (idx >= 0) {
        inMemoryAreas[idx] = { ...inMemoryAreas[idx], ...update };
        return inMemoryAreas[idx];
      } else {
        const created = { ...create };
        inMemoryAreas.push(created);
        return created;
      }
    }),
    delete: vi.fn(async ({ where }: any) => {
      const idx = inMemoryAreas.findIndex((a) => a.id === where.id);
      if (idx >= 0) {
        const deleted = inMemoryAreas.splice(idx, 1)[0];
        return deleted;
      }
      return null;
    }),
  };

  const printerConfigMock = {
    findUnique: vi.fn(async () => (inMemoryPrinterConfig ? { ...inMemoryPrinterConfig } : null)),
    create: vi.fn(async ({ data }: any) => {
      inMemoryPrinterConfig = { ...data };
      return inMemoryPrinterConfig;
    }),
    upsert: vi.fn(async ({ update, create }: any) => {
      if (inMemoryPrinterConfig) {
        inMemoryPrinterConfig = { ...inMemoryPrinterConfig, ...update };
      } else {
        inMemoryPrinterConfig = { ...create };
      }
      return inMemoryPrinterConfig;
    }),
  };

  let inMemoryRestaurantConfig: any = null;
  const restaurantConfigMock = {
    findUnique: vi.fn(async () => (inMemoryRestaurantConfig ? { ...inMemoryRestaurantConfig } : null)),
    create: vi.fn(async ({ data }: any) => {
      inMemoryRestaurantConfig = { ...data };
      return inMemoryRestaurantConfig;
    }),
    upsert: vi.fn(async ({ update, create }: any) => {
      if (inMemoryRestaurantConfig) {
        inMemoryRestaurantConfig = { ...inMemoryRestaurantConfig, ...update };
      } else {
        inMemoryRestaurantConfig = { ...create };
      }
      return inMemoryRestaurantConfig;
    }),
  };

  const auditLogMock = {
    create: vi.fn(async ({ data }: any) => ({ id: 1, ...data })),
  };

  return {
    diningAreaMock,
    printerConfigMock,
    restaurantConfigMock,
    auditLogMock,
    setInMemoryAreas: (val: any[]) => {
      inMemoryAreas = val;
    },
    setInMemoryPrinterConfig: (val: any) => {
      inMemoryPrinterConfig = val;
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    diningArea: diningAreaMock,
    printerConfig: printerConfigMock,
    restaurantConfig: restaurantConfigMock,
    auditLog: auditLogMock,
  },
}));

import {
  getRestaurantGlobalConfig,
  updateRestaurantInfo,
  getPrinterConfig,
  updatePrinterConfig,
  listDiningAreas,
  saveDiningArea,
  deleteDiningArea,
  DEFAULT_CONFIG,
  type DiningArea,
} from "../lib/services/restaurant-config.service";

describe("Test Suite: Módulos de Configuración con Prisma (Salones, Datos Restaurante, Comprobantes e Impresión)", () => {
  beforeEach(() => {
    setInMemoryAreas(
      DEFAULT_CONFIG.areas.map((a) => ({
        id: a.id,
        name: a.name,
        level: a.level,
        description: a.description,
        tableNumbers: [...a.tableNumbers],
        active: a.active,
        color: a.color,
      }))
    );

    setInMemoryPrinterConfig({
      id: "default",
      paperWidth: DEFAULT_CONFIG.printers.paperWidth,
      autoCut: DEFAULT_CONFIG.printers.autoCut,
      autoPrintVoucher: DEFAULT_CONFIG.printers.autoPrintVoucher,
      printWaiterCopy: DEFAULT_CONFIG.printers.printWaiterCopy,
      series: { ...DEFAULT_CONFIG.printers.series },
      kitchenPrinter: { ...DEFAULT_CONFIG.printers.kitchenPrinter },
      barPrinter: { ...DEFAULT_CONFIG.printers.barPrinter },
      cashierPrinter: { ...DEFAULT_CONFIG.printers.cashierPrinter },
    });

    vi.clearAllMocks();
  });

  describe("Módulo 1: Salones y Áreas (Persistencia Prisma)", () => {
    it("debe listar los salones configurados desde la base de datos", async () => {
      const areas = await listDiningAreas();
      expect(Array.isArray(areas)).toBe(true);
      expect(areas.length).toBeGreaterThan(0);
      expect(diningAreaMock.findMany).toHaveBeenCalled();

      const main = areas.find((a) => a.name.includes("Principal"));
      expect(main).toBeDefined();
      expect(main?.level).toContain("Piso");
      expect(Array.isArray(main?.tableNumbers)).toBe(true);
    });

    it("debe auto-inicializar salones por defecto si la tabla de la BD está vacía", async () => {
      setInMemoryAreas([]);
      const areas = await listDiningAreas();
      expect(diningAreaMock.createMany).toHaveBeenCalled();
      expect(areas.length).toBe(DEFAULT_CONFIG.areas.length);
    });

    it("debe permitir registrar un nuevo salón en la base de datos con nivel y color distintivo", async () => {
      const newArea: DiningArea = {
        id: "area-test-terraza",
        name: "Terraza Panorámica Test",
        level: "Piso 3",
        description: "Mesas al aire libre con vista a la ciudad",
        tableNumbers: [15, 16],
        active: true,
        color: "amber",
      };

      const updatedList = await saveDiningArea(newArea);
      expect(diningAreaMock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "area-test-terraza" },
          create: expect.objectContaining({
            id: "area-test-terraza",
            name: "Terraza Panorámica Test",
            tableNumbers: [15, 16],
          }),
        })
      );

      const saved = updatedList.find((a) => a.id === "area-test-terraza");
      expect(saved).toBeDefined();
      expect(saved?.name).toBe("Terraza Panorámica Test");
      expect(saved?.tableNumbers).toEqual([15, 16]);
    });

    it("debe permitir actualizar la asignación de mesas a un salón existente en la BD", async () => {
      await saveDiningArea({
        id: "area-test-terraza",
        name: "Terraza Panorámica Test",
        level: "Piso 3",
        description: "Mesas al aire libre",
        tableNumbers: [15, 16],
        active: true,
      });

      const all = await listDiningAreas();
      const area = all.find((a) => a.id === "area-test-terraza");
      expect(area).toBeDefined();

      const updated = await saveDiningArea({
        ...area!,
        tableNumbers: [15, 16, 17, 18],
      });

      const found = updated.find((a) => a.id === "area-test-terraza");
      expect(found?.tableNumbers).toEqual([15, 16, 17, 18]);
      expect(found?.tableNumbers.length).toBe(4);
    });

    it("debe permitir eliminar un salón de la base de datos de forma segura", async () => {
      await saveDiningArea({
        id: "area-test-terraza",
        name: "Terraza Panorámica Test",
        level: "Piso 3",
        description: "Mesas al aire libre",
        tableNumbers: [15, 16],
        active: true,
      });

      const listAfterDelete = await deleteDiningArea("area-test-terraza");
      expect(diningAreaMock.delete).toHaveBeenCalledWith({
        where: { id: "area-test-terraza" },
      });

      const exists = listAfterDelete.some((a) => a.id === "area-test-terraza");
      expect(exists).toBe(false);
    });
  });

  describe("Módulo 2: Datos del Restaurante / Empresa", () => {
    it("debe retornar la identidad fiscal y comercial oficial", async () => {
      const config = await getRestaurantGlobalConfig();
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

  describe("Módulo 3: Comprobantes, Series e Impresoras Térmicas (Persistencia Prisma)", () => {
    it("debe leer la configuración de impresoras y series desde Prisma", async () => {
      const config = await getPrinterConfig();
      expect(printerConfigMock.findUnique).toHaveBeenCalled();
      expect(config.series.boleta).toMatch(/^B\d{3}$/);
      expect(config.series.factura).toMatch(/^F\d{3}$/);
      expect(config.series.ticket).toMatch(/^T\d{3}$/);
      expect(config.paperWidth).toMatch(/^(80mm|58mm)$/);
    });

    it("debe auto-crear configuración por defecto si no existe en la base de datos", async () => {
      setInMemoryPrinterConfig(null);
      const config = await getPrinterConfig();
      expect(printerConfigMock.create).toHaveBeenCalled();
      expect(config.paperWidth).toBe("80mm");
      expect(config.kitchenPrinter.active).toBe(true);
    });

    it("debe permitir actualizar parámetros de comanderas y auto-corte de papel en la BD", async () => {
      const updated = await updatePrinterConfig({
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

      expect(printerConfigMock.upsert).toHaveBeenCalled();
      expect(updated.paperWidth).toBe("80mm");
      expect(updated.autoCut).toBe(true);
      expect(updated.kitchenPrinter.name).toBe("Comandera Térmica Cocina Central");
      expect(updated.kitchenPrinter.active).toBe(true);
    });

    it("debe permitir alternar el ancho de papel entre 80mm y 58mm persistiendo en la BD", async () => {
      const config58 = await updatePrinterConfig({ paperWidth: "58mm" });
      expect(config58.paperWidth).toBe("58mm");

      const config80 = await updatePrinterConfig({ paperWidth: "80mm" });
      expect(config80.paperWidth).toBe("80mm");
    });
  });

  describe("Módulo 4: getRestaurantGlobalConfig Consolidado", () => {
    it("debe consolidar información del restaurante, salones de Prisma e impresoras de Prisma", async () => {
      const globalConfig = await getRestaurantGlobalConfig();

      expect(globalConfig.restaurant).toBeDefined();
      expect(globalConfig.restaurant.ruc).toBe("20608976543");
      expect(Array.isArray(globalConfig.areas)).toBe(true);
      expect(globalConfig.areas.length).toBeGreaterThan(0);
      expect(globalConfig.printers).toBeDefined();
      expect(globalConfig.printers.paperWidth).toBe("80mm");
    });
  });
});
