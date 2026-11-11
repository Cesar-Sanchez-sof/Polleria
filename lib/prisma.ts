import { PrismaClient, type Prisma } from "@prisma/client";

// Asegura que en el entorno de ejecución Node.js la zona horaria predeterminada sea Perú (Trujillo, La Libertad / America/Lima, UTC-5)
if (!process.env.TZ) {
  process.env.TZ = "America/Lima";
}

function appendQueryParam(url: string, key: string, value: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${key}=${value}`;
}

export function configureDatabaseUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return rawUrl;

  let url = rawUrl;
  if (!url.includes("timezone=")) {
    url = appendQueryParam(url, "options", "-c%20timezone=America/Lima");
  }

  // Ampliar el pool local de Prisma para concurrencia HTTP (>= 50 VUs) evitando colas artificiales
  if (!/[?&]connection_limit=/.test(url)) {
    const rawLimit = Number(process.env.PRISMA_CONNECTION_LIMIT);
    const defaultLimit = url.includes("-pooler") ? 80 : 40;
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit;
    url = appendQueryParam(url, "connection_limit", String(limit));
  }

  if (!/[?&]pool_timeout=/.test(url)) {
    url = appendQueryParam(url, "pool_timeout", "20");
  }

  return url;
}

const configuredUrl = configureDatabaseUrl(process.env.DATABASE_URL);
if (configuredUrl) {
  process.env.DATABASE_URL = configuredUrl;
}

const prismaLogs: Prisma.LogLevel[] =
  process.env.PRISMA_LOG_QUERIES === "1"
    ? ["query", "info", "warn", "error"]
    : process.env.NODE_ENV === "production"
      ? ["error"]
      : ["warn", "error"];

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: prismaLogs,
  });

globalForPrisma.prisma = prisma;
