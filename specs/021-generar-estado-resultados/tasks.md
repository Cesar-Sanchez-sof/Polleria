---
description: "Task list template for feature implementation"
---

# Tasks: Estado de Resultados por FunciÃ³n (PCGE 2019)

**Input**: Design documents from `/specs/021-generar-estado-resultados/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **Incluidas** â€” el plan las hace obligatorias: `plan.md` â†’ *Testing: Vitest 4*,
`research.md` â†’ **D10 (estrategia de pruebas)** y `quickstart.md` â†’ Â§1/Â§4 definen suites y
comandos de validaciÃ³n.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing
of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `lib/` at repository root (see plan.md â†’ Structure Decision)
- CÃ¡lculo puro: `lib/accounting/income-statement.ts` Â· OrquestaciÃ³n:
  `lib/services/income-statement.service.ts`
- Pruebas: `lib/accounting/income-statement.test.ts` y
  `lib/services/income-statement.service.test.ts`
- **No** se crea `app/api/income-statement` (fuera de alcance, decisiÃ³n D11) ni migraciones.

## User Stories (spec.md)

| Story | Prioridad | TÃ­tulo |
|---|---|---|
| US1 | P1 | Generar el estado de resultados de un periodo (MVP) |
| US2 | P1 | Respetar la naturaleza contable de cada cuenta |
| US3 | P2 | Generar el reporte aunque falten cuentas |
| US4 | P3 | Verificar el reporte contra el Balance General |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar el punto de partida y las utilidades existentes que el reporte reutiliza.

- [X] T001 Ejecutar `npm test` y `npm run lint` en la raÃ­z del repositorio y confirmar estado verde de partida (sin dependencias nuevas segÃºn `plan.md` â†’ Technical Context)
- [X] T002 [P] Verificar en `lib/dates.ts` que existen `parseUtcDate` y `formatDateToIso`, y confirmar que no existe `app/api/income-statement/route.ts` ni migraciones pendientes (alcance D11 en `research.md`); registrar cualquier discrepancia en `specs/021-generar-estado-resultados/plan.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos del contrato y utilidades de cÃ¡lculo que **todos** los user stories necesitan.

**?? CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Definir en `lib/accounting/income-statement.ts` los tipos del contrato `contracts/income-statement.md`: `IncomeStatementInput` (`companyId?`, `startDate`, `endDate`, `movements?`), `MovementInput` (`accountCode`, `debit?`, `credit?`, `date?`, `status?`), `AccountBalance` (`code`, `name`, `debit`, `credit`) y `IncomeStatementResult` (con `period: { startDate: string; endDate: string }`, `currency: string` y los 14 campos numÃ©ricos del contrato), re-exportados para consumo externo
- [X] T004 [P] Escribir PRIMERO los tests de fundamento en `lib/accounting/income-statement.test.ts` (naturaleza por elemento: "elemento 7 se salda por Haber âˆ’ Debe; elementos 6 y 9 por Debe âˆ’ Haber"; clasificaciÃ³n por prefijo segÃºn la matriz D5 de `research.md`; `round2` a 2 decimales) y confirmar que FALLAN
- [X] T005 Implementar en `lib/accounting/income-statement.ts` las utilidades base: `round2(n) = Math.round(n * 100) / 100`, `isDetailAccount(code)` (excluye cabeceras de 1â€“2 dÃ­gitos, D6), `naturalezaDe(code)` y `lineaDe(code)` (matriz de inclusiÃ³n/exclusiÃ³n D5, con `70` sin `709`, `77` sin `776`, `67` sin `676`), para que los tests de T004 pasen

**Checkpoint**: Foundation ready â€” user story implementation can now begin.

---

## Phase 3: User Story 1 - Generar el estado de resultados de un periodo (Priority: P1) ?? MVP

**Goal**: Obtener las nueve lÃ­neas del reporte para un rango de fechas, con todas las fÃ³rmulas
(FR-003 â†’ FR-018) y el servicio que trae los saldos cuando no se pasan movimientos.

**Independent Test**: `npx vitest run lib/accounting/income-statement.test.ts
lib/services/income-statement.service.test.ts` â€” el escenario de referencia de
`quickstart.md` Â§2 devuelve exactamente la tabla de valores esperada.

