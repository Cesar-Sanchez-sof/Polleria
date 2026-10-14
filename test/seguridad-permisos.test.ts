import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { CATALOGO_PERMISOS, CODIGOS_VALIDOS, MODULOS_PERMISOS } from "@/lib/auth/catalogo-permisos";
import { SECCIONES, permisoDeEnlace, permisosRequeridos } from "@/lib/auth/rutas-permisos";

const RAIZ = process.cwd();

function archivos(dir: string, nombre: RegExp): string[] {
  return readdirSync(dir).flatMap((f) => {
    const ruta = join(dir, f);
    return statSync(ruta).isDirectory() ? archivos(ruta, nombre) : nombre.test(f) ? [ruta] : [];
  });
}

/** Funciones exportadas de un archivo cuyo cuerpo NO contiene ninguna de las marcas indicadas. */
function funcionesSinProteger(ruta: string, marcas: RegExp, nombres?: RegExp): string[] {
  const src = readFileSync(ruta, "utf8");
  const sf = ts.createSourceFile(ruta, src, ts.ScriptTarget.Latest, true);
  const sinProteger: string[] = [];
  for (const st of sf.statements) {
    if (!ts.isFunctionDeclaration(st) || !st.name || !st.body) continue;
    if (!st.modifiers?.some((x) => x.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (nombres && !nombres.test(st.name.text)) continue;
    if (!marcas.test(st.body.getText())) sinProteger.push(st.name.text);
  }
  return sinProteger;
}

describe("catálogo de permisos", () => {
  it("no tiene códigos repetidos y todos siguen el formato modulo.accion", () => {
    const codigos = CATALOGO_PERMISOS.map((p) => p.code);
    expect(new Set(codigos).size).toBe(codigos.length);
    codigos.forEach((c) => expect(c).toMatch(/^[a-z]+\.(ver|crear|editar|eliminar)$/));
  });

  it("todo módulo permite 'ver' (la ventana)", () => {
    MODULOS_PERMISOS.forEach((m) => expect(m.acciones).toContain("ver"));
  });

  it("las rutas y los enlaces del menú solo usan permisos que existen", () => {
    const usados = [
      ...Object.values(SECCIONES).flat(),
      ...["/sales", "/usuarios", "/roles", "/audit", "/purchases", "/accounting", "/restaurant/areas"].flatMap(
        (r) => permisosRequeridos(r) ?? [],
      ),
    ];
    usados.forEach((c) => expect(CODIGOS_VALIDOS.has(c), c).toBe(true));
    expect(permisoDeEnlace("/roles")).toBe("roles.ver");
    expect(permisoDeEnlace("/")).toBeNull();
  });

  it("gana la regla más específica de cada ruta", () => {
    expect(permisosRequeridos("/purchases/inventory")).toEqual(["inventario.ver"]);
    expect(permisosRequeridos("/purchases/add")).toEqual(["compras.ver"]);
    expect(permisosRequeridos("/accounting/accounts")).toEqual(["cuentas.ver"]);
    expect(permisosRequeridos("/accounting/ledger")).toEqual(["reportes.ver"]);
    expect(permisosRequeridos("/")).toBeNull();
    expect(permisosRequeridos("/login")).toBeNull();
  });

  it("los roles base del seed solo usan códigos del catálogo", async () => {
    await expect(import("../prisma/seed-roles")).resolves.toBeDefined();
  });
});

describe("ninguna API queda sin control de acceso", () => {
  // Públicas o de infraestructura (el proxy ya exige sesión salvo login y webhooks).
  const EXCEPCIONES = [
    "app/api/auth/login/route.ts",
    "app/api/auth/logout/route.ts",
    "app/api/webhooks/mercadopago/route.ts",
    "app/api/openapi/route.ts",
    "app/api/realtime/route.ts",
    "app/api/payment-methods/route.ts",
  ];
  const rutas = archivos(join(RAIZ, "app/api"), /^route\.ts$/)
    .map((r) => relative(RAIZ, r).replace(/\\/g, "/"))
    .filter((r) => !EXCEPCIONES.includes(r));

  it("encuentra las rutas de la API", () => {
    expect(rutas.length).toBeGreaterThan(30);
  });

  it.each(rutas)("%s: cada handler valida sesión o permiso", (ruta) => {
    const sinProteger = funcionesSinProteger(join(RAIZ, ruta), /\b(autorizar|sesionActual)\(/, /^(GET|POST|PUT|PATCH|DELETE)$/);
    expect(sinProteger).toEqual([]);
  });
});

describe("ninguna server action de compras queda sin control de acceso", () => {
  // Cualquier archivo que mencione "use server" se considera server action.
  const acciones = archivos(join(RAIZ, "lib/services/purchases"), /\.ts$/)
    .filter((r) => !/\.test\.ts$/.test(r) && /["']use server["']/.test(readFileSync(r, "utf8")))
    .map((r) => relative(RAIZ, r).replace(/\\/g, "/"));

  it("encuentra las server actions", () => {
    expect(acciones.length).toBeGreaterThan(5);
  });

  // Si la directiva no es lo primero del archivo, Next.js no lo trata como server action
  // y el build de producción falla al llevarlo al navegador.
  it.each(acciones)("%s: la directiva 'use server' está al inicio del archivo", (ruta) => {
    expect(readFileSync(join(RAIZ, ruta), "utf8")).toMatch(/^\uFEFF?\s*["']use server["']/);
  });

  it.each(acciones)("%s: cada acción exige permiso", (ruta) => {
    expect(funcionesSinProteger(join(RAIZ, ruta), /\bexigirPermiso\(/)).toEqual([]);
  });
});