import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintPluginUnusedImports from "eslint-plugin-unused-imports";

const eslintConfig = defineConfig([
  // Next.js default configs
  ...nextVitals,
  ...nextTs,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // "test/**",   // comentado para que sea lintado
    // "scripts/**", // comentado para que sea lintado
  ]),

  // Core linting rules for the whole project
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      // Regla autocorregible: ESLint podrá convertir `let` a `const`.
      "prefer-const": "error",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-location-assign-relative-destination": "off",
      "@next/next/no-img-element": "off",
    },
  },

  // Apply rule that forbids direct import of Prisma client in app layer.
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

  // Unused imports removal rule (plugin `eslint-plugin-unused-imports`).
  {
    files: ["app/**/*.{ts,tsx}"],
    plugins: { "unused-imports": eslintPluginUnusedImports },
    rules: {
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
