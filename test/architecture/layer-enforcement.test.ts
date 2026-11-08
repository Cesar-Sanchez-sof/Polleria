import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function getRouteFiles(dir: string): string[] {
  let results: string[] = [];
  try {
    const list = readdirSync(dir);
    for (const file of list) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(getRouteFiles(fullPath));
      } else if (file === "route.ts") {
        results.push(fullPath);
      }
    }
  } catch {
    // Si el directorio no existe, retornar vacío
  }
  return results;
}

describe("Arquitectura por Dominio - Cierre y Reforzamiento (6/6)", () => {
  it("eslint.config.mjs debe tener la regla 'no-restricted-imports' configurada en nivel 'error'", () => {
    const eslintConfig = readFileSync(join(ROOT, "eslint.config.mjs"), "utf-8");
    expect(eslintConfig).toContain('"no-restricted-imports"');
    expect(eslintConfig).toContain('"error"');
    expect(eslintConfig).toContain('"@/lib/prisma"');
  });

  it("AGENTS.md debe documentar las reglas de capas e impedir importaciones de Prisma en app/", () => {
    const agentsMd = readFileSync(join(ROOT, "AGENTS.md"), "utf-8");
    expect(agentsMd).toContain("Reglas de Arquitectura por Dominio");
    expect(agentsMd).toContain("createApiHandler");
    expect(agentsMd).toContain("@/lib/prisma");
  });

  it("README.md debe documentar la arquitectura por dominio y la regla de capas en nivel error", () => {
    const readme = readFileSync(join(ROOT, "README.md"), "utf-8");
    expect(readme).toContain("Arquitectura por Dominio");
    expect(readme).toContain("Enforcement Automatizado en ESLint (Nivel `error`)");
    expect(readme).toContain("no-restricted-imports");
  });

  describe("Cero importaciones de @/lib/prisma en rutas de dominios migrados", () => {
    const MIGRATED_DOMAINS = [
      "app/api/orders",
      "app/api/sales",
      "app/api/cash-sessions",
      "app/api/customers",
      "app/api/payments",
      "app/api/tables",
      "app/api/settings",
      "app/api/products",
      "app/api/webhooks",
      "app/api/realtime",
    ];

    for (const domain of MIGRATED_DOMAINS) {
      const routeFiles = getRouteFiles(join(ROOT, domain));

      it(`Dominio '${domain}' debe tener handlers desacoplados y 0 importaciones de @/lib/prisma`, () => {
        expect(routeFiles.length).toBeGreaterThan(0);
        for (const filePath of routeFiles) {
          const content = readFileSync(filePath, "utf-8");
          const hasDirectPrisma =
            /import\s+.*\s+from\s+["']@\/lib\/prisma["']/.test(content) ||
            /require\(["']@\/lib\/prisma["']\)/.test(content);
          expect(
            hasDirectPrisma,
            `El archivo ${filePath} no debe importar @/lib/prisma directamente`
          ).toBe(false);
        }
      });
    }
  });
});
