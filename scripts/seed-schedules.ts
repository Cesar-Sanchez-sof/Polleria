/**
 * Inyección rápida de horarios estándar de la pollería (abre de 6:00 pm a 11:30 pm).
 *
 * Uso:
 *   npx tsx scripts/seed-schedules.ts                       → hoy y los próximos 13 días
 *   npx tsx scripts/seed-schedules.ts --days 30             → 30 días desde hoy
 *   npx tsx scripts/seed-schedules.ts --from 2026-11-01 --days 7
 *
 * Es idempotente: si ya existe un horario con el mismo nombre en esa fecha, no lo duplica.
 * No toca empleados; las asignaciones se hacen desde Recursos humanos → Horarios laborales.
 * Edita STANDARD_SHIFTS para ajustar los turnos (un fin menor que el inicio cruza la medianoche).
 */
import { PrismaClient } from "@prisma/client";
import { formatDateToIso, parseUtcDate } from "../lib/dates";

const STANDARD_SHIFTS = [
  { name: "Preparación", start: "16:00", end: "18:00" }, // mise en place antes de abrir
  { name: "Atención", start: "18:00", end: "23:30" }, // horario de atención al público
  { name: "Cierre", start: "23:30", end: "00:30" }, // limpieza y cuadre; termina al día siguiente
] as const;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Fecha de hoy en Lima (UTC-5) como "YYYY-MM-DD". */
function todayLima(): string {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function main() {
  const from = arg("from") ?? todayLima();
  const days = Number(arg("days") ?? 14);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(from) ? parseUtcDate(from) : null;
  if (!start || formatDateToIso(start) !== from) throw new Error(`--from inválido: ${from} (usa YYYY-MM-DD)`);
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error("--days debe ser un entero entre 1 y 366");

  const prisma = new PrismaClient();
  try {
    const dates = Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * 86_400_000));
    const existing = await prisma.shift.findMany({
      where: { date: { in: dates }, name: { in: STANDARD_SHIFTS.map((s) => s.name) } },
      select: { name: true, date: true },
    });
    const taken = new Set(existing.map((e) => `${e.name}|${formatDateToIso(e.date)}`));

    const data = dates.flatMap((date) =>
      STANDARD_SHIFTS.filter((s) => !taken.has(`${s.name}|${formatDateToIso(date)}`)).map((s) => ({
        name: s.name,
        date,
        startTime: new Date(`1970-01-01T${s.start}:00.000Z`),
        endTime: new Date(`1970-01-01T${s.end}:00.000Z`),
      })),
    );
    const { count } = await prisma.shift.createMany({ data });
    console.log(
      `✔ ${count} horarios creados (${days} días desde ${from}); ${dates.length * STANDARD_SHIFTS.length - count} ya existían.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("✘", e instanceof Error ? e.message : e);
  process.exit(1);
});
