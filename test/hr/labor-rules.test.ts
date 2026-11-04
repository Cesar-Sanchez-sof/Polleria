import { describe, expect, it } from "vitest";
import {
  addMonthsIso,
  annualVacationDays,
  checkVacationRequest,
  daysInclusive,
  essaludContribution,
  evaluateDay,
  evaluateSchedule,
  fullMonthsBetween,
  instantAt,
  maxAdvanceAmount,
  trialEndFor,
  vacationBalance,
  weekdayOf,
  type TemplateTimes,
} from "@/lib/services/hr/labor-rules";

const T = (id: number, name: string, start_time: string, end_time: string): TemplateTimes => ({ id, name, start_time, end_time });
const templates = new Map([
  [1, T(1, "Preparación", "16:00", "18:00")],
  [2, T(2, "Atención", "18:00", "23:30")],
  [3, T(3, "Cierre", "23:30", "00:30")],
  [4, T(4, "Mañana", "08:00", "17:00")],
  [5, T(5, "Almuerzo", "12:00", "15:00")],
]);
const days = (weekdays: number[], ids: number[]) => weekdays.map((weekday) => ({ weekday, template_ids: ids }));

describe("fechas", () => {
  it("suma meses respetando el fin de mes", () => {
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsIso("2026-11-15", 3)).toBe("2027-02-15");
  });
  it("cuenta meses completos y días calendario", () => {
    expect(fullMonthsBetween("2025-11-02", "2026-11-01")).toBe(11);
    expect(fullMonthsBetween("2025-11-02", "2026-11-02")).toBe(12);
    expect(daysInclusive("2026-11-02", "2026-11-08")).toBe(7);
  });
  it("periodo de prueba de 3 meses y día de la semana con lunes = 0", () => {
    expect(trialEndFor("2026-11-02")).toBe("2027-02-01");
    expect(weekdayOf("2026-11-02")).toBe(0);
    expect(weekdayOf("2026-11-08")).toBe(6);
  });
});

describe("evaluateSchedule (jornada pactada)", () => {
  it("suma la jornada con turnos contiguos y nocturnos", () => {
    const s = evaluateSchedule("Indeterminado", days([0, 1, 2, 3, 4], [1, 2, 3]), templates);
    expect(s.daily_hours[0]).toBe(8.5);
    expect(s.weekly_hours).toBe(42.5);
    expect(s.working_days).toBe(5);
    expect(s.warnings[0]).toMatch(/Lunes tiene 8.5 h/);
  });
  it("no permite superar las 48 horas semanales", () => {
    expect(() => evaluateSchedule("Indeterminado", days([0, 1, 2, 3, 4, 5], [4]), templates)).toThrow("48 h");
  });
  it("exige al menos un día de descanso en contratos laborales (no en locación)", () => {
    expect(() => evaluateSchedule("PlazoFijo", days([0, 1, 2, 3, 4, 5, 6], [5]), templates)).toThrow("descanso");
    expect(evaluateSchedule("LocacionServicios", days([0, 1, 2, 3, 4, 5, 6], [5]), templates).working_days).toBe(7);
  });
  it("rechaza turnos que se cruzan el mismo día", () => {
    expect(() => evaluateSchedule("Indeterminado", days([0], [4, 5]), templates)).toThrow("se cruzan");
  });
  it("tiempo parcial debe promediar menos de 4 h diarias", () => {
    expect(evaluateSchedule("TiempoParcial", days([4, 5], [1]), templates).weekly_hours).toBe(4);
    expect(() => evaluateSchedule("TiempoParcial", days([4, 5], [2]), templates)).toThrow("menos de 4 h");
  });
  it("prácticas: máximo 6 h diarias", () => {
    expect(() => evaluateSchedule("Practicas", days([0], [4]), templates)).toThrow("6 h");
  });
  it("rechaza un horario vacío o con turnos inexistentes", () => {
    expect(() => evaluateSchedule("Indeterminado", [], templates)).toThrow("al menos un día");
    expect(() => evaluateSchedule("Indeterminado", days([0], [99]), templates)).toThrow("no existe");
  });
});

describe("vacaciones", () => {
  it("días por régimen y modalidad", () => {
    expect(annualVacationDays("General", "Indeterminado")).toBe(30);
    expect(annualVacationDays("Micro", "PlazoFijo")).toBe(15);
    expect(annualVacationDays("General", "TiempoParcial")).toBe(0);
    expect(annualVacationDays("General", "LocacionServicios")).toBe(0);
  });

  it("antes del año solo hay adelanto proporcional", () => {
    const b = vacationBalance({ annualDays: 30, serviceStart: "2026-03-02", today: "2026-11-04", usedDays: 0 });
    expect(b).toMatchObject({ months_of_service: 8, earned_days: 0, accrued_current_year: 20, available_days: 0, max_with_advance: 20 });
    expect(checkVacationRequest(b, 5, false)).toMatchObject({ ok: false, error: expect.stringContaining("adelanto") });
    expect(checkVacationRequest(b, 5, true)).toEqual({ ok: true, isAdvance: true });
    expect(checkVacationRequest(b, 21, true)).toMatchObject({ ok: false });
  });

  it("con récord cumplido se descuenta lo ya tomado", () => {
    const b = vacationBalance({ annualDays: 15, serviceStart: "2025-05-01", today: "2026-11-04", usedDays: 10 });
    expect(b).toMatchObject({ completed_years: 1, earned_days: 15, accrued_current_year: 7, available_days: 5, max_with_advance: 12 });
    expect(checkVacationRequest(b, 5, false)).toEqual({ ok: true, isAdvance: false });
  });

  it("sin derecho a vacaciones no se puede pedir", () => {
    const b = vacationBalance({ annualDays: 0, serviceStart: "2024-01-01", today: "2026-11-04", usedDays: 0 });
    expect(checkVacationRequest(b, 1, true)).toMatchObject({ ok: false, error: expect.stringContaining("no genera") });
  });
});

describe("evaluateDay (asistencia)", () => {
  const date = "2026-11-04";
  const shifts = [
    { start_time: "18:00", end_time: "23:30" },
    { start_time: "23:30", end_time: "00:30" },
  ];
  const at = (hhmm: string, nextDay = false) => instantAt(date, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) + (nextDay ? 1440 : 0));
  const base = { date, shifts, checkIn: null, checkOut: null, justified: false, onLeave: false };

  it("puntual dentro de la tolerancia, con salida al día siguiente", () => {
    const r = evaluateDay({ ...base, checkIn: at("18:08"), checkOut: at("00:35", true), now: at("01:00", true) });
    expect(r).toMatchObject({ status: "Puntual", late_minutes: 8, scheduled_minutes: 390, worked_minutes: 387, expected_start: "18:00", expected_end: "00:30" });
  });
  it("tardanza pasada la tolerancia; justificada si RR. HH. lo indica", () => {
    expect(evaluateDay({ ...base, checkIn: at("18:25"), checkOut: at("00:30", true), now: at("01:00", true) }).status).toBe("Tardanza");
    expect(evaluateDay({ ...base, checkIn: at("18:25"), checkOut: at("00:30", true), justified: true, now: at("01:00", true) }).status).toBe("Justificada");
  });
  it("programado, sin marcar y falta según la hora actual", () => {
    expect(evaluateDay({ ...base, now: at("17:00") }).status).toBe("Programado");
    expect(evaluateDay({ ...base, now: at("18:30") }).status).toBe("Sin marcar");
    expect(evaluateDay({ ...base, now: at("01:00", true) }).status).toBe("Falta");
  });
  it("en turno, sin salida, licencia, descanso y extra", () => {
    expect(evaluateDay({ ...base, checkIn: at("17:55"), now: at("20:00") }).status).toBe("En turno");
    expect(evaluateDay({ ...base, checkIn: at("17:55"), now: at("03:00", true) }).status).toBe("Sin salida");
    expect(evaluateDay({ ...base, onLeave: true, now: at("20:00") }).status).toBe("Licencia");
    expect(evaluateDay({ ...base, shifts: [], now: at("20:00") }).status).toBe("Descanso");
    expect(evaluateDay({ ...base, shifts: [], checkIn: at("18:00"), checkOut: at("20:00"), now: at("21:00") })).toMatchObject({ status: "Extra", extra_minutes: 120 });
  });
});

describe("adelantos y aportes", () => {
  it("tope del 50 % del sueldo y EsSalud con base mínima de la RMV", () => {
    expect(maxAdvanceAmount(1500)).toBe(750);
    expect(essaludContribution(2000)).toBe(180);
    expect(essaludContribution(500)).toBe(101.7);
  });
});
