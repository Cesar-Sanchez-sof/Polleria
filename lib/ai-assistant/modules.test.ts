import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ASSISTANT_MODULES, allowedModules } from "@/lib/ai-assistant/modules";

const catalog = JSON.parse(
  readFileSync(join(process.cwd(), "ai-service", "knowledge", "erp_modules_v1.json"), "utf8"),
) as { modulos: Record<string, { permisos: string[] }> };

describe("módulos consultables por el asistente", () => {
  it("coinciden con el catálogo de ai-service (mismos módulos y permisos)", () => {
    const fromCatalog = Object.fromEntries(Object.entries(catalog.modulos).map(([id, m]) => [id, m.permisos]));
    expect(ASSISTANT_MODULES).toEqual(fromCatalog);
  });

  it("el rol de sistema ve todos; los demás, solo los módulos de sus permisos", () => {
    expect(allowedModules({ superuser: true, codes: [] })).toEqual(Object.keys(ASSISTANT_MODULES));
    expect(allowedModules({ superuser: false, codes: [] })).toEqual([]);
    expect(allowedModules({ superuser: false, codes: ["caja.ver"] })).toEqual(["ventas", "caja"]);
    expect(allowedModules({ superuser: false, codes: ["compras.ver"] })).toEqual(["compras", "proveedores"]);
  });
});
