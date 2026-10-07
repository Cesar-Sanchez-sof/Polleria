# Implementation Plan: Estado de Resultados por Función (PCGE 2019)

**Branch**: `021-generar-estado-resultados` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-generar-estado-resultados/spec.md`

## Summary

Construir el **Estado de Resultados por Función** para un rango de fechas, calculando las nueve
líneas del reporte (ingresos de operación, costo de ventas, margen bruto, gastos de operación,
beneficio operativo, partidas financieras, impuesto a la renta y resultado del período) a partir de
los saldos por cuenta de los asientos vigentes, aplicando la naturaleza contable del PCGE 2019
(elemento 7 por haber−debe; elementos 6 y 9 por debe−haber).

El enfoque separa **cálculo puro** (función sin acceso a datos, testeable con datos de ejemplo) de
**orquestación de datos** (servicio que, si no se le pasan movimientos precargados, agrega los
saldos desde el almacenamiento contable). Es el mismo patrón que ya usa el Balance General
(`lib/accounting/balance-sheet.ts` + su consulta en `app/api/balance-sheet/route.ts`), lo que
permite reutilizar convenciones, redondeo y criterios de "cuenta detalle" ya probados.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Next.js 16.3.5 (App Router), React 19

**Primary Dependencies**: Prisma 6 (`@prisma/client`) sobre PostgreSQL; `swagger-jsdoc` sólo si
más adelante se expone el reporte (fuera de alcance ahora)

**Storage**: PostgreSQL — `accounting_account`, `journal_entry`, `journal_entry_detail`

**Testing**: Vitest 4 (`npm test`, `npm run test:watch`), mocks de `@/lib/prisma` con `vi.mock`

**Target Platform**: Node.js (runtime del servidor Next.js); el módulo de cálculo es agnóstico de
plataforma

**Project Type**: web service con módulo de negocio puro dentro de `lib/`

**Performance Goals**: entregar el reporte en < 3 s para un periodo de hasta 100.000 movimientos
(SC-006)

**Constraints**: importes finales con 2 decimales; ningún valor `null`/`undefined` en la salida;
sólo asientos vigentes (`status = true`); identidades del reporte deben cerrar con diferencia
< 0.01

**Scale/Scope**: una sola empresa (el `companyId`/`tenantId` de entrada se acepta pero no filtra);
1 servicio + 1 módulo de cálculo + 2 suites de pruebas; sin endpoint ni pantalla en esta iteración

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` **es una plantilla sin rellenar** (todos los principios siguen
con `[PRINCIPLE_n_NAME]` y comentarios de ejemplo): no hay gates formales que evaluar. Para no
dejar el gate vacío, se evalúan las convenciones efectivas del repositorio:

| Gate (convención del repo) | Resultado | Evidencia |
|---|---|---|
| Cálculo puro separado del acceso a datos | ✅ PASS | `lib/accounting/balance-sheet.ts` no importa Prisma; esta feature replica el patrón |
| Pruebas unitarias junto al código (`*.test.ts`) | ✅ PASS | `lib/accounting/balance-sheet.test.ts`, `app/api/**/route.test.ts` |
| Sin dependencias nuevas | ✅ PASS | Sólo `@prisma/client` y vitest, ya presentes en `package.json` |
| Convenciones de fechas en UTC (`parseUtcDate`) | ✅ PASS | `lib/dates.ts` usado por las rutas contables |
| Naming y estilo del código existente (JSDoc en español, `round2`) | ✅ PASS | Mismo encabezado normativo que `balance-sheet.ts` |
| Alcance acotado (sin endpoint nuevo) | ✅ PASS | Spec: exposición web fuera de alcance |

**Gate result**: PASS — sin violaciones, por lo que *Complexity Tracking* queda vacío.

*Re-check post-diseño (Phase 1)*: PASS — los artefactos generados no introducen proyectos,
dependencias ni abstracciones nuevas.

## Project Structure

### Documentation (this feature)

```text
specs/021-generar-estado-resultados/
├── plan.md              # Este archivo (comando /speckit.plan)
├── spec.md              # Especificación de la feature
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/           # Fase 1
│   └── income-statement.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit.tasks — NO creado por /speckit.plan)
```

### Source Code (repository root)

```text
lib/
├── accounting/
│   ├── balance-sheet.ts               # existente — patrón a seguir
│   ├── balance-sheet.test.ts          # existente
│   ├── income-statement.ts            # NUEVO — cálculo puro del reporte
│   └── income-statement.test.ts       # NUEVO — pruebas unitarias del cálculo
├── services/
│   └── income-statement.service.ts    # NUEVO — orquestación: entrada + consulta de saldos
└── dates.ts                           # existente — parseUtcDate/formatDateToIso

app/api/                               # SIN CAMBIOS en esta iteración (endpoint fuera de alcance)
prisma/schema.prisma                   # SIN CAMBIOS (no hay migraciones)
```

**Structure Decision**: se elige la estructura **monolítica existente** (carpeta `lib/` del mismo
proyecto): cálculo puro en `lib/accounting/` y orquestación en
`lib/services/income-statement.service.ts` (ruta pedida en la descripción de la feature). No se
crea ningún proyecto ni paquete nuevo.

> ⚠️ **Riesgo conocido y mitigado**: en este repositorio `lib/services/*.service.ts` son
> habitualmente servicios **front-end** (usan `fetch` vía `lib/services/http.ts`). El nuevo
> servicio importa Prisma, por lo que sólo debe consumirse desde código de servidor (rutas,
> scripts). Ver decisión **D2** en [research.md](./research.md).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | No hay violaciones de constitución/convenciones que justificar | — |
