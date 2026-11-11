import { describe, it, expect, beforeEach, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/permissions";
import {
  createApiHandler,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/http/route-handler";
import {
  realtimeHub,
  broadcastRealtimeEvent,
} from "@/lib/realtime/event-emitter";
import { GET as realtimeGET, POST as realtimePOST } from "@/app/api/realtime/route";
import {
  API_CATALOG,
  buildCatalogUrls,
} from "@/scripts/load-tests/api-catalog.mjs";

const ROOT = process.cwd();

function collectApiRouteFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      collectApiRouteFiles(fullPath, acc);
    } else if (entry === "route.ts") {
      acc.push(fullPath);
    }
  }
  return acc;
}

describe("Evaluación CA-01: Concurrencia de Peticiones HTTP a Todas las APIs", () => {
  beforeEach(() => {
    realtimeHub.reset();
    vi.clearAllMocks();
  });

  describe("1. Cobertura integral del inventario de rutas app/api/**", () => {
    it("el catálogo de pruebas de carga cubre el 100% de los Route Handlers existentes en app/api/", () => {
      const routeFiles = collectApiRouteFiles(join(ROOT, "app", "api"));
      expect(routeFiles.length).toBeGreaterThanOrEqual(90);

      const catalogByRoute = new Map(API_CATALOG.map((item) => [item.route, item]));
      const missingRoutes: string[] = [];
      const missingMethods: string[] = [];

      for (const filePath of routeFiles) {
        const relativeRoute =
          "/" +
          filePath
            .replace(ROOT + sep, "")
            .split(sep)
            .join("/")
            .replace(/^app\//, "")
            .replace(/\/route\.ts$/, "");

        const entry = catalogByRoute.get(relativeRoute);
        if (!entry) {
          missingRoutes.push(relativeRoute);
          continue;
        }

        const source = readFileSync(filePath, "utf-8");
        const exportedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"].filter(
          (method) =>
            source.includes(`export const ${method}`) ||
            source.includes(`export async function ${method}`) ||
            source.includes(`export function ${method}`)
        );

        for (const method of exportedMethods) {
          if (!entry.methods.includes(method)) {
            missingMethods.push(`${relativeRoute} -> ${method}`);
          }
        }
      }

      expect(missingRoutes, `Rutas sin inventario de carga: ${missingRoutes.join(", ")}`).toEqual([]);
      expect(missingMethods, `Métodos HTTP faltantes en catálogo: ${missingMethods.join(", ")}`).toEqual([]);
    });

    it("todos los endpoints seguros de lectura resuelven URLs concretas con query params válidos", () => {
      const resolved = buildCatalogUrls({
        today: "2026-11-10",
        year: 2026,
        month: 11,
        monthStart: "2026-11-01",
        ids: { order: 15, account: 4 },
      });

      const readable = resolved.filter((e) => e.safety === "read");
      expect(readable.length).toBeGreaterThanOrEqual(55);

      for (const entry of readable) {
        expect(entry.url.startsWith("/api/")).toBe(true);
        expect(entry.url).not.toContain("[");
        expect(entry.url).not.toContain("]");
      }
    });
  });

  describe("2. Aislamiento de contexto y manejo de errores bajo ráfagas HTTP concurrentes", () => {
    it("soporta 90 invocaciones HTTP paralelas multi-usuario en createApiHandler sin mezcla de sesiones ni payloads", async () => {
      interface RequestActor {
        userId: number;
        username: string;
        role: string;
      }

      const actorStorage = new AsyncLocalStorage<RequestActor>();

      vi.mocked(authorize).mockImplementation(async () => {
        const actor = actorStorage.getStore() ?? {
          userId: 1,
          username: "fallback",
          role: "ADMIN",
        };
        // Simula latencia asíncrona variable de validación de sesión/RBAC
        await new Promise((r) => setTimeout(r, actor.userId % 5));
        return {
          ok: true,
          session: actor,
          superuser: actor.role === "ADMIN",
        };
      });

      const handler = createApiHandler<{ orderRef: string; amount: number }, { domain: string }>({
        permission: "ventas.crear",
        handler: async ({ body, params, session, searchParams }) => {
          await new Promise((r) => setTimeout(r, (body.amount % 4) + 1));
          return NextResponse.json({
            userId: session?.userId,
            username: session?.username,
            domain: params.domain,
            orderRef: body.orderRef,
            trace: searchParams.get("trace"),
          });
        },
      });

      const totalRequests = 90;
      const tasks = Array.from({ length: totalRequests }, (_, idx) => {
        const actor: RequestActor = {
          userId: 100 + idx,
          username: `mozo_${idx}`,
          role: idx % 3 === 0 ? "ADMIN" : "MOZO",
        };
        const domain = idx % 2 === 0 ? "sales" : "orders";
        const req = new NextRequest(
          `http://localhost:3000/api/${domain}?trace=req-${idx}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderRef: `ORD-${idx}`, amount: 20 + idx }),
          }
        );

        return actorStorage.run(actor, async () => {
          const res = await handler(req, { params: Promise.resolve({ domain }) });
          const data = (await res.json()) as {
            userId: number;
            username: string;
            domain: string;
            orderRef: string;
            trace: string;
          };
          return { idx, status: res.status, data };
        });
      });

      const results = await Promise.all(tasks);

      expect(results).toHaveLength(totalRequests);
      for (const r of results) {
        expect(r.status).toBe(200);
        expect(r.data.userId).toBe(100 + r.idx);
        expect(r.data.username).toBe(`mozo_${r.idx}`);
        expect(r.data.orderRef).toBe(`ORD-${r.idx}`);
        expect(r.data.trace).toBe(`req-${r.idx}`);
      }
    });

    it("mapea determinísticamente errores concurrentes (400, 403, 404, 409, 200) sin fugas de estado", async () => {
      vi.mocked(authorize).mockResolvedValue({
        ok: true,
        session: { userId: 1, username: "admin", role: "ADMIN" },
        superuser: true,
      });

      const handler = createApiHandler<unknown>({
        permission: "pedidos.ver",
        handler: async ({ searchParams }) => {
          const mode = searchParams.get("mode");
          if (mode === "400") throw new ValidationError("Payload inválido");
          if (mode === "403") throw new ForbiddenError("Sin acceso");
          if (mode === "404") throw new NotFoundError("No existe");
          if (mode === "409") throw new ConflictError("Mesa ya cobrada");
          return NextResponse.json({ ok: true });
        },
      });

      const modes = ["200", "400", "403", "404", "409"] as const;
      const batch = Array.from({ length: 100 }, (_, i) => {
        const expectedMode = modes[i % modes.length];
        const req = new NextRequest(`http://localhost:3000/api/test?mode=${expectedMode}`);
        return handler(req).then((res) => ({
          expectedStatus: Number(expectedMode),
          actualStatus: res.status,
        }));
      });

      const outcomes = await Promise.all(batch);
      for (const item of outcomes) {
        expect(item.actualStatus).toBe(item.expectedStatus);
      }
    });
  });

  describe("3. Concurrencia de conexiones SSE y broadcasts en /api/realtime", () => {
    it("soporta 200 clientes SSE concurrentes recibiendo 50 broadcasts paralelos y limpia al desconectar", async () => {
      vi.mocked(authorize).mockResolvedValue({
        ok: true,
        session: { userId: 1, username: "cajero", role: "CAJERO" },
        superuser: false,
      });

      const receivedPerClient: number[] = Array(200).fill(0);
      const cleanups: Array<() => void> = [];

      // 1. Conectar 200 clientes SSE simulados en paralelo
      for (let i = 0; i < 200; i++) {
        const controller = {
          enqueue: vi.fn(() => {
            receivedPerClient[i]++;
          }),
          close: vi.fn(),
        } as unknown as ReadableStreamDefaultController<Uint8Array>;
        cleanups.push(realtimeHub.addSSEClient(controller));
      }

      expect(realtimeHub.getActiveClientCount()).toBe(200);

      // 2. Disparar 50 eventos HTTP POST /api/realtime simultáneos
      const postBatch = Array.from({ length: 50 }, (_, idx) => {
        const req = new NextRequest("http://localhost:3000/api/realtime", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "ORDER_CREATED",
            payload: { orderId: idx + 1 },
          }),
        });
        return realtimePOST(req);
      });

      const responses = await Promise.all(postBatch);
      expect(responses.every((r) => r.status === 200)).toBe(true);

      // 200 clientes x 50 eventos = 10,000 entregas exitosas sin pérdida
      const totalDeliveries = receivedPerClient.reduce((a, b) => a + b, 0);
      expect(totalDeliveries).toBe(10_000);

      // 3. Desconexión concurrente de todos los clientes + apertura/cierre de stream GET
      await Promise.all(cleanups.map((fn) => Promise.resolve(fn())));
      expect(realtimeHub.getActiveClientCount()).toBe(0);

      // 4. Broadcast con stream GET real + cancelación por AbortSignal
      const abortController = new AbortController();
      const getReq = new NextRequest("http://localhost:3000/api/realtime", {
        signal: abortController.signal,
      });
      const sseRes = await realtimeGET(getReq);
      expect(sseRes.status).toBe(200);
      expect(sseRes.headers.get("Content-Type")).toContain("text/event-stream");
      broadcastRealtimeEvent("PING", { check: true });
      abortController.abort();
      await sseRes.body?.cancel();
      expect(realtimeHub.getActiveClientCount()).toBe(0);
    });
  });
});
