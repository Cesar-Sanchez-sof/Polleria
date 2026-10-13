# Tasks: Consultar Cuenta Contable (detalle)

**Input**: Design documents from `/specs/024-consultar-cuenta-contable/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/accounts-detail.openapi.yaml](./contracts/accounts-detail.openapi.yaml),
[quickstart.md](./quickstart.md)

**Tests**: La spec no pide TDD; se incluye **una única** tarea de prueba porque el escenario de
aceptación "fallo de base de datos → 500" (FR-008/SC-004) **no tiene cobertura automatizada hoy**
(la suite del GET cubre 200/400/404). El resto de la verificación apoya en la suite colocada
existente y en la validación manual de `quickstart.md`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Nota de contexto (research D2)**: la funcionalidad **ya está implementada y probada**
(`app/api/accounts/[id]/route.ts` + `route.test.ts`). Las tareas de las historias son de
**verificación**; el único cambio de código pendiente es la corrección documental OpenAPI (D6),
situada en Polish por ser transversal al contrato.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web application única (Next.js)**: rutas en `app/`, lógica compartida en `lib/`, datos en
  `prisma/` (ver plan.md *Source Code*)
- Los scripts usan PowerShell (Windows); ejecutar desde la raíz del repo `D:\backs\Polleria`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Asegurar el entorno mínimo para verificar la feature (toolchain + BD con plan contable).

- [X] T001 Verify toolchain and generate the Prisma client: run `npm install` then `npx prisma generate` in the repository root `D:\backs\Polleria` (confirms `@prisma/client` and Vitest are ready per plan.md Technical Context)
- [X] T002 [P] Ensure PostgreSQL is reachable and the chart of accounts is seeded: confirm `DATABASE_URL` in `D:\backs\Polleria\.env`, then run `npm run db:seed` in `D:\backs\Polleria` (creates the `AccountingAccount` rows needed by quickstart.md §2; seed logic in `prisma/seed-accounts.ts`)

**Checkpoint**: Environment ready — tests and manual validation can run.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Baseline de referencia ANTES de tocar nada; bloquea las verificaciones posteriores.

**?? CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Establish the test baseline: run `npm test` in `D:\backs\Polleria` and confirm every suite is green, including `app/api/accounts/[id]/route.test.ts` (baseline for FR-001…FR-008; if red here, STOP and investigate before proceeding)
- [X] T004 [P] Capture the baseline OpenAPI document for later diffing: start `npm run dev`, request `GET http://localhost:3000/api/openapi`, and save the JSON to `C:\Users\leand\AppData\Local\Temp\opencode\openapi-baseline-024.json` (expected in baseline: dangling `$ref: '#/components/schemas/Account'` and no 400/404/500 for `/api/accounts/{id}` — the gap documented in research D6)

**Checkpoint**: Foundation ready — user story verification can now begin.

---

## Phase 3: User Story 1 - Consultar el detalle de una cuenta por su identificador (Priority: P1) ?? MVP

**Goal**: Confirmar que `GET /api/accounts/{id}` cumple FR-001…FR-010: objeto plano con los 7
campos, `400` sin tocar la BD, `404` inexistente, `500` con log ante fallo, sin autenticación.

**Independent Test**: `npx vitest run app/api/accounts/[id]/route.test.ts` en verde con los
escenarios 200/400/404/500, más los `curl` de `quickstart.md` §2 contra `npm run dev`.

### Tests for User Story 1 (OPTIONAL - only if tests requested) ??

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T005 [P] [US1] Add the missing 500-path test for the detail query in `app/api/accounts/[id]/route.test.ts`: inside the existing `describe("GET /api/accounts/[id]")`, mock `accountMock.findUnique` to reject, then assert status `500`, body `{ "error": "No se pudo obtener la cuenta contable." }`, and that `console.error` was called (covers FR-008/SC-004; follow the existing mock conventions of that file — `vi.hoisted`, `vi.mock("@/lib/prisma")`)

### Implementation for User Story 1

- [X] T006 [US1] Run the detail-query suite and confirm all scenarios green: `npx vitest run app/api/accounts/[id]/route.test.ts` in `D:\backs\Polleria` (200 con formato público exacto `{ id, codigo, nombre, tipo, idPadre, activo, usos }`, 404, 400 sin tocar la BD, 500 — depends on T005)
- [X] T007 [US1] Execute the manual contract validation of quickstart.md §2 (steps 2a–2b) against `npm run dev` in `D:\backs\Polleria`: `GET /api/accounts/{id}` → 200 objeto plano sin envoltorio `data`; `/999999` → 404 `"Cuenta contable no encontrada."`; `/abc` → 400 `"Identificador de cuenta inválido."`; `/7abc` → 200 resolviendo a la cuenta 7 (BR-5); same response with and without session cookie (FR-007) — **DESVIACIÓN**: sin cookie la respuesta es `401 "No autenticado"` emitida por `proxy.ts` (activo); con cookie todo lo anterior passa. Ver T017/T018

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - Consultar cuentas inactivas y medir su uso (Priority: P2)

**Goal**: Confirmar FR-005 (cuentas inactivas consultables) y FR-006/SC-007 (`usos` consistente).

**Independent Test**: Consultar por `id` una cuenta inactiva → 200 con `activo: false`; consultar
una cuenta tras registrar un asiento que la use → `usos` aumenta en 1 (verificación según
quickstart.md §2c).

### Implementation for User Story 2

- [X] T008 [P] [US2] Verify an inactive account is fully queryable: pick an account with `activo: false` from `GET /api/accounts` (or create one via `POST /api/accounts` with `"activo": false` per spec 004) and request its detail in `D:\backs\Polleria` → expect `200` with `activo: false` and the remaining 6 fields intact (spec US2.1; quickstart.md §2b)
- [X] T009 [P] [US2] Verify a freshly created account reports `usos: 0` and `activo: true` in its detail response, using an account created during T008 or the seed accounts (`D:\backs\Polleria`; spec US2.3)
- [X] T010 [US2] Verify `usos` consistency end to end: annotate the current `usos` of one account, register a manual journal entry that uses it (flow of spec `002-registrar-asiento-manualmente`), re-query the detail, and confirm `usos` increased by exactly 1 with no caching (spec US2.2; quickstart.md §2c — depends on T002 for a working database)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Único cambio de código del plan: cerrar la deuda documental OpenAPI (research D6),
transversal al contrato de ambas historias; más limpieza y regresión.

- [X] T011 [P] Add the missing `Account` schema to `app/api/openapi/swaggerConfig.ts` inside `components.schemas`, mirroring `contracts/accounts-detail.openapi.yaml`: properties `id` (integer), `codigo` (string, `maxLength: 10`, `pattern: '^[A-Za-z0-9.-]{1,10}$'`), `nombre` (string, `maxLength: 100`), `tipo` (string, `enum: [Activo, Pasivo, Patrimonio, Ingreso, Gasto, Costo]`), `idPadre` (integer, `nullable: true`), `activo` (boolean), `usos` (integer, `minimum: 0`), with `required: [id, codigo, nombre, tipo, idPadre, activo, usos]` and a Spanish example (data-model.md §3)
- [X] T012 Update the `@openapi` annotation of the `GET` handler in `app/api/accounts/[id]/route.ts` so responses `400`, `404` and `500` reference `$ref: '#/components/schemas/Error'` with their exact messages (`"Identificador de cuenta inválido."`, `"Cuenta contable no encontrada."`, `"No se pudo obtener la cuenta contable."`) and `200` references `#/components/schemas/Account` (doc-comment only — do NOT alter the handler logic; PATCH annotation stays untouched, out of scope per research D6)
- [X] T013 [P] Verify the documentation fix end to end: restart `npm run dev`, fetch `GET http://localhost:3000/api/openapi`, diff against `C:\Users\leand\AppData\Local\Temp\opencode\openapi-baseline-024.json` (from T004), and open `http://localhost:3000/swagger` to confirm `/api/accounts/{id}` renders the `Account` schema with no dangling `$ref` and shows 400/404/500 (depends on T011, T012)
- [X] T014 [P] Update the evidence table in `specs/024-consultar-cuenta-contable/spec.md` ("Evidencia de verificación") to mention the new 500-path test in `app/api/accounts/[id]/route.test.ts` and the corrected OpenAPI documentation, keeping the table format
- [X] T015 Run full regression: `npm run lint` and `npm test` in `D:\backs\Polleria`; both must pass with no new warnings (depends on T005, T011, T012) — `npm test`: **246/246 en verde** (245 base + 1 nueva); `npm run lint`: los 207 problemas del repo son **preexistentes** y los archivos tocados por esta feature pasan limpios (`npx eslint` sobre los 3 archivos → exit 0)
- [X] T016 Commit the work in logical groups (verification test; OpenAPI doc fix; spec update) using `git add` + `git commit` in `D:\backs\Polleria`, with messages in the repository's existing style
- [X] T017 Correct the authentication statements in `specs/024-consultar-cuenta-contable/spec.md` (US1 scenario 6, FR-007, BR-2, Edge Cases, Permissions section, Assumptions) to document the discovered reality: `proxy.ts` (Next 16 middleware) is ACTIVE, so anonymous HTTP requests receive `401 "No autenticado"` before reaching the route handler, while the handler itself performs no session/role check (unit tests invoke it directly and therefore pass without a session)
- [X] T018 [P] Update `specs/024-consultar-cuenta-contable/plan.md` (Constraints), `specs/024-consultar-cuenta-contable/research.md` (add decision D10 on the authentication discovery and the pre-existing `requireRole` bug in `app/api/accounting-periods/route.ts`) and `specs/024-consultar-cuenta-contable/quickstart.md` (add the login prerequisite for all manual validation steps) so the design documents match the active-proxy reality

**Checkpoint**: All user stories verified and the contract documentation matches the implemented behavior.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
  (T003 baseline and T004 baseline capture)
- **User Stories (Phase 3+)**: Depend on Foundational phase completion
  - US1 (Phase 3) and US2 (Phase 4) are **independent of each other** (same endpoint, different
    scenarios) and can be verified in parallel
- **Polish (Final Phase)**: Depends on US1 verification (T006/T007) for confidence, and T013
  specifically depends on T011+T012; T015 depends on all code-touching tasks

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependencies on other stories; MVP
- **User Story 2 (P2)**: After Foundational — independent of US1 (needs only T002's seeded database; US1's T005 does not block it)

### Within Each User Story

- Tests (when included) written and failing first (T005 before T006)
- Verification tasks use the artifacts of Setup/Foundational (seeded DB, baselines)
- Story complete before moving to next priority (or run both in parallel — same files are untouched)

### Parallel Opportunities

- T001 ∥ T002 (Setup; different concerns)
- T003 ∥ T004 (Foundational; tests vs. OpenAPI baseline)
- T005 ∥ T007 (US1; test file vs. manual curl validation)
- T008 ∥ T009 (US2; independent manual checks)
- T011 ∥ T014 (Polish; `swaggerConfig.ts` vs. spec doc)
- US1 ∥ US2 entirely (read-only verification of the same implemented endpoint)

---

## Parallel Example: User Story 1

