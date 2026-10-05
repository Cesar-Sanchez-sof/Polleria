/**
 * Reusable seed for accounting chart of accounts (PCGE 2019 simplified for the restaurant).
 *
 * - Idempotent: can be executed multiple times without duplicating accounts (upsert by `code`).
 * - Migrates prior catalog to the new one preserving existing journal entries.
 */
import { PrismaClient } from "@prisma/client";

type CatalogRow = [code: string, name: string, type: string, parentCode: string | null];

export const CATALOGO_CUENTAS: CatalogRow[] = [
  // =========================
  // ACTIVO
  // =========================
  ["1", "Activo", "Activo", null],
  ["2", "Pasivo", "Pasivo", null],
  ["3", "Patrimonio", "Patrimonio", null],
  ["4", "Ingresos", "Ingreso", null],
  ["5", "Gastos", "Gasto", null],
  ["6", "Costo de Ventas", "Costo", null],
  ["7", "Ingresos", "Ingreso", null],
  ["10", "Efectivo y equivalentes de efectivo", "Activo", "1"],
  ["12", "Cuentas por Cobrar Comerciales - Terceros", "Activo", "1"],
  ["20", "Mercaderías", "Activo", "2"],
  ["24", "Materias Primas", "Activo", "2"],
  ["25", "Materiales Auxiliares, Suministros y Repuestos", "Activo", "2"],
  ["33", "Propiedad, Planta y Equipo", "Activo", "3"],
  ["40", "Tributos por Pagar - IGV", "Pasivo", "4"],
  ["41", "Remuneraciones por Pagar", "Pasivo", "4"],
  ["42", "Cuentas por Pagar Comerciales - Terceros", "Pasivo", "4"],
  ["46", "Cuentas por Pagar Diversas - Terceros", "Pasivo", "4"],
  ["50", "Capital", "Patrimonio", "5"],
  ["59", "Resultados Acumulados", "Patrimonio", "5"],
  ["60", "Compras", "Gasto", "6"],
  ["61", "Variación de inventarios", "Gasto", "6"],
  ["62", "Gastos de Personal", "Gasto", "6"],
  ["63", "Gastos de Servicios prestados por terceros", "Gasto", "6"],
  ["69", "Costo de Ventas", "Gasto", "6"],
  ["70", "Ventas de Mercaderías", "Ingreso", "7"],
  ["101", "Caja", "Activo", "1"],
  ["104", "Bancos - Cuentas Corrientes", "Activo", "1"],
  ["121", "Cuentas por Cobrar Comerciales - Terceros", "Activo", "1"],
  ["167", "Tributos por Acreditar - IGV", "Activo", "1"],
  ["201", "Mercaderías", "Activo", "2"],
  ["241", "Materias Primas", "Activo", "2"],
  ["251", "Materiales Auxiliares, Suministros y Repuestos", "Activo", "2"],
  ["331", "Propiedad, Planta y Equipo - Maquinaria y Equipos", "Activo", "3"],
  ["395", "Depreciación Acumulada de Propiedad, Planta y Equipo", "Activo", "3"],
  ["401", "Tributos por Pagar - IGV", "Pasivo", "4"],
  ["411", "Remuneraciones por Pagar", "Pasivo", "4"],
  ["421", "Cuentas por Pagar Comerciales - Terceros", "Pasivo", "4"],
  ["461", "Cuentas por Pagar Diversas - Terceros", "Pasivo", "4"],
  ["501", "Capital", "Patrimonio", "5"],
  ["591", "Resultados Acumulados", "Patrimonio", "5"],
  ["621", "Gastos de Personal", "Gasto", "6"],
  ["631", "Gastos de Servicios Básicos", "Gasto", "6"],
  ["634", "Gastos de Transporte y Delivery", "Gasto", "6"],
  ["635", "Gastos de Arrendamiento", "Gasto", "6"],
  ["636", "Gastos de Mantenimiento", "Gasto", "6"],
  ["637", "Publicidad y Promociones", "Gasto", "6"],
  ["659", "Otros Gastos de Gestión", "Gasto", "6"],
  ["673", "Gastos Financieros", "Gasto", "6"],
  ["691", "Costo de Ventas de Mercaderías", "Costo", "6"],
  ["701", "Ventas de Mercaderías", "Ingreso", "7"],
  ["704", "Prestación de Servicios", "Ingreso", "7"]
];

const ORDERED_RENAMES: Array<{ from: string; to: string }> = [
  { from: "167", to: "395" },
  { from: "201", to: "421" },
  { from: "401", to: "701" },
  { from: "501", to: "621" },
  { from: "102", to: "104" },
  { from: "161", to: "331" },
  { from: "202", to: "411" },
  { from: "204", to: "461" },
  { from: "302", to: "591" },
  { from: "402", to: "704" },
  { from: "502", to: "631" },
  { from: "503", to: "635" },
  { from: "504", to: "637" },
  { from: "505", to: "634" },
  { from: "506", to: "636" },
  { from: "507", to: "659" },
  { from: "601", to: "691" },
  { from: "105", to: "121" },
  { from: "108", to: "167" },
  { from: "120", to: "201" },
  { from: "206", to: "401" },
  { from: "301", to: "501" },
];

const OBSOLETE_ADJUSTMENTS_CODE = "121";
const ARCHIVED_ADJUSTMENTS_CODE = "121-OLD";

type Database = Pick<PrismaClient, "accountingAccount" | "journalEntryDetail">;

const CATALOG_BY_CODE = new Map(
  CATALOGO_CUENTAS.map(([code, name, type]) => [code, { name, type }])
);

