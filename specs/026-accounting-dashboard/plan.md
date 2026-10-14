# Implementation Plan: Dashboard Contable (Resumen Financiero)

**Branch**: `026-accounting-dashboard` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-accounting-dashboard/spec.md`

## Summary

Construir una pantalla de solo lectura en `/accounting/dashboard` que consolida los datos
contables más importantes (ingresos, gastos, utilidad neta, caja/bancos, cuentas por
cobrar, cuentas por pagar, nº de asientos + 4 gráficos) para un período seleccionable,
siguiendo la arquitectura ya probada del módulo contable: **capa de cálculo pura**
(`lib/accounting/dashboard.ts`, sin imports de Prisma, equivalente a
`lib/accounting/balance-sheet.ts`) → **endpoint** `GET /api/accounting/dashboard` que
alimenta el cálculo con agregados de Prisma (`journalEntryDetail.groupBy` y
`$queryRaw` para la serie mensual) → **cliente frontend**
(`lib/services/dashboard.service.ts` con `getJson`) → **página client-component** que
renderiza KPIs y gráficos con **Recharts** (vía el wrapper shadcn ya existente
`components/ui/chart.tsx`), reutilizando `signedBalance()`/`round2()` y los criterios de
"asientos vigentes" (`entry.status === true`) del resto de reportes para garantizar
coincidencia exacta de cifras (SC-002).

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), Next.js 16.3.5 (App Router), React 19.2.8
— *ojo: versión de Next distinta a la documentación de entrenamiento; ver
`node_modules/next/dist/docs/index.md` antes de escribir código (regla de AGENTS.md)*

**Primary Dependencies**: Prisma 6.19.3 (client), Recharts 3.8.0 (ya instalado, con
wrapper shadcn `components/ui/chart.tsx`), shadcn/ui + Tailwind CSS 4, lucide-react,
date-fns 4

**Storage**: PostgreSQL (Prisma `datasource db.provider = "postgresql"`), modelos
`AccountingAccount`, `AccountingPeriod`, `JournalEntry`, `JournalEntryDetail`

**Testing**: Vitest 4 (`npm test` = `vitest run`); convenciones existentes
`lib/accounting/*.test.ts` (lógica pura) y `app/api/**/route.test.ts` (handler con
`vi.mock("@/lib/prisma")` y `vi.hoisted`)

**Target Platform**: Web (navegador moderno), servidor Next.js; sin app móvil

**Project Type**: Web application monolítica Next.js (frontend + API routes en el mismo
proyecto)

**Performance Goals**: dashboard cargado en < 3 s (SC-003); cambio de período < 3 s
(SC-005); una sola petición HTTP por carga

**Constraints**: solo lectura (no escribe datos contables); debe coincidir **exactamente**
con balance/estado de resultados para el mismo período (SC-002, tolerancia 0.00);
mismo formato monetario `es-PE/PEN`; mismos estados de carga/vacío/error que el resto
del módulo

**Scale/Scope**: 1 pantalla nueva, 1 endpoint nuevo, ~4 archivos de lógica/componentes +
2 tests; datos históricos esperados: cientos a miles de líneas de asiento (una pollería)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` **está sin personalizar**: conserva los placeholders de
la plantilla (`[PRINCIPLE_1_NAME]`, `[SECTION_2_CONTENT]`, `[GOVERNANCE_RULES]`,
`Version: [CONSTITUTION_VERSION]`), por lo que **no define gates ejecutables**. Se deja
constancia (misma situación en los specs 001–025) y se verifica contra los principios
*de facto* observados en el código fuente del módulo contable:

| Gate (de facto) | Resultado | Evidencia |
|---|---|---|
| Lógica de cálculo pura separada de I/O, testeable sin BD | ✅ | `lib/accounting/dashboard.ts` sin imports de Prisma (patrón `lib/accounting/balance-sheet.ts` + `balance-sheet.test.ts`) |
| API REST JSON bajo `app/api/**`, errores `{ error }` con códigos 400/404/500 | ✅ | contrato nuevo idéntico a `app/api/balance-sheet/route.ts` |
| Frontend consume APIs vía `lib/services/*.service.ts` + `getJson` | ✅ | `lib/services/dashboard.service.ts` (patrón `balance-sheet.service.ts`) |
| Pantalla App Router en `app/accounting/<ruta>/page.tsx` con `ModuleHeader`, estados carga/vacío/error | ✅ | `app/accounting/dashboard/page.tsx` |
| Reglas contables no se reinventan: reutilizar criterios existentes | ✅ | reutiliza `signedBalance`, `round2`, `entry.status === true`, prefijos PCGE |
| Cobertura de tests para lógica nueva (Vitest) | ✅ | `dashboard.test.ts` (unit) + `route.test.ts` (API) |
| Sin cambios de esquema Prisma ni migraciones | ✅ | solo lectura sobre modelos existentes |

**Gate result: PASS** — sin violaciones que justificar en Complexity Tracking.

**Re-check post-diseño (Fase 1)**: `research.md`, `data-model.md`, `contracts/` y
`quickstart.md` confirman lo mismo: sin migraciones Prisma, cálculo puro testeable,
endpoint con el patrón `{ error }` de `/api/balance-sheet`, frontend con `getJson` +
estados carga/vacío/error, tests Vitest y reutilización de criterios contables
existentes. **PASS** — tabla de violaciones vacía.

## Project Structure

### Documentation (this feature)

```text
specs/026-accounting-dashboard/
├── plan.md              # Este archivo (/speckit.plan)
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/           # Fase 1 (OpenAPI del endpoint nuevo)
│   └── accounting-dashboard.openapi.yaml
├── checklists/
│   └── requirements.md  # (creado por /speckit.specify)
├── spec.md
└── tasks.md             # Fase 2 — NO creado por /speckit.plan
```

### Source Code (repository root)

```text
lib/accounting/
├── dashboard.ts              # NUEVO: cálculo puro de KPI + series (recibe agregados)
└── dashboard.test.ts         # NUEVO: pruebas unitarias (KPI, variación %, series, estados vacíos)

app/api/accounting/dashboard/
└── route.ts                  # NUEVO: GET /api/accounting/dashboard?desde&hasta (Prisma → dashboard.ts)

lib/services/
└── dashboard.service.ts      # NUEVO: getDashboard() con getJson + formatPEN (reutiliza helpers)

app/accounting/dashboard/
├── page.tsx                  # NUEVO: página client (ModuleHeader, filtros, requestRef, debounce)
└── components/
    ├── DashboardKpis.tsx     # NUEVO: tarjetas KPI con variación vs período anterior
    ├── DashboardCharts.tsx   # NUEVO: 4 gráficos Recharts (ChartContainer de components/ui/chart.tsx)
    └── DashboardFilters.tsx  # NUEVO: selector de período/rango + rango visible

components/personalized/Sidebar.tsx
└── (MODIFICADO: enlace "Dashboard Contable" → /accounting/dashboard en el bloque contabilidad)

app/api/accounting/dashboard/
└── route.test.ts             # NUEVO: pruebas del handler (vi.mock "@/lib/prisma")

# Sin cambios: prisma/schema.prisma, lib/accounting/balance-sheet.ts, reportes existentes
```

**Structure Decision**: monolito Next.js (ya elegido por el proyecto). La feature añade
un endpoint nuevo siguiendo el patrón "cálculo puro + route handler + service + page" de
`balance-sheet`; nada de nuevos paquetes, ni backend separado, ni migraciones.

## Complexity Tracking

> Sin violaciones de Constitution Check: tabla vacía.
