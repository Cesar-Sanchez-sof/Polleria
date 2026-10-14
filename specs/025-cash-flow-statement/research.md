# Research: Estado de Flujos de Efectivo (NIC 7 / PCGE 2019)

**Feature**: 025-cash-flow-statement | **Fecha**: 2026-10-12 | **Fase**: 0 (Outline & Research)

Este documento resuelve todos los "unknowns" del contexto técnico. Referencias verificadas en el código: `lib/accounting/balance-sheet.ts`, `app/api/balance-sheet/route.ts`, `app/api/general-ledger/route.test.ts`, `lib/dates.ts`, `prisma/schema.prisma` (modelos `AccountingAccount`, `JournalEntry`, `JournalEntryDetail`).

---

## D1 — Arquitectura en tres capas (reutilizar patrón Balance General)

**Decisión**: Núcleo de cálculo puro en `lib/accounting/cash-flow-statement.ts`; ruta `app/api/cash-flow-statement/route.ts` que hace los agregados Prisma y llama al cálculo; cliente frontend en `lib/services/cash-flow-statement.service.ts`.

**Rationale**: Es exactamente la arquitectura del reporte análogo (`balance-sheet`). El cálculo puro se prueba sin BD ni Next.js; la ruta solo orquesta datos (como `app/api/balance-sheet/route.ts` líneas 74-160); el cliente repite el patrón de `balance-sheet.service.ts` (`getJson` desde `lib/services/http.ts`). Además satisface el pedido literal del usuario de tener `lib/services/cash-flow-statement.service.ts`.

**Alternativas consideradas**:
- *Todo en un solo archivo de servicio con Prisma acoplado*: rechazado — no testeable sin BD, contra el precedente del proyecto.
- *Lógica dentro de la ruta*: rechazado — no testeable unitariamente, duplicaría lógica en futuras UIs.

---

## D2 — Ventana de períodos y saldos (inicial vs. del período)

**Decisión**:
- **Saldos iniciales**: `journalEntryDetail` de asientos vigentes (`entry.status = true`) con `entry.entryDate < startDate` (día anterior inclusive).
- **Movimientos del período**: mismo filtro con `entry.entryDate >= startDate && <= endDate`.
- Ambos se obtienen con `prisma.journalEntryDetail.groupBy({ by: ["accountId"], _sum: { debit, credit } })` — dos llamadas, igual que el balance-sheet (líneas 89-112).

**Rationale**: `entryDate` es `@db.Date` y se compara en UTC con `parseUtcDate` (`lib/dates.ts`), evitando corrimientos de zona horaria. El patrón de dos `groupBy` (saldo acumulado + ventana del período) ya está probado en producción en `/api/balance-sheet`.

**Alternativas consideradas**: calcular saldos iniciales como `saldoFinal − movimientosDelPeríodo` — rechazado: propaga errores de redondeo y complica la conciliación (SC-001 exige fidelidad a dos decimales).

---

## D3 — Fuente del Resultado Neto (net_profit)

**Decisión**: `net_profit` = suma de los saldos firmados del período de las cuentas de naturaleza P&L (`type IN ("Ingreso","Gasto","Costo")`) calculada con la misma lógica de `computePeriodResult` de `balance-sheet.ts` (Ingreso suma, Gasto/Costo restan), acotada a la ventana `[startDate, endDate]` — no al año calendario.

**Rationale**: La cuenta 89 (Resultado del ejercicio) solo se acredita con asientos de cierre; para un reporte de período parcial (mes/trimestre) la fuente fiable son las cuentas de P&L del propio período. Es además coherente con cómo el Balance General calcula `periodResult`.

**Alternativas consideradas**: leer el saldo de la cuenta 89 — rechazado para v1: solo existe después del cierre anual y distorsionaría reportes mensuales.

---

## D4 — Saldo firmado y convención de signos (reutilizar `signedBalance`)

**Decisión**: Reutilizar `signedBalance(type, debit, credit)` de `lib/accounting/balance-sheet.ts`:
- Activo / Gasto / Costo → `débito − crédito` (+)
- Pasivo / Patrimonio / Ingreso → `crédito − débito` (+)

Efecto en flujo de cada línea de capital de trabajo (spec FR-003):
- **Activo** (12, 20/24/25): `efecto = saldoInicial − saldoFinal` (sube → resta flujo)
- **Pasivo** (40, 41, 42, 45, 50): `efecto = saldoFinal − saldoInicial` (sube → suma flujo)

**Rationale**: la función ya existe y está testeada; unifica convenciones entre reportes contables.

---

## D5 — Agrupación de cuentas por prefijo PCGE

**Decisión** (todos los matching son `code.startsWith(...)`, como en `balance-sheet.ts`):

| Línea del reporte | Cuentas PCGE | Naturaleza |
|---|---|---|
| Efectivo (10) | `101`, `104` — **excluye** `107` Fondos restringidos | Activo |
| Cuentas por cobrar comerciales | `12` (121 Anticipos, 122 Facturas/boletas por cobrar) | Activo |
| Inventarios / existencias | `20` (Mercaderías), `24` (Materias primas), `25` (Suministros) | Activo |
| Cuentas por pagar comerciales | `42` (421 Proveedores nacionales) | Pasivo |
| Remuneraciones por pagar | `41` | Pasivo |
| Tributos por pagar | `40` (incluye 40111 IGV, 4017 Renta, 403 Planilla) | Pasivo |
| Depreciación y amortización | `68` (contrapartida 395) | Gasto |
| Diferencia de cambio | `676` (pérdida) y `776` (ganancia) | Gasto / Ingreso |
| Adquisición de PPE | `33` (neto de `465` Proveedores de inmuebles/maquinaria) | Activo / Pasivo |
| Desinversiones financieras | `30` (Inversiones financieras) | Activo |
| Aportes de capital | `50` (501 Capital social) | Patrimonio |
| Obligaciones financieras | `45` | Pasivo |
| Dividendos pagados | `407` (Cuentas por pagar - socios y accionistas) | Pasivo |

**Rationale**: los subcódigos completos (40111, 4017…) se cubren con el prefijo del agrupador mayor, consistente con `CURRENT_LIABILITY_GROUPS` del Balance General. El código de cuenta es `VarChar(10)` y puede traer sub-niveles; el prefijo absorbe toda la jerarquía sin necesidad de resolver `parentId`.

**Nota 107**: el grupo "cash" del balance-sheet usa `startsWith("10")` (incluye 107). Aquí se usa explícitamente `101|104` porque el spec (FR-006) exige **excluir** fondos restringidos del efectivo y equivalentes.

---

## D6 — Métodos de cálculo por línea

**Decisión** (fórmulas exactas; `ΔX = saldoFinal(X) − saldoInicial(X)` con saldos firmados según D4):

**Operación**
1. `net_profit` = resultado P&L del período (D3)
2. `depreciation` = saldo firmado del período de `68` (se suma como ajuste no monetario)
3. `unrealized_exchange_difference` = `saldoPeríodo(676) − saldoPeríodo(776)` (pérdida positiva suma; ganancia positiva resta)
4. `accounts_receivable` = `−Δ(12)`; `inventories` = `−Δ(20|24|25)` (activos)
5. `accounts_payable` = `+Δ(42)`; `payroll_payable` = `+Δ(41)`; `taxes_payable` = `+Δ(40)` (pasivos)
6. `net_cash_operating` = net_profit + total_ajustes + total_capital_trabajo

**Inversión**
7. `property_plant_equipment_purchases` = `−max(0, Δ(33) − Δ(465))` → negativo (salida); el incremento de 465 (proveedor de activos aún no pagado) se descuenta para aislar el efectivo realmente pagado (spec FR-004)
8. `asset_sales` = `max(0, −Δ(33)) + max(0, −Δ(30))` → positivo (entrada); se asume que las bajas de 33/30 corresponden a cobros en efectivo (ver supuesto A4)
9. `net_cash_investing` = suma

**Financiamiento**
10. `capital_contributions` = `+Δ(50)` (pasivo/patrimonio: sube → suma)
11. `financial_obligations` = `+Δ(45)` neto (préstamos recibidos suman; amortizaciones restan)
12. `dividends_paid` = `−Σ débitos del período en cuentas 407` → negativo (salida de efectivo). Las **declaraciones** (créditos en 407 contra 59) son no monetarias y no se reportan; solo los pagos (débitos) representan salida de efectivo (NIC 7)
13. `net_cash_financing` = suma

**Conciliación**
14. `cash_at_beginning` = saldo inicial firmado de `101|104`
15. `net_cash_increase` = operación + inversión + financiamiento
16. `cash_at_end` = `cash_at_beginning + net_cash_increase`
17. `is_reconciled` = `|cash_at_end − saldoFinalFirmado(101|104)| < 0.005` (tolerancia de medio céntimo por redondeo)
18. `reconciliation_difference` = `saldoFinalFirmado(101|104) − cash_at_end` (campo extra habilitado por FR-009 "como mínimo")

**Rationale semántico de la conciliación**: las tres secciones **no** cubren todas las cuentas de balance (ej. 46 otras por pagar, 63 gastos). Por partida doble, `Δ10 = P&L + ajustes + ΣΔcuentas de balance no monetarias`. Si existe efectivo afectado por cuentas fuera del modelo (o asientos faltantes), `cash_at_end ≠ saldoFinal(10)` → `is_reconciled = false`. La conciliación es así una **verificación de integridad real**, no una identidad trivial — exactamente lo que piden US2 y SC-005.

**Alternativas consideradas para dividendos**: `Δ(407)` neto — rechazado: mezcla declaraciones del período con pagos y oculta salidas cuando ambos ocurren en la ventana.

---

## D7 — Tolerancia y redondeo

**Decisión**:
- Cuenta ausente de los agregados → `0.00` (`Map.get(...) ?? 0`), nunca error (spec FR-007).
- `round2(n) = Math.round(n * 100) / 100` (idéntico a `balance-sheet.ts` línea 67-69) aplicado en **cada** subtotal de línea y de sección, no solo al final (spec FR-008 / SC-003).
- `isMeaningful` (`|x| >= 0.005`) disponible si se requiere filtrar ceros en futuras presentaciones.

**Rationale**: coincide con la convención monetaria existente del proyecto y evita la acumulación de residuos de coma flotante que rompería la conciliación.

---

## D8 — Contrato de salida (snake_case)

**Decisión**: El JSON de respuesta conserva la estructura **snake_case** del prompt de origen (`operating_activities.net_cash_operating`, `cash_at_beginning`, `is_reconciled`, …), más el campo adicional `reconciliation_difference`.

**Rationale**: es el contrato solicitado explícitamente por el usuario y ya está fijado en el spec (FR-009). El proyecto mezcla convenciones (daily-book usa claves en español, balance-sheet camelCase), por lo que no hay un estándar que lo impida.

**Alternativas consideradas**: camelCase homogéneo con `BalanceSheetStatement` — dejado como opción futura al ser breaking una vez publicado el endpoint.

---

## D9 — Parámetros del endpoint y single-tenant

**Decisión**: `GET /api/cash-flow-statement?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` (nombres en español, como `/api/daily-book`). Sin `companyId`: el schema Prisma **no tiene modelo Company**; el ERP es single-tenant con `COMPANY_NAME` en env (usado por `/api/balance-sheet`). Validación 400 si el formato no es `YYYY-MM-DD` o si `desde > hasta`; 404 si no hay cuentas contables activas (igual que balance-sheet); 500 en error inesperado.

**Rationale**: consistencia total con la API existente; el `companyId` del prompt de origen se resuelve como supuesto single-tenant (spec Out of Scope: multi-empresa).

---

## D10 — Estrategia de pruebas (Vitest)

**Decisión**:
1. `lib/accounting/cash-flow-statement.test.ts` — cálculo puro con fixtures de saldos/movimientos. Casos: conciliación exitosa (obligatorio por spec), período vacío, pérdida neta, suba/baja de cobranzas, préstamo y amortización de 45, compra de activo con 465 parcial, dividendos, cuenta ausente = 0.00, redondeo de 0.1+0.2.
2. `app/api/cash-flow-statement/route.test.ts` — ruta con `vi.hoisted` + `vi.mock("@/lib/prisma")` (patrón de `general-ledger/route.test.ts`): 400 fecha inválida / desde > hasta, 404 sin cuentas, 200 happy path, 500 en fallo de BD.

**Rationale**: patrón probado en el repo; el 100% de la lógica de negocio queda cubierta sin BD real. SC-003 exige la batería de ≥10 escenarios en el test puro.

---

## Supuestos registrados (del spec, con sueco técnico)

- **A1**: moneda fija `"PEN"` en la respuesta (campo `currency`).
- **A2**: `net_profit` por cuentas P&L del período (D3), fallback 0.00 sin datos.
- **A3**: método exclusivamente indirecto; sin notas de presentación NIC 7 complementarias (Out of Scope).
- **A4**: bajas de cuentas 33/30 se tratan como cobros de efectivo (aproximación v1 aceptable; en una futura versión se distinguirán permutas no monetarias).
- **A5**: dividendos identificados por débitos del período en 407 (D6.12).

## NEEDS CLARIFICATION restantes

Ninguno — todos los unknowns del Technical Context están resueltos (D1-D10).
