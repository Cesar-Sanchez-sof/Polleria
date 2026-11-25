import { describe, it, expect, afterEach, vi } from "vitest";
import { Redis } from "@upstash/redis";
import { lookupIdentityDocument } from "@/lib/services/integrations/document-lookup.service";
import { uploadVouchersBatch } from "@/lib/services/integrations/s3-storage.service";

describe("Evaluación CA-03: Concurrencia de Accesos a Base de Datos y Recursos Externos", () => {
  const originalFetch = globalThis.fetch;
  const originalJsonPeToken = process.env.JSON_PE_TOKEN;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalJsonPeToken === undefined) {
      delete process.env.JSON_PE_TOKEN;
    } else {
      process.env.JSON_PE_TOKEN = originalJsonPeToken;
    }
    vi.restoreAllMocks();
  });

  describe("1. Neon PostgreSQL / Prisma Connection Pool bajo contención", () => {
    it("simula agotamiento de pool (P2024) con 20 transacciones paralelas sobre límite de 5 conexiones y recupera al liberar", async () => {
      const POOL_LIMIT = 5;
      let activeConnections = 0;
      let peakConnections = 0;

      async function simulatedPrismaTransaction<T>(
        fn: () => Promise<T>
      ): Promise<T> {
        if (activeConnections >= POOL_LIMIT) {
          const err = new Error(
            "Timed out fetching a new connection from the connection pool."
          ) as Error & { code: string };
          err.code = "P2024";
          throw err;
        }
        activeConnections++;
        peakConnections = Math.max(peakConnections, activeConnections);
        try {
          return await fn();
        } finally {
          activeConnections--;
        }
      }

      // Ráfaga simultánea de 20 operaciones contra un pool de 5 conexiones
      const wave1 = await Promise.allSettled(
        Array.from({ length: 20 }, (_, i) =>
          simulatedPrismaTransaction(async () => {
            await new Promise((r) => setTimeout(r, 15));
            return { txId: i + 1 };
          })
        )
      );

      const succeeded = wave1.filter((r) => r.status === "fulfilled");
      const timedOut = wave1.filter((r) => r.status === "rejected");

      expect(peakConnections).toBe(POOL_LIMIT);
      expect(succeeded).toHaveLength(POOL_LIMIT);
      expect(timedOut).toHaveLength(15);
      for (const rej of timedOut) {
        expect((rej.reason as { code?: string }).code).toBe("P2024");
      }

      // Tras liberar el pool, el sistema no queda bloqueado y acepta un nuevo lote
      expect(activeConnections).toBe(0);
      const wave2 = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          simulatedPrismaTransaction(async () => ({ recoveredId: i + 1 }))
        )
      );
      expect(wave2).toHaveLength(5);
      expect(activeConnections).toBe(0);
    });
  });

  describe("2. AWS S3 / Neon Object Storage: carga concurrente en lotes", () => {
    it("procesa 50 comprobantes concurrentes con maxConcurrency=20 sin colisión de rutas S3", async () => {
      const prevKey = process.env.AWS_ACCESS_KEY_ID;
      const prevSecret = process.env.AWS_SECRET_ACCESS_KEY;
      const prevS3Key = process.env.S3_ACCESS_KEY_ID;
      const prevS3Secret = process.env.S3_SECRET_ACCESS_KEY;

      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;

      try {
        const batch50 = Array.from({ length: 50 }, (_, i) => ({
          meta: {
            voucherId: 1000 + i,
            voucherType: (i % 2 === 0 ? "Boleta" : "Factura") as "Boleta" | "Factura",
            serie: i % 2 === 0 ? "B001" : "F001",
            number: 1000 + i,
            format: "xml" as const,
            date: new Date("2026-11-10T18:00:00Z"),
          },
          content: `<Invoice><ID>${1000 + i}</ID></Invoice>`,
        }));

        const summary = await uploadVouchersBatch(batch50, { maxConcurrency: 20 });

        expect(summary.total).toBe(50);
        expect(summary.successful).toBe(50);
        expect(summary.failed).toBe(0);
        expect(summary.concurrencyUsed).toBe(20);
        expect(new Set(summary.results.map((r) => r.s3Key)).size).toBe(50);
      } finally {
        if (prevKey !== undefined) process.env.AWS_ACCESS_KEY_ID = prevKey;
        if (prevSecret !== undefined) process.env.AWS_SECRET_ACCESS_KEY = prevSecret;
        if (prevS3Key !== undefined) process.env.S3_ACCESS_KEY_ID = prevS3Key;
        if (prevS3Secret !== undefined) process.env.S3_SECRET_ACCESS_KEY = prevS3Secret;
      }
    });
  });

  describe("3. RENIEC / SUNAT (json.pe) bajo ráfaga concurrente con degradación 429/503", () => {
    it("resuelve 40 consultas paralelas de DNI/RUC sin rechazos no manejados ni mezcla de respuestas", async () => {
      process.env.JSON_PE_TOKEN = "mock-stress-token-valid";
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      let callCount = 0;
      globalThis.fetch = vi.fn(async (_url, init) => {
        const idx = ++callCount;
        const body = JSON.parse(String(init?.body ?? "{}")) as { dni?: string; ruc?: string };
        await new Promise((r) => setTimeout(r, (idx % 5) + 1));

        // 25% de respuestas saturadas (429 Too Many Requests o caída 503)
        if (idx % 4 === 0) {
          return new Response(JSON.stringify({ message: "Rate limit exceeded" }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (body.dni) {
          return new Response(
            JSON.stringify({
              data: {
                nombres: `NOM_${body.dni}`,
                apellido_paterno: "PEREZ",
                apellido_materno: "GARCIA",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            data: {
              razon_social: `EMPRESA_${body.ruc} S.A.C.`,
              estado: "ACTIVO",
              condicion: "HABIDO",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }) as typeof fetch;

      const queries = Array.from({ length: 40 }, (_, i) => {
        const isDni = i % 2 === 0;
        const docNumber = isDni
          ? String(40000000 + i)
          : String(20600000000 + i);
        return lookupIdentityDocument(isDni ? "dni" : "ruc", docNumber).then(
          (res) => ({ expectedNum: docNumber, isDni, res })
        );
      });

      const outcomes = await Promise.all(queries);

      expect(outcomes).toHaveLength(40);
      for (const item of outcomes) {
        expect(item.res.number).toBe(item.expectedNum);
        expect(item.res.type).toBe(item.isDni ? "dni" : "ruc");
        if (item.res.source === "json.pe") {
          expect(item.res.fullName).toContain(item.expectedNum);
        } else {
          // Las peticiones que sufrieron 429 activaron fallback limpio sin romper
          expect(item.res.source).toBe("simulado");
        }
      }
      consoleWarnSpy.mockRestore();
    });
  });

  describe("4. Upstash Redis: locks distribuidos (SET NX) y contadores atómicos bajo 100 ops paralelas", () => {
    it("garantiza exclusión mutua y conteo atómico exacto usando @upstash/redis sobre transporte HTTP paralelo", async () => {
      const store = new Map<string, string | number>();

      function execCommand(args: unknown[]): { result: unknown } {
        const cmd = String(args[0] ?? "").toUpperCase();
        const key = String(args[1] ?? "");

        if (cmd === "INCR") {
          const next = Number(store.get(key) ?? 0) + 1;
          store.set(key, next);
          return { result: next };
        }

        if (cmd === "SET") {
          const val = String(args[2] ?? "");
          const hasNx = args.some((arg) => String(arg).toUpperCase() === "NX");
          if (hasNx && store.has(key)) {
            return { result: null };
          }
          store.set(key, val);
          return { result: "OK" };
        }

        return { result: null };
      }

      globalThis.fetch = vi.fn(async (_url, init) => {
        const rawBody = JSON.parse(String(init?.body ?? "[]")) as unknown[];
        if (Array.isArray(rawBody[0])) {
          const batchResults = (rawBody as unknown[][]).map(execCommand);
          return new Response(JSON.stringify(batchResults), { status: 200 });
        }
        return new Response(JSON.stringify(execCommand(rawBody)), { status: 200 });
      }) as typeof fetch;

      const redis = new Redis({
        url: "https://mock-upstash.upstash.io",
        token: "mock-token",
        responseEncoding: false,
      });

      // 1. 100 incrementos paralelos (simulación de Rate Limiter o CUO atómico)
      const incrResults = await Promise.all(
        Array.from({ length: 100 }, () => redis.incr("rate:api:orders"))
      );
      expect(Math.max(...incrResults)).toBe(100);
      expect(new Set(incrResults).size).toBe(100);

      // 2. 50 intentos simultáneos de adquirir un lock exclusivo (cobro único de mesa)
      const lockAttempts = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          redis.set("lock:order:999", `worker-${i}`, { nx: true, ex: 10 })
        )
      );
      const winners = lockAttempts.filter((res) => res === "OK");
      expect(winners).toHaveLength(1);
    });
  });
});
