import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dashboardSectionFindMany: vi.fn(),
  dashboardSectionCreate: vi.fn(),
  dashboardFindMany: vi.fn(),
  dashboardFindUnique: vi.fn(),
  dashboardCreate: vi.fn(),
  dashboardWidgetDeleteMany: vi.fn(),
  dashboardWidgetCreateMany: vi.fn(),
  dashboardWidgetFindMany: vi.fn(),
  dashboardShareCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dashboardSection: {
      findMany: mocks.dashboardSectionFindMany,
      create: mocks.dashboardSectionCreate,
    },
    dashboard: {
      findMany: mocks.dashboardFindMany,
      findUnique: mocks.dashboardFindUnique,
      create: mocks.dashboardCreate,
    },
    dashboardWidget: {
      deleteMany: mocks.dashboardWidgetDeleteMany,
      createMany: mocks.dashboardWidgetCreateMany,
      findMany: mocks.dashboardWidgetFindMany,
    },
    dashboardShare: {
      create: mocks.dashboardShareCreate,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  getSections,
  createSection,
  getDashboards,
  createDashboard,
  getDashboardById,
  updateDashboardWidgets,
  createShareLink,
} from "./dashboard.service";

describe("Dashboard Service (Módulo de Tableros)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSections", () => {
    it("devuelve las secciones ordenadas por order asc", async () => {
      const mockSections = [
        { id: "s1", name: "Ventas", order: 1 },
        { id: "s2", name: "Operaciones", order: 2 },
      ];
      mocks.dashboardSectionFindMany.mockResolvedValue(mockSections);

      const result = await getSections();
      expect(result).toEqual(mockSections);
      expect(mocks.dashboardSectionFindMany).toHaveBeenCalledWith({
        orderBy: { order: "asc" },
      });
    });

    it("maneja y propaga errores con try/catch", async () => {
      mocks.dashboardSectionFindMany.mockRejectedValue(new Error("DB error"));
      await expect(getSections()).rejects.toThrow("DB error");
    });
  });

  describe("createSection", () => {
    it("crea una nueva sección correctamente", async () => {
      const created = { id: "s1", name: "Finanzas", order: 0 };
      mocks.dashboardSectionCreate.mockResolvedValue(created);

      const result = await createSection("Finanzas");
      expect(result).toEqual(created);
      expect(mocks.dashboardSectionCreate).toHaveBeenCalledWith({
        data: { name: "Finanzas" },
      });
    });

    it("crea una sección con orden explícito", async () => {
      const created = { id: "s1", name: "Finanzas", order: 5 };
      mocks.dashboardSectionCreate.mockResolvedValue(created);

      const result = await createSection("Finanzas", 5);
      expect(result).toEqual(created);
      expect(mocks.dashboardSectionCreate).toHaveBeenCalledWith({
        data: { name: "Finanzas", order: 5 },
      });
    });

    it("maneja errores con try/catch al crear", async () => {
      mocks.dashboardSectionCreate.mockRejectedValue(new Error("Unique constraint"));
      await expect(createSection("Finanzas")).rejects.toThrow("Unique constraint");
    });
  });

  describe("getDashboards", () => {
    it("devuelve los tableros incluyendo su sección", async () => {
      const mockDashboards = [
        { id: "d1", name: "Principal", section: { id: "s1", name: "Ventas" } },
      ];
      mocks.dashboardFindMany.mockResolvedValue(mockDashboards);

      const result = await getDashboards();
      expect(result).toEqual(mockDashboards);
      expect(mocks.dashboardFindMany).toHaveBeenCalledWith({
        include: { section: true },
        orderBy: { createdAt: "desc" },
      });
    });

    it("maneja errores con try/catch al consultar tableros", async () => {
      mocks.dashboardFindMany.mockRejectedValue(new Error("Connection failed"));
      await expect(getDashboards()).rejects.toThrow("Connection failed");
    });
  });

  describe("createDashboard", () => {
    it("crea un tablero con sus campos y relaciones", async () => {
      const input = {
        name: "Tablero de Ventas",
        sectionId: "sec-123",
        accessGroups: ["admin", "manager"],
        allowedUsers: ["user1@mail.com"],
        isPublished: true,
        createdById: 10,
      };
      const created = { id: "dash-1", ...input, section: { id: "sec-123" } };
      mocks.dashboardCreate.mockResolvedValue(created);

      const result = await createDashboard(input);
      expect(result).toEqual(created);
      expect(mocks.dashboardCreate).toHaveBeenCalledWith({
        data: {
          name: "Tablero de Ventas",
          sectionId: "sec-123",
          accessGroups: ["admin", "manager"],
          allowedUsers: ["user1@mail.com"],
          isPublished: true,
          createdById: 10,
        },
        include: { section: true },
      });
    });

    it("usa valores por defecto para campos opcionales", async () => {
      const input = {
        name: "Borrador",
        sectionId: "sec-123",
        createdById: 10,
      };
      mocks.dashboardCreate.mockResolvedValue({ id: "dash-2" });

      await createDashboard(input);
      expect(mocks.dashboardCreate).toHaveBeenCalledWith({
        data: {
          name: "Borrador",
          sectionId: "sec-123",
          accessGroups: [],
          allowedUsers: [],
          isPublished: false,
          createdById: 10,
        },
        include: { section: true },
      });
    });

    it("maneja errores con try/catch al crear", async () => {
      mocks.dashboardCreate.mockRejectedValue(new Error("Validation failed"));
      await expect(
        createDashboard({
          name: "Fail",
          sectionId: "sec-1",
          createdById: 1,
        })
      ).rejects.toThrow("Validation failed");
    });
  });

  describe("getDashboardById", () => {
    it("devuelve el tablero con widgets ordenados y datos de sección", async () => {
      const mockDashboard = {
        id: "dash-1",
        name: "Tablero Principal",
        section: { id: "sec-1", name: "General" },
        widgets: [
          { id: "w1", y: 0, x: 0 },
          { id: "w2", y: 0, x: 4 },
        ],
      };
      mocks.dashboardFindUnique.mockResolvedValue(mockDashboard);

      const result = await getDashboardById("dash-1");
      expect(result).toEqual(mockDashboard);
      expect(mocks.dashboardFindUnique).toHaveBeenCalledWith({
        where: { id: "dash-1" },
        include: {
          section: true,
          widgets: {
            orderBy: [{ y: "asc" }, { x: "asc" }],
          },
        },
      });
    });

    it("maneja errores con try/catch al buscar por id", async () => {
      mocks.dashboardFindUnique.mockRejectedValue(new Error("Database timeout"));
      await expect(getDashboardById("dash-1")).rejects.toThrow("Database timeout");
    });
  });

  describe("updateDashboardWidgets", () => {
    it("elimina widgets anteriores y crea los nuevos en una transacción", async () => {
      const widgetsInput = [
        {
          title: "Ventas Hoy",
          type: "stat",
          metricKey: "sales_today",
          x: 0,
          y: 0,
          w: 4,
          h: 2,
        },
        {
          title: "Gráfico de Ingresos",
          type: "chart",
          metricKey: "revenue_chart",
          x: 4,
          y: 0,
          w: 8,
          h: 4,
        },
      ];

      const createdWidgets = [
        { id: "w1", dashboardId: "dash-1", ...widgetsInput[0] },
        { id: "w2", dashboardId: "dash-1", ...widgetsInput[1] },
      ];

      mocks.transaction.mockImplementation(async (callback: any) => {
        return callback({
          dashboardWidget: {
            deleteMany: mocks.dashboardWidgetDeleteMany,
            createMany: mocks.dashboardWidgetCreateMany,
            findMany: mocks.dashboardWidgetFindMany.mockResolvedValue(createdWidgets),
          },
        });
      });

      const result = await updateDashboardWidgets("dash-1", widgetsInput);

      expect(mocks.dashboardWidgetDeleteMany).toHaveBeenCalledWith({
        where: { dashboardId: "dash-1" },
      });
      expect(mocks.dashboardWidgetCreateMany).toHaveBeenCalledWith({
        data: [
          {
            dashboardId: "dash-1",
            title: "Ventas Hoy",
            type: "stat",
            metricKey: "sales_today",
            x: 0,
            y: 0,
            w: 4,
            h: 2,
            config: undefined,
          },
          {
            dashboardId: "dash-1",
            title: "Gráfico de Ingresos",
            type: "chart",
            metricKey: "revenue_chart",
            x: 4,
            y: 0,
            w: 8,
            h: 4,
            config: undefined,
          },
        ],
      });
      expect(result).toEqual(createdWidgets);
    });

    it("maneja errores con try/catch en la transacción", async () => {
      mocks.transaction.mockRejectedValue(new Error("Transaction failed"));
      await expect(updateDashboardWidgets("dash-1", [])).rejects.toThrow("Transaction failed");
    });
  });

  describe("createShareLink", () => {
    it("crea un registro en DashboardShare con UUID y createdById", async () => {
      const createdShare = {
        id: "generated-uuid",
        name: "Compartido con Gerencia",
        dashboardId: "dash-1",
        createdById: 5,
        isActive: true,
      };
      mocks.dashboardShareCreate.mockResolvedValue(createdShare);

      const result = await createShareLink("dash-1", "Compartido con Gerencia", 5);
      expect(result).toEqual(createdShare);
      expect(mocks.dashboardShareCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Compartido con Gerencia",
          dashboardId: "dash-1",
          createdById: 5,
          isActive: true,
        }),
      });
      // Verifica que el id generado sea un string UUID válido
      const callData = mocks.dashboardShareCreate.mock.calls[0][0].data;
      expect(typeof callData.id).toBe("string");
      expect(callData.id.length).toBeGreaterThan(10);
    });

    it("maneja errores con try/catch al compartir", async () => {
      mocks.dashboardShareCreate.mockRejectedValue(new Error("User not found"));
      await expect(createShareLink("dash-1", "Link", 999)).rejects.toThrow("User not found");
    });
  });
});
