import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function getAllAppTsFiles(dir: string): string[] {
  let results: string[] = [];
  try {
    const list = readdirSync(dir);
    for (const file of list) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(getAllAppTsFiles(fullPath));
      } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
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
    // Verificamos que NO queden bloques de excepción 'warn' legacy
    expect(eslintConfig).not.toContain('"warn"');
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

  it("Erradicación total del monolito legacy: Cero importaciones directas de @/lib/prisma en todo el directorio app/", () => {
    const allAppFiles = getAllAppTsFiles(join(ROOT, "app"));
    expect(allAppFiles.length).toBeGreaterThan(50);

    const violations: string[] = [];
    for (const filePath of allAppFiles) {
      const content = readFileSync(filePath, "utf-8");
      const hasDirectPrisma =
        /import\s+.*\s+from\s+["']@\/lib\/prisma["']/.test(content) ||
        /require\(["']@\/lib\/prisma["']\)/.test(content);
      if (hasDirectPrisma) {
        violations.push(filePath);
      }
    }

    expect(
      violations,
      `Se encontraron archivos en app/ que importan @/lib/prisma: ${violations.join(", ")}`
    ).toEqual([]);
  });
});
