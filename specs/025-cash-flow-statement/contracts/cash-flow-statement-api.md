# Contract: GET /api/cash-flow-statement

**Feature**: 025-cash-flow-statement | **Fase**: 1 | **Versión**: 1 (v1)

Endpoint de solo lectura que devuelve el Estado de Flujos de Efectivo (método indirecto, NIC 7 / PCGE 2019) para un período. Autenticación: la misma sesión aplicada al resto de rutas del ERP (middleware existente). Se documenta en Swagger (`/api/docs`) con JSDoc `@openapi`, como las demás rutas contables.

## Request

```http
GET /api/cash-flow-statement?desde=2026-01-01&hasta=2026-01-31
```

| Query param | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `desde` | `YYYY-MM-DD` | ✅ | Inicio del período (inclusive). Ventana `[desde, día anterior a desde)` para saldos iniciales |
| `hasta` | `YYYY-MM-DD` | ✅ | Fin del período (inclusive) |

## Responses

### 200 — Estado generado

Cuerpo: `CashFlowStatementResult` (ver [data-model.md](../data-model.md)).

```json
{
  "period": { "startDate": "2026-01-01", "endDate": "2026-01-31" },
  "currency": "PEN",
  "operating_activities": {
    "net_profit": 12500.00,
    "adjustments_non_cash": {
      "depreciation": 850.00,
      "unrealized_exchange_difference": -120.50,
      "total": 729.50
    },
    "working_capital_changes": {
      "accounts_receivable": 1500.00,
      "inventories": -320.00,
      "accounts_payable": 980.75,
      "payroll_payable": 0.00,
      "taxes_payable": -450.25,
      "total": 1710.50
    },
    "net_cash_operating": 14940.00
  },
  "investing_activities": {
    "property_plant_equipment_purchases": -3000.00,
    "asset_sales": 0.00,
    "net_cash_investing": -3000.00
  },
  "financing_activities": {
    "capital_contributions": 0.00,
    "financial_obligations": 2000.00,
    "dividends_paid": -500.00,
    "net_cash_financing": 1500.00
  },
  "net_cash_increase": 13440.00,
  "cash_at_beginning": 5000.00,
  "cash_at_end": 18440.00,
  "is_reconciled": true,
  "reconciliation_difference": 0.00
}
```

### 400 — Parámetros inválidos

```json
{ "error": "El parámetro 'desde' debe tener el formato YYYY-MM-DD." }
```
También 400 si `desde > hasta`.

### 404 — Sin catálogo contable

```json
{ "error": "No hay cuentas contables activas para elaborar el estado de flujos de efectivo." }
```

### 500 — Error interno

```json
{ "error": "No se pudo generar el Estado de Flujos de Efectivo." }
```

## Semántica clave del contrato

- **Tolerancia a datos incompletos (FR-007)**: cualquier cuenta PCGE sin saldos ni movimientos en el período aparece como `0.00`; nunca 404 por falta de datos de una cuenta puntual.
- **`is_reconciled` (FR-006)**: `true` ⇔ `|cash_at_end − saldoFinal(101|104)| < 0.005`. Un `false` **no** es error: indica diferencias de captura/asientos faltantes para que el contador investigue (`reconciliation_difference` cuantifica la brecha).
- **Convención de signos**: entradas de efectivo positivas, salidas negativas (`property_plant_equipment_purchases` y `dividends_paid` típicamente ≤ 0).
- **Rendimiento (SC-002)**: < 3 s para ≤ 10,000 movimientos — se sirve con tres `groupBy` agregados (saldo inicial, ventana del período y saldo final; mismo patrón que `/api/balance-sheet`), sin streaming.

## Cliente frontend (`lib/services/cash-flow-statement.service.ts`)

```ts
export interface CashFlowStatementFilter { desde: string; hasta: string }
export async function getCashFlowStatement(filter: CashFlowStatementFilter): Promise<CashFlowStatementResult>
```

Replica el patrón de `balance-sheet.service.ts`: `getJson` de `lib/services/http.ts`, `ApiError` re-exportado, helpers `formatPen`/`formatCutOffDate` reutilizados. La respuesta se tipa con la interfaz `CashFlowStatementResult` exportada desde `lib/accounting/cash-flow-statement.ts` (fuente única de verdad).
