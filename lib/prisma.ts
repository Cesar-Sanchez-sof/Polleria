import { PrismaClient } from "@prisma/client";

// Asegura que en el entorno de ejecución Node.js la zona horaria predeterminada sea Perú (Trujillo, La Libertad / America/Lima, UTC-5)
if (!process.env.TZ) {
  process.env.TZ = "America/Lima";
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "info", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
