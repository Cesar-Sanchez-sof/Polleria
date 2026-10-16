import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { PERMISSIONS_CATALOG, VALID_CODES, PERMISSION_MODULES, satisfiesPermission } from "@/lib/auth/permissions-catalog";
import { SECTIONS, linkPermission, requiredPermissions } from "@/lib/auth/route-permissions";

const ROOT = process.cwd();

function files(dir: string, name: RegExp): string[] {
  return readdirSync(dir).flatMap((f) => {
    const route = join(dir, f);
    return statSync(route).isDirectory() ? files(route, name) : name.test(f) ? [route] : [];
  });
}

/** Funciones exportadas de un archivo cuyo cuerpo NO contiene ninguna de las marcas indicadas. */
function unprotectedFunctions(route: string, marks: RegExp, names?: RegExp): string[] {
  const src = readFileSync(route, "utf8");
  const sf = ts.createSourceFile(route, src, ts.ScriptTarget.Latest, true);
  const unprotected: string[] = [];
  for (const st of sf.statements) {
    if (!ts.isFunctionDeclaration(st) || !st.name || !st.body) continue;
    if (!st.modifiers?.some((x) => x.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (names && !names.test(st.name.text)) continue;
    if (!marks.test(st.body.getText())) unprotected.push(st.name.text);
  }
  return unprotected;
}

describe("catálogo de permisos", () => {
  it("no tiene códigos repetidos y todos siguen el formato modulo.accion", () => {
    const codes = PERMISSIONS_CATALOG.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    codes.forEach((c) => expect(c).toMatch(/^[a-z]+\.(ver|crear|editar|eliminar)$/));
  });

  it("todo módulo permite 'ver' (la ventana)", () => {
    PERMISSION_MODULES.forEach((m) => expect(m.actions).toContain("ver"));
  });

  it("las rutas y los enlaces del menú solo usan permisos que existen", () => {
    const used = [
      ...Object.values(SECTIONS).flat(),
      ...["/sales", "/security/users", "/security/roles", "/security/audit", "/purchases", "/accounting", "/settings/areas"].flatMap(
        (r) => requiredPermissions(r) ?? [],
      ),
    ];
    used.forEach((c) => expect(VALID_CODES.has(c), c).toBe(true));
    expect(linkPermission("/security/roles")).toBe("roles.ver");
    expect(linkPermission("/")).toBeNull();
  });

  it("cada pantalla del menú tiene su propio permiso y los permisos padre cubren a sus pantallas", () => {
    for (const href of ["/sales?tab=drinks", "/accounting/reports/ple", "/settings/accounting-guide", "/docs/swagger"]) {
      expect(VALID_CODES.has(linkPermission(href)!), href).toBe(true);
    }
    expect(satisfiesPermission(["ple.ver"], "reportes.ver")).toBe(true);
    expect(satisfiesPermission(["ple.ver"], "reportes.editar")).toBe(false);
    expect(satisfiesPermission(["bebidas.ver"], "pedidos.ver")).toBe(true);
    expect(satisfiesPermission(["caja.ver"], "pedidos.ver")).toBe(false);
  });

  it("todo enlace del menú lateral tiene permiso asignado (denegado por defecto)", () => {
    const src = readFileSync(join(ROOT, "components/personalized/Sidebar.tsx"), "utf8");
    const hrefs = [...src.matchAll(/href: "([^"]+)", path:/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(20);
    hrefs.forEach((h) => expect(VALID_CODES.has(linkPermission(h) ?? ""), h).toBe(true));
  });

  it("gana la regla más específica de cada ruta", () => {
    expect(requiredPermissions("/purchases/inventory")).toEqual(["inventario.ver"]);
    expect(requiredPermissions("/purchases/add")).toEqual(["compras.ver"]);
    expect(requiredPermissions("/accounting/accounts")).toEqual(["cuentas.ver"]);
    expect(requiredPermissions("/accounting/reports/ledger")).toEqual(["mayor.ver"]);
    expect(requiredPermissions("/")).toBeNull();
    expect(requiredPermissions("/login")).toBeNull();
  });

  it("los roles base del seed solo usan códigos del catálogo", async () => {
    await expect(import("../prisma/seed-roles")).resolves.toBeDefined();
  });
});

describe("ninguna API queda sin control de acceso", () => {
  // Públicas o de infraestructura (el proxy ya exige sesión salvo login y webhooks).
  const EXCEPTIONS = [
    "app/api/auth/login/route.ts",
    "app/api/auth/logout/route.ts",
    "app/api/webhooks/mercadopago/route.ts",
    "app/api/openapi/route.ts",
    "app/api/realtime/route.ts",
    "app/api/payment-methods/route.ts",
  ];
  const routes = files(join(ROOT, "app/api"), /^route\.ts$/)
    .map((r) => relative(ROOT, r).replace(/\\/g, "/"))
    .filter((r) => !EXCEPTIONS.includes(r));

  it("encuentra las rutas de la API", () => {
    expect(routes.length).toBeGreaterThan(30);
  });

  it.each(routes)("%s: cada handler valida sesión o permiso", (route) => {
    const unprotected = unprotectedFunctions(join(ROOT, route), /\b(authorize|currentSession)\(/, /^(GET|POST|PUT|PATCH|DELETE)$/);
    expect(unprotected).toEqual([]);
  });
});

describe("ninguna server action de compras queda sin control de acceso", () => {
  // Cualquier archivo que mencione "use server" se considera server action.
  const actions = files(join(ROOT, "lib/services/purchases"), /\.ts$/)
    .filter((r) => !/\.test\.ts$/.test(r) && /["']use server["']/.test(readFileSync(r, "utf8")))
    .map((r) => relative(ROOT, r).replace(/\\/g, "/"));

  it("encuentra las server actions", () => {
    expect(actions.length).toBeGreaterThan(5);
  });

  // Si la directiva no es lo primero del archivo, Next.js no lo trata como server action
  // y el build de producción falla al llevarlo al navegador.
  it.each(actions)("%s: la directiva 'use server' está al inicio del archivo", (route) => {
    expect(readFileSync(join(ROOT, route), "utf8")).toMatch(/^\uFEFF?\s*["']use server["']/);
  });

  it.each(actions)("%s: cada acción exige permiso", (route) => {
    expect(unprotectedFunctions(join(ROOT, route), /\brequirePermission\(/)).toEqual([]);
  });
});