import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  employeeFindFirst: vi.fn(),
  employeeFindUnique: vi.fn(),
  employeeFindUniqueOrThrow: vi.fn(),
  employeeCreate: vi.fn(),
  employeeUpdate: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const db = {
    employee: {
      findFirst: m.employeeFindFirst,
      findUnique: m.employeeFindUnique,
      findUniqueOrThrow: m.employeeFindUniqueOrThrow,
      findMany: vi.fn().mockResolvedValue([]),
      create: m.employeeCreate,
      update: m.employeeUpdate,
    },
    user: { findFirst: m.userFindFirst, updateMany: m.userUpdateMany },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { prisma: db };
});

import {
  createEmployee,
  normalizeEmployee,
  setEmployeeActive,
  updateEmployee,
  verifyModifiableEmployee,
  type EmployeeData,
} from "./employees.service";
import { UserError } from "./users.service";

const valid: EmployeeData = {
  dni: "12345678",
  first_name: "  Ana ",
  paternal_last_name: "Pérez",
  phone: "987654321",
  birth_date: "1995-04-10",
  hire_date: "2026-10-01",
  position: "Mesera",
  area: "Salón",
  contract_type: "Planilla",
  base_salary: "1130.5",
};

const row = {
  id: 7,
  dni: "12345678",
  firstName: "Ana",
  middleName: null,
  paternalLastName: "Pérez",
  maternalLastName: null,
  phone: "987654321",
  address: null,
  birthDate: new Date("1995-04-10T00:00:00Z"),
  hireDate: new Date("2026-10-01T00:00:00Z"),
  position: "Mesera",
  area: "Salón",
  contractType: "Planilla",
  baseSalary: "1130.50",
  active: true,
  shifts: [],
  users: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  m.employeeFindFirst.mockResolvedValue(null);
  m.employeeFindUnique.mockResolvedValue({ id: 7 });
  m.employeeCreate.mockResolvedValue(row);
  m.employeeUpdate.mockResolvedValue(row);
  m.employeeFindUniqueOrThrow.mockResolvedValue(row);
  m.userFindFirst.mockResolvedValue(null);
  m.userUpdateMany.mockResolvedValue({ count: 0 });
});

describe("normalizeEmployee", () => {
  const today = new Date("2026-10-28T12:00:00Z");

  it("normaliza espacios y convierte el sueldo", () => {
    const n = normalizeEmployee(valid, today);
    expect(n.firstName).toBe("Ana");
    expect(n.baseSalary).toBe(1130.5);
    expect(n.hireDate.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it.each([
    [{ dni: "1234" }, "8 dígitos"],
    [{ first_name: " " }, "nombre es obligatorio"],
    [{ paternal_last_name: "" }, "apellido paterno es obligatorio"],
    [{ phone: "12345" }, "teléfono"],
    [{ birth_date: "2026-02-30" }, "fecha de nacimiento no es una fecha válida"],
    [{ birth_date: "2030-01-01" }, "no puede ser futura"],
    [{ birth_date: "2015-01-01" }, "mayor de 18"],
    [{ contract_type: "Eventual" }, "contrato"],
    [{ base_salary: -1 }, "sueldo base"],
  ])("rechaza %j", (override, message) => {
    expect(() => normalizeEmployee({ ...valid, ...override } as EmployeeData, today)).toThrow(message);
  });
});

describe("createEmployee / updateEmployee", () => {
  it("crea el empleado activo", async () => {
    const e = await createEmployee(valid);
    expect(e).toMatchObject({ employee_id: 7, full_name: "Ana Pérez", base_salary: 1130.5, active: true, has_user: false, upcoming_shifts: 0, next_shift: null });
    expect(m.employeeCreate.mock.calls[0][0].data).toMatchObject({ dni: "12345678", active: true });
  });

  it("rechaza un DNI repetido con 409", async () => {
    m.employeeFindFirst.mockResolvedValue({ id: 99 });
    await expect(createEmployee(valid)).rejects.toMatchObject({ status: 409 });
    expect(m.employeeCreate).not.toHaveBeenCalled();
  });

  it("edita excluyendo al propio empleado de la búsqueda de duplicados", async () => {
    await updateEmployee(7, valid);
    expect(m.employeeFindFirst.mock.calls[0][0].where).toMatchObject({ dni: "12345678", NOT: { id: 7 } });
  });

  it("editar un empleado inexistente da 404", async () => {
    m.employeeFindUnique.mockResolvedValue(null);
    await expect(updateEmployee(7, valid)).rejects.toBeInstanceOf(UserError);
  });
});

describe("setEmployeeActive", () => {
  it("la baja desactiva también sus usuarios", async () => {
    m.userUpdateMany.mockResolvedValue({ count: 1 });
    const r = await setEmployeeActive(7, false);
    expect(r.users_deactivated).toBe(1);
    expect(m.userUpdateMany).toHaveBeenCalledWith({ where: { employeeId: 7, active: true }, data: { active: false } });
  });

  it("el reingreso no toca a los usuarios", async () => {
    await setEmployeeActive(7, true);
    expect(m.userUpdateMany).not.toHaveBeenCalled();
  });
});

describe("verifyModifiableEmployee", () => {
  it("un no administrador no puede tocar al empleado de un administrador", async () => {
    m.userFindFirst.mockResolvedValue({ id: 1 });
    await expect(verifyModifiableEmployee(7, false)).rejects.toMatchObject({ status: 403 });
  });

  it("un administrador sí, y un empleado común no tiene restricción", async () => {
    await expect(verifyModifiableEmployee(7, true)).resolves.toBeUndefined();
    await expect(verifyModifiableEmployee(7, false)).resolves.toBeUndefined();
  });
});