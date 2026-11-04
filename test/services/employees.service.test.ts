import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  employeeFindFirst: vi.fn(),
  employeeFindUnique: vi.fn(),
  employeeFindUniqueOrThrow: vi.fn(),
  employeeCreate: vi.fn(),
  employeeUpdate: vi.fn(),
  userFindFirst: vi.fn(),
  templateFindMany: vi.fn(),
  contractFindFirst: vi.fn(),
  contractCreate: vi.fn(),
  insuranceFindFirst: vi.fn(),
  insuranceCreate: vi.fn(),
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
    user: { findFirst: m.userFindFirst },
    shiftTemplate: { findMany: m.templateFindMany },
    employmentContract: { findFirst: m.contractFindFirst, create: m.contractCreate },
    employeeInsurance: { findFirst: m.insuranceFindFirst, create: m.insuranceCreate },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { prisma: db };
});

const scheduleAhead = vi.hoisted(() => vi.fn().mockResolvedValue({ assignments: 12 }));
vi.mock("@/lib/services/schedules.service", () => ({ scheduleEmployeeAhead: scheduleAhead }));

import { hireEmployee, normalizeEmployee, updateEmployee, verifyModifiableEmployee, type EmployeeData } from "@/lib/services/employees.service";
import type { ContractData } from "@/lib/services/hr/contracts.service";
import { UserError } from "@/lib/services/users.service";

const valid: EmployeeData = {
  dni: "12345678",
  first_name: "  Ana ",
  paternal_last_name: "Pérez",
  phone: "987654321",
  email: "ANA@Correo.pe",
  birth_date: "1995-04-10",
};

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const ATENCION = { id: 2, name: "Atención", startTime: time("18:00"), endTime: time("23:30"), active: true };

/** Mesera a plazo indeterminado: Atención de lunes a sábado (33 h), descansa el domingo. */
const contract: ContractData = {
  contract_type: "Indeterminado",
  labor_regime: "Micro",
  position: "Mesera",
  area: "Salón",
  start_date: "2026-11-02",
  base_salary: 1200,
  pension_system: "ONP",
  schedule: [0, 1, 2, 3, 4, 5].map((weekday) => ({ weekday, template_ids: [2] })),
};

const contractRow = {
  id: 11,
  employeeId: 7,
  contractType: "Indeterminado",
  laborRegime: "Micro",
  position: "Mesera",
  area: "Salón",
  startDate: new Date("2026-11-02T00:00:00Z"),
  endDate: null,
  trialEndDate: new Date("2027-02-01T00:00:00Z"),
  baseSalary: "1200.00",
  familyAllowance: false,
  pensionSystem: "ONP",
  afpName: null,
  cuspp: null,
  status: "Vigente",
  terminationDate: null,
  terminationReason: null,
  notes: null,
  renewedFromId: null,
  renewedBy: null,
  createdAt: new Date("2026-11-01T15:00:00Z"),
  employee: { id: 7, dni: "12345678", firstName: "Ana", middleName: null, paternalLastName: "Pérez", maternalLastName: null },
  schedule: [0, 1, 2, 3, 4, 5].map((weekday) => ({ weekday, shiftTemplateId: 2, shiftTemplate: ATENCION })),
};

const employeeRow = {
  id: 7,
  dni: "12345678",
  firstName: "Ana",
  middleName: null,
  paternalLastName: "Pérez",
  maternalLastName: null,
  phone: "987654321",
  email: "ana@correo.pe",
  address: null,
  birthDate: new Date("1995-04-10T00:00:00Z"),
  hireDate: new Date("2026-11-02T00:00:00Z"),
  emergencyContact: null,
  emergencyPhone: null,
  active: true,
  shifts: [],
  contracts: [contractRow],
  users: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  m.employeeFindFirst.mockResolvedValue(null);
  m.employeeFindUnique.mockResolvedValue({ id: 7, active: true, hireDate: new Date("2026-11-02T00:00:00Z") });
  m.employeeCreate.mockResolvedValue({ id: 7 });
  m.employeeUpdate.mockResolvedValue(employeeRow);
  m.employeeFindUniqueOrThrow.mockResolvedValue(employeeRow);
  m.userFindFirst.mockResolvedValue(null);
  m.templateFindMany.mockResolvedValue([ATENCION]);
  m.contractFindFirst.mockResolvedValue(null);
  m.contractCreate.mockResolvedValue(contractRow);
  m.insuranceFindFirst.mockResolvedValue(null);
  m.insuranceCreate.mockResolvedValue({ id: 1 });
});

describe("normalizeEmployee", () => {
  it("normaliza espacios y el correo", () => {
    const n = normalizeEmployee(valid, "2026-11-02");
    expect(n.firstName).toBe("Ana");
    expect(n.email).toBe("ana@correo.pe");
    expect(n.birthDate?.toISOString()).toBe("1995-04-10T00:00:00.000Z");
  });

  it.each([
    [{ dni: "1234" }, "8 dígitos"],
    [{ first_name: " " }, "nombre es obligatorio"],
    [{ paternal_last_name: "" }, "apellido paterno es obligatorio"],
    [{ phone: "12345" }, "teléfono"],
    [{ emergency_phone: "123" }, "emergencia"],
    [{ email: "ana@" }, "correo"],
    [{ birth_date: "2026-02-30" }, "fecha de nacimiento no es una fecha válida"],
    [{ birth_date: "2099-01-01" }, "no puede ser futura"],
    [{ birth_date: "2010-01-01" }, "mayor de 18"],
  ])("rechaza %j", (override, message) => {
    expect(() => normalizeEmployee({ ...valid, ...override } as EmployeeData, "2026-11-02")).toThrow(message);
  });
});

describe("hireEmployee (contratación)", () => {
  it("registra empleado, contrato con su horario y EsSalud en una sola operación", async () => {
    const r = await hireEmployee(valid, contract, 1);
    expect(m.employeeCreate.mock.calls[0][0].data).toMatchObject({ dni: "12345678", active: true, hireDate: new Date("2026-11-02T00:00:00Z") });
    const created = m.contractCreate.mock.calls[0][0].data;
    expect(created).toMatchObject({ employeeId: 7, contractType: "Indeterminado", baseSalary: 1200, createdById: 1 });
    expect(created.schedule.create).toHaveLength(6);
    // Periodo de prueba de 3 meses por defecto
    expect(created.trialEndDate.toISOString()).toBe("2027-02-01T00:00:00.000Z");
    expect(m.insuranceCreate.mock.calls[0][0].data).toMatchObject({ type: "EsSalud", monthlyCost: 108 });
    expect(r.contract).toMatchObject({ weekly_hours: 33, working_days: 6, position: "Mesera" });
    expect(r.employee.contract).toMatchObject({ position: "Mesera", weekly_hours: 33 });
    // Su horario pactado queda programado solo en Horarios laborales (sin reprogramar: es alta).
    expect(scheduleAhead).toHaveBeenCalledWith(expect.anything(), 7, false);
  });

  it("no contrata si el horario no deja día de descanso", async () => {
    const all = { ...contract, schedule: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, template_ids: [2] })) };
    await expect(hireEmployee(valid, all, 1)).rejects.toThrow("descanso semanal");
    expect(m.contractCreate).not.toHaveBeenCalled();
  });

  it("no contrata por debajo de la remuneración mínima", async () => {
    await expect(hireEmployee(valid, { ...contract, base_salary: 900 }, 1)).rejects.toThrow("remuneración mínima");
  });

  it("rechaza un DNI repetido con 409 y orienta al reingreso si es ex empleado", async () => {
    m.employeeFindFirst.mockResolvedValue({ id: 99, active: false });
    await expect(hireEmployee(valid, contract, 1)).rejects.toThrow("ex empleado");
    expect(m.employeeCreate).not.toHaveBeenCalled();
  });

  it("exige mayoría de edad a la fecha de inicio del contrato", async () => {
    await expect(hireEmployee({ ...valid, birth_date: "2008-12-01" }, contract, 1)).rejects.toThrow("mayor de 18");
  });
});

describe("updateEmployee", () => {
  it("edita excluyendo al propio empleado de la búsqueda de duplicados", async () => {
    await updateEmployee(7, valid);
    expect(m.employeeFindFirst.mock.calls[0][0].where).toMatchObject({ dni: "12345678", NOT: { id: 7 } });
  });

  it("editar un empleado inexistente da 404", async () => {
    m.employeeFindUnique.mockResolvedValue(null);
    await expect(updateEmployee(7, valid)).rejects.toBeInstanceOf(UserError);
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