async function migrateCode(db: Database, from: string, to: string): Promise<void> {
  if (from === to) return;
  const source = await db.accountingAccount.findUnique({ where: { code: from } });
  if (!source) return;

  const expected = CATALOG_BY_CODE.get(from);
  if (expected && source.name === expected.name && source.type === expected.type) return;

  const target = await db.accountingAccount.findUnique({ where: { code: to } });
  if (!target) {
    await db.accountingAccount.update({
      where: { code: from },
      data: { code: to },
    });
    console.log(`  ↻ ${from} → ${to} (renombre, se conservan asientos)`);
    return;
  }

  await db.journalEntryDetail.updateMany({
    where: { accountId: source.id },
    data: { accountId: target.id },
  });
  await retireAccount(db, source.id, from);
  console.log(`  ↻ ${from} → ${to} (detalles movidos)`);
}

async function retireAccount(db: Database, id: number, code: string): Promise<void> {
  const [usages, children] = await Promise.all([
    db.journalEntryDetail.count({ where: { accountId: id } }),
    db.accountingAccount.count({ where: { parentId: id } }),
  ]);
  if (usages === 0 && children === 0) {
    await db.accountingAccount.delete({ where: { id } });
    console.log(`  ✕ ${code} eliminada (sin movimientos)`);
  } else {
    await db.accountingAccount.update({
      where: { id },
      data: { active: false },
    });
    console.log(`  ⊘ ${code} desactivada (${usages} líneas, ${children} hijas conservadas)`);
  }
}

async function deleteInventoryAdjustments(db: Database): Promise<void> {
  const account = await db.accountingAccount.findUnique({
    where: { code: OBSOLETE_ADJUSTMENTS_CODE },
  });
  if (!account || account.name === "Cuentas por Cobrar Comerciales - Terceros") return;

  const [usages, children] = await Promise.all([
    db.journalEntryDetail.count({ where: { accountId: account.id } }),
    db.accountingAccount.count({ where: { parentId: account.id } }),
  ]);
  if (usages === 0 && children === 0) {
    await db.accountingAccount.delete({ where: { id: account.id } });
    console.log(`  ✕ ${OBSOLETE_ADJUSTMENTS_CODE} "Ajustes de Inventario" eliminada`);
    return;
  }

  const freeArchive = await db.accountingAccount.findUnique({
    where: { code: ARCHIVED_ADJUSTMENTS_CODE },
  });
  if (freeArchive) {
    await db.journalEntryDetail.updateMany({
      where: { accountId: account.id },
      data: { accountId: freeArchive.id },
    });
    await retireAccount(db, account.id, OBSOLETE_ADJUSTMENTS_CODE);
    return;
  }

  await db.accountingAccount.update({
    where: { id: account.id },
    data: {
      code: ARCHIVED_ADJUSTMENTS_CODE,
      name: "Ajustes de Inventario (histórica)",
      active: false,
    },
  });
  console.log(
    `  ⊘ ${OBSOLETE_ADJUSTMENTS_CODE} archivada como ${ARCHIVED_ADJUSTMENTS_CODE} (${usages} líneas conservadas)`
  );
}

export async function seedCuentas(db: Database): Promise<void> {
  console.log("📒 Sincronizando catálogo de cuentas (PCGE 2019 simplificado)...");

  await deleteInventoryAdjustments(db);
  for (const { from, to } of ORDERED_RENAMES) {
    await migrateCode(db, from, to);
  }

  const sorted = [...CATALOGO_CUENTAS].sort((a, b) => {
    if (a[3] === null && b[3] !== null) return -1;
    if (a[3] !== null && b[3] === null) return 1;
    return a[0].localeCompare(b[0]);
  });

  for (const [code, name, type, parentCode] of sorted) {
    let parentId: number | null = null;
    if (parentCode !== null) {
      const parent = await db.accountingAccount.findUnique({
        where: { code: parentCode },
      });
      if (!parent) throw new Error(`Cuenta padre ${parentCode} no encontrada para ${code}.`);
      parentId = parent.id;
    }
    await db.accountingAccount.upsert({
      where: { code },
      update: { name, type, parentId, active: true },
      create: { code, name, type, parentId, active: true },
    });
  }
  console.log(`✔ Catálogo sincronizado (${sorted.length} cuentas).`);

  const allAccounts = await db.accountingAccount.findMany({
    select: { code: true, name: true, type: true, parentId: true },
  });
  const seenCodes = new Set<string>();
  for (const acc of allAccounts) {
    if (seenCodes.has(acc.code)) throw new Error(`Cuenta duplicada: ${acc.code}.`);
    seenCodes.add(acc.code);
  }
  const byCode = new Map(allAccounts.map((c) => [c.code, c]));
  const expected = new Map(CATALOGO_CUENTAS.map(([c, n, t, p]) => [c, { n, t, p }]));
  for (const [code, exp] of expected) {
    const real = byCode.get(code);
    if (!real) throw new Error(`Falta la cuenta ${code} tras el seed.`);
    if (real.name !== exp.n || real.type !== exp.t) {
      throw new Error(`Cuenta ${code} con datos distintos a los esperados.`);
    }
    const realHasParent = real.parentId === null ? null : "con-padre";
    const expHasParent = exp.p === null ? null : "con-padre";
    if (realHasParent !== expHasParent) throw new Error(`Jerarquía incorrecta en ${code}.`);
  }
  console.log("✔ Verificación: sin duplicados y jerarquía correcta.");
}

const isDirectExecution =
  typeof process !== "undefined" &&
  !!process.argv[1] &&
  (process.argv[1].endsWith("seed-cuentas.ts") || process.argv[1].endsWith("seed-cuentas.js"));

if (isDirectExecution) {
  const prisma = new PrismaClient();
  seedCuentas(prisma)
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error("❌ Error al sincronizar cuentas:", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
