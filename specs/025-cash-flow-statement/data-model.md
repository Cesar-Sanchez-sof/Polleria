# Data Model: Estado de Flujos de Efectivo

**Feature**: 025-cash-flow-statement | **Fase**: 1 (Design & Contracts)

## Entidades de persistencia

**No hay nuevos modelos ni migraciones.** El reporte se deriva exclusivamente de entidades existentes (`prisma/schema.prisma`):

| Modelo existente | Uso en el reporte |
|---|---|
| `AccountingAccount` | Catálogo de cuentas PCGE: `code` (`VarChar(10)`, agrupación por prefijo), `type` (Activo/Pasivo/Patrimonio/Ingreso/Gasto/Costo), `active` |
| `JournalEntry` | Ventana temporal: `entryDate` (`@db.Date`, UTC), `status` (solo asientos vigentes = `true`) |
| `JournalEntryDetail` | Montos agregados: `debit`/`credit` (`Decimal(12,2)`) agregados por `accountId` vía `groupBy` |

## Entidades derivadas (estructuras del reporte)

### CashFlowStatementParams (entrada del cálculo puro)

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `startDate` | `string` (YYYY-MM-DD) | ✅ | Fecha UTC, formato estricto; `<= endDate` |
| `endDate` | `string` (YYYY-MM-DD) | ✅ | Fecha UTC |
| `initialBalances` | `Record<accountCode, number>` | ✅ | Saldos firmados acumulados a `startDate − 1 día`; cuenta ausente = 0.00 |
| `finalBalances` | `Record<accountCode, number>` | ✅ | Saldos firmados acumulados a `endDate`; cuenta ausente = 0.00 |
| `periodMovements` | `Array<{ accountCode, debit, credit }>` | ✅ | Movimientos en `[startDate, endDate]`; array vacío válido |

> Nota: `companyId` del prompt de origen se omite (single-tenant, D9). La ruta construye estos datos desde Prisma; el cálculo puro es agnóstico a la fuente (permite testing con fixtures).

### CashFlowStatementResult (salida — contrato completo)

```text
CashFlowStatementResult
├── period: { startDate, endDate }
├── currency: "PEN"
├── operating_activities
│   ├── net_profit: number
│   ├── adjustments_non_cash
│   │   ├── depreciation: number
│   │   ├── unrealized_exchange_difference: number
│   │   └── total: number                        # round2(depreciation + unrealized)
│   ├── working_capital_changes
│   │   ├── accounts_receivable: number          # −Δ(12)
│   │   ├── inventories: number                  # −Δ(20|24|25)
│   │   ├── accounts_payable: number             # +Δ(42)
│   │   ├── payroll_payable: number              # +Δ(41)
│   │   ├── taxes_payable: number                # +Δ(40)
│   │   └── total: number                        # round2(suma de los 5)
│   └── net_cash_operating: number               # round2(net_profit + ajustes + WC)
├── investing_activities
│   ├── property_plant_equipment_purchases: number  # −max(0, Δ(33) − Δ(465)) ≤ 0
│   ├── asset_sales: number                         # max(0, −Δ(33)) + max(0, −Δ(30)) ≥ 0
│   └── net_cash_investing: number
├── financing_activities
│   ├── capital_contributions: number             # +Δ(50)
│   ├── financial_obligations: number             # +Δ(45) neto
│   ├── dividends_paid: number                    # −Σ débitos período(407) ≤ 0
│   └── net_cash_financing: number
├── net_cash_increase: number                     # round2(op + inv + fin)
├── cash_at_beginning: number                     # saldo inicial 101|104
├── cash_at_end: number                           # beginning + increase
├── is_reconciled: boolean                        # |cash_at_end − final(101|104)| < 0.005
└── reconciliation_difference: number             # final(101|104) − cash_at_end (campo extra)
```

## Reglas de validación (desde el spec)

| Regla | FR | Implementación |
|---|---|---|
| Formato de fecha estricto `YYYY-MM-DD` | — | Regex en la ruta; 400 si falla o `desde > hasta` |
| Cuentas sin datos = 0.00, sin error | FR-007 | `Map.get(code) ?? 0` en todos los lookups |
| Redondeo a 2 decimales en cada subtotal | FR-008 | `round2()` en líneas y subtotales de sección |
| Exclusión de 107 del efectivo | FR-006 | Matching `101|104` (nunca `10` genérico) |
| Solo asientos vigentes | — | Filtro `entry.status = true` en ambos agregados |
| Conciliación Cuenta 10 | FR-006 | Tolerancia `0.005`; no bloquea emisión |

## Transiciones de estado

No aplicable — el reporte es una **vista calculada** sin ciclo de vida propio (no persiste, no se anula, no se aprueba).

## Agrupadores PCGE (tabla canónica — ver research.md D5)

| Prefijo | Agrupador | Sección |
|---|---|---|
| `101`, `104` | Efectivo y equivalentes | Conciliación |
| `12` | Cuentas por cobrar comerciales | Operación (WC) |
| `20`, `24`, `25` | Inventarios | Operación (WC) |
| `40`, `41`, `42` | Tributos / Remuneraciones / Proveedores por pagar | Operación (WC) |
| `68` | Depreciaciones y amortizaciones | Operación (ajuste) |
| `676`, `776` | Diferencia de cambio | Operación (ajuste) |
| `30`, `33` | Inversiones financieras / PPE | Inversión |
| `465` | Proveedores de inmuebles y maquinaria | Inversión (deducción) |
| `45` | Obligaciones financieras | Financiamiento |
| `47` | Inversiones — no usado en v1 | — |
| `50` | Capital social | Financiamiento |
| `407` | Cuentas por pagar — socios | Financiamiento (dividendos) |
