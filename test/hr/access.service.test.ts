import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  userCreate: vi.fn(),
  employeeFindUnique: vi.fn(),
  verifyRole: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const db = {
    user: { findFirst: m.userFindFirst, create: m.userCreate },
    employee: { findUnique: m.employeeFindUnique },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { prisma: db };
});
vi.mock("@/lib/services/security/roles.service", () => ({ verifyAssignableRole: m.verifyRole }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: async (p: string) => `hash(${p})` }));

import { grantAccess, prepareAccess } from "@/lib/services/hr/access.service";

const valid = { username: " RQuispe ", email: "Rosa@Demo.pe", role_id: 3, password: "Clave2026" };

beforeEach(() => {
  vi.clearAllMocks();
  m.userFindFirst.mockResolvedValue(null);
  m.userCreate.mockImplementation(({ data }) => Promise.resolve({ id: 9, username: data.username, email: data.email, role: { name: "CAJERO" } }));
  m.employeeFindUnique.mockResolvedValue({ active: true });
  m.verifyRole.mockResolvedValue(undefined);
});

describe("acceso al sistema del trabajador", () => {
  it("normaliza usuario y correo, valida la contraseña y la cifra", async () => {
    const a = await prepareAccess(valid, false);
    expect(a).toEqual({ username: "rquispe", email: "rosa@demo.pe", roleId: 3, password: "hash(Clave2026)" });
  });

  it.each([
    [{ username: "ab" }, "3 a 20"],
    [{ email: "rosa@" }, "correo"],
    [{ password: "corta1" }, "8 caracteres"],
    [{ password: "sololetras" }, "8 caracteres"],
  ])("rechaza %j", async (override, message) => {
    await expect(prepareAccess({ ...valid, ...override }, false)).rejects.toThrow(message);
  });

  it("solo un administrador asigna un rol de sistema (regla de Usuarios)", async () => {
    m.verifyRole.mockRejectedValue(new Error("Solo un administrador puede asignar un rol de sistema"));
    await expect(prepareAccess(valid, false)).rejects.toThrow("rol de sistema");
  });

  it("crea el usuario vinculado al empleado existente", async () => {
    const u = await grantAccess(7, valid, false);
    expect(u).toEqual({ user_id: 9, username: "rquispe", email: "rosa@demo.pe", role: "CAJERO" });
    expect(m.userCreate.mock.calls[0][0].data).toMatchObject({ employeeId: 7, roleId: 3, active: true });
  });

  it("un empleado tiene un solo usuario y no se repiten usuario ni correo", async () => {
    m.userFindFirst.mockResolvedValueOnce({ username: "rosa1" });
    await expect(grantAccess(7, valid, false)).rejects.toThrow("ya tiene el usuario «rosa1»");
    m.userFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ username: "rquispe" });
    await expect(grantAccess(7, valid, false)).rejects.toMatchObject({ status: 409 });
    expect(m.userCreate).not.toHaveBeenCalled();
  });

  it("no da acceso a un trabajador cesado", async () => {
    m.employeeFindUnique.mockResolvedValue({ active: false });
    await expect(grantAccess(7, valid, false)).rejects.toThrow("cesado");
  });
});
