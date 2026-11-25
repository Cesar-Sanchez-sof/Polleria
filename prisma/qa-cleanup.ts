/**
 * Borra los datos que deja `scripts/qa-smoke-rrhh-seguridad.mjs`: empleados con DNI 999xxxxx (o 99xxxxxx llamados «QA») (y, en cascada,
 * sus usuarios, contratos y asistencia), usuarios «qa.*», roles «QA …» y horarios «QA evento …».
 * Uso: npx tsx prisma/qa-cleanup.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

async function main() {
  const shifts = await prisma.shift.deleteMany({ where: { name: { startsWith: "QA evento" } } });
  const employees = await prisma.employee.deleteMany({
    where: { OR: [{ dni: { startsWith: "999" } }, { dni: { startsWith: "99" }, firstName: "QA" }] },
  });
  const users = await prisma.user.deleteMany({ where: { username: { startsWith: "qa." } } });
  const roles = await prisma.role.deleteMany({ where: { name: { startsWith: "QA " }, isSystem: false } });
  console.log("Datos de QA eliminados:", { shifts: shifts.count, employees: employees.count, users: users.count, roles: roles.count });
}

main()
  .catch((e) => {
    console.error("❌", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
