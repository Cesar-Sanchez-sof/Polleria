# Research: Dashboard Contable (Resumen Financiero)

**Feature**: `026-accounting-dashboard` | **Fase 0** | **Fecha**: 2026-10-12

Resuelve todos los *unknowns* del Technical Context de `plan.md`. Referencias verificadas
en código: `lib/accounting/balance-sheet.ts`, `app/api/balance-sheet/route.ts`,
`lib/services/balance-sheet.service.ts`, `lib/services/http.ts`,
`app/accounting/balance/page.tsx`, `components/ui/chart.tsx`,
`components/personalized/Sidebar.tsx`, `app/api/general-ledger/route.test.ts`,
`prisma/schema.prisma` (modelos `AccountingAccount`, `AccountingPeriod`, `JournalEntry`,
`JournalEntryDetail`), `prisma/schema.prisma` datasource (`postgresql`).

---

## R1 — Fuente y forma de los datos del dashboard

**Unknown**: ¿componer el dashboard desde endpoints existentes (balance-sheet, daily-book,
general-ledger) o crear un endpoint propio?

**Decisión**: **Endpoint propio** `GET /api/accounting/dashboard?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`
que, con 3–4 consultas Prisma, obtiene los agregados y los pasa a una función pura
`buildDashboard()` en `lib/accounting/dashboard.ts`.

**Rationale**: los endpoints existentes devuelven reportes ya formateados (líneas de
balance, diario) y no exponen series mensuales ni comparación con el período anterior;
componer 4–5 fetch en el cliente violaría SC-003 (<3 s) y SC-005 (cambio <3 s), y
duplicaría lógica. El patrón "route handler + cálculo puro" es exactamente el de
`app/api/balance-sheet/route.ts` + `lib/accounting/balance-sheet.ts` (consistencia y
mismo testeo).

**Alternativas consideradas**:
- *Componer desde `/api/balance-sheet` + `/api/general-ledger` + `/api/daily-book`*: descartada — no hay KPI agregados ni serie mensual en ellos, y multiplique requests.
- *Server Component que consulta Prisma directamente en `page.tsx`*: descartada — todo el módulo contable usa `"use client"` + service (patrón `app/accounting/balance/page.tsx`), y rompería los estados de carga/carrera con `requestRef`.

---

## R2 — Definición exacta de cada KPI (para que coincida con los reportes oficiales)

**Unknown**: fórmulas de ingresos, gastos, utilidad, caja, por cobrar, por pagar.

**Decisión**: usar **`signedBalance(type, debit, credit)`** de
`lib/accounting/balance-sheet.ts` (reutilizado, no reimplementado) sobre cuentas activas,
con estos criterios:

| KPI | Cuentas | Fórmula | Tipo |
|---|---|---|---|
| Ingresos | `type === "Ingreso"` | `signedBalance` (acreedor) | suma del período (`desde`–`hasta`) |
| Gastos | `type === "Gasto" || type === "Costo"` | `signedBalance` (deudor) | suma del período |
| Utilidad neta | — | `ingresos − gastos` | suma del período (negativo = pérdida) |
| Caja y bancos | `code.startsWith("10")` | `signedBalance` (deudor) | **saldo acumulado** al `hasta` |
| Cuentas por cobrar | `code.startsWith("12")` | `signedBalance` (deudor) | saldo acumulado al `hasta` |
| Cuentas por pagar | `code.startsWith("42")` | `−signedBalance` (acreedor → positivo) | saldo acumulado al `hasta` |
| N.º de asientos | `journalEntry` con `status: true` | `count` | del período |
| Cuentas con mayor movimiento | todas | `abs(debit + credit)` por cuenta (o `abs(debit−credit)` según naturaleza, ver R2.1) | del período |

Filtro transversal idéntico al resto de reportes: `entry.status === true` y cuentas
`active: true` (ver `app/api/balance-sheet/route.ts:94,75`).

**Rationale**: P&L (ingresos/gastos/utilidad) y balance (caja/por cobrar/por pagar) son
los mismos agregados que alimentan `/api/balance-sheet`, garantizando SC-002
(diferencia 0). Los prefijos `10/12/42` ya se usan como grupos en
`lib/accounting/balance-sheet.ts:96-138`.

**R2.1 — "Mayor movimiento"**: decisión → `montoMovido = |debit − credit|` **agregado
sobre todas las líneas de la cuenta** (`sum(debit) − sum(credit)` en valor absoluto),
porque es el mismo número que arroja el saldo del período y evita doble conteo. Orden
descendente, top 8, descartando cuentas con `montoMovido < 0.005`.

**Alternativas consideradas**: (a) `sum(debit) + sum(credit)` (movimiento bruto):
descartado porque en partidas de doble asiento infla cuentas de naturaleza acreedora;
(b) usar solo `type === "Gasto"` para el KPI gastos: descartado porque el spec pide
"gastos" y `computePeriodResult` de balance-sheet ya considera `Gasto + Costo`.

## R2.2 — Excluir KPIs P&L del acumulado histórico

**Decisión**: ingresos/gastos/utilidad **siempre** se calculan sobre el rango seleccionado
(`desde`–`hasta`), nunca acumulados desde el origen; los saldos de balance (caja/por
cobrar/por pagar) sí son acumulados hasta `hasta` (igual que el balance real).

**Rationale**: coincide con la semántica de `/api/balance-sheet`, que usa
`entryDate >= yearStart` para P&L y `<= hasta` para cuentas de balance
(`app/api/balance-sheet/route.ts:89-112`).

---

## R3 — Serie mensual de los últimos 12 meses (gráficos de tendencia/utilidad)

**Unknown**: cómo obtener ingresos y gastos mes a mes sin 12 queries.

**Decisión**: **una sola consulta SQL** con `prisma.$queryRaw` sobre
`journal_entry` + `journal_entry_detail` + `accounting_account`:

```sql
SELECT date_trunc('month', e.entry_date) AS mes,
       a.type AS tipo,
       COALESCE(SUM(d.debit),0)  AS debit,
       COALESCE(SUM(d.credit),0) AS credit
FROM journal_entry_detail d
JOIN journal_entry e ON e.id = d.entry_id AND e.status = TRUE
JOIN accounting_account a ON a.id = d.account_id AND a.active = TRUE
WHERE e.entry_date BETWEEN $desde AND $hasta
  AND a.type IN ('Ingreso','Gasto','Costo')
GROUP BY 1, 2 ORDER BY 1;
```

El agregado crudo pasa a `buildDashboard()`, que arma la serie mes a mes
(rellenando meses sin datos con 0, ver edge case "periodo sin movimientos").

**Rationale**: PostgreSQL (`datasource db.provider = "postgresql"`) soporta
`date_trunc`; 1 sola query para los 12 meses + 1 para los agregados de KPI + 1 para
"mayor movimiento" + 1 para conteo de asientos = ~4 consultas por carga.

**Alternativas consideradas**:
- *12 × `groupBy` con rango mensual*: descartada (N+1 innecesario, más lento, peor para SC-003).
- *Traer todas las líneas y agrupar en JS*: descartada (memoria y tiempo crecen con el histórico).
- *Vista materializada / tabla agregada*: descartada (complejidad + migración, viola el gate "sin cambios de esquema").

---

## R4 — Período por defecto y comparación con período anterior

**Decisión**:
- **Rango por defecto**: si hay un `AccountingPeriod` con `status = OPEN`, usar su
  `startDate`–`endDate`; si no hay periodo abierto, usar los **últimos 12 meses**
  (misma lógica del spec: "período vigente o últimos 12 meses").
- **Selección**: dos inputs `type="date"` (desde/hasta) + botón "Periodo actual" y
  "Últimos 12 meses" (mismo estilo que `BalanceSheetFilters`).
- **Comparación**: período inmediato anterior de **misma duración en días**
  (`desde_prev = desde − duración`, `hasta_prev = desde − 1 día`). Si ese rango cae
  antes de la primera fecha con datos o está vacío → variación `null` y la tarjeta
  muestra "sin comparación" (FR-002 / edge case US1.4).
- **Variación %**: `((actual − anterior) / |anterior|) × 100`, redondeada a 1 decimal;
  si `|anterior| < 0.005` → `null` (evita división por cero).

**Rationale**: regla por defecto razonable documentada en Assumptions del spec; la
comparación por duración equivalente es la única justa para rangos arbitrarios.

---

## R5 — Gráficos con Recharts

**Decisión**: usar **Recharts 3.8.0** (ya en `package.json`) a través del wrapper shadcn
**`components/ui/chart.tsx`** (`ChartContainer`, `ChartTooltip`, `ChartLegend`,
`ChartConfig`), con `BarChart`/`LineChart` (trend, utilidad, cuentas) y `PieChart`
(distribución de gastos). Todo dentro de componentes `"use client"`.

**Rationale**: el solicitante pidió Recharts explícitamente (Assumptions del spec);
`chart.tsx` ya importa `recharts` y trae tooltips, leyenda, temas y estados vacíos
consistentes con shadcn/Tailwind 4. Sin dependencias nuevas.

