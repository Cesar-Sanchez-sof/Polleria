import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { USE_CASES } from "@/app/api/openapi/use-cases";
import { enrichOperations, extractPermissions } from "@/app/api/openapi/enrich";
import { GET as getSpec } from "@/app/api/openapi/route";

const API = join(process.cwd(), "app", "api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "openapi" ? [] : routeFiles(p);
    return f === "route.ts" ? [p] : [];
  });
}

/** Todas las operaciones "MÉTODO /api/ruta" del código. */
function operations(): string[] {
  const ops: string[] = [];
  for (const file of routeFiles(API)) {
    const url = "/api/" + file.slice(API.length + 1).replace(/\\/g, "/").replace(/\/?route\.ts$/, "").replace(/\[([^\]]+)\]/g, "{$1}");
    for (const method of Object.keys(extractPermissions(readFileSync(file, "utf8")))) ops.push(`${method} ${url.replace(/\/$/, "")}`);
  }
  return ops;
}

describe("documentación OpenAPI: casos de uso", () => {
  it("cada endpoint de app/api tiene al menos un caso de uso", () => {
    const missing = operations().filter((op) => !USE_CASES[op]?.uses.length);
    expect(missing).toEqual([]);
  });

  it("el catálogo no tiene entradas de endpoints que ya no existen", () => {
    const real = new Set(operations());
    expect(Object.keys(USE_CASES).filter((k) => !real.has(k))).toEqual([]);
  });

  it("extrae los permisos RBAC por método", () => {
    const perms = extractPermissions(
      'export const GET = createApiHandler({ permission: ["a.ver", "b.ver"] });\nexport const POST = createApiHandler({ permission: "a.crear" });',
    );
    expect(perms).toEqual({ GET: ["a.ver", "b.ver"], POST: ["a.crear"] });
  });

  it("enrich agrega permiso, casos de uso y respuestas de error", () => {
    const spec = { openapi: "3.0.3", info: { title: "t", version: "1" }, paths: { "/api/orders": { get: { responses: {} } } } };
    enrichOperations(spec as never, new Map([["GET /api/orders", ["pedidos.ver"]]]));
    const op = (spec.paths["/api/orders"] as { get: { description: string; responses: Record<string, unknown>; tags: string[] } }).get;
    expect(op.description).toContain("`pedidos.ver`");
    expect(op.description).toContain("**Casos de uso:**");
    expect(Object.keys(op.responses)).toEqual(expect.arrayContaining(["400", "401", "403", "500"]));
  });

  it("GET /api/openapi publica el spec con casos de uso en todas las operaciones", async () => {
    const spec = (await (await getSpec()).json()) as { paths: Record<string, Record<string, { description?: string; tags?: string[] }>> };
    const without: string[] = [];
    for (const [path, item] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(item)) {
        if (path === "/api/openapi") continue;
        if (!op.description?.includes("Casos de uso")) without.push(`${method.toUpperCase()} ${path}`);
        if (!op.tags?.length) without.push(`(sin tag) ${method.toUpperCase()} ${path}`);
      }
    }
    expect(without).toEqual([]);
  });
});
