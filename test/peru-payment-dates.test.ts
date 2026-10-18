import { describe, it, expect } from "vitest";
import { toPeruDateOnly } from "../lib/services/accounting-posting.service";
import { formatDateTimePeru, formatTimePeru } from "../lib/services/journal-entries.service";

describe("Verificación de Fechas de Cobro y Asientos Contables (Huso Horario Perú America/Lima)", () => {
  it("debe calcular la fecha exacta de Perú para ventas en horario de tarde/noche (ej: 21:00 Perú)", () => {
    // 21:00 en Perú (UTC-5) del 13 de Octubre de 2026 corresponde a 02:00 UTC del 14 de Octubre de 2026
    const nightUtcDate = new Date("2026-10-14T02:00:00.000Z");

    const datePeru = toPeruDateOnly(nightUtcDate);

    // En Perú aún era 13 de octubre
    expect(datePeru.getUTCFullYear()).toBe(2026);
    expect(datePeru.getUTCMonth()).toBe(9); // Octubre (base 0)
    expect(datePeru.getUTCDate()).toBe(13);
  });

  it("debe calcular la fecha exacta de Perú para ventas al mediodía (ej: 13:00 Perú)", () => {
    // 13:00 en Perú (UTC-5) del 13 de Octubre de 2026 corresponde a 18:00 UTC del 13 de Octubre
    const noonUtcDate = new Date("2026-10-13T18:00:00.000Z");

    const datePeru = toPeruDateOnly(noonUtcDate);

    expect(datePeru.getUTCFullYear()).toBe(2026);
    expect(datePeru.getUTCMonth()).toBe(9);
    expect(datePeru.getUTCDate()).toBe(13);
  });

  it("debe cambiar de día únicamente cuando en Perú pasan las 00:00 medianoche", () => {
    // 00:05 AM en Perú del 14 de Octubre (05:05 UTC del 14 de Octubre)
    const earlyMorningUtcDate = new Date("2026-10-14T05:05:00.000Z");

    const datePeru = toPeruDateOnly(earlyMorningUtcDate);

    expect(datePeru.getUTCFullYear()).toBe(2026);
    expect(datePeru.getUTCMonth()).toBe(9);
    expect(datePeru.getUTCDate()).toBe(14);
  });

  it("garantiza que los asientos contables nocturnos no se registren erróneamente en el día siguiente", () => {
    // 23:45 PM en Perú del 13 de Octubre (04:45 UTC del 14 de Octubre)
    const saleClosingTable = new Date("2026-10-14T04:45:00.000Z");
    const accountingDate = toPeruDateOnly(saleClosingTable);

    expect(accountingDate.toISOString().startsWith("2026-10-13")).toBe(true);
  });

  it("no debe retroceder un día cuando la fecha ya está en medianoche UTC (@db.Date de Prisma)", () => {
    // Fecha emitida hoy en Perú y almacenada en BD como Date.UTC(2026, 9, 17) -> 2026-10-17T00:00:00.000Z
    const alreadyDateOnly = new Date("2026-10-17T00:00:00.000Z");
    const accountingDate = toPeruDateOnly(alreadyDateOnly);

    // Debe seguir siendo el 17 de Octubre, NUNCA el 16 de Octubre
    expect(accountingDate.getUTCFullYear()).toBe(2026);
    expect(accountingDate.getUTCMonth()).toBe(9);
    expect(accountingDate.getUTCDate()).toBe(17);
    expect(accountingDate.toISOString().startsWith("2026-10-17")).toBe(true);
  });

  it("debe formatear con precisión la fecha y hora de creación de asientos en huso horario de Perú (America/Lima)", () => {
    // 22:30:15 UTC corresponde a 17:30:15 en Perú
    const createdAtUtc = new Date("2026-10-17T22:30:15.000Z");
    const formattedDateTime = formatDateTimePeru(createdAtUtc);
    const formattedTime = formatTimePeru(createdAtUtc);

    expect(formattedDateTime).toContain("17/10/2026");
    expect(formattedDateTime).toContain("17:30:15");
    expect(formattedTime).toBe("17:30:15");
  });
});

