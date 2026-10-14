import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  usuarioFindUnique: vi.fn(),
  sesionActual: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: m.usuarioFindUnique } } }));
vi.mock("@/lib/auth/sesion-actual", () => ({ sesionActual: m.sesionActual }));

// El setup global sustituye "@/lib/auth/permisos"; aquí se prueba la implementación real.
const permisos = await vi.importActual<typeof import("./permisos")>("./permisos");

const sesion = { idUsuario: 7, username: "ana", rol: "CAJERO" };

function usuario(codigos: string[], opciones: { estado?: boolean; activo?: boolean; sistema?: boolean } = {}) {
  return {
    estado: opciones.estado ?? true,
    role: {
      active: opciones.activo ?? true,
      isSystem: opciones.sistema ?? false,
      permissions: codigos.map((code) => ({ permission: { code } })),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.sesionActual.mockResolvedValue(sesion);
});

describe("autorizar", () => {
  it("responde 401 si no hay sesión", async () => {
    m.sesionActual.mockResolvedValue(null);
    const r = await permisos.autorizar("ventas.ver");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.respuesta.status).toBe(401);
  });

  it("permite cuando el rol tiene el permiso", async () => {
    m.usuarioFindUnique.mockResolvedValue(usuario(["ventas.ver"]));
    const r = await permisos.autorizar("ventas.ver");
    expect(r.ok).toBe(true);
  });

  it("responde 403 cuando el rol no tiene el permiso", async () => {
    m.usuarioFindUnique.mockResolvedValue(usuario(["ventas.ver"]));
    const r = await permisos.autorizar("ventas.crear");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.respuesta.status).toBe(403);
  });

  it("con una lista basta tener uno de los permisos", async () => {
    m.usuarioFindUnique.mockResolvedValue(usuario(["cocina.ver"]));
    expect((await permisos.autorizar(["pedidos.ver", "cocina.ver"])).ok).toBe(true);
    expect((await permisos.autorizar(["pedidos.ver", "ventas.ver"])).ok).toBe(false);
  });

  it("el rol de sistema (ADMIN) tiene todos los permisos", async () => {
    m.usuarioFindUnique.mockResolvedValue(usuario([], { sistema: true }));
    const r = await permisos.autorizar("roles.eliminar");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.superusuario).toBe(true);
  });

  it("niega todo si el rol está desactivado, aunque sea de sistema", async () => {
    m.usuarioFindUnique.mockResolvedValue(usuario(["ventas.ver"], { activo: false }));
    expect((await permisos.autorizar("ventas.ver")).ok).toBe(false);
  });

  it("niega todo si el usuario está desactivado", async () => {
    m.usuarioFindUnique.mockResolvedValue(usuario(["ventas.ver"], { estado: false }));
    expect((await permisos.autorizar("ventas.ver")).ok).toBe(false);
  });

  it("niega todo si el usuario ya no existe", async () => {
    m.usuarioFindUnique.mockResolvedValue(null);
    expect((await permisos.autorizar("ventas.ver")).ok).toBe(false);
  });
});

describe("exigirPermiso (server actions)", () => {
  it("devuelve la sesión cuando hay permiso", async () => {
    m.usuarioFindUnique.mockResolvedValue(usuario(["compras.crear"]));
    await expect(permisos.exigirPermiso("compras.crear")).resolves.toEqual(sesion);
  });

  it("lanza error sin permiso", async () => {
    m.usuarioFindUnique.mockResolvedValue(usuario([]));
    await expect(permisos.exigirPermiso("compras.crear")).rejects.toThrow("No tienes permiso");
  });

  it("lanza error sin sesión", async () => {
    m.sesionActual.mockResolvedValue(null);
    await expect(permisos.exigirPermiso("compras.crear")).rejects.toThrow("No autenticado");
  });
});