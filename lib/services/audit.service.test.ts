import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  create: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { auditLog: { create: m.create, count: m.count, findMany: m.findMany } },
}));

import { buildFilter, listAudit, logAudit, sanitizeDetails } from "./audit.service";

beforeEach(() => vi.clearAllMocks());

describe("registrarAuditoria", () => {
  it("guarda usuario, acción, módulo, entidad y detalle", async () => {
    await logAudit({
      actor: { userId: 3, username: "andy" },
      action: "CREATE",
      module: "Usuarios",
      entity: "Usuario",
      entityId: 9,
      description: "Creó el usuario ana",
      details: { after: { username: "ana" } },
      ipAddress: "10.0.0.1",
    });
    expect(m.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 3,
        username: "andy",
        action: "CREATE",
        module: "Usuarios",
        entity: "Usuario",
        entityId: "9",
        ipAddress: "10.0.0.1",
        details: { after: { username: "ana" } },
      }),
    });
  });

  it("usa 'sistema' sin actor y no lanza si la BD falla", async () => {
    m.create.mockRejectedValueOnce(new Error("db caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      logAudit({ actor: null, action: "LOGIN_FAILED", module: "Seguridad", entity: "Sesión", description: "x" }),
    ).resolves.toBeUndefined();
    m.create.mockResolvedValueOnce({});
    await logAudit({ actor: null, action: "LOGOUT", module: "Seguridad", entity: "Sesión", description: "x" });
    expect(m.create.mock.calls[1][0].data.username).toBe("sistema");
  });
});

describe("sanearDetalles", () => {
  it("oculta contraseñas y tokens", () => {
    expect(sanitizeDetails({ password: "abc", nested: { token: "t", ok: 1 } })).toEqual({
      password: "[oculto]",
      nested: { token: "[oculto]", ok: 1 },
    });
  });
});

describe("construirFiltro", () => {
  it("incluye el día 'hasta' completo", () => {
    const w = buildFilter({ from: "2026-10-01", to: "2026-10-02" });
    expect(w.createdAt).toEqual({
      gte: new Date("2026-10-01T00:00:00.000Z"),
      lt: new Date("2026-10-03T00:00:00.000Z"),
    });
  });

  it("ignora acciones inválidas y filtra por usuario y módulo", () => {
    const w = buildFilter({ action: "HACK", user: " andy ", module: "Usuarios" });
    expect(w.action).toBeUndefined();
    expect(w.username).toEqual({ contains: "andy", mode: "insensitive" });
    expect(w.module).toBe("Usuarios");
  });
});

describe("listarAuditoria", () => {
  it("pagina y mapea filas", async () => {
    m.count.mockResolvedValue(45);
    m.findMany.mockResolvedValue([
      {
        id: 1,
        createdAt: new Date("2026-10-07T10:00:00Z"),
        userId: 3,
        username: "andy",
        action: "UPDATE",
        module: "Usuarios",
        entity: "Usuario",
        entityId: "9",
        description: "d",
        details: null,
        ipAddress: null,
      },
    ]);
    const r = await listAudit({ page: 2, perPage: 20 });
    expect(m.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }));
    expect(r.totalPages).toBe(3);
    expect(r.data[0]).toMatchObject({ user: "andy", action: "UPDATE", date: "2026-10-07T10:00:00.000Z" });
  });
});