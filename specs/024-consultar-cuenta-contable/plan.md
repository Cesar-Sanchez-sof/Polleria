# Implementation Plan: Consultar Cuenta Contable (detalle)

**Branch**: `024-consultar-cuenta-contable` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-consultar-cuenta-contable/spec.md`

## Summary

La funcionalidad "consultar cuentas contables" se resolvió como **la consulta del detalle de una
cuenta contable individual** (`GET /api/accounts/{id}`), porque el listado del plan contable ya
tiene spec propia (`003-listado-cuentas-contables`). El endpoint **ya está implementado y probado**
en `app/api/accounts/[id]/route.ts` con pruebas en `app/api/accounts/[id]/route.test.ts`: devuelve
la cuenta en formato público `{ id, codigo, nombre, tipo, idPadre, activo, usos }`, con `400`
(id no numérico), `404` (inexistente) y `500` (fallo de BD), tras la capa global de sesión
(`proxy.ts` activo: `401` sin cookie válida) y sin caché.

Por tanto el plan es **de verificación, no de construcción**: el único trabajo pendiente detectado
es corregir la **documentación OpenAPI** de la propia consulta (anotación `@openapi` que apunta a
un esquema `#/components/schemas/Account` **inexistente** en `app/api/openapi/swaggerConfig.ts`,
con respuestas de error sin documentar). No se requiere ningún cambio de comportamiento para
cumplir la spec.

## Technical Context

**Language/Version**: TypeScript sobre Next.js 16.3.5 (App Router, route handlers con
`params: Promise<{id: string}>`), React 19.2.8

**Primary Dependencies**: `next` 16.3.5, `@prisma/client` ^6.19.3, `swagger-jsdoc` ^6.3.0 /
`openapi-types` ^12.1.3 (documentación), Vitest (pruebas)

**Storage**: PostgreSQL vía Prisma (`datasource db { provider = "postgresql" }`, modelo
`AccountingAccount`)

**Testing**: Vitest (`npm test` → `vitest run`), pruebas colocadas junto a la ruta
(`app/api/accounts/[id]/route.test.ts`, mocks de Prisma con `vi.mock`/`vi.hoisted`)

**Target Platform**: Aplicación web (servidor Next.js + UI en navegador)

**Project Type**: Web application (un único monorepo Next.js: `app/`, `components/`, `lib/`,
`prisma/`)

**Performance Goals**: Una sola consulta indexada por petición (`findUnique` por `id`); el contador
`usos` se obtiene en esa misma consulta (`_count.entryDetails`), sin N+1

**Constraints**: Estabilidad del formato público (los 7 campos en español); **capa global de sesión
obligatoria** (`proxy.ts` activo: `401 "No autenticado"` sin cookie; el manejador no valida sesión
ni rol); respuesta siempre dinámica (nunca servida desde
caché estática); la tolerancia del identificador (`01`, `7abc`) es comportamiento documentado (BR-5)
y no debe "endurecerse"

**Scale/Scope**: Plan contable pequeño (decenas de cuentas) de una pollería; lecturas puntuales de
una cuenta; impacto mínimo — 1 ruta existente + 1 archivo de configuración OpenAPI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` contiene **únicamente la plantilla sin ratificar** (marcadores
`[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`, `[GOVERNANCE_RULES]`, versión sin definir): **no hay
principios ni gates exigibles**. En consecuencia:

| Gate | Resultado | Nota |
|------|-----------|------|
| Principios de la constitución | N/A | Sin principios ratificados; no se puede incumplir lo que no existe. Se recomienda ratificar la constitución antes de features de mayor riesgo. |
| Convenciones del proyecto (sustituto) | PASS | Se respetan las convenciones observadas en specs/rutas vecinas: respuestas en español (`codigo`, `nombre`, `usos`), manejo de errores `{ error }`, pruebas colocadas junto a la ruta, y autenticación resuelta por la capa global de sesión (`proxy.ts`) en lugar del manejador (corregido el 2026-10-12). |
| Alcance/spec | PASS | La spec no pide cambios de comportamiento; el plan no añade complejidad nueva. |

**Gate result**: PASS (sin violaciones que justificar; ver *Complexity Tracking*).

## Project Structure

### Documentation (this feature)

```text
specs/024-consultar-cuenta-contable/
├── plan.md                      # This file (/speckit.plan command output)
├── research.md                  # Phase 0 output (/speckit.plan command)
├── data-model.md                # Phase 1 output (/speckit.plan command)
├── quickstart.md                # Phase 1 output (/speckit.plan command)
├── contracts/                   # Phase 1 output (/speckit.plan command)
│   └── accounts-detail.openapi.yaml
├── checklists/
│   └── requirements.md          # /speckit.specify output
├── spec.md                      # /speckit.specify output
└── tasks.md                     # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app/
├── api/
│   ├── accounts/
│   │   ├── route.ts             # GET (listado) y POST — fuera de alcance, contexto (specs 003/004)
│   │   └── [id]/
│   │       ├── route.ts         # GET (detalle) — IMPLEMENTADO; PATCH fuera de alcance
│   │       └── route.test.ts    # Pruebas colocadas del detalle y de la edición
│   └── openapi/
│       ├── swaggerConfig.ts     # Esquemas base — AQUÍ se añade el esquema `Account` (único cambio)
│       └── route.ts             # Spec OpenAPI servida en /api/openapi
└── accounting/accounts/         # UI del plan contable — fuera de alcance (spec 003)

lib/
├── chart-of-accounts.ts         # ACCOUNT_SELECT, toAccountApi, formato público — sin cambios
└── services/accounts.service.ts # Servicio front-end — sin cambios (no consume el detalle aún)

prisma/
└── schema.prisma                # Modelo AccountingAccount — sin cambios

app/api/accounts/[id]/
└── route.test.ts                # Suite existente que valida el contrato (verificación)
```

**Structure Decision**: Web application única (Next.js App Router). La feature no introduce nuevas
rutas, modelos ni servicios: reutiliza `app/api/accounts/[id]/route.ts` y `lib/chart-of-accounts.ts`
tal como existen. El único archivo a tocar es `app/api/openapi/swaggerConfig.ts` (corrección
documental del contrato, ver research.md D6).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| No aplica | No hay violaciones de constitución (plantilla sin ratificar) y el plan añade un solo cambio documental | — |
