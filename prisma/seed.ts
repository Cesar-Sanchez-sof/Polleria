/**
 * Orquestador de seeds. Ejecuta, en orden:
 *   1. Configuración inicial  (prisma/seeds/01-config.ts)  · obligatorio
 *   2. Datos maestros         (prisma/seeds/02-master.ts)
 *   3. Datos de demostración  (prisma/seeds/03-demo.ts)    · se omite con SEED_DEMO=false
 *
 * Uso:
 *   npm run db:seed                 → corre los tres seeds (idempotente)
 *   npm run db:seed -- --auto       → igual, pero se salta todo si la base ya está sembrada
 *                                      (es lo que ejecutan `npm run dev` y `npm start` al arrancar)
 *   npm run db:seed -- --only=config|master|demo
 *   npm run db:reset                → respaldo + vaciado de TODA la base + seeds (ver prisma/reset-db.ts)
 *
 * Es seguro ejecutarlo varias veces: nunca borra ni pisa datos existentes.
 */
import { PrismaClient } from "@prisma/client";
import { PERMISSIONS_CATALOG } from "../lib/auth/permissions-catalog";

// Cliente compartido: los servicios del sistema (importados por el seed de demostración) reutilizan este mismo.
const g = globalThis as unknown as { prisma?: PrismaClient };
g.prisma = new PrismaClient({ log: ["warn", "error"] });
const prisma = g.prisma;

/** ¿Ya está sembrada la configuración mínima? (consulta barata para el arranque automático) */
async function alreadySeeded(): Promise<boolean> {
  const [admin, permissions, accounts, products] = await Promise.all([
    prisma.user.count({ where: { username: "admin" } }),
    prisma.permission.count(),
    prisma.accountingAccount.count(),
    prisma.product.count(),
  ]);
  return admin > 0 && permissions === PERMISSIONS_CATALOG.length && accounts > 0 && products > 0;
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];

  if (args.includes("--auto") && (await alreadySeeded())) {
    console.log("🌱 Base de datos ya inicializada: no hace falta sembrar.");
    return;
  }

  console.log("🌱 Poblando la base de datos de la Pollería…");
  const { seedConfig } = await import("./seeds/01-config");
  const { seedMaster } = await import("./seeds/02-master");
  const { seedDemo } = await import("./seeds/03-demo");

  if (!only || only === "config") await seedConfig(prisma);
  if (!only || only === "master") await seedMaster(prisma);
  if (!only || only === "demo") await seedDemo(prisma);

  console.log("\n✨ Seeds completados.");
  console.log("   Usuario administrador: admin / contraseña inicial «Password123!» (cámbiala al ingresar).");
}

main()
  .catch((e) => {
    console.error("❌ Error al poblar la base de datos:", e);
    // En el arranque automático un fallo del seed no debe impedir levantar el sistema.
    if (!process.argv.includes("--auto")) process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
