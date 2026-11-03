import { describe, expect, it } from "vitest";
import {
  addDays,
  contractStatus,
  daysBetween,
  isCurrentOrUpcoming,
  limaToday,
  periodsOverlap,
  suggestedRenewalStart,
} from "./contracts";

const TODAY = "2026-11-03";

describe("limaToday", () => {
  it("usa la fecha de Lima aunque en UTC ya sea el día siguiente", () => {
    expect(limaToday(new Date("2026-11-04T03:00:00Z"))).toBe("2026-11-03");
    expect(limaToday(new Date("2026-11-04T05:00:00Z"))).toBe("2026-11-04");
  });
});

describe("fechas", () => {
  it("suma días y cruza de mes y de año", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("cuenta los días entre dos fechas", () => {
    expect(daysBetween("2026-11-03", "2026-12-03")).toBe(30);
    expect(daysBetween("2026-11-03", "2026-11-01")).toBe(-2);
  });
});

describe("contractStatus", () => {
  const base = { startDate: "2026-01-01", endDate: null, terminatedAt: null };

  it("el indeterminado iniciado está vigente", () => {
    expect(contractStatus(base, TODAY)).toBe("active");
  });

  it("uno que empieza más adelante está por iniciar", () => {
    expect(contractStatus({ ...base, startDate: "2026-11-04" }, TODAY)).toBe("upcoming");
  });

  it("a plazo fijo: vigente, por vencer a 30 días o menos, y vencido", () => {
    expect(contractStatus({ ...base, endDate: "2027-03-01" }, TODAY)).toBe("active");
    expect(contractStatus({ ...base, endDate: "2026-12-03" }, TODAY)).toBe("expiring");
    expect(contractStatus({ ...base, endDate: TODAY }, TODAY)).toBe("expiring");
    expect(contractStatus({ ...base, endDate: "2026-11-02" }, TODAY)).toBe("expired");
  });

  it("una rescisión manda sobre cualquier otra fecha", () => {
    expect(contractStatus({ ...base, endDate: "2027-12-01", terminatedAt: "2026-06-01" }, TODAY)).toBe("terminated");
  });

  it("solo los vigentes, por vencer y por iniciar ocupan al empleado", () => {
    expect(["active", "expiring", "upcoming"].every((s) => isCurrentOrUpcoming(s as never))).toBe(true);
    expect(isCurrentOrUpcoming("expired")).toBe(false);
    expect(isCurrentOrUpcoming("terminated")).toBe(false);
  });
});

describe("periodsOverlap", () => {
  const fixed = { startDate: "2026-01-01", endDate: "2026-06-30", terminatedAt: null };

  it("se cruzan si comparten aunque sea un día", () => {
    expect(periodsOverlap(fixed, { startDate: "2026-06-30", endDate: null, terminatedAt: null })).toBe(true);
  });

  it("el siguiente día no se cruza: así se renueva sin hueco ni choque", () => {
    expect(periodsOverlap(fixed, { startDate: "2026-07-01", endDate: null, terminatedAt: null })).toBe(false);
  });

  it("un indeterminado cruza con todo lo que empieza después de su inicio", () => {
    const open = { startDate: "2026-03-01", endDate: null, terminatedAt: null };
    expect(periodsOverlap(open, { startDate: "2030-01-01", endDate: "2030-06-01", terminatedAt: null })).toBe(true);
    expect(periodsOverlap(open, { startDate: "2025-01-01", endDate: "2026-02-28", terminatedAt: null })).toBe(false);
  });

  it("una rescisión acorta el periodo", () => {
    const open = { startDate: "2026-01-01", endDate: null, terminatedAt: "2026-05-31" };
    expect(periodsOverlap(open, { startDate: "2026-06-01", endDate: null, terminatedAt: null })).toBe(false);
  });
});

describe("suggestedRenewalStart", () => {
  it("empieza el día siguiente al fin si aún no pasó", () => {
    expect(suggestedRenewalStart("2026-12-31", TODAY)).toBe("2027-01-01");
  });

  it("si el contrato ya venció empieza hoy", () => {
    expect(suggestedRenewalStart("2026-10-01", TODAY)).toBe(TODAY);
    expect(suggestedRenewalStart(null, TODAY)).toBe(TODAY);
  });
});