### Tests for User Story 1 (OPTIONAL - only if tests requested) ??

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T006 [P] [US1] Test del escenario de referencia de `quickstart.md` Â§2 (15 movimientos â†’ ingresos ordinarios 920.00, subarrendamiento 0.00, costo 400.00, margen 520.00, gastos 160.00, beneficio 360.00, otros 500.00, cambio 5.00, financieros 20.00/15.00, antes de impuestos 870.00, impuesto 100.00, resultado 770.00) en `lib/accounting/income-statement.test.ts`
- [X] T007 [P] [US1] Tests del servicio con `vi.mock("@/lib/prisma")` en `lib/services/income-statement.service.test.ts`: agregaciÃ³n por `journalEntryDetail.groupBy`, filtro `entry.status = true`, rango `entryDate` inclusivo en UTC, movimientos precargados que evitan la consulta, y rechazo con `status: 400` para fecha mal formada o `startDate > endDate` con los mensajes exactos de `contracts/income-statement.md` Â§3

### Implementation for User Story 1

- [X] T008 [US1] Implementar `computeIncomeStatement(...)` en `lib/accounting/income-statement.ts` con FR-003 a FR-018 (ingresos de operaciÃ³n, costo 69x sin usar la 60 â†’ FR-027, gastos 94/95, partidas financieras 77/776/67/676, otros ingresos 75+76âˆ’65âˆ’66, impuesto 88 y resultado del perÃ­odo), devolviendo siempre nÃºmeros redondeados a 2 decimales
- [X] T009 [US1] Implementar `getIncomeStatement(input)` en `lib/services/income-statement.service.ts`: valida `startDate`/`endDate` (`AAAA-MM-DD` y `startDate â‰¤ endDate` â†’ error `400`), si no vienen `movements` consulta los saldos por cuenta con Prisma (`status = true` y rango inclusivo, D3), construye `AccountBalance[]` sin cabeceras (D6) y delega en `computeIncomeStatement`; errores inesperados â†’ `500` "No se pudo generar el Estado de Resultados."
- [X] T010 [US1] AÃ±adir en `lib/accounting/income-statement.test.ts` la verificaciÃ³n de las 6 invariantes FR-026 (total de ingresos, total de gastos, margen, beneficio operativo, antes de impuestos y resultado del perÃ­odo) con tolerancia `0.005`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - Respetar la naturaleza contable de cada cuenta (Priority: P1)

**Goal**: Signos correctos segÃºn la naturaleza PCGE y ausencia de doble descuento en 709/74
(decisiÃ³n Q1 = opciÃ³n A).

**Independent Test**: con `701 haber 1.000,00` y `709 debe 50,00`, los ingresos ordinarios son
`950,00` (no `900,00`); con saldo contrario a la naturaleza, la lÃ­nea refleja el signo real.

### Tests for User Story 2 (OPTIONAL - only if tests requested) ??

- [X] T011 [US2] AÃ±adir en `lib/accounting/income-statement.test.ts` los casos de naturaleza FR-019: elemento 7 por `Haber âˆ’ Debe`, elementos 6 y 9 por `Debe âˆ’ Haber`, cuenta de gasto con saldo acreedor publicado negativo, y pÃ©rdida del periodo sin truncarse a cero (incluye el caso 701/709 â†’ 950.00 y 709/74 excluidas de la base de la 70)

### Implementation for User Story 2

- [X] T012 [US2] Implementar/ajustar en `lib/accounting/income-statement.ts` la aplicaciÃ³n de `naturalezaDe` por elemento y las exclusiones `709`/`74` de la base de la Cuenta 70 (restadas una sola vez), asegurando que ningÃºn importe se fuerce a positivo
- [X] T013 [P] [US2] AÃ±adir en `lib/services/income-statement.service.test.ts` aserciones de signo sobre los agregados que devuelve la consulta (por ejemplo una cuenta 95 con saldo acreedor y una 70 con saldo deudor) para comprobar que el servicio no altera el signo antes del cÃ¡lculo

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently.

---

## Phase 5: User Story 3 - Generar el reporte aunque falten cuentas (Priority: P2)

