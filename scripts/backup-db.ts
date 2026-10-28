import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function backup() {
  console.log("🔍 Conectando a la base de datos para iniciar el respaldo completo...");
  const tables: Array<{ table_name: string }> = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups", `backup-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`📁 Carpeta de destino creada: ${backupDir}`);
  const summary: Record<string, number> = {};

  for (const { table_name } of tables) {
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "${table_name}"`);
      fs.writeFileSync(
        path.join(backupDir, `${table_name}.json`),
        JSON.stringify(rows, (key, value) => (typeof value === "bigint" ? value.toString() : value), 2),
        "utf-8"
      );
      summary[table_name] = rows.length;
      console.log(`✔ Tabla '${table_name}': ${rows.length} filas respaldadas.`);
    } catch (err: any) {
      console.error(`❌ Error en tabla '${table_name}':`, err.message);
    }
  }

  fs.writeFileSync(
    path.join(backupDir, "_summary.json"),
    JSON.stringify({ timestamp, tablesCount: tables.length, summary }, null, 2),
    "utf-8"
  );

  console.log(`\n🎉 Respaldo completado con éxito sin alterar datos.`);
  console.log(`Total tablas respaldadas: ${tables.length}`);
}

backup()
  .catch((e) => {
    console.error("❌ Error en el proceso de respaldo:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
