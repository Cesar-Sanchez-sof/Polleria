import { describe, it, expect } from "vitest";
import { toPeruDateOnly } from "../lib/services/accounting-posting.service";

describe("Verificación de Fechas de Cobro y Asientos Contables (Huso Horario Perú America/Lima)", () => {
  it("debe calcular la fecha exacta de Perú para ventas en horario de tarde/noche (ej: 21:00 Perú)", () => {
    // 21:00 en Perú (UTC-5) del 13 de Octubre de 2026 corresponde a 02:00 UTC del 14 de Octubre de 2026
    const fechaNocheUtc = new Date("2026-10-14T02:00:00.000Z");

    const fechaPeru = toPeruDateOnly(fechaNocheUtc);

    // En Perú aún era 13 de octubre
    expect(fechaPeru.getUTCFullYear()).toBe(2026);
    expect(fechaPeru.getUTCMonth()).toBe(9); // Octubre (base 0)
    expect(fechaPeru.getUTCDate()).toBe(13);
  });

  it("debe calcular la fecha exacta de Perú para ventas al mediodía (ej: 13:00 Perú)", () => {
    // 13:00 en Perú (UTC-5) del 13 de Octubre de 2026 corresponde a 18:00 UTC del 13 de Octubre
    const fechaMediodiaUtc = new Date("2026-10-13T18:00:00.000Z");

    const fechaPeru = toPeruDateOnly(fechaMediodiaUtc);

    expect(fechaPeru.getUTCFullYear()).toBe(2026);
    expect(fechaPeru.getUTCMonth()).toBe(9);
    expect(fechaPeru.getUTCDate()).toBe(13);
  });

  it("debe cambiar de día únicamente cuando en Perú pasan las 00:00 medianoche", () => {
    // 00:05 AM en Perú del 14 de Octubre (05:05 UTC del 14 de Octubre)
    const fechaMadrugadaUtc = new Date("2026-10-14T05:05:00.000Z");

    const fechaPeru = toPeruDateOnly(fechaMadrugadaUtc);

    expect(fechaPeru.getUTCFullYear()).toBe(2026);
    expect(fechaPeru.getUTCMonth()).toBe(9);
    expect(fechaPeru.getUTCDate()).toBe(14);
  });

  it("garantiza que los asientos contables nocturnos no se registren erróneamente en el día siguiente", () => {
    // 23:45 PM en Perú del 13 de Octubre (04:45 UTC del 14 de Octubre)
    const ventaCierreMesa = new Date("2026-10-14T04:45:00.000Z");
    const fechaContable = toPeruDateOnly(ventaCierreMesa);

    expect(fechaContable.toISOString().startsWith("2026-10-13")).toBe(true);
  });
});
