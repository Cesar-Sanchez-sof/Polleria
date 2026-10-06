import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const m = vi.hoisted(() => ({
  usuarioFindFirst: vi.fn(),
  usuarioFindUnique: vi.fn(),
  usuarioCreate: vi.fn(),
  usuarioUpdate: vi.fn(),
  empleadoFindFirst: vi.fn(),
  empleadoCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const db = {
    usuario: {
      findFirst: m.usuarioFindFirst,
      findUnique: m.usuarioFindUnique,
      create: m.usuarioCreate,
      update: m.usuarioUpdate,
    },
    empleado: { findFirst: m.empleadoFindFirst, create: m.empleadoCreate },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { prisma: db };
});

import { autenticar, crearUsuario, ErrorUsuario, type DatosUsuario } from "./usuarios.service";

const datos: DatosUsuario = {
  primer_nombre: "Ana",
  apellido_paterno: "Pérez",
  dni: "12345678",
  correo: "Ana@Correo.com",
  username: "Ana.Perez",
  password: "Secreta123",
  id_rol: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.usuarioFindFirst.mockResolvedValue(null);
  m.empleadoFindFirst.mockResolvedValue(null);
  m.empleadoCreate.mockResolvedValue({ id_empleado: 9 });
  m.usuarioCreate.mockResolvedValue({ id_usuario: 1 });
});

describe("crearUsuario", () => {
  it("guarda la contraseña como hash bcrypt y normaliza usuario y correo", async () => {
    await crearUsuario(datos);
    const { data } = m.usuarioCreate.mock.calls[0][0];
    expect(data.password).not.toBe("Secreta123");
    expect(await bcrypt.compare("Secreta123", data.password)).toBe(true);
    expect(data.username).toBe("ana.perez");
    expect(data.correo).toBe("ana@correo.com");
  });

  it("rechaza un nombre de usuario repetido con 409", async () => {
    m.usuarioFindFirst.mockResolvedValue({ username: "ana.perez" });
    await expect(crearUsuario(datos)).rejects.toMatchObject({ status: 409, message: /nombre de usuario/ });
    expect(m.usuarioCreate).not.toHaveBeenCalled();
  });

  it("rechaza un correo repetido con 409", async () => {
    m.usuarioFindFirst.mockResolvedValue({ username: "otro" });
    await expect(crearUsuario(datos)).rejects.toMatchObject({ status: 409, message: /correo/ });
  });

  it("rechaza un documento repetido con 409", async () => {
    m.empleadoFindFirst.mockResolvedValue({ id_empleado: 3 });
    await expect(crearUsuario(datos)).rejects.toMatchObject({ status: 409, message: /documento/ });
  });

  it.each([
    ["contraseña corta", { password: "Ab1" }],
    ["contraseña sin números", { password: "sololetras" }],
    ["correo inválido", { correo: "no-es-correo" }],
    ["documento inválido", { dni: "123" }],
    ["usuario con espacios", { username: "ana perez" }],
  ])("valida: %s", async (_caso, cambio) => {
    await expect(crearUsuario({ ...datos, ...cambio })).rejects.toBeInstanceOf(ErrorUsuario);
    expect(m.usuarioCreate).not.toHaveBeenCalled();
  });
});

describe("autenticar", () => {
  const hash = bcrypt.hashSync("Secreta123", 4);
  const fila = (estado: boolean) => ({ id_usuario: 1, username: "ana", password: hash, estado, rol: { nombre: "Cajero" } });

  it("permite ingresar a un usuario activo por usuario o correo", async () => {
    m.usuarioFindFirst.mockResolvedValue(fila(true));
    await expect(autenticar("Ana", "Secreta123")).resolves.toEqual({ idUsuario: 1, username: "ana", rol: "Cajero" });
    expect(m.usuarioUpdate).toHaveBeenCalled();
  });

  it("no deja ingresar a un usuario desactivado", async () => {
    m.usuarioFindFirst.mockResolvedValue(fila(false));
    await expect(autenticar("ana", "Secreta123")).rejects.toMatchObject({ status: 403 });
    expect(m.usuarioUpdate).not.toHaveBeenCalled();
  });

  it("no revela que la cuenta está desactivada si la contraseña es incorrecta", async () => {
    m.usuarioFindFirst.mockResolvedValue(fila(false));
    await expect(autenticar("ana", "mala")).rejects.toMatchObject({ status: 401 });
  });

  it("rechaza usuario inexistente o contraseña incorrecta con 401", async () => {
    m.usuarioFindFirst.mockResolvedValue(null);
    await expect(autenticar("nadie", "x")).rejects.toMatchObject({ status: 401 });
    m.usuarioFindFirst.mockResolvedValue(fila(true));
    await expect(autenticar("ana", "mala")).rejects.toMatchObject({ status: 401 });
  });
});