import { PrismaClient } from "@prisma/client";
import { seedRolesPermissions } from "../prisma/seed-roles";
import { seedBranding } from "../prisma/seed-branding";

/** Sincroniza los permisos (incluye «personalizacion») y deja la personalización lista: `npx tsx scripts/seed-branding.ts`. */
async function main() {
  const prisma = new PrismaClient();
  try {
    await seedRolesPermissions(prisma);
    await seedBranding(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
