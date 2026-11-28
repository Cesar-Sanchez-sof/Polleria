/**
 * Vacía TODOS los datos de la base (conserva las tablas y el historial de migraciones).
 * Después hay que volver a sembrar (`npm run db:seed`); `npm run db:reset` hace todo en orden:
 *   respaldo → vaciado → seeds.
 *
 * Seguridad:
 *  - Exige `--yes`.
 *  - Muestra el servidor al que se conecta y espera 5 segundos (Ctrl+C para cancelar).
 *  - En NODE_ENV=production exige además `--allow-production`.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

function target(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(DATABASE_URL no definida o inválida)";
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.includes("--yes")) {
    console.error("Este comando BORRA todos los datos. Vuelve a ejecutarlo con --yes para confirmar.");
    process.exitCode = 1;
    return;
  }
  if (process.env.NODE_ENV === "production" && !args.includes("--allow-production")) {
    console.error("NODE_ENV=production: se necesita además --allow-production.");
    process.exitCode = 1;
    return;
  }

  console.log(`⚠  Se vaciarán TODOS los datos de: ${target()}`);
  console.log("   Esperando 5 segundos… (Ctrl+C para cancelar)");
  await new Promise((r) => setTimeout(r, 5000));

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) {
    console.log("No hay tablas para vaciar.");
    return;
  }
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  console.log(`✔ ${tables.length} tablas vaciadas y contadores reiniciados.`);
}

main()
  .catch((e) => {
    console.error("❌ Error al vaciar la base de datos:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
