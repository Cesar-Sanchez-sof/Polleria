import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dashboardSectionFindMany: vi.fn(),
  dashboardSectionCreate: vi.fn(),
  dashboardSectionUpdate: vi.fn(),
  dashboardSectionDeleteMany: vi.fn(),
  dashboardFindMany: vi.fn(),
  dashboardFindUnique: vi.fn(),
  dashboardFindUniqueOrThrow: vi.fn(),
  dashboardCreate: vi.fn(),
  dashboardUpdate: vi.fn(),
  dashboardDeleteMany: vi.fn(),
  dashboardWidgetDeleteMany: vi.fn(),
  dashboardWidgetCreateMany: vi.fn(),
  dashboardWidgetFindMany: vi.fn(),
  dashboardRoleAccessCreateMany: vi.fn(),
  dashboardRoleAccessDeleteMany: vi.fn(),
  dashboardUserAccessCreateMany: vi.fn(),
  dashboardUserAccessDeleteMany: vi.fn(),
  dashboardShareFindMany: vi.fn(),
  dashboardShareCreate: vi.fn(),
  dashboardShareUpdate: vi.fn(),
  dashboardShareDeleteMany: vi.fn(),
  roleFindMany: vi.fn(),
  userFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dashboardSection: {
      findMany: mocks.dashboardSectionFindMany,
      create: mocks.dashboardSectionCreate,
      update: mocks.dashboardSectionUpdate,
      deleteMany: mocks.dashboardSectionDeleteMany,
    },
    dashboard: {
      findMany: mocks.dashboardFindMany,
      findUnique: mocks.dashboardFindUnique,
      findUniqueOrThrow: mocks.dashboardFindUniqueOrThrow,
      create: mocks.dashboardCreate,
      update: mocks.dashboardUpdate,
      deleteMany: mocks.dashboardDeleteMany,
    },
    dashboardWidget: {
      deleteMany: mocks.dashboardWidgetDeleteMany,
      createMany: mocks.dashboardWidgetCreateMany,
      findMany: mocks.dashboardWidgetFindMany,
    },
    dashboardRoleAccess: {
      createMany: mocks.dashboardRoleAccessCreateMany,
      deleteMany: mocks.dashboardRoleAccessDeleteMany,
    },
    dashboardUserAccess: {
      createMany: mocks.dashboardUserAccessCreateMany,
      deleteMany: mocks.dashboardUserAccessDeleteMany,
    },
    dashboardShare: {
      findMany: mocks.dashboardShareFindMany,
      create: mocks.dashboardShareCreate,
      update: mocks.dashboardShareUpdate,
      deleteMany: mocks.dashboardShareDeleteMany,
    },
    role: {
      findMany: mocks.roleFindMany,
    },
    user: {
      findMany: mocks.userFindMany,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  getSections,
  createSection,
  reorderSections,
  deleteSections,
  getDashboards,
  createDashboard,
  toggleDashboardPublished,
  deleteDashboards,
  getShareLinks,
  toggleShareLinkActive,
  deleteShareLinks,
  getRolesForAccess,
  getUsersForAccess,
} from "@/lib/services/settings/dashboard.service";

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
  });

  describe("reorderSections", () => {
    it("ejecuta la transacción con las actualizaciones de orden", async () => {
      mocks.transaction.mockResolvedValue([]);
      await reorderSections([
        { id: "s1", order: 1 },
        { id: "s2", order: 2 },
      ]);
      expect(mocks.transaction).toHaveBeenCalled();
    });
  });

  describe("deleteSections", () => {
    it("elimina secciones por IDs", async () => {
      mocks.dashboardSectionDeleteMany.mockResolvedValue({ count: 2 });
      const count = await deleteSections(["s1", "s2"]);
      expect(count).toBe(2);
      expect(mocks.dashboardSectionDeleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["s1", "s2"] } },
      });
    });
  });

  describe("getDashboards", () => {
    it("devuelve los tableros incluyendo sección, roleAccess y userAccess", async () => {
      const mockDashboards = [
        {
          id: "d1",
          name: "Principal",
          section: { id: "s1", name: "Ventas" },
          roleAccess: [],
          userAccess: [],
        },
      ];
      mocks.dashboardFindMany.mockResolvedValue(mockDashboards);

      const result = await getDashboards();
      expect(result).toEqual(mockDashboards);
      expect(mocks.dashboardFindMany).toHaveBeenCalledWith({
        include: {
          section: true,
          roleAccess: { include: { role: true } },
          userAccess: { include: { user: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("createDashboard", () => {
    it("crea un tablero con sus permisos de rol y usuario dentro de una transacción", async () => {
      const input = {
        name: "Tablero de Ventas",
        sectionId: "sec-123",
        createdById: 10,
        roleAccess: [{ roleId: 1, canView: true, canEdit: false }],
        userAccess: [{ userId: 2, canView: true, canEdit: true }],
      };

      const created = {
        id: "dash-1",
        ...input,
        section: { id: "sec-123" },
        roleAccess: input.roleAccess,
        userAccess: input.userAccess,
      };

      mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => {
        return callback({
          dashboard: {
            create: mocks.dashboardCreate.mockResolvedValue({ id: "dash-1" }),
            findUniqueOrThrow: mocks.dashboardFindUniqueOrThrow.mockResolvedValue(created),
          },
          dashboardRoleAccess: {
            createMany: mocks.dashboardRoleAccessCreateMany,
          },
          dashboardUserAccess: {
            createMany: mocks.dashboardUserAccessCreateMany,
          },
        });
      });

      const result = await createDashboard(input);
      expect(result).toEqual(created);
      expect(mocks.dashboardRoleAccessCreateMany).toHaveBeenCalledWith({
        data: [{ dashboardId: "dash-1", roleId: 1, canView: true, canEdit: false }],
      });
      expect(mocks.dashboardUserAccessCreateMany).toHaveBeenCalledWith({
        data: [{ dashboardId: "dash-1", userId: 2, canView: true, canEdit: true }],
      });
    });
  });

  describe("toggleDashboardPublished", () => {
    it("actualiza el estado de isPublished", async () => {
      mocks.dashboardUpdate.mockResolvedValue({ id: "d1", isPublished: true });
      const res = await toggleDashboardPublished("d1", true);
      expect(res.isPublished).toBe(true);
      expect(mocks.dashboardUpdate).toHaveBeenCalledWith({
        where: { id: "d1" },
        data: { isPublished: true },
      });
    });
  });

  describe("deleteDashboards", () => {
    it("elimina los tableros seleccionados", async () => {
      mocks.dashboardDeleteMany.mockResolvedValue({ count: 3 });
      const count = await deleteDashboards(["d1", "d2", "d3"]);
      expect(count).toBe(3);
      expect(mocks.dashboardDeleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["d1", "d2", "d3"] } },
      });
    });
  });

  describe("getShareLinks", () => {
    it("devuelve los enlaces con sección y usuario", async () => {
      const mockLinks = [
        {
          id: "uuid-1",
          name: "Link 1",
          dashboard: { name: "Ventas", section: { name: "Comercial" } },
          createdBy: { username: "admin" },
        },
      ];
      mocks.dashboardShareFindMany.mockResolvedValue(mockLinks);
      const res = await getShareLinks();
      expect(res).toEqual(mockLinks);
    });
  });

  describe("toggleShareLinkActive", () => {
    it("actualiza isActive en DashboardShare", async () => {
      mocks.dashboardShareUpdate.mockResolvedValue({ id: "uuid-1", isActive: false });
      const res = await toggleShareLinkActive("uuid-1", false);
      expect(res.isActive).toBe(false);
    });
  });

  describe("deleteShareLinks", () => {
    it("elimina enlaces compartidos", async () => {
      mocks.dashboardShareDeleteMany.mockResolvedValue({ count: 1 });
      const count = await deleteShareLinks(["uuid-1"]);
      expect(count).toBe(1);
    });
  });

  describe("getRolesForAccess y getUsersForAccess", () => {
    it("obtiene la lista de roles formateada", async () => {
      mocks.roleFindMany.mockResolvedValue([
        { id: 1, name: "Admin", description: "All" },
      ]);
      const roles = await getRolesForAccess();
      expect(roles).toHaveLength(1);
      expect(roles[0].name).toBe("Admin");
    });

    it("obtiene la lista de usuarios con fullName", async () => {
      mocks.userFindMany.mockResolvedValue([
        {
          id: 1,
          username: "admin",
          email: "admin@erp.com",
          employee: { firstName: "Carlos", paternalLastName: "Gómez" },
        },
      ]);
      const users = await getUsersForAccess();
      expect(users).toHaveLength(1);
      expect(users[0].fullName).toBe("Carlos Gómez");
    });
  });
});
