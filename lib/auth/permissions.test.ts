import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  currentSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: m.userFindUnique } } }));
vi.mock("@/lib/auth/current-session", () => ({ currentSession: m.currentSession }));

// El setup global sustituye "@/lib/auth/permissions"; aquí se prueba la implementación real.
const permissions = await vi.importActual<typeof import("./permissions")>("./permissions");

const session = { userId: 7, username: "ana", role: "CAJERO" };

function user(codes: string[], options: { userActive?: boolean; roleActive?: boolean; system?: boolean } = {}) {
  return {
    active: options.userActive ?? true,
    role: {
      active: options.roleActive ?? true,
      isSystem: options.system ?? false,
      permissions: codes.map((code) => ({ permission: { code } })),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.currentSession.mockResolvedValue(session);
});

describe("autorizar", () => {
  it("responde 401 si no hay sesión", async () => {
    m.currentSession.mockResolvedValue(null);
    const r = await permissions.authorize("ventas.ver");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("permite cuando el rol tiene el permiso", async () => {
    m.userFindUnique.mockResolvedValue(user(["ventas.ver"]));
    const r = await permissions.authorize("ventas.ver");
    expect(r.ok).toBe(true);
  });

  it("responde 403 cuando el rol no tiene el permiso", async () => {
    m.userFindUnique.mockResolvedValue(user(["ventas.ver"]));
    const r = await permissions.authorize("ventas.crear");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  it("con una lista basta tener uno de los permisos", async () => {
    m.userFindUnique.mockResolvedValue(user(["cocina.ver"]));
    expect((await permissions.authorize(["pedidos.ver", "cocina.ver"])).ok).toBe(true);
    expect((await permissions.authorize(["pedidos.ver", "ventas.ver"])).ok).toBe(false);
  });

  it("el rol de sistema (ADMIN) tiene todos los permisos", async () => {
    m.userFindUnique.mockResolvedValue(user([], { system: true }));
    const r = await permissions.authorize("roles.eliminar");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.superuser).toBe(true);
  });

  it("niega todo si el rol está desactivado, aunque sea de sistema", async () => {
    m.userFindUnique.mockResolvedValue(user(["ventas.ver"], { roleActive: false }));
    expect((await permissions.authorize("ventas.ver")).ok).toBe(false);
  });

  it("niega todo si el usuario está desactivado", async () => {
    m.userFindUnique.mockResolvedValue(user(["ventas.ver"], { userActive: false }));
    expect((await permissions.authorize("ventas.ver")).ok).toBe(false);
  });

  it("niega todo si el usuario ya no existe", async () => {
    m.userFindUnique.mockResolvedValue(null);
    expect((await permissions.authorize("ventas.ver")).ok).toBe(false);
  });
});

describe("exigirPermiso (server actions)", () => {
  it("devuelve la sesión cuando hay permiso", async () => {
    m.userFindUnique.mockResolvedValue(user(["compras.crear"]));
    await expect(permissions.requirePermission("compras.crear")).resolves.toEqual(session);
  });

  it("lanza error sin permiso", async () => {
    m.userFindUnique.mockResolvedValue(user([]));
    await expect(permissions.requirePermission("compras.crear")).rejects.toThrow("No tienes permiso");
  });

  it("lanza error sin sesión", async () => {
    m.currentSession.mockResolvedValue(null);
    await expect(permissions.requirePermission("compras.crear")).rejects.toThrow("No autenticado");
  });
});