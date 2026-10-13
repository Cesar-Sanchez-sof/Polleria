import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  create: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { auditLog: { create: m.create, count: m.count, findMany: m.findMany } },
}));

import { construirFiltro, listarAuditoria, registrarAuditoria, sanearDetalles } from "./audit.service";

beforeEach(() => vi.clearAllMocks());

describe("registrarAuditoria", () => {
  it("guarda usuario, acción, módulo, entidad y detalle", async () => {
    await registrarAuditoria({
      actor: { userId: 3, username: "andy" },
      action: "CREATE",
      module: "Usuarios",
      entity: "Usuario",
      entityId: 9,
      description: "Creó el usuario ana",
      details: { despues: { username: "ana" } },
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
        details: { despues: { username: "ana" } },
      }),
    });
  });

  it("usa 'sistema' sin actor y no lanza si la BD falla", async () => {
    m.create.mockRejectedValueOnce(new Error("db caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      registrarAuditoria({ actor: null, action: "LOGIN_FAILED", module: "Seguridad", entity: "Sesión", description: "x" }),
    ).resolves.toBeUndefined();
    m.create.mockResolvedValueOnce({});
    await registrarAuditoria({ actor: null, action: "LOGOUT", module: "Seguridad", entity: "Sesión", description: "x" });
    expect(m.create.mock.calls[1][0].data.username).toBe("sistema");
  });
});

describe("sanearDetalles", () => {
  it("oculta contraseñas y tokens", () => {
    expect(sanearDetalles({ password: "abc", anidado: { token: "t", ok: 1 } })).toEqual({
      password: "[oculto]",
      anidado: { token: "[oculto]", ok: 1 },
    });
  });
});

describe("construirFiltro", () => {
  it("incluye el día 'hasta' completo", () => {
    const w = construirFiltro({ desde: "2026-10-01", hasta: "2026-10-02" });
    expect(w.createdAt).toEqual({
      gte: new Date("2026-10-01T00:00:00.000Z"),
      lt: new Date("2026-10-03T00:00:00.000Z"),
    });
  });

  it("ignora acciones inválidas y filtra por usuario y módulo", () => {
    const w = construirFiltro({ accion: "HACK", usuario: " andy ", modulo: "Usuarios" });
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
    const r = await listarAuditoria({ pagina: 2, porPagina: 20 });
    expect(m.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }));
    expect(r.totalPaginas).toBe(3);
    expect(r.datos[0]).toMatchObject({ usuario: "andy", accion: "UPDATE", fecha: "2026-10-07T10:00:00.000Z" });
  });
});