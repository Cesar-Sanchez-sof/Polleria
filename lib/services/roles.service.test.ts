import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  roleCreate: vi.fn(),
  roleFindUnique: vi.fn(),
  roleUpdate: vi.fn(),
  roleDelete: vi.fn(),
  permissionFindMany: vi.fn(),
  rpDeleteMany: vi.fn(),
  rpCreateMany: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const db = {
    role: { create: m.roleCreate, findUnique: m.roleFindUnique, update: m.roleUpdate, delete: m.roleDelete },
    permission: { findMany: m.permissionFindMany },
    rolePermission: { deleteMany: m.rpDeleteMany, createMany: m.rpCreateMany },
    user: { findUnique: m.userFindUnique },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { prisma: db };
});

import {
  actualizarRol,
  crearRol,
  eliminarRol,
  verificarRolAsignable,
  verificarUsuarioModificable,
} from "./roles.service";

function rolConRelaciones(extra: Partial<{ id: number; name: string; isSystem: boolean; active: boolean; users: number }> = {}) {
  return {
    id: extra.id ?? 5,
    name: extra.name ?? "SUPERVISOR",
    description: null,
    active: extra.active ?? true,
    isSystem: extra.isSystem ?? false,
    _count: { users: extra.users ?? 0 },
    permissions: [{ permission: { code: "pedidos.ver" } }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.permissionFindMany.mockImplementation(async ({ where }: { where: { code: { in: string[] } } }) =>
    where.code.in.map((_, i) => ({ id: i + 1 })),
  );
  m.roleCreate.mockResolvedValue({ id: 5 });
  m.roleFindUnique.mockResolvedValue(rolConRelaciones());
});

describe("crearRol", () => {
  it("normaliza el nombre a mayúsculas y guarda los permisos", async () => {
    await crearRol({ nombre: "  supervisor  de sala ", permisos: ["pedidos.ver"] });
    expect(m.roleCreate.mock.calls[0][0].data.name).toBe("SUPERVISOR DE SALA");
    expect(m.rpCreateMany).toHaveBeenCalledTimes(1);
  });

  it("agrega 'ver' cuando se da crear, editar o eliminar en un módulo", async () => {
    await crearRol({ nombre: "SUPERVISOR", permisos: ["ventas.crear"] });
    const consultados: string[] = m.permissionFindMany.mock.calls[0][0].where.code.in;
    expect(consultados.sort()).toEqual(["ventas.crear", "ventas.ver"]);
  });

  it("rechaza permisos que no están en el catálogo", async () => {
    await expect(crearRol({ nombre: "SUPERVISOR", permisos: ["ventas.hackear"] })).rejects.toThrow("Permiso desconocido");
    expect(m.roleCreate).not.toHaveBeenCalled();
  });

  it("rechaza nombres inválidos", async () => {
    await expect(crearRol({ nombre: "ab", permisos: [] })).rejects.toThrow("nombre del rol");
    await expect(crearRol({ nombre: "<script>", permisos: [] })).rejects.toThrow("nombre del rol");
  });

  it("rechaza permisos que no son una lista", async () => {
    await expect(crearRol({ nombre: "SUPERVISOR", permisos: "ventas.ver" as unknown as string[] })).rejects.toThrow("lista");
  });
});

describe("actualizarRol", () => {
  it("un rol de sistema no se puede renombrar ni desactivar", async () => {
    m.roleFindUnique.mockResolvedValue({ name: "ADMIN", isSystem: true, _count: { users: 1 } });
    await expect(actualizarRol(1, { nombre: "OTRO", permisos: [] })).rejects.toThrow("sistema");
    await expect(actualizarRol(1, { nombre: "ADMIN", activo: false, permisos: [] })).rejects.toThrow("sistema");
  });

  it("un rol de sistema conserva sus permisos aunque se envíen otros", async () => {
    m.roleFindUnique
      .mockResolvedValueOnce({ name: "ADMIN", isSystem: true, _count: { users: 1 } })
      .mockResolvedValue(rolConRelaciones({ name: "ADMIN", isSystem: true }));
    await actualizarRol(1, { nombre: "ADMIN", descripcion: "Todo", permisos: [] });
    expect(m.rpDeleteMany).not.toHaveBeenCalled();
    expect(m.roleUpdate).toHaveBeenCalledTimes(1);
  });

  it("no se puede desactivar un rol con usuarios asignados", async () => {
    m.roleFindUnique.mockResolvedValue({ name: "CAJERO", isSystem: false, _count: { users: 3 } });
    await expect(actualizarRol(2, { nombre: "CAJERO", activo: false, permisos: [] })).rejects.toThrow("3 usuario");
  });

  it("responde 404 si el rol no existe", async () => {
    m.roleFindUnique.mockResolvedValue(null);
    await expect(actualizarRol(99, { nombre: "SUPERVISOR", permisos: [] })).rejects.toMatchObject({ status: 404 });
  });
});

describe("eliminarRol", () => {
  it("bloquea la eliminación de un rol de sistema", async () => {
    m.roleFindUnique.mockResolvedValue(rolConRelaciones({ name: "ADMIN", isSystem: true }));
    await expect(eliminarRol(1)).rejects.toThrow("sistema");
    expect(m.roleDelete).not.toHaveBeenCalled();
  });

  it("bloquea la eliminación de un rol con usuarios (409)", async () => {
    m.roleFindUnique.mockResolvedValue(rolConRelaciones({ users: 2 }));
    await expect(eliminarRol(5)).rejects.toMatchObject({ status: 409 });
    expect(m.roleDelete).not.toHaveBeenCalled();
  });

  it("elimina un rol sin usuarios", async () => {
    await eliminarRol(5);
    expect(m.roleDelete).toHaveBeenCalledWith({ where: { id: 5 } });
  });
});

describe("conexión con usuarios", () => {
  it("no deja asignar un rol inexistente o inactivo", async () => {
    m.roleFindUnique.mockResolvedValue(null);
    await expect(verificarRolAsignable(9, true)).rejects.toThrow("inactivo");
    m.roleFindUnique.mockResolvedValue({ active: false, isSystem: false });
    await expect(verificarRolAsignable(9, true)).rejects.toThrow("inactivo");
  });

  it("solo un administrador puede asignar un rol de sistema", async () => {
    m.roleFindUnique.mockResolvedValue({ active: true, isSystem: true });
    await expect(verificarRolAsignable(1, false)).rejects.toMatchObject({ status: 403 });
    await expect(verificarRolAsignable(1, true)).resolves.toBeUndefined();
  });

  it("solo un administrador puede modificar a otro administrador", async () => {
    m.userFindUnique.mockResolvedValue({ role: { isSystem: true } });
    await expect(verificarUsuarioModificable(1, false)).rejects.toMatchObject({ status: 403 });
    await expect(verificarUsuarioModificable(1, true)).resolves.toBeUndefined();
    m.userFindUnique.mockResolvedValue({ role: { isSystem: false } });
    await expect(verificarUsuarioModificable(2, false)).resolves.toBeUndefined();
  });
});