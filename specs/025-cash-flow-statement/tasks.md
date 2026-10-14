---
description: "Task list — Estado de Flujos de Efectivo (025-cash-flow-statement)"
---

# Tasks: Estado de Flujos de Efectivo (NIC 7 / PCGE 2019)

**Input**: Design documents from `/specs/025-cash-flow-statement/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/cash-flow-statement-api.md](./contracts/cash-flow-statement-api.md),
[quickstart.md](./quickstart.md)

**Tests**: Incluidos — research D10 y SC-003 exigen batería de ≥10 escenarios (cálculo puro)
+ tests de ruta con Prisma mockeado.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Monolito Next.js: cálculo puro en `lib/accounting/`, ruta en `app/api/`, cliente en `lib/services/`. Sin migraciones Prisma.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Establecer la línea base verde: `npm test` desde la raíz y confirmar que la suite existente pasa antes de añadir el feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**?? CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Definir los tipos del contrato en `lib/accounting/cash-flow-statement.ts`: `PeriodMovement` (`accountCode`, `accountType?`, `debit`, `credit`), `CashFlowStatementParams` (`startDate`, `endDate`, `initialBalances`, `finalBalances`, `periodMovements` — data-model §CashFlowStatementParams) y `CashFlowStatementResult` snake_case completo (data-model §CashFlowStatementResult / contrato 200) — sin imports de Prisma

**Checkpoint**: Foundation ready

---

## Phase 3: User Story 1 - Generar el estado de flujos de efectivo de un período (Priority: P1) ?? MVP

**Goal**: `GET /api/cash-flow-statement?desde&hasta` devuelve el reporte de método indirecto con las tres secciones y sus subtotales.

**Independent Test**: curl con un período con movimiento → HTTP 200 con la estructura del contrato; `net_cash_increase = operating + investing + financing` y `cash_at_end = cash_at_beginning + net_cash_increase`.

### Tests for User Story 1 (tests first)

- [X] T003 [P] [US1] Batería de ≥10 escenarios del cálculo puro en `lib/accounting/cash-flow-statement.test.ts` (SC-003): conciliación exitosa, período vacío (0.00 y conciliado), pérdida neta, cobranza que sube/baja, préstamo y amortización de 45, compra de activo con 465 parcial, dividendos (débitos 407), cuenta ausente = 0.00, redondeo `0.1 + 0.2`, descuadre → `is_reconciled: false` con `reconciliation_difference` ≠ 0, depreciación (68) y diferencia de cambio (676/776)

### Implementation for User Story 1

- [X] T004 [US1] Implementar `buildCashFlowStatement(params)` en `lib/accounting/cash-flow-statement.ts`: reutilizar `signedBalance` y `round2` de `lib/accounting/balance-sheet.ts`; fórmulas D6 (operación/inversión/financiamiento), Δ = saldoFinal − saldoInicial por prefijo PCGE (research D5/D6), `net_profit` de las cuentas P&L del período (D3), efectivo `101|104` excluyendo `107` (FR-006), redondeo a 2 decimales en cada subtotal (FR-008), tolerancia 0.005 en `is_reconciled` (depends on T002, T003)
- [X] T005 [P] [US1] Tests de la ruta en `app/api/cash-flow-statement/route.test.ts` con `vi.hoisted` + `vi.mock("@/lib/prisma")` (patrón `app/api/general-ledger/route.test.ts`): 200 happy path con estructura snake_case, 400 fecha mal formada, 400 `desde > hasta`, 404 sin cuentas activas, 500 fallo de BD
- [X] T006 [US1] Implementar `GET` en `app/api/cash-flow-statement/route.ts` (depends on T004, T005): valida `desde`/`hasta` (400), cuentas activas (404 con mensaje del contrato), 3 `groupBy` de `journalEntryDetail` (inicial `< desde`, final `<= hasta`, ventana `[desde, hasta]` con `entry.status = true`), construye `CashFlowStatementParams` y devuelve `Response.json(result)`; `export const dynamic = "force-dynamic"`, manejo de errores 500 y bloque `@openapi` (tag Cash Flow Statement) — patrón `app/api/balance-sheet/route.ts`
- [X] T007 [P] [US1] Cliente frontend en `lib/services/cash-flow-statement.service.ts`: `CashFlowStatementFilter`, `getCashFlowStatement(filter)` con `getJson` de `lib/services/http.ts`, re-exporta `ApiError`, `formatPen`, `formatCutOffDate` desde los servicios existentes y el tipo `CashFlowStatementResult` (contrato §Cliente frontend)

**Checkpoint**: US1 entregable — MVP con curl 200 (SC-001 verificable)

---

## Phase 4: User Story 2 - Conciliar el efectivo calculado con la Cuenta 10 (Priority: P2)

**Goal**: `cash_at_beginning`/`cash_at_end`/`net_cash_increase` conciliados contra el saldo real de `101|104` con indicador explícito.

**Independent Test**: con datos consistentes `is_reconciled: true` y `reconciliation_difference = 0`; anulando un asiento que afecte la Cuenta 10 → `is_reconciled: false` y diferencia ≠ 0 (SC-005).

### Implementation for User Story 2

- [X] T008 [US2] Ampliar `lib/accounting/cash-flow-statement.test.ts` con los escenarios de conciliación US2: efectivo inicial/final de `101|104` (excluyendo `107` restringido), `net_cash_increase = op + inv + fin`, `cash_at_end = beginning + increase`, descuadre por efectivo fuera del modelo (ej. asiento en 104 sin contrapartida modelada) → `is_reconciled: false` + `reconciliation_difference` con signo correcto (`saldoReal − calculado`)
- [X] T009 [US2] Verificar en la ruta que la respuesta incluye `is_reconciled` y `reconciliation_difference` en el happy path (`app/api/cash-flow-statement/route.test.ts`)

**Checkpoint**: US1 + US2 funcionan de forma independiente

---

## Phase 5: User Story 3 - Reporte robusto ante datos incompletos y precisión monetaria (Priority: P3)

**Goal**: Cuentas ausentes = 0.00 sin errores y redondeo estricto a 2 decimales en todos los importes.

**Independent Test**: período con solo 2 cuentas con datos → el resto del reporte en 0.00 y HTTP 200; todos los montos con exactamente 2 decimales.

### Implementation for User Story 3

- [X] T010 [P] [US3] Ampliar `lib/accounting/cash-flow-statement.test.ts`: fixture con un único grupo de cuentas activas → todas las líneas no tocadas en 0.00 (FR-007/SC-004), y aserciones de 2 decimales en cada subtotal (FR-008/SC-003) usando un helper `toHaveTwoDecimals()`
- [X] T011 [US3] Caso de ruta con datos incompletos en `app/api/cash-flow-statement/route.test.ts`: catálogo de 5 cuentas pero solo 1 con movimiento → 200 con líneas en 0.00 y `currency: "PEN"`

**Checkpoint**: Todas las historias funcionan de forma independiente

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T012 [P] Regresión completa: `npm test` (sin roturas en la suite existente), `npx tsc --noEmit` y `npm run lint` sin errores nuevos introducidos por el feature
- [X] T013 Verificación manual según [quickstart.md](./quickstart.md): `npm run dev` + curl 200/400/404 + aritmética `net_cash_increase` y `cash_at_end` + aparición del endpoint en `/api/docs` (Swagger `@openapi`)

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002)** → bloquea todo
- **US1**: T003 (test, primero) → T004 (cálculo) → T005 ∥ T007 → T006 (ruta) → checkpoint
- **US2**: después de US1 → T008 → T009
- **US3**: después de US1 → T010 ∥ T011
- **Polish**: T012 → T013

### Parallel Opportunities

- T002 ∥ T003 (tipos vs tests, archivos distintos una vez creados los tipos)
- T005 ∥ T007 (route.test.ts vs service)
- T010 ∥ T011 (test puro vs test de ruta)

---

## Implementation Strategy

1. Setup + Foundational (T001–T002)
2. **US1 (T003–T007) → MVP**: curl 200 con estructura completa
3. US2 (T008–T009): conciliación validada
4. US3 (T010–T011): robustez y redondeo
5. Polish (T012–T013): regresión + validación manual + Swagger

---

## Notes

- [P] tasks = different files, no dependencies
- Regla crítica: **no reimplementar** `signedBalance`/`round2` — importarlos de `lib/accounting/balance-sheet.ts`
- Efectivo = `101|104` explícitos, **nunca** `10` genérico (excluye 107 — FR-006)
- Sin cambios de esquema Prisma ni migraciones
