/**
 * Semilla reutilizable del catálogo de cuentas contables (PCGE 2019 simplificado
 * para la pollería).
 *
 * - Es idempotente: se puede ejecutar N veces sin duplicar cuentas (upsert por
 *   `codigo`, que es único en `cuenta_contable`).
 * - Migra el catálogo anterior al nuevo preservando los asientos contables
 *   existentes: antes de eliminar una cuenta antigua mueve sus
 *   `detalle_asiento_contable` a la cuenta sucesora. Nunca borra asientos.
 * - Uso:
 *     import { seedCuentas } from "./seed-cuentas";
 *     await seedCuentas(prisma);
 *   o ejecución directa:
 *     npx tsx prisma/seed-cuentas.ts
 */
import { PrismaClient } from "@prisma/client";

type FilaCatalogo = [
  codigo: string,
  nombre: string,
  tipo: string,
  padreCodigo: string | null,
];

/**
 * Catálogo objetivo. Formato: [código, nombre, tipo, códigoPadre].
 * Los tipos se mantienen alineados con `TIPOS_VALIDOS` (`lib/plan-contable.ts`)
 * y `TIPOS_CUENTA` (`lib/services/cuentas.service.ts`).
 */
export const CATALOGO_CUENTAS: FilaCatalogo[] = [
  // =========================
  // ACTIVO
  // =========================
  ["1", "Activo", "Activo", null],
  ["101", "Caja", "Activo", "1"],
  ["104", "Bancos - Cuentas Corrientes", "Activo", "1"],
  ["121", "Cuentas por Cobrar Comerciales - Terceros", "Activo", "1"],
  // IGV por acreditar en compras (crédito fiscal pendiente de aplicar).
  ["167", "Tributos por Acreditar - IGV", "Activo", "1"],
  // Mercaderías, Materias Primas y Materiales Auxiliares son cuentas
  // independientes: no se mezclan.
  ["201", "Mercaderías", "Activo", "1"],
  ["241", "Materias Primas", "Activo", "1"],
  ["251", "Materiales Auxiliares, Suministros y Repuestos", "Activo", "1"],
  // Maquinaria dentro de Propiedad, Planta y Equipo, con su depreciación
  // acumulada en cuenta separada.
  ["331", "Propiedad, Planta y Equipo - Maquinaria y Equipos", "Activo", "1"],
  ["395", "Depreciación Acumulada de Propiedad, Planta y Equipo", "Activo", "1"],

  // =========================
  // PASIVO
  // =========================
  ["2", "Pasivo", "Pasivo", null],
  ["411", "Remuneraciones por Pagar", "Pasivo", "2"],
  ["421", "Cuentas por Pagar Comerciales - Terceros", "Pasivo", "2"],
  ["461", "Cuentas por Pagar Diversas - Terceros", "Pasivo", "2"],
  // IGV/tributos por pagar generado por las ventas (débito fiscal).
  ["401", "Tributos por Pagar - IGV", "Pasivo", "2"],

  // =========================
  // PATRIMONIO
  // =========================
  ["3", "Patrimonio", "Patrimonio", null],
  ["501", "Capital", "Patrimonio", "3"],
  ["591", "Resultados Acumulados", "Patrimonio", "3"],

  // =========================
  // INGRESOS
  // =========================
  ["4", "Ingresos", "Ingreso", null],
  ["701", "Ventas de Mercaderías", "Ingreso", "4"],
  // Sólo cuando el cliente paga un importe separado por el delivery.
  ["704", "Prestación de Servicios", "Ingreso", "4"],

  // =========================
  // GASTOS
  // =========================
  // "Gastos" es la categoría general; "Gastos de Administración" no existe
  // como cuenta concreta.
  ["5", "Gastos", "Gasto", null],
  ["621", "Gastos de Personal", "Gasto", "5"],
  ["631", "Gastos de Servicios Básicos", "Gasto", "5"],
  ["635", "Gastos de Arrendamiento", "Gasto", "5"],
  ["637", "Publicidad y Promociones", "Gasto", "5"],
  // Delivery asumido por la pollería (costo/gasto propio, no ingreso).
  ["634", "Gastos de Transporte y Delivery", "Gasto", "5"],
  ["636", "Gastos de Mantenimiento", "Gasto", "5"],
  ["659", "Otros Gastos de Gestión", "Gasto", "5"],
  ["673", "Gastos Financieros", "Gasto", "5"],

  // =========================
  // COSTO DE VENTAS
  // =========================
  // Separado de Gastos.
  ["6", "Costo de Ventas", "Costo", null],
  ["691", "Costo de Ventas de Mercaderías", "Costo", "6"],
];

/**
 * Renombres código antiguo → código nuevo, en orden seguro.
 *
 * Varios códigos antiguos colisionan con códigos nuevos de distinto significado
 * (121, 167, 201, 401, 501). El orden libera primero esos slots:
 * se mueve la cuenta que ocupa el slot (p. ej. 167 antigua → 395) antes de
 * crear la nueva (p. ej. 108 → 167). Alterar este orden puede provocar
 * violaciones del índice único de `codigo`.
 */
const RENOMBRES_ORDENADOS: Array<{ desde: string; hacia: string }> = [
  // Liberan slots colisionados (destinos fuera del catálogo antiguo).
  { desde: "167", hacia: "395" }, // Depreciación Acumulada de Maquinaria → Deprec. PPE
  { desde: "201", hacia: "421" }, // Cuentas por Pagar Comerciales → CxP Comerciales - Terceros
  { desde: "401", hacia: "701" }, // Ventas de Mercaderías → Ventas de Mercaderías
  { desde: "501", hacia: "621" }, // Gastos de Personal → Gastos de Personal
  // Renombres sin colisión.
  { desde: "102", hacia: "104" }, // Bancos - Cuenta Corriente → Bancos - Cuentas Corrientes
  { desde: "161", hacia: "331" }, // Maquinaria y Equipos → PPE - Maquinaria y Equipos
  { desde: "202", hacia: "411" }, // Remuneraciones por Pagar (mismo nombre, código PCGE)
  { desde: "204", hacia: "461" }, // Cuentas por Pagar Diversas → CxP Diversas - Terceros
  { desde: "302", hacia: "591" }, // Resultados Acumulados (mismo nombre)
  { desde: "402", hacia: "704" }, // Ingresos por Servicio de Delivery → Prestación de Servicios
  { desde: "502", hacia: "631" }, // Gastos de Servicios Básicos
  { desde: "503", hacia: "635" }, // Gastos de Arrendamiento
  { desde: "504", hacia: "637" }, // Publicidad y Promociones
  { desde: "505", hacia: "634" }, // Gastos de Transporte y Delivery
  { desde: "506", hacia: "636" }, // Gastos de Mantenimiento
  { desde: "507", hacia: "659" }, // Gastos Varios de Administración → Otros Gastos de Gestión
  { desde: "601", hacia: "691" }, // Costo de Mercadería Vendida → Costo de Ventas de Mercaderías
  // Con los slots ya libres, se completan las migraciones restantes.
  { desde: "105", hacia: "121" }, // Cuentas por Cobrar Comerciales → CxC Comerciales - Terceros
  { desde: "108", hacia: "167" }, // IGV Compras a Creditables → Tributos por Acreditar - IGV
  // 120 "Mercaderías e Insumos" se separa en 201/241/251. El historial existente
  // se consolida en 201 Mercaderías; 241 y 251 nacen sin movimientos.
  { desde: "120", hacia: "201" },
  { desde: "206", hacia: "401" }, // Impuestos por Pagar - IGV → Tributos por Pagar - IGV
  { desde: "301", hacia: "501" }, // Capital Social → Capital
];

/** Código antiguo que se elimina sin sucesora directa. */
const CODIGO_AJUSTES_ELIMINADO = "121"; // "Ajustes de Inventario" (código antiguo)
/** Código temporal para archivar la cuenta eliminada si tiene movimientos. */
const CODIGO_AJUSTES_ARCHIVO = "121-OLD";

type Db = Pick<PrismaClient, "cuenta_contable" | "detalle_asiento_contable">;

/** Catálogo nuevo indexado por código, para no confundir cuentas ya migradas. */
const CATALOGO_POR_CODIGO = new Map(
  CATALOGO_CUENTAS.map(([codigo, nombre, tipo]) => [codigo, { nombre, tipo }])
);

