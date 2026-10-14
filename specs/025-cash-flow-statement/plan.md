# Implementation Plan: Estado de Flujos de Efectivo (NIC 7 / PCGE 2019)

**Branch**: `025-cash-flow-statement` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-cash-flow-statement/spec.md`

## Summary

Implementar el Estado de Flujos de Efectivo (método indirecto, NIC 7 / PCGE 2019) siguiendo la arquitectura ya establecida en el módulo contable del ERP: una **capa de cálculo pura** en `lib/accounting/cash-flow-statement.ts` (equivalente a `lib/accounting/balance-sheet.ts`), un **endpoint** `GET /api/cash-flow-statement` que alimenta el cálculo con agregados de Prisma (`journalEntryDetail.groupBy`), y un **cliente frontend** en `lib/services/cash-flow-statement.service.ts`. El reporte clasifica los flujos en Operación / Inversión / Financiamiento, concilia el efectivo final contra el saldo real de la Cuenta 10 (101 + 104, excluyendo 107) y tolera cuentas sin datos (0.00) con redondeo estricto a 2 decimales.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Next.js 16 (App Router), React 19

**Primary Dependencies**: Prisma ORM v6 (PostgreSQL/Neon), `next/server` (NextRequest/route handlers), Swagger JSDoc (`@openapi`) para documentación en `/api/docs`

**Storage**: PostgreSQL (Neon) — sin nuevos modelos: el reporte se deriva de `accounting_account`, `journal_entry` y `journal_entry_detail` existentes

**Testing**: Vitest 4 — tests unitarios colocados (`*.test.ts` junto al módulo), mocks de Prisma con `vi.hoisted` + `vi.mock` (patrón de `app/api/general-ledger/route.test.ts`)

**Target Platform**: Web (Next.js server + client), moneda PEN

**Project Type**: Web service (ERP) — solo backend + cliente de servicio interno; sin UI propia en v1 (Out of Scope del spec)

**Performance Goals**: SC-002 — generar el estado en < 3 segundos para un período con hasta 10,000 movimientos (se logra con `groupBy` agregado en BD, mismo patrón que `/api/balance-sheet`)

**Constraints**: Redondeo estricto a 2 decimales en todos los subtotales (`round2` con `Math.round(n*100)/100`, precedente en `balance-sheet.ts`); solo asientos vigentes (`entry.status = true`); fechas tratadas en UTC (`parseUtcDate` de `lib/dates.ts`); regla de integridad NIC 7: el efectivo calculado al cierre debe coincidir con el saldo real de la Cuenta 10 (`is_reconciled`)

**Scale/Scope**: Single-tenant (una empresa por despliegue, `COMPANY_NAME` en env); 3 archivos nuevos de código + 2 archivos de test; sin migraciones de BD

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` existe pero **no está diligenciado** (plantilla en blanco, sin principios ratificados). No hay gates de gobernanza enforceables. Se aplican los estándares *de facto* del repositorio como sustituto:

| Estándar de facto (fuente) | Cumplimiento del plan |
|---|---|
| Lógica de cálculo pura separada de I/O (`lib/accounting/balance-sheet.ts`) | ✅ Núcleo puro en `lib/accounting/cash-flow-statement.ts`, sin imports de Prisma |
| Rutas API con agregados Prisma + manejo de errores 400/404/500 y JSDoc `@openapi` (`app/api/balance-sheet/route.ts`) | ✅ `app/api/cash-flow-statement/route.ts` replica el patrón |
| Tests Vitest colocados y mocks de Prisma vía `vi.hoisted` (`app/api/general-ledger/route.test.ts`) | ✅ `route.test.ts` + test del cálculo puro |
| Documentación de negocio en español, códigos PCGE 2019 | ✅ Todos los artefactos y código en español/PCGE |
| Sin duplicar `round2`/`signedBalance` ya existentes | ✅ Reutiliza `signedBalance` y patrón `round2` de `balance-sheet.ts` |

**Resultado**: PASS (sin violaciones que justificar).

## Project Structure

### Documentation (this feature)

```text
specs/025-cash-flow-statement/
├── plan.md                      # Este archivo
├── research.md                  # Fase 0 — decisiones técnicas
├── data-model.md                # Fase 1 — entidades derivadas y reglas
├── quickstart.md                # Fase 1 — guía de validación
├── contracts/
│   └── cash-flow-statement-api.md  # Fase 1 — contrato GET /api/cash-flow-statement
├── checklists/
│   └── requirements.md          # Checklist de calidad del spec
└── tasks.md                     # Fase 2 (/speckit.tasks — NO creado por /speckit.plan)
```

### Source Code (repository root)

```text
lib/
├── accounting/
│   ├── balance-sheet.ts                  # (existente) Balance General — cálculo puro
│   ├── balance-sheet.test.ts             # (existente)
│   └── cash-flow-statement.ts            # NUEVO — cálculo puro del Estado de Flujos
├── services/
│   ├── balance-sheet.service.ts          # (existente) cliente frontend del balance
│   └── cash-flow-statement.service.ts    # NUEVO — cliente frontend del reporte
├── dates.ts                              # (existente) parseUtcDate/formatDateToIso
└── prisma.ts                             # (existente)

app/api/
├── balance-sheet/route.ts                # (existente) precedente de reporte contable
└── cash-flow-statement/
    ├── route.ts                          # NUEVO — GET /api/cash-flow-statement
    └── route.test.ts                     # NUEVO — tests de la ruta (Prisma mockeado)

lib/accounting/cash-flow-statement.test.ts  # NUEVO — tests del cálculo puro
```

**Structure Decision**: Se reutiliza la arquitectura en tres capas ya probada para el Balance General: cálculo puro (`lib/accounting/`), orquestación de datos en la ruta (`app/api/`), y cliente tipado para los componentes (`lib/services/`). El nombre de archivo del servicio cliente (`lib/services/cash-flow-statement.service.ts`) coincide con el solicitado en el prompt de origen; el núcleo del cálculo queda en `lib/accounting/` por convención del proyecto (testable sin BD ni Next.js).

## Complexity Tracking

Sin violaciones de constitución/estándares — tabla vacía.
