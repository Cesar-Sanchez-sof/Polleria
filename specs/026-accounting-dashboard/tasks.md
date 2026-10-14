---

description: "Task list template for feature implementation â€” Dashboard Contable (026-accounting-dashboard)"
---

# Tasks: Dashboard Contable (Resumen Financiero)

**Input**: Design documents from `/specs/026-accounting-dashboard/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/accounting-dashboard.openapi.yaml](./contracts/accounting-dashboard.openapi.yaml)

**Tests**: Incluidos â€” el spec define criterios de prueba independientes por historia y `research.md` R8 fija la estrategia de testing (Vitest unit + route con Prisma mockeado).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monolito Next.js (ver plan.md "Project Structure"): lÃ³gica en `lib/`, API en `app/api/`, servicios cliente en `lib/services/`, pantallas en `app/<mÃ³dulo>/`. Sin cambios de esquema Prisma.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar la base de trabajo antes de escribir cÃ³digo nuevo (dependencias ya instaladas: Recharts 3.8.0, wrapper `components/ui/chart.tsx`, Prisma 6, Vitest 4)

- [X] T001 Establecer la lÃ­nea base verde: ejecutar `npm test` y `npm run lint` desde la raÃ­z y confirmar que la suite existente (balance-sheet, daily-book, general-ledger, journal-entries, usuarios, purchases) pasa sin errores antes de iniciar el feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos del contrato y helpers puros compartidos por TODAS las historias de usuario

**?? CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Definir las interfaces del contrato en `lib/accounting/dashboard.ts`: `DashboardPayload`, `Kpi` (keys `ingresos|gastos|utilidad|caja_bancos|por_cobrar|por_pagar|asientos`, `kind: "currency"|"count"`), `Variation` (`percent` 1 decimal, `direction: "up"|"down"|"flat"`), `MonthlyPoint` (`month` `YYYY-MM`), `ExpenseCategory` (`percent` 0â€“100), `TopAccount`, `DashboardInput` â€” literalmente segÃºn `data-model.md` Â§3 y `contracts/accounting-dashboard.openapi.yaml`
- [X] T003 [P] Implementar helpers puros compartidos en `lib/accounting/dashboard.ts`: `resolvePreviousRange` (perÃ­odo anterior de igual duraciÃ³n en dÃ­as: `desde_prev = desde âˆ’ duraciÃ³n`, `hasta_prev = desde âˆ’ 1 dÃ­a`, research R4), `computeVariation` (`((actual âˆ’ anterior) / |anterior|) Ã— 100` redondeada a 1 decimal; retorna `null` si no hay perÃ­odo anterior o `|anterior| < 0.005`, research R4/data-model Â§3) y `formatRangeLabel` (rango visible, es-PE, FR-008) â€” sin imports de Prisma

**Checkpoint**: Foundation ready â€” user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Ver los indicadores clave del perÃ­odo (Priority: P1) ?? MVP

**Goal**: KPIs del perÃ­odo (ingresos, gastos, utilidad neta, caja/bancos, por cobrar, por pagar, nÂº de asientos) con variaciÃ³n % vs perÃ­odo anterior, en una pantalla con estados carga/vacÃ­o/error

**Independent Test**: abrir `/accounting/dashboard` con un perÃ­odo que tenga datos â†’ todos los KPI aparecen con valor, formato monetario PEN y comparaciÃ³n porcentual; cada valor coincide exactamente con el total del reporte oficial correspondiente (SC-002, verificaciÃ³n manual contra `/api/balance-sheet`)

### Tests for User Story 1 (OPTIONAL - only if tests requested) ??

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T004 [P] [US1] Test unitario de KPIs en `lib/accounting/dashboard.test.ts`: ingresos/gastos/utilidad con `signedBalance` sobre cuentas `type Ingreso` y `Gasto|Costo` del rango (P&L del rango, nunca acumulado â€” R2.2); saldos acumulados al `hasta` para `10*` (caja), `12*` (por cobrar), `42*` (por pagar, signo acreedorâ†’positivo); utilidad negativa = pÃ©rdida; `variation = null` sin perÃ­odo anterior o con `|anterior| < 0.005`; redondeo a 2 decimales; rango sin datos â†’ KPIs en 0 y `meta.empty = true` (R8, edge cases del spec)

### Implementation for User Story 1

- [X] T005 [US1] Implementar el cÃ¡lculo de KPIs en `lib/accounting/dashboard.ts` (`buildDashboardKpis`): **reutilizar `signedBalance` y `round2` importados de `lib/accounting/balance-sheet.ts`** (no reimplementar); P&L del rango `desde`â€“`hasta`, saldos de balance acumulados `<= hasta`; filtro transversal cuentas `active: true` y asientos `entry.status: true` para coincidir exactamente con los reportes oficiales (FR-009, research R2/R2.2)
- [X] T006 [US1] Implementar `GET /api/accounting/dashboard` en `app/api/accounting/dashboard/route.ts`: validar `desde`/`hasta` con formato `YYYY-MM-DD` y `desde <= hasta` (400 si no), 404 sin cuentas activas, 500 en error inesperado; ejecutar con Prisma los agregados del rango, del rango previo y el conteo de asientos vigentes; invocar `buildDashboard()`; incluir bloque JSDoc `@openapi` coherente con `contracts/accounting-dashboard.openapi.yaml` y `export const dynamic = "force-dynamic"` (patrÃ³n `app/api/balance-sheet/route.ts`)
- [X] T007 [P] [US1] Test del handler en `app/api/accounting/dashboard/route.test.ts` con `vi.hoisted` + `vi.mock("@/lib/prisma")` (patrÃ³n `app/api/general-ledger/route.test.ts`): 200 con `kpis` correctos y `meta`, 400 con fecha mal formada, 400 con `desde > hasta`, 404 sin cuentas activas, 500 ante error Prisma
- [X] T008 [P] [US1] Cliente frontend en `lib/services/dashboard.service.ts`: `getDashboard(desde, hasta)` vÃ­a `getJson` de `lib/services/http.ts` y `buildDashboardQuery` (omitiendo vacÃ­os), re-exportando los tipos de `lib/accounting/dashboard.ts` (patrÃ³n `lib/services/balance-sheet.service.ts`)
- [X] T009 [US1] PÃ¡gina `app/accounting/dashboard/page.tsx` con `"use client"`: `ModuleHeader` del mÃ³dulo contabilidad, estados de carga (skeleton), error con botÃ³n "Reintentar", estado vacÃ­o ("Sin movimientos en el periodo"), `requestRef = useRef(0)` para descartar respuestas obsoletas (FR-011/FR-014, research R7, patrÃ³n `app/accounting/balance/page.tsx`) y render de `DashboardKpis`
- [X] T010 [P] [US1] Tarjetas KPI en `app/accounting/dashboard/components/DashboardKpis.tsx`: valor con formato `es-PE/PEN` para `kind: "currency"` y contador para `"count"`, variaciÃ³n porcentual con indicador visual up/down, etiqueta "sin comparaciÃ³n" cuando `variation` es `null`, tratamiento de color/etiqueta para utilidad negativa (pÃ©rdida, edge case del spec)
- [X] T011 [P] [US1] AÃ±adir el enlace "Dashboard Contable" â†’ `/accounting/dashboard` en `components/personalized/Sidebar.tsx`, dentro del bloque de contabilidad (mismo estilo que los enlaces existentes del mÃ³dulo)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently â€” MVP entregable (SC-001/SC-002 verificables)

---

## Phase 4: User Story 2 - Visualizar los grÃ¡ficos financieros (Priority: P2)

**Goal**: 4 grÃ¡ficos Recharts interactivos â€” tendencia ingresos vs gastos (12 meses), evoluciÃ³n utilidad mensual, distribuciÃ³n de gastos por categorÃ­a y cuentas con mayor movimiento

**Independent Test**: con al menos 3 meses de datos, abrir el dashboard â†’ los grÃ¡ficos se renderizan con datos correctos, leyendas, ejes etiquetados y tooltips con valor exacto al interactuar

### Tests for User Story 2 (OPTIONAL - only if tests requested) ??

- [X] T012 [P] [US2] Ampliar `lib/accounting/dashboard.test.ts`: serie mensual de los Ãºltimos 12 meses con meses sin datos rellenados en 0, `utilidad = ingresos âˆ’ gastos` por punto mensual, `expenseBreakdown` con categorÃ­as PCGE por prefijo (`60 Costo de ventas`, `62 Gastos de personal`, `63 Servicios`, `64 Arrendamientos`, `65 Otros gastos de gestiÃ³n`, `67 Gastos financieros`, `68 Impuestos y contribuciones`, `69 Costos no deducibles`, `Otros` â€” data-model Â§3) cuyos `percent` suman 100, y `topAccounts` top 8 ordenado por `|sum(debit) âˆ’ sum(credit)|` descartando montos `< 0.005` (research R2.1)

### Implementation for User Story 2

- [X] T013 [US2] Implementar en `lib/accounting/dashboard.ts`: `buildMonthlySeries` (punto por mes `YYYY-MM` terminado en el rango, meses sin datos en 0), `buildExpenseBreakdown` (agrupa cuentas `Gasto|Costo` por prefijo de categorÃ­a, monto y proporciÃ³n) y `buildTopAccounts` (top 8, `code` + `name`, research R2.1/R3)
- [X] T014 [US2] Ampliar `app/api/accounting/dashboard/route.ts` con la serie mensual vÃ­a `prisma.$queryRaw` (una sola consulta con `date_trunc('month', e.entry_date)` sobre `journal_entry` + `journal_entry_detail` + `accounting_account`, filtros `e.status = TRUE` y `a.active = TRUE`, `a.type IN ('Ingreso','Gasto','Costo')`, research R3) y pasar el agregado crudo a `buildDashboard()`
- [X] T015 [P] [US2] Ampliar `app/api/accounting/dashboard/route.test.ts` mockeando `prisma.$queryRaw`: payload 200 con `monthlySeries` poblada y caso de meses faltantes (relleno en 0)
- [X] T016 [US2] GrÃ¡ficos en `app/accounting/dashboard/components/DashboardCharts.tsx` usando **Recharts vÃ­a** `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent` de `components/ui/chart.tsx`: `BarChart` ingresos vs gastos (12 meses), `LineChart` utilidad mensual (color de pÃ©rdida), `PieChart` distribuciÃ³n de gastos con monto y proporciÃ³n, `BarChart` de cuentas con mayor movimiento; ejes etiquetados, leyenda y tooltip con valor exacto (FR-010), estado vacÃ­o comprensible por grÃ¡fico (US2.5) y contenedores con altura/aspect definida para evitar grÃ¡ficos en blanco (research R5)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Cambiar el perÃ­odo y comparar (Priority: P3)

**Goal**: Selector de perÃ­odo (desde/hasta + atajos "Periodo actual" / "Ãšltimos 12 meses") que actualiza KPIs y grÃ¡ficos sin recargar, con rango visible y control de carreras

**Independent Test**: cambiar el perÃ­odo seleccionado â†’ todos los KPI y grÃ¡ficos se recalculan con los datos del nuevo perÃ­odo sin recargar la pÃ¡gina; dos cambios rÃ¡pidos muestran siempre el Ãºltimo solicitado

### Implementation for User Story 3

- [X] T017 [P] [US3] Componente `app/accounting/dashboard/components/DashboardFilters.tsx`: dos inputs `type="date"` (desde/hasta), botones "Periodo actual" y "Ãšltimos 12 meses", y etiqueta visible del rango de fechas seleccionado en es-PE (FR-007/FR-008, research R4)
- [X] T018 [P] [US3] Helper puro `resolveDefaultRange` en `lib/accounting/dashboard.ts` con su test en `lib/accounting/dashboard.test.ts`: si hay `AccountingPeriod` abierto (`status = "OPEN"`, obtenido del array de `GET /api/accounting-periods?status=open`) usar su `startDate`â€“`endDate`; si no, Ãºltimos 12 meses desde hoy (R4)
- [X] T019 [US3] Integrar filtros en `app/accounting/dashboard/page.tsx`: resolver el rango por defecto al montar con `resolveDefaultRange`, disparar la carga al cambiar de rango agrupando cambios rÃ¡pidos con `setTimeout(0)` + `requestRef` (descartar respuestas obsoletas, FR-014/SC-005), mantener skeleton durante el cambio y conservar estados vacÃ­o/error por rango

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: ValidaciÃ³n end-to-end, documentaciÃ³n y regresiÃ³n

- [X] T020 [P] Crear la guÃ­a de validaciÃ³n `specs/026-accounting-dashboard/quickstart.md` (pre-requisitos, comandos de test unitario y de ruta, verificaciÃ³n manual con curl del endpoint, comparaciÃ³n SC-002 y checklist de UI), referenciando `contracts/accounting-dashboard.openapi.yaml` sin duplicar el contrato
- [X] T021 Ejecutar la verificaciÃ³n manual SC-002: con el servidor dev (`npm run dev`), comparar `ingresos`/`gastos`/`utilidad` de `GET /api/accounting/dashboard?desde&hasta` contra `GET /api/balance-sheet` para el mismo rango â†’ diferencia 0 en los tres valores; dejar constancia en `quickstart.md`
- [X] T022 RegresiÃ³n completa: ejecutar `npm test` (suite entera, sin roturas en los tests existentes) y `npm run lint`; verificar en `http://localhost:3000/api/docs` que el endpoint **Accounting Dashboard** aparece documentado con sus parÃ¡metros y respuestas
- [ ] T023 [P] RevisiÃ³n manual de UI segÃºn criterios del spec: estados carga/vacÃ­o/error con reintento, pÃ©rdida negativa representada sin montos confusos, tooltips/leyendas de los 4 grÃ¡ficos, cambio de perÃ­odo sin recarga y sin carreras, y rango de fechas siempre visible (SC-001/SC-004/SC-006)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies â€” can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001) â€” BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (T002, T003) â€” MVP
- **User Story 2 (Phase 4)**: Depends on Foundational; integra con US1 (amplÃ­a `lib/accounting/dashboard.ts`, la ruta y el test de US1) â€” implementar despuÃ©s de US1 para evitar conflictos de archivos
- **User Story 3 (Phase 5)**: Depends on Foundational; integra con US1 (page.tsx + filtros) â€” implementar despuÃ©s de US1
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational â€” no dependencies on other stories
- **User Story 2 (P2)**: Start after US1 (comparte `dashboard.ts`, `route.ts` y `route.test.ts` con US1)
- **User Story 3 (P3)**: Start after US1 (comparte `page.tsx` con US1)

### Within Each User Story

- Tests first (must FAIL before implementation)
- CÃ¡lculo puro antes que la ruta; ruta antes que el cliente y la pÃ¡gina
- Componentes [P] en paralelo cuando tocan archivos distintos
- Story complete before moving to next priority

### Parallel Opportunities

- T002 âˆ¥ T003 (Foundational, mismo archivo pero definiciones independientes â€” secuencial si se prefiere evitar conflictos)
- T004 es el primer task de US1 (los tests van antes que la implementaciÃ³n)
- T007 âˆ¥ T008 âˆ¥ T010 âˆ¥ T011 (archivos distintos: route.test.ts, service, componente de KPIs, Sidebar)
- T012 âˆ¥ T015 (tests de US2 en archivos distintos)
- T017 âˆ¥ T018 (DashboardFilters.tsx vs helper puro + test)
- T020 âˆ¥ T023 (docs vs revisiÃ³n de UI)

---

## Parallel Example: User Story 1

```bash
# Tras completar T004 (tests que fallan) y T005 (cÃ¡lculo puro), lanzar en paralelo:
Task: "Test del handler en app/api/accounting/dashboard/route.test.ts"        # T007
Task: "Cliente frontend en lib/services/dashboard.service.ts"                 # T008
Task: "Tarjetas KPI en app/accounting/dashboard/components/DashboardKpis.tsx" # T010
Task: "Enlace en components/personalized/Sidebar.tsx"                         # T011

# Luego, secuencial (dependen de lo anterior):
Task: "GET /api/accounting/dashboard en app/api/accounting/dashboard/route.ts" # T006
Task: "PÃ¡gina app/accounting/dashboard/page.tsx"                              # T009
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002â€“T003) â€” CRITICAL
3. Complete Phase 3: User Story 1 (T004â€“T011)
4. **STOP and VALIDATE**: KPIs correctos + comparaciÃ³n exacta vs `/api/balance-sheet` (SC-002)
5. Deploy/demo: pantalla funcional con los 7 KPI y comparaciÃ³n porcentual

### Incremental Delivery

1. Setup + Foundational â†’ base lista
2. US1 â†’ test independiente â†’ demo (MVP: radiografÃ­a financiera en <30 s, SC-001)
3. US2 â†’ test independiente â†’ demo (tendencias y concentraciones de gasto)
4. US3 â†’ test independiente â†’ demo (anÃ¡lisis de meses cerrados y avance del mes en curso)
5. Polish â†’ regresiÃ³n + documentaciÃ³n de validaciÃ³n

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once US1 is done (es la base compartida):
   - Developer A: User Story 2 (grÃ¡ficos: `DashboardCharts.tsx`, `$queryRaw`)
   - Developer B: User Story 3 (filtros: `DashboardFilters.tsx`, default range)
3. Stories complete and integrate independently (T020â€“T023 en conjunto al cierre)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Regla crÃ­tica (SC-002/FR-009): **no reimplementar reglas contables** â€” importar `signedBalance`/`round2` de `lib/accounting/balance-sheet.ts` y usar los mismos filtros de vigencia