async function migrarCodigo(db: Db, desde: string, hacia: string): Promise<void> {
  if (desde === hacia) return;
  const origen = await db.cuenta_contable.findUnique({ where: { codigo: desde } });
  if (!origen) return;
  // Idempotencia: si el slot `desde` ya contiene la cuenta NUEVA (mismo nombre y
  // tipo que el catálogo), no es la cuenta antigua: no se migra. Sin este
  // control, una segunda ejecución movería los detalles de la cuenta nueva
  // (p. ej. 167 "Tributos por Acreditar" → 395) y la recrearía con otro id.
  const esperado = CATALOGO_POR_CODIGO.get(desde);
  if (esperado && origen.nombre === esperado.nombre && origen.tipo === esperado.tipo) return;
  const destino = await db.cuenta_contable.findUnique({ where: { codigo: hacia } });
  if (!destino) {
    // Renombre directo: conserva el id y, con él, las FK de los detalles.
    await db.cuenta_contable.update({
      where: { codigo: desde },
      data: { codigo: hacia },
    });
    console.log(`  ↻ ${desde} → ${hacia} (renombre, se conservan asientos)`);
    return;
  }
  // Ambas existen: se mueven los detalles a la sucesora y se retira la antigua.
  await db.detalle_asiento_contable.updateMany({
    where: { id_cuenta_contable: origen.id_cuenta_contable },
    data: { id_cuenta_contable: destino.id_cuenta_contable },
  });
  await retirarCuenta(db, origen.id_cuenta_contable, desde);
  console.log(`  ↻ ${desde} → ${hacia} (detalles movidos)`);
}

async function retirarCuenta(db: Db, id: number, codigo: string): Promise<void> {
  const [usos, hijos] = await Promise.all([
    db.detalle_asiento_contable.count({ where: { id_cuenta_contable: id } }),
    db.cuenta_contable.count({ where: { id_cuenta_padre: id } }),
  ]);
  if (usos === 0 && hijos === 0) {
    await db.cuenta_contable.delete({ where: { id_cuenta_contable: id } });
    console.log(`  ✕ ${codigo} eliminada (sin movimientos)`);
  } else {
    // Con FK RESTRICT no se puede borrar: se desactiva para no romper asientos.
    await db.cuenta_contable.update({
      where: { id_cuenta_contable: id },
      data: { activo: false },
    });
    console.log(`  ⊘ ${codigo} desactivada (${usos} líneas, ${hijos} hijas conservadas)`);
  }
}

/**
 * Elimina la cuenta de "Ajustes de Inventario" (código antiguo 121).
 * Si tiene movimientos o hijas no se borra: se archiva con un código temporal
 * para liberar el slot "121" (nueva CxC Comerciales - Terceros) sin romper FKs.
 */
async function eliminarAjustesInventario(db: Db): Promise<void> {
  const cuenta = await db.cuenta_contable.findUnique({
    where: { codigo: CODIGO_AJUSTES_ELIMINADO },
  });
  // Si el slot 121 ya es la cuenta nueva, no hay nada que archivar.
  if (!cuenta || cuenta.nombre === "Cuentas por Cobrar Comerciales - Terceros") return;
  const [usos, hijos] = await Promise.all([
    db.detalle_asiento_contable.count({
      where: { id_cuenta_contable: cuenta.id_cuenta_contable },
    }),
    db.cuenta_contable.count({ where: { id_cuenta_padre: cuenta.id_cuenta_contable } }),
  ]);
  if (usos === 0 && hijos === 0) {
    await db.cuenta_contable.delete({ where: { id_cuenta_contable: cuenta.id_cuenta_contable } });
    console.log(`  ✕ ${CODIGO_AJUSTES_ELIMINADO} "Ajustes de Inventario" eliminada`);
    return;
  }
  const archivoLibre = await db.cuenta_contable.findUnique({
    where: { codigo: CODIGO_AJUSTES_ARCHIVO },
  });
  if (archivoLibre) {
    await db.detalle_asiento_contable.updateMany({
      where: { id_cuenta_contable: cuenta.id_cuenta_contable },
      data: { id_cuenta_contable: archivoLibre.id_cuenta_contable },
    });
    await retirarCuenta(db, cuenta.id_cuenta_contable, CODIGO_AJUSTES_ELIMINADO);
    return;
  }
  await db.cuenta_contable.update({
    where: { id_cuenta_contable: cuenta.id_cuenta_contable },
    data: {
      codigo: CODIGO_AJUSTES_ARCHIVO,
      nombre: "Ajustes de Inventario (histórica)",
      activo: false,
    },
  });
  console.log(
    `  ⊘ ${CODIGO_AJUSTES_ELIMINADO} archivada como ${CODIGO_AJUSTES_ARCHIVO} (${usos} líneas conservadas)`
  );
}

/**
 * Crea o actualiza el catálogo completo. Reutilizable y seguro ante
 * re-ejecuciones: resuelve padres por código y aplica upsert por `codigo`.
 */
export async function seedCuentas(db: Db): Promise<void> {
  console.log("📒 Sincronizando catálogo de cuentas (PCGE 2019 simplificado)...");

  // 1. Migración del catálogo anterior preservando asientos.
  // La cuenta antigua 121 ("Ajustes de Inventario") se archiva/elimina ANTES
  // que el renombre 105 → 121: si el slot 121 siguiera ocupado por Ajustes, el
  // historial de CxC se fusionaría en la cuenta archivada en vez de quedar en
  // la nueva "Cuentas por Cobrar Comerciales - Terceros".
  await eliminarAjustesInventario(db);
  for (const { desde, hacia } of RENOMBRES_ORDENADOS) {
    await migrarCodigo(db, desde, hacia);
  }

  // 2. Upsert del catálogo objetivo (padres primero para resolver FKs).
  const ordenadas = [...CATALOGO_CUENTAS].sort((a, b) => {
    if (a[3] === null && b[3] !== null) return -1;
    if (a[3] !== null && b[3] === null) return 1;
    return a[0].localeCompare(b[0]);
  });

  for (const [codigo, nombre, tipo, padreCodigo] of ordenadas) {
    let idPadre: number | null = null;
    if (padreCodigo !== null) {
      const padre = await db.cuenta_contable.findUnique({
        where: { codigo: padreCodigo },
      });
      if (!padre) throw new Error(`Cuenta padre ${padreCodigo} no encontrada para ${codigo}.`);
      idPadre = padre.id_cuenta_contable;
    }
    await db.cuenta_contable.upsert({
      where: { codigo },
      update: { nombre, tipo, id_cuenta_padre: idPadre, activo: true },
      create: { codigo, nombre, tipo, id_cuenta_padre: idPadre, activo: true },
    });
  }
  console.log(`✔ Catálogo sincronizado (${ordenadas.length} cuentas).`);

  // 3. Verificaciones: sin duplicados y jerarquía correcta.
  const todas = await db.cuenta_contable.findMany({
    select: { codigo: true, nombre: true, tipo: true, id_cuenta_padre: true },
  });
  const vistos = new Set<string>();
  for (const c of todas) {
    if (vistos.has(c.codigo)) throw new Error(`Cuenta duplicada: ${c.codigo}.`);
    vistos.add(c.codigo);
  }
  const porCodigo = new Map(todas.map((c) => [c.codigo, c]));
  const esperadas = new Map(CATALOGO_CUENTAS.map(([c, n, t, p]) => [c, { n, t, p }]));
  for (const [codigo, esp] of esperadas) {
    const real = porCodigo.get(codigo);
    if (!real) throw new Error(`Falta la cuenta ${codigo} tras el seed.`);
    if (real.nombre !== esp.n || real.tipo !== esp.t) {
      throw new Error(`Cuenta ${codigo} con datos distintos a los esperados.`);
    }
    const padreReal = real.id_cuenta_padre === null ? null : "con-padre";
    const padreEsp = esp.p === null ? null : "con-padre";
    if (padreReal !== padreEsp) throw new Error(`Jerarquía incorrecta en ${codigo}.`);
  }
  console.log("✔ Verificación: sin duplicados y jerarquía correcta.");
}

// Ejecución directa: `npx tsx prisma/seed-cuentas.ts`
const ejecutadoDirecto =
  typeof process !== "undefined" &&
  !!process.argv[1] &&
  (process.argv[1].endsWith("seed-cuentas.ts") || process.argv[1].endsWith("seed-cuentas.js"));

if (ejecutadoDirecto) {
  const prisma = new PrismaClient();
  seedCuentas(prisma)
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error("❌ Error al sincronizar cuentas:", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
