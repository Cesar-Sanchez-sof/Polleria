import dotenv from "dotenv";
dotenv.config();

import { prisma } from "../lib/prisma";

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number;
    created_at: string;
    issued_at: string;
    fecha_lima: string;
  }>>(`
    SELECT id, created_at::text, issued_at::text, ((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')::date::text AS fecha_lima
    FROM sales_invoice
    WHERE created_at > '2026-11-10 00:40:00+00'
      AND EXTRACT(HOUR FROM ((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')) >= 19
    ORDER BY id;
  `);

  console.log("RESULTADO_CONSULTA:", JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
