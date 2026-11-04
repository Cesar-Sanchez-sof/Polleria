import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  employeeFindUnique: vi.fn(),
  contractFindFirst: vi.fn(),
  leaveFindFirst: vi.fn(),
  attendanceFindUnique: vi.fn(),
  attendanceFindFirst: vi.fn(),
  attendanceUpsert: vi.fn(),
  attendanceUpdate: vi.fn(),
  linkFindMany: vi.fn(),
  markCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: m.userFindUnique },
    employee: { findUnique: m.employeeFindUnique },
    employmentContract: { findFirst: m.contractFindFirst },
    leaveRequest: { findFirst: m.leaveFindFirst },
    attendance: { findUnique: m.attendanceFindUnique, findFirst: m.attendanceFindFirst, upsert: m.attendanceUpsert, update: m.attendanceUpdate },
    employeeShift: { findMany: m.linkFindMany },
    attendanceMark: { create: m.markCreate },
  },
}));

import { checkInOnLogin, deviceLabel, markAttendance } from "@/lib/services/hr/attendance.service";
import { instantAt } from "@/lib/services/hr/labor-rules";

const day = "2026-11-04";
const at = (hhmm: string) => instantAt(day, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)));
const shift = (start: string, end: string) => ({ shift: { startTime: new Date(`1970-01-01T${start}:00Z`), endTime: new Date(`1970-01-01T${end}:00Z`) } });

beforeEach(() => {
  vi.clearAllMocks();
  m.userFindUnique.mockResolvedValue({ employeeId: 7, employee: { active: true } });
  m.employeeFindUnique.mockResolvedValue({ id: 7, active: true, firstName: "Ana", paternalLastName: "Pérez" });
  m.contractFindFirst.mockResolvedValue({ id: 1 });
  m.leaveFindFirst.mockResolvedValue(null);
  m.attendanceFindUnique.mockResolvedValue(null);
  m.attendanceFindFirst.mockResolvedValue(null);
  m.attendanceUpsert.mockImplementation(({ create }) => Promise.resolve({ id: 50, ...create }));
  m.linkFindMany.mockResolvedValue([shift("18:00", "23:30"), shift("23:30", "00:30")]);
  m.markCreate.mockResolvedValue({ id: 1 });
});

const ctx = (time: string) => ({ username: "ana", ip: "190.1.2.3", userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0", now: at(time) });

describe("checkInOnLogin (asistencia al iniciar sesión)", () => {
  it("registra la entrada dentro de la ventana del turno, con origen, IP y bitácora", async () => {
    const r = await checkInOnLogin(3, ctx("17:52"));
    expect(r).toEqual({ status: "marked", time: "17:52", message: "Entrada registrada a las 17:52" });
    expect(m.attendanceUpsert.mock.calls[0][0].create).toMatchObject({ employeeId: 7, source: "InicioSesion", checkInIp: "190.1.2.3", registeredById: 3 });
    expect(m.markCreate.mock.calls[0][0].data).toMatchObject({ kind: "Entrada", source: "InicioSesion", username: "ana", ipAddress: "190.1.2.3" });
  });

  it("informa la tardanza cuando entra pasada la tolerancia", async () => {
    const r = await checkInOnLogin(3, ctx("18:25"));
    expect(r.message).toContain("25 min de tardanza");
  });

  it("no marca antes de una hora del inicio del turno", async () => {
    const r = await checkInOnLogin(3, ctx("16:30"));
    expect(r.status).toBe("early");
    expect(r.message).toContain("desde las 17:00");
    expect(m.attendanceUpsert).not.toHaveBeenCalled();
  });

  it("no duplica la entrada si vuelve a iniciar sesión", async () => {
    m.attendanceFindUnique.mockResolvedValue({ checkIn: at("17:55") });
    const r = await checkInOnLogin(3, ctx("20:00"));
    expect(r).toMatchObject({ status: "already", message: expect.stringContaining("17:55") });
    expect(m.attendanceUpsert).not.toHaveBeenCalled();
  });

  it("sin turno, con licencia o sin empleado no marca nada", async () => {
    m.linkFindMany.mockResolvedValue([]);
    expect((await checkInOnLogin(3, ctx("18:00"))).status).toBe("no_shift");
    m.leaveFindFirst.mockResolvedValue({ type: "Vacaciones" });
    expect((await checkInOnLogin(3, ctx("18:00"))).status).toBe("on_leave");
    m.userFindUnique.mockResolvedValue(null);
    expect((await checkInOnLogin(3, ctx("18:00"))).status).toBe("not_employee");
    expect(m.attendanceUpsert).not.toHaveBeenCalled();
  });

  it("nunca hace fallar el inicio de sesión", async () => {
    m.userFindUnique.mockRejectedValue(new Error("BD caída"));
    await expect(checkInOnLogin(3, ctx("18:00"))).resolves.toMatchObject({ status: "no_shift" });
  });
});

describe("salida al cerrar sesión", () => {
  it("cierra la entrada abierta del turno nocturno de ayer", async () => {
    m.attendanceFindFirst.mockResolvedValue({ date: new Date(`${day}T00:00:00Z`) });
    m.attendanceFindUnique.mockResolvedValue({ id: 50, checkIn: at("17:58"), checkOut: null });
    m.attendanceUpdate.mockImplementation(({ data }) => Promise.resolve({ id: 50, ...data }));
    const now = instantAt(day, 24 * 60 + 35); // 00:35 del día siguiente
    const r = await markAttendance(7, "check_out", { actorUserId: 3, actorUsername: "ana", source: "CierreSesion", ip: "190.1.2.3", now });
    expect(r).toMatchObject({ date: day, time: "00:35" });
    expect(m.attendanceUpdate.mock.calls[0][0].data).toMatchObject({ checkOutSource: "CierreSesion", checkOutIp: "190.1.2.3" });
    expect(m.markCreate.mock.calls[0][0].data).toMatchObject({ kind: "Salida", source: "CierreSesion" });
  });
});

describe("deviceLabel", () => {
  it("resume el navegador y el sistema", () => {
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/130.0 Safari/537.36")).toBe("Chrome · Windows");
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Mobile Safari/604.1")).toBe("Safari · iPhone/iPad");
    expect(deviceLabel(null)).toBeNull();
  });
});
