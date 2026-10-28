import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  shiftFindFirst: vi.fn(),
  shiftFindMany: vi.fn(),
  shiftFindUnique: vi.fn(),
  shiftFindUniqueOrThrow: vi.fn(),
  shiftCreate: vi.fn(),
  shiftUpdate: vi.fn(),
  shiftDelete: vi.fn(),
  employeeFindMany: vi.fn(),
  linkFindMany: vi.fn(),
  linkDeleteMany: vi.fn(),
  linkCreateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const db = {
    shift: {
      findFirst: m.shiftFindFirst,
      findMany: m.shiftFindMany,
      findUnique: m.shiftFindUnique,
      findUniqueOrThrow: m.shiftFindUniqueOrThrow,
      create: m.shiftCreate,
      update: m.shiftUpdate,
      delete: m.shiftDelete,
    },
    employee: { findMany: m.employeeFindMany },
    employeeShift: { findMany: m.linkFindMany, deleteMany: m.linkDeleteMany, createMany: m.linkCreateMany },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { prisma: db };
});

import {
  createSchedule,
  deleteSchedule,
  normalizeSchedule,
  setScheduleEmployees,
  shiftHours,
  updateSchedule,
} from "./schedules.service";

const valid = { name: " Turno  mañana ", date: "2026-11-02", start_time: "08:00", end_time: "16:30" };

const row = {
  id: 3,
  name: "Turno mañana",
  date: new Date("2026-11-02T00:00:00Z"),
  startTime: new Date("1970-01-01T08:00:00Z"),
  endTime: new Date("1970-01-01T16:30:00Z"),
  employees: [
    { employee: { id: 1, dni: "11111111", firstName: "Ana", paternalLastName: "Pérez", position: null, active: true } },
  ],
};

/** Otro turno del mismo empleado, ya asignado, tal como lo devuelve la consulta de cruces. */
const other = (name: string, date: string, start: string, end: string) => ({
  id: 9,
  name,
  date: new Date(`${date}T00:00:00Z`),
  startTime: new Date(`1970-01-01T${start}:00Z`),
  endTime: new Date(`1970-01-01T${end}:00Z`),
  employees: [{ employee: { firstName: "Ana", paternalLastName: "Pérez" } }],
});

beforeEach(() => {
  vi.clearAllMocks();
  m.shiftFindFirst.mockResolvedValue(null);
  m.shiftFindMany.mockResolvedValue([]);
  m.shiftFindUnique.mockResolvedValue(row);
  m.shiftFindUniqueOrThrow.mockResolvedValue(row);
  m.shiftCreate.mockResolvedValue(row);
  m.shiftUpdate.mockResolvedValue(row);
  m.employeeFindMany.mockResolvedValue([{ id: 1, active: true }]);
  m.linkFindMany.mockResolvedValue([]);
  m.linkDeleteMany.mockResolvedValue({ count: 0 });
  m.linkCreateMany.mockResolvedValue({ count: 1 });
});

describe("normalizeSchedule", () => {
  it("normaliza el nombre y arma las columnas de fecha y hora", () => {
    const n = normalizeSchedule(valid);
    expect(n.name).toBe("Turno mañana");
    expect(n.date.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(n.startTime.toISOString()).toBe("1970-01-01T08:00:00.000Z");
  });

  it.each([
    [{ name: " " }, "nombre"],
    [{ name: "x".repeat(31) }, "30 caracteres"],
    [{ date: "2026-13-01" }, "fecha"],
    [{ start_time: "8:00" }, "HH:MM"],
    [{ end_time: "24:00" }, "HH:MM"],
    [{ end_time: "08:00" }, "distinta"],
  ])("rechaza %j", (override, message) => {
    expect(() => normalizeSchedule({ ...valid, ...override })).toThrow(message);
  });
});

describe("shiftHours", () => {
  it("calcula turnos normales y nocturnos", () => {
    expect(shiftHours("08:00", "16:30")).toBe(8.5);
    expect(shiftHours("18:00", "02:00")).toBe(8);
  });
});

describe("createSchedule / updateSchedule / deleteSchedule", () => {
  it("devuelve el horario con sus empleados y marca los nocturnos", async () => {
    const s = await createSchedule(valid);
    expect(s).toMatchObject({ shift_id: 3, start_time: "08:00", end_time: "16:30", overnight: false, hours: 8.5 });
    expect(s.employees[0].full_name).toBe("Ana Pérez");
  });

  it("rechaza nombre y fecha repetidos con 409", async () => {
    m.shiftFindFirst.mockResolvedValue({ id: 9 });
    await expect(createSchedule(valid)).rejects.toMatchObject({ status: 409 });
    expect(m.shiftCreate).not.toHaveBeenCalled();
  });

  it("al cambiar la hora revisa que el personal ya asignado no quede en dos turnos a la vez", async () => {
    m.linkFindMany.mockResolvedValue([{ employeeId: 1 }]);
    m.shiftFindMany.mockResolvedValue([other("Cena", "2026-11-02", "16:00", "20:00")]);
    await expect(updateSchedule(3, valid)).rejects.toMatchObject({ status: 409 });
    expect(m.shiftUpdate).not.toHaveBeenCalled();
  });

  it("eliminar un horario inexistente da 404", async () => {
    m.shiftFindUnique.mockResolvedValue(null);
    await expect(deleteSchedule(3)).rejects.toMatchObject({ status: 404 });
  });
});

describe("setScheduleEmployees", () => {
  it("quita solo las asignaciones de este horario y agrega las nuevas sin tocar los demás", async () => {
    await setScheduleEmployees(3, [1, 1]);
    expect(m.linkDeleteMany).toHaveBeenCalledWith({ where: { shiftId: 3, employeeId: { notIn: [1] } } });
    expect(m.linkCreateMany).toHaveBeenCalledWith({ data: [{ employeeId: 1, shiftId: 3 }], skipDuplicates: true });
  });

  it("una lista vacía deja el horario sin empleados", async () => {
    await setScheduleEmployees(3, []);
    expect(m.linkDeleteMany).toHaveBeenCalledWith({ where: { shiftId: 3, employeeId: { notIn: [] } } });
    expect(m.linkCreateMany).not.toHaveBeenCalled();
  });

  it("permite varios horarios el mismo día si no se cruzan (también si solo se tocan en el borde)", async () => {
    // El turno 3 va de 08:00 a 16:30; Cierre empieza justo a las 16:30 y Noche termina a las 08:00.
    m.shiftFindMany.mockResolvedValue([
      other("Cierre", "2026-11-02", "16:30", "17:30"),
      other("Noche", "2026-11-01", "20:00", "08:00"),
    ]);
    await expect(setScheduleEmployees(3, [1])).resolves.toBeDefined();
  });

  it("rechaza asignar a alguien a dos horarios que se cruzan", async () => {
    m.shiftFindMany.mockResolvedValue([other("Preparación", "2026-11-02", "15:00", "09:00")]);
    await expect(setScheduleEmployees(3, [1])).rejects.toThrow(/Ana Pérez ya está asignado a «Preparación»/);
    expect(m.linkCreateMany).not.toHaveBeenCalled();
  });

  it("detecta el cruce con un turno nocturno del día anterior", async () => {
    m.shiftFindMany.mockResolvedValue([other("Noche", "2026-11-01", "20:00", "09:00")]);
    await expect(setScheduleEmployees(3, [1])).rejects.toMatchObject({ status: 409 });
  });

  it("rechaza empleados inexistentes, dados de baja o ids inválidos", async () => {
    m.employeeFindMany.mockResolvedValue([]);
    await expect(setScheduleEmployees(3, [1])).rejects.toMatchObject({ status: 404 });
    m.employeeFindMany.mockResolvedValue([{ id: 1, active: false }]);
    await expect(setScheduleEmployees(3, [1])).rejects.toThrow("baja");
    await expect(setScheduleEmployees(3, ["x"])).rejects.toThrow("no es válida");
  });
});