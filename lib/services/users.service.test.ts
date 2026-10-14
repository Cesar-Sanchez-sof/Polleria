import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const m = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  employeeFindFirst: vi.fn(),
  employeeCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const db = {
    user: {
      findFirst: m.userFindFirst,
      findUnique: m.userFindUnique,
      create: m.userCreate,
      update: m.userUpdate,
    },
    employee: {
      findFirst: m.employeeFindFirst,
      create: m.employeeCreate,
    },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };

  return { prisma: db };
});

import {
  authenticate,
  createUser,
  UserError,
  type UserData,
} from "./users.service";

const userData: UserData = {
  first_name: "Ana",
  paternal_last_name: "Pérez",
  dni: "12345678",
  email: "Ana@Correo.com",
  username: "Ana.Perez",
  password: "Secreta123",
  role_id: 1,
};

beforeEach(() => {
  vi.clearAllMocks();

  m.userFindFirst.mockResolvedValue(null);
  m.employeeFindFirst.mockResolvedValue(null);

  m.employeeCreate.mockResolvedValue({
    employee_id: 9,
  });

  m.userCreate.mockResolvedValue({
    user_id: 1,
    username: "ana.perez",
    email: "ana@correo.com",
    role: {
      id: 1,
      name: "Cajero",
    },
    employee: {
      id: 9,
      dni: "12345678",
      firstName: "Ana",
      lastName: "Pérez",
    },
  });
});

describe("crearUsuario", () => {
  it("guarda la contraseña como hash bcrypt y normaliza usuario y correo", async () => {
    await createUser(userData);
    const { data } = m.userCreate.mock.calls[0][0];
    expect(data.password).not.toBe("Secreta123");
    expect(await bcrypt.compare("Secreta123", data.password)).toBe(true);
    expect(data.username).toBe("ana.perez");
    expect(data.email).toBe("ana@correo.com");
  });

  it("rechaza un nombre de usuario repetido con 409", async () => {
    m.userFindFirst.mockResolvedValue({ username: "ana.perez" });
    await expect(createUser(userData)).rejects.toMatchObject({ status: 409, message: /nombre de usuario/ });
    expect(m.userCreate).not.toHaveBeenCalled();
  });

  it("rechaza un correo repetido con 409", async () => {
    m.userFindFirst.mockResolvedValue({ username: "otro" });
    await expect(createUser(userData)).rejects.toMatchObject({ status: 409, message: /correo/ });
  });

  it("rechaza un documento repetido con 409", async () => {
    m.employeeFindFirst.mockResolvedValue({ employee_id: 3 });
    await expect(createUser(userData)).rejects.toMatchObject({ status: 409, message: /documento/ });
  });

  it.each([
    ["contraseña corta", { password: "Ab1" }],
    ["contraseña sin números", { password: "sololetras" }],
    ["correo inválido", { email: "no-es-correo" }],
    ["documento inválido", { dni: "123" }],
    ["usuario con espacios", { username: "ana perez" }],
  ])("valida: %s", async (_case, change) => {
    await expect(createUser({ ...userData, ...change })).rejects.toBeInstanceOf(UserError);
    expect(m.userCreate).not.toHaveBeenCalled();
  });
});

describe("autenticar", () => {
  const hash = bcrypt.hashSync("Secreta123", 4);
  const row = (active: boolean) => ({
    id: 1,
    user_id: 1,
    username: "ana",
    password: hash,
    active,
    role: {
      id: 1,
      name: "Cajero",
    },
  });

  it("permite ingresar a un usuario activo por usuario o correo", async () => {
    m.userFindFirst.mockResolvedValue(row(true));
    await expect(authenticate("Ana", "Secreta123")).resolves.toEqual({ userId: 1, username: "ana", role: "Cajero" });
    expect(m.userUpdate).toHaveBeenCalled();
  });

  it("no deja ingresar a un usuario desactivado", async () => {
    m.userFindFirst.mockResolvedValue(row(false));
    await expect(authenticate("ana", "Secreta123")).rejects.toMatchObject({ status: 403 });
    expect(m.userUpdate).not.toHaveBeenCalled();
  });

  it("no revela que la cuenta está desactivada si la contraseña es incorrecta", async () => {
    m.userFindFirst.mockResolvedValue(row(false));
    await expect(authenticate("ana", "mala")).rejects.toMatchObject({ status: 401 });
  });

  it("rechaza usuario inexistente o contraseña incorrecta con 401", async () => {
    m.userFindFirst.mockResolvedValue(null);
    await expect(authenticate("nadie", "x")).rejects.toMatchObject({ status: 401 });
    m.userFindFirst.mockResolvedValue(row(true));
    await expect(authenticate("ana", "mala")).rejects.toMatchObject({ status: 401 });
  });
});