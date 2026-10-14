import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Configuración de Vitest.
 *
 * `@` apunta a la raíz del proyecto para que los tests puedan importar con el
 * mismo alias que usa TypeScript (`tsconfig.json` → `paths`).
 * El archivo es `.mts` (ESM) para que el cargador nativo de Vite lo lea sin avisos.
 */
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup-permissions.ts"],
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "out/**", "build/**"],
  },
});
