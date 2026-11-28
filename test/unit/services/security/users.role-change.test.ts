import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userCount: vi.fn(),
  userUpdate: vi.fn(),
  employeeFindFirst: vi.fn(),
  employeeUpdate: vi.fn(),
  logAudit: vi.fn(),
  invalidate: vi.fn(),
  verifyModifiableUser: vi.fn(),
  verifyAssignableRole: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const db = {
    user: { findUnique: m.userFindUnique, findFirst: m.userFindFirst, count: m.userCount, update: m.userUpdate },
    employee: { findFirst: m.employeeFindFirst, update: m.employeeUpdate },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { prisma: db };
});
vi.mock("@/lib/services/security/audit.service", () => ({ logAudit: m.logAudit }));
vi.mock("@/lib/auth/auth-cache", () => ({ resolveWithAuthCache: vi.fn(), invalidateAuthCache: m.invalidate }));
vi.mock("@/lib/services/security/roles.service", () => ({
  verifyModifiableUser: m.verifyModifiableUser,
  verifyAssignableRole: m.verifyAssignableRole,
}));

import { updateUserWithAudit, type UserData } from "@/lib/services/security/users.service";

const data = (roleId: number): UserData => ({
  first_name: "Luis",
  paternal_last_name: "Quispe",
  dni: "70000010",
  email: "luis@correo.com",
  username: "luis.q",
  role_id: roleId,
});

const actor = { userId: 1, username: "admin" };

/** Estado previo del usuario 7: cocinero (rol 5, no es de sistema). */
function setCurrent(role: { roleId: number; name: string; isSystem: boolean }) {
  m.userFindUnique.mockImplementation(async (args: { select?: Record<string, unknown> }) =>
    args.select && "roleId" in args.select
      ? { roleId: role.roleId, role: { name: role.name, isSystem: role.isSystem } }
      : { employeeId: 3 },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  m.userFindFirst.mockResolvedValue(null);
  m.employeeFindFirst.mockResolvedValue(null);
  m.userCount.mockResolvedValue(2);
  m.userUpdate.mockImplementation(async ({ data: d }: { data: { roleId: number } }) => ({
    id: 7,
    username: "luis.q",
    email: "luis@correo.com",
    active: true,
    role: { id: d.roleId, name: d.roleId === 6 ? "CAJERO" : "COCINERO" },
    employee: { id: 3, dni: "70000010", firstName: "Luis", paternalLastName: "Quispe" },
  }));
  setCurrent({ roleId: 5, name: "COCINERO", isSystem: false });
});

describe("cambio de rol de un usuario", () => {
  it("un administrador cambia el rol de cocinero a cajero y queda auditado con el rol anterior y el nuevo", async () => {
    const updated = await updateUserWithAudit({ id: 7, data: data(6), actor, superuser: true });
    expect(updated.role.name).toBe("CAJERO");
    expect(m.userUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ roleId: 6 }) }));
    expect(m.invalidate).toHaveBeenCalledWith(7); // los permisos nuevos rigen en la siguiente petición
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Cambió el rol del usuario luis.q de COCINERO a CAJERO",
        details: expect.objectContaining({ before: { role: "COCINERO" }, roleChanged: true }),
      }),
    );
  });

  it("quien no es administrador no puede cambiar el rol, aunque tenga usuarios.editar", async () => {
    await expect(updateUserWithAudit({ id: 7, data: data(6), actor: { userId: 2, username: "gestor" }, superuser: false })).rejects.toMatchObject({
      status: 403,
      message: "Solo un administrador puede cambiar el rol de un usuario",
    });
    expect(m.userUpdate).not.toHaveBeenCalled();
  });

  it("quien no es administrador sí puede editar otros datos si el rol no cambia", async () => {
    await updateUserWithAudit({ id: 7, data: data(5), actor: { userId: 2, username: "gestor" }, superuser: false });
    expect(m.userUpdate).toHaveBeenCalled();
    expect(m.logAudit).toHaveBeenCalledWith(expect.objectContaining({ description: "Modificó el usuario luis.q" }));
  });

  it("nadie cambia su propio rol", async () => {
    await expect(updateUserWithAudit({ id: 1, data: data(6), actor, superuser: true })).rejects.toMatchObject({
      status: 403,
      message: "No puedes cambiar tu propio rol",
    });
    expect(m.userUpdate).not.toHaveBeenCalled();
  });

  it("no se le quita el rol de sistema al único administrador activo", async () => {
    setCurrent({ roleId: 1, name: "ADMIN", isSystem: true });
    m.userCount.mockResolvedValue(0);
    await expect(updateUserWithAudit({ id: 7, data: data(6), actor, superuser: true })).rejects.toMatchObject({ status: 409 });
    expect(m.userUpdate).not.toHaveBeenCalled();
  });

  it("sí se le quita el rol de sistema a un administrador si queda otro activo", async () => {
    setCurrent({ roleId: 1, name: "ADMIN", isSystem: true });
    m.userCount.mockResolvedValue(1);
    await updateUserWithAudit({ id: 7, data: data(6), actor, superuser: true });
    expect(m.userUpdate).toHaveBeenCalled();
  });

  it("un usuario inexistente responde 404", async () => {
    m.userFindUnique.mockResolvedValue(null);
    await expect(updateUserWithAudit({ id: 99, data: data(6), actor, superuser: true })).rejects.toMatchObject({ status: 404 });
  });
});