```powershell
# Launch the automated and manual verifications of US1 together (after T002/T003):
Task: "T005 Add the missing 500-path test ... in app/api/accounts/[id]/route.test.ts"
Task: "T007 Manual contract validation ... per quickstart.md §2 against npm run dev"

# After T005 completes:
Task: "T006 Run npx vitest run app/api/accounts/[id]/route.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T004) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T005–T007)
4. **STOP and VALIDATE**: the detail query satisfies FR-001…FR-10 with 200/400/404/500 covered
5. The feature is already deployed behavior — MVP means "verified + fully covered", not "built"

### Incremental Delivery

1. Setup + Foundational → baselines captured
2. US1 verified → MVP (consulta individual confirmada, falta 500 automatizado → añadido)
3. US2 verified → cuentas inactivas y `usos` confirmados
4. Polish → contrato OpenAPI alineado con el comportamiento real (D6), regresión limpia
5. Each story adds confidence without touching shared files

### Parallel Team Strategy

With multiple people:

1. Together: Setup + Foundational
2. Once Foundational is done:
   - Person A: US1 (T005–T007)
   - Person B: US2 (T008–T010) — read-only checks, no file conflicts
3. Together: Polish (T011–T016), donde sólo T011/T012 tocan código

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable (here: independently *verifiable*,
  since the implementation exists — research D2)
- Verify tests fail before implementing (T005 must fail before the code change is added to the
  test file — it validates already-working behavior, so it should pass immediately once written;
  if it fails, the handler has a regression)
- Commit after each task or logical group (T016)
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Out of scope (do NOT do): `PATCH /api/accounts/{id}` changes, front-end `getAccount()` in
  `lib/services/accounts.service.ts` (research D5), strict id-pattern validation (research D4),
  response enveloping (research D3)

---

## Implementation Notes (2026-10-12)

**Resultado: 18/18 tareas completadas.** Rama `024-consultar-cuenta-contable` (creada desde
`feature/consultar-cuentas-por-pagar`), 3 commits (`51078ac`, `679fe1e`, `c5bdda4`).

| Verificación | Resultado real |
|--------------|----------------|
| T003 baseline | 245 pruebas en verde (17 archivos) |
| T005/T006 | Nuevo test `500` añadido; suite `[id]` → 24/24 |
| T007 (con sesión) | `/8` → `200` objeto plano; `/999999` → `404`; `/abc` → `400`; `/8abc` y `/01` → `200` (BR-5); sin cookie → `401 "No autenticado"` (proxy) |
| T008 | Cuenta inactiva 205 (`990.01`) → `200` con `activo: false` |
| T009 | Cuenta nueva 206 (`990.02`) → `200` con `activo: true`, `usos: 0` |
| T010 | Asiento `MISC/2026/10/0001` (201) → `usos` 0→1 en las cuentas 9 y 49 |
| T013 | `/api/openapi`: esquema `Account` presente (sin `$ref` colgante); `400`/`404`/`500` → esquema `Error` con ejemplos |
| T015 | `npm test` 246/246; archivos tocados lint-limpios (los 207 problemas del repo son preexistentes) |

**Desviaciones y observaciones**

1. **Servidor de validación**: se usó `npx next dev -p 3124` porque el puerto 3000 ya estaba
   ocupado por otro proceso no relacionado.
2. **Autenticación (T017/T018)**: `proxy.ts` está activo → toda validación manual requiere sesión
   (`POST /api/auth/login`, usuario `admin` del seed). Specs/plan/research/quickstart corregidos.
3. **Período contable**: `POST /api/accounting-periods` está roto en el entorno (`requireRole`
   espera cookie `auth-token` e id de usuario fijo `3`); el período OPEN de octubre 2026 se creó
   como **fixture de BD** (`scripts/_tmp-period-024.ts`, ejecutado y eliminado). Bug preexistente
   fuera de alcance, documentado en research D10 (dominio de la spec `001`).
4. **Datos de verificación creados en la BD de desarrollo**: cuentas `990.01` (inactiva) y
   `990.02` (activa), asiento `MISC/2026/10/0001` y período 10/2026 — deliberados y trazables.
5. **`npm install` no se ejecutó** (T001): `node_modules` estaba sano; se verificó con
   `npx prisma generate` + `vitest --version`.
