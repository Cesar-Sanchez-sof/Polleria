import { describe, it, expect } from "vitest";
import { resolvePreviousRange, resolveDateRange } from "@/lib/dashboards/date-utils";

describe("Ronda D1 - Item 5: resolvePreviousRange con Reloj Fijo", () => {
  // En UTC: 2026-11-10T15:00:00Z -> En Lima (UTC-5): 2026-11-10 a las 10:00 AM
  const relojNov10 = new Date("2026-11-10T15:00:00.000Z");

  // En UTC: 2026-12-01T03:00:00Z -> En Lima (UTC-5): 2026-11-30 a las 22:00 PM (último día de noviembre)
  const relojNov30 = new Date("2026-12-01T03:00:00.000Z");

  describe("Reloj 2026-11-10T15:00:00Z (10 de noviembre en Lima)", () => {
    it("today: 1 día -> ayer (2026-11-09 a 2026-11-09)", () => {
      const prev = resolvePreviousRange({ field: "fecha", preset: "today" }, relojNov10);
      expect(prev).toEqual(["2026-11-09", "2026-11-09"]);
    });

    it("yesterday: 1 día -> anteayer (2026-11-08 a 2026-11-08)", () => {
      const prev = resolvePreviousRange({ field: "fecha", preset: "yesterday" }, relojNov10);
      expect(prev).toEqual(["2026-11-08", "2026-11-08"]);
    });

    it("last7: 7 días inmediatamente anteriores (2026-10-28 a 2026-11-03)", () => {
      const prev = resolvePreviousRange({ field: "fecha", preset: "last7" }, relojNov10);
      expect(prev).toEqual(["2026-10-28", "2026-11-03"]);
    });

    it("last30: 30 días inmediatamente anteriores (2026-09-12 a 2026-10-11)", () => {
      const prev = resolvePreviousRange({ field: "fecha", preset: "last30" }, relojNov10);
      expect(prev).toEqual(["2026-09-12", "2026-10-11"]);
    });

    it("thisMonth: 'mes hasta hoy' (1-10 nov) vs 'mismo tramo mes anterior' (1-10 oct)", () => {
      const prev = resolvePreviousRange({ field: "fecha", preset: "thisMonth" }, relojNov10);
      expect(prev).toEqual(["2026-10-01", "2026-10-10"]);
    });

    it("lastMonth: el mes anterior a ese (Septiembre 2026 completo: 2026-09-01 a 2026-09-30)", () => {
      const prev = resolvePreviousRange({ field: "fecha", preset: "lastMonth" }, relojNov10);
      expect(prev).toEqual(["2026-09-01", "2026-09-30"]);
    });

    it("thisYear: año hasta hoy (01-ene a 10-nov 2026) vs mismo tramo año anterior (01-ene a 10-nov 2025)", () => {
      const prev = resolvePreviousRange({ field: "fecha", preset: "thisYear" }, relojNov10);
      expect(prev).toEqual(["2025-01-01", "2025-11-10"]);
    });
  });

  describe("Reloj 2026-12-01T03:00:00Z (30 de noviembre en Lima)", () => {
    it("thisMonth: mes hasta hoy (1-30 nov) vs mismo tramo mes anterior (1-30 oct con clamp)", () => {
      const prev = resolvePreviousRange({ field: "fecha", preset: "thisMonth" }, relojNov30);
      expect(prev).toEqual(["2026-10-01", "2026-10-30"]);
    });

    it("lastMonth: el mes anterior a ese (Septiembre 2026)", () => {
      const prev = resolvePreviousRange({ field: "fecha", preset: "lastMonth" }, relojNov30);
      expect(prev).toEqual(["2026-09-01", "2026-09-30"]);
    });
  });
});