**Alternativas consideradas**: importar primitivas Recharts crudas sin `chart.tsx`
(descartada: duplica tooltips/leyenda y rompe consistencia visual); librerías nuevas
(descartada: ya está Recharts).

**Riesgo/verificación**: Recharts requiere anchura del contenedor → los gráficos van en
`aspect-video`/alto fijo dentro de `ChartContainer` y la página se prueba en móvil
(estados del spec: sin gráfico en blanco roto).

---

## R6 — Acceso/autenticación (FR-013)

**Decisión**: **sin control nuevo**. `app/api/balance-sheet/route.ts` no valida sesión ni
rol (verificado: no hay `middleware.ts` en la raíz ni checks en el handler), y el sidebar
muestra los enlaces contables sin filtro de rol (spec 007, evidencia
`components/personalized/Sidebar.tsx`). El dashboard se comporta **exactamente igual**
que `/accounting/balance` → FR-013 satisfecho por equivalencia, no por código nuevo.

**Alternativa descartada**: añadir auth solo al dashboard (inconsistente con el módulo;
alcance de otra feature).

---

## R7 — Estados de carga / vacío / error (FR-011) y control de carreras (FR-014)

**Decisión**: replicar el patrón de `app/accounting/balance/page.tsx`:
`loading`/`error` state + `requestRef = useRef(0)` para descartar respuestas obsoletas +
`setTimeout(0)` para agrupar cambios rápidos de rango. Estados por bloque: el dashboard
completo muestra skeleton ("Cargando dashboard…"), estados vacíos por tarjeta/gráfico
("Sin movimientos en el periodo") y error con botón "Reintentar".

**Rationale**: es el comportamiento ya testeado en producción del módulo y satisface
FR-011, FR-014, SC-005, SC-006 sin lógica nueva.

---

## R8 — Estrategia de testing

**Decisión**:
1. `lib/accounting/dashboard.test.ts` — función pura: KPI con datos de fixture,
   utilidad negativa (pérdida), variación % (incl. `null` por cero/ausencia), serie
   mensual con meses faltantes = 0, top-cuentas, redondeo a 2 decimales, rango vacío.
2. `app/api/accounting/dashboard/route.test.ts` — handler con
   `vi.mock("@/lib/prisma")` + `vi.hoisted` (patrón
   `app/api/general-ledger/route.test.ts`): 200 con payload completo, 400 con fecha
   inválida, 404 sin cuentas activas, 500 ante error Prisma.
3. Verificación manual SC-002: comparar `ingresos/gastos/utilidad` del dashboard contra
   `/api/balance-sheet` para el mismo rango (quickstart.md).

**Rationale**: convenciones Vitest ya establecidas (`npm test`); cobertura de la lógica
nueva sin duplicar tests de lo que ya cubren `balance-sheet.test.ts`.

---

## R9 — Contrato y documentación OpenAPI

**Decisión**: documentar el endpoint con bloque `@openapi` en `route.ts` (patrón de
`app/api/balance-sheet/route.ts`) y volcar el contrato objetivo en
`contracts/accounting-dashboard.openapi.yaml` (formato OpenAPI 3.0.3, igual que
`specs/024-consultar-cuenta-contable/contracts/accounts-detail.openapi.yaml`).

**Rationale**: `/api/openapi` (swagger-jsdoc) escanea `app/api/**/*.ts`; mantener el
contrato en la carpeta del feature es la práctica del repo.

---

## Tabla de unknowns resueltos

| # | Unknown (Technical Context) | Estado |
|---|---|---|
| R1 | Fuente de datos del dashboard | ✅ endpoint propio + cálculo puro |
| R2 | Fórmulas KPI y "mayor movimiento" | ✅ `signedBalance` + prefijos PCGE 10/12/42 |
| R2.2 | Semántica P&L vs saldos de balance | ✅ rango vs acumulado |
| R3 | Serie de 12 meses | ✅ `$queryRaw` con `date_trunc` |
| R4 | Período por defecto y comparación | ✅ periodo OPEN / 12 meses + rango previo igual duración |
| R5 | Uso de Recharts | ✅ wrapper `components/ui/chart.tsx` |
| R6 | Acceso (FR-013) | ✅ equivalente a `/accounting/balance` (sin auth, como el resto) |
| R7 | Loading/vacío/error/carreras | ✅ patrón `balance/page.tsx` con `requestRef` |
| R8 | Testing | ✅ unit (pura) + route.test (mock prisma) + verificación manual SC-002 |
| R9 | Contrato | ✅ `@openapi` + `contracts/*.yaml` |

**No quedan NEEDS CLARIFICATION sin resolver.**
