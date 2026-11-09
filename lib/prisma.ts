import { PrismaClient } from "@prisma/client";

// Asegura que en el entorno de ejecución Node.js la zona horaria predeterminada sea Perú (Trujillo, La Libertad / America/Lima, UTC-5)
if (!process.env.TZ) {
  process.env.TZ = "America/Lima";
}

// Inyecta automáticamente el huso horario oficial de Trujillo, La Libertad (America/Lima) en DATABASE_URL si no está presente
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("timezone=")) {
  const separator = process.env.DATABASE_URL.includes("?") ? "&" : "?";
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}${separator}options=-c%20timezone=America/Lima`;
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "info", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