**Goal**: Tolerancia a datos incompletos: `0.00` en lugar de errores o valores nulos (FR-020,
FR-021).

**Independent Test**: con sÃ³lo `701` y `691`, el reporte devuelve 1.000,00 / 400,00 / 600,00 y
todas las demÃ¡s lÃ­neas en `0.00`; sin movimientos, todas en `0.00`.

### Tests for User Story 3 (OPTIONAL - only if tests requested) ??

- [X] T014 [US3] AÃ±adir en `lib/accounting/income-statement.test.ts` los escenarios `quickstart.md` Â§3.1 (sÃ³lo ventas y costo) y Â§3.2 (periodo sin movimientos): todas las lÃ­neas ausentes en `0.00`, ningÃºn `null`/`undefined` y todos los importes con 2 decimales (SC-003, SC-007)
- [X] T015 [P] [US3] AÃ±adir en `lib/services/income-statement.service.test.ts` el caso de consulta sin movimientos almacenados en el rango: el servicio responde con el reporte completo en `0.00` sin lanzar error (FR-020)

### Implementation for User Story 3

- [X] T016 [US3] Implementar en `lib/accounting/income-statement.ts` la inicializaciÃ³n de cada lÃ­nea en `0.00` y la normalizaciÃ³n de importes ausentes/nulos a `0` (y, si hace falta, en la construcciÃ³n de `AccountBalance[]` de `lib/services/income-statement.service.ts`), garantizando 2 decimales en la salida

**Checkpoint**: At this point, User Stories 1, 2 AND 3 should all work independently.

---

## Phase 6: User Story 4 - Verificar el reporte contra el Balance General (Priority: P3)

**Goal**: Coherencia entre estados financieros (SC-004) y cumplimiento del objetivo de rendimiento
(SC-006).

**Independent Test**: con los mismos saldos, `net_profit` y `computePeriodResult`
(`lib/accounting/balance-sheet.ts`) difieren en menos de `0,01`; 100.000 movimientos se procesan
en menos de 3 segundos.

### Tests for User Story 4 (OPTIONAL - only if tests requested) ??

- [X] T017 [US4] AÃ±adir en `lib/accounting/income-statement.test.ts` la prueba SC-004: alimentar `computePeriodResult` de `lib/accounting/balance-sheet.ts` con los mismos saldos del escenario Â§2 y comparar con `net_profit` (diferencia menor a `0,01`)
- [X] T018 [US4] AÃ±adir en `lib/accounting/income-statement.test.ts` la prueba de rendimiento SC-006: generar 100.000 movimientos, ejecutar `computeIncomeStatement` y afirmar que tarda menos de 3000 ms

### Implementation for User Story 4

- [X] T019 [US4] Si SC-004 no se cumple, reconciliar en `lib/accounting/income-statement.ts` el criterio de inclusiÃ³n de cuentas P&L para que coincida con `lib/accounting/balance-sheet.ts` y registrar el ajuste en `specs/021-generar-estado-resultados/research.md`

