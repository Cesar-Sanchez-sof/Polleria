import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message:
                "Convención de capas (route → service → Prisma): No importar '@/lib/prisma' directamente en app/. Debe invocarse a través de la capa de servicios.",
            },
          ],
        },
      ],
    },
  },
  {
    // Archivos legacy pendientes de migración arquitectónica (Deuda Técnica controlada)
    files: [
      "app/api/accounting/**",
      "app/api/accounting-periods/**",
      "app/api/accounts/**",
      "app/api/balance-sheet/**",
      "app/api/cash-flow-statement/**",
      "app/api/daily-book/**",
      "app/api/executive-summary/**",
      "app/api/general-ledger/**",
      "app/api/journal-entries/**",
      "app/api/leaves/**",
      "app/api/me/**",
      "app/api/purchases/without-voucher/**",
      "app/api/trial-balance/**",
    ],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message:
                "Deuda técnica legacy: Este endpoint auxiliar aún importa '@/lib/prisma' directamente. Debe migrarse a la capa de servicios.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