**Checkpoint**: All user stories should now be independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T020 [P] Ejecutar `npm run lint` y `npx vitest run lib/accounting/income-statement.test.ts lib/services/income-statement.service.test.ts` y dejar ambas suites en verde
- [ ] T021 [P] Actualizar `specs/021-generar-estado-resultados/quickstart.md` (Â§4) marcando los escenarios ejecutados y corrigiendo cualquier discrepancia con el comportamiento real
- [ ] T022 Revisar `specs/021-generar-estado-resultados/checklists/requirements.md` y `plan.md` por si la implementaciÃ³n alterÃ³ alcance, supuestos o supuestos tÃ©cnicos; documentar la decisiÃ³n en `specs/021-generar-estado-resultados/research.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies â€” can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001, T002) â€” **BLOCKS all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational (T003â€“T005) â€” **MVP**
- **User Story 2 (Phase 4)**: Depends on Foundational; usa `computeIncomeStatement` de US1 pero
  sÃ³lo toca reglas de signo â†’ puede paralelizarse con US3
- **User Story 3 (Phase 5)**: Depends on Foundational; interactÃºa con US1 en los mismos dos
  archivos â†’ secuencial respecto de US1
- **User Story 4 (Phase 6)**: Depende de US1 (necesita `net_profit` y el cÃ¡lculo completo)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: arranca al cerrar Phase 2; sin dependencias de otras stories
- **US2 (P1)**: arranca al cerrar Phase 2; se apoya en el cÃ¡lculo de US1 (mismo archivo
  `lib/accounting/income-statement.ts`)
- **US3 (P2)**: arranca al cerrar Phase 2; mismos archivos que US1
- **US4 (P3)**: requiere US1 completa

### Within Each User Story

- Tests first (T004, T006, T007, T011, T014, T015, T017, T018) y deben FALLAR
- Tipos (T003) â†’ utilidades (T005) â†’ cÃ¡lculo (T008) â†’ servicio (T009) â†’ invariantes (T010)
- Historia completa antes de pasar a la siguiente prioridad

### Parallel Opportunities

- **Setup**: T002 en paralelo con T001 (T001 es comando, T002 es lectura de archivos)
- **Foundational**: T004 (archivo de tests) en paralelo con T003 (archivo de implementaciÃ³n)
- **US1**: T006 (test de cÃ¡lculo) âˆ¥ T007 (test de servicio) â€” archivos distintos
- **US2**: T013 (test de servicio) en paralelo con T011/T012 (archivos de cÃ¡lculo)
- **US3**: T015 (test de servicio) en paralelo con T014 (test de cÃ¡lculo)
- **Polish**: T020 âˆ¥ T021 (comandos vs documentaciÃ³n)

> Nota: `lib/accounting/income-statement.ts` y su `.test.ts` concentran la mayor parte del
> trabajo; dos personas trabajando en la misma story deben dividirse archivo de implementaciÃ³n vs
> archivo de pruebas.

---

## Parallel Example: User Story 1

```bash
# Arrancar en paralelo los dos archivos de US1 (distintos ficheros, sin dependencias entre sÃ­):
Task T006: "Test del escenario de referencia en lib/accounting/income-statement.test.ts"
Task T007: "Tests del servicio con Prisma mockeado en lib/services/income-statement.service.test.ts"

# Luego, en paralelo (implementaciÃ³n en archivos distintos):
Task T008: "Implementar computeIncomeStatement en lib/accounting/income-statement.ts"
Task T009: "Implementar getIncomeStatement en lib/services/income-statement.service.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Foundational (T003â€“T005) â€” **CRITICAL, bloquea todo**
3. Complete Phase 3: User Story 1 (T006 â†’ T010)
4. **STOP and VALIDATE**: `npx vitest run lib/accounting/income-statement.test.ts
   lib/services/income-statement.service.test.ts` debe dar verde con el escenario Â§2
5. Demo: comparar el resultado 770,00 de `quickstart.md` Â§2 contra el cÃ¡lculo manual

### Incremental Delivery

1. Setup + Foundational â†’ utilidades y tipos listos
2. US1 â†’ reporte completo con fÃ³rmulas y servicio (MVP)
3. US2 â†’ signos y exclusiones verificados
4. US3 â†’ tolerancia a datos incompletos
5. US4 â†’ coherencia con Balance General y rendimiento
6. Polish â†’ lint, docs y checklists al dÃ­a

### Parallel Team Strategy

1. El equipo completa Setup + Foundational
2. Con la foundation lista:
   - Desarrollador A: US1 (`lib/accounting/income-statement.ts`)
   - Desarrollador B: tests de servicio (`lib/services/income-statement.service.test.ts`)
3. DespuÃ©s de US1: US2 âˆ¥ US3, y US4 al cerrar US1

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable (cada una con su criterio de
  "Independent Test")
- Verify tests fail before implementing (T004, T006, T007, T011, T014, T015, T017, T018)
- Commit after each task or logical group
- Stop at each checkpoint to validate the story independently
- **Fuera de alcance**: endpoint HTTP (`app/api/income-statement`), pantalla y migraciones
  (D11 / Supuestos de la spec)
- **Sin dependencias nuevas**: sÃ³lo `@prisma/client` y vitest, ya presentes en `package.json`
