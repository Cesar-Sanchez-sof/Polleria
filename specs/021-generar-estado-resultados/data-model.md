# Phase 1 — Data Model: Estado de Resultados por Función

**Feature**: `021-generar-estado-resultados` | **Date**: 2026-10-06
**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

Este documento modela los **datos que circulan** por la feature: qué entra, qué se calcula y qué
sale. No hay nuevas entidades persistidas ni migraciones: el reporte se calcula al momento y no
se almacena.

---

## 1. Entidades de lectura (existen, sin cambios)

### AccountingAccount (cuenta contable)

Fuente de los códigos y nombres; sólo se leen cuentas activas.

| Campo | Tipo | Uso en la feature |
|---|---|---|
| `id` | entero | llave para agrupar los movimientos |
| `code` | texto | clave de clasificación (prefijos PCGE, ver [D5](./research.md)) |
| `name` | texto | etiqueta de auditoría del saldo |
| `type` | enum (`Activo`, `Pasivo`, `Patrimonio`, `Ingreso`, `Gasto`, `Costo`) | contraste en pruebas; **no** decide la línea (ver D4) |
| `active` | booleano | sólo se consideran activas |

### JournalEntry (asiento contable)

| Campo | Tipo | Uso en la feature |
|---|---|---|
| `entryDate` | fecha (UTC) | debe estar dentro del rango `[startDate, endDate]` |
| `status` | booleano | sólo `true` (asientos vigentes, FR-025) |
| `id` | entero | llave hacia `JournalEntryDetail` |

### JournalEntryDetail (movimiento / línea de diario)

| Campo | Tipo | Uso en la feature |
|---|---|---|
| `accountId` | entero → `AccountingAccount.id` | agrupación |
| `debit` | decimal(12,2) | debe acumulado por cuenta |
| `credit` | decimal(12,2) | haber acumulado por cuenta |
| `entryId` | entero → `JournalEntry.id` | filtro por fecha/estado del asiento |

> **Nota de modelo**: no existen las tablas `journal_items` ni `account_move_lines` mencionadas
> en la descripción original; la fuente real es `journal_entry_detail` (decisión **D3**).

---

## 2. Datos de entrada

### IncomeStatementInput

| Campo | Tipo | Obligatorio | Regla de validación (FR) |
|---|---|---|---|
| `companyId` / `tenantId` | texto o entero | No | Se acepta y **no filtra** (modelo single-tenant, D8) |
| `startDate` | fecha `AAAA-MM-DD` | Sí | Formato correcto; `startDate ≤ endDate` (FR, Edge Cases) |
| `endDate` | fecha `AAAA-MM-DD` | Sí | Formato correcto |
| `movements` | lista de movimientos | No | Si se omite, el servicio consulta los movimientos almacenados (FR-024) |

### Movement (movimiento precargado)

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `accountCode` | texto | Sí | Código PCGE de la cuenta (`"701"`, `"691"`, `"95"`, …) |
| `debit` | número ≥ 0 | No | Ausente o nulo → `0.00` (FR-020) |
| `credit` | número ≥ 0 | No | Ausente o nulo → `0.00` (FR-020) |
| `date` | fecha | Sí* | Sólo se usa si el movimiento viene sin agrupar; determina la pertenencia al rango |
| `status` | booleano | No | Por defecto vigente; los anulados se excluyen (FR-025) |

\* Obligatoria sólo cuando el reporte recibe movimientos crudos; si recibe **saldos ya
agregados** por cuenta (rango ya aplicado), la fecha ya fue filtrada por quien los agregó.

---

## 3. Saldo por cuenta (intermedio, calculado)

Se obtiene agregando los movimientos del rango **por cuenta**:

```text
AccountBalance { code, name, debit: Σ debe, credit: Σ haber }
```

- Saldo con naturaleza **acreedora** (elemento 7): `credit − debit`.
- Saldo con naturaleza **deudora** (elementos 6 y 9): `debit − credit`.
- Se ignoran las cuentas cabecera (códigos de 1–2 dígitos sin subcuenta) para no duplicar
  importes (D6).
- Sólo se agregan las cuentas cuyo código cae en la matriz de la feature (D5); el resto no
  afecta ningún renglón.

---

## 4. Datos de salida

### IncomeStatementResult

Contrato completo en [contracts/income-statement.md](./contracts/income-statement.md).

| Campo | Fórmula (FR) | Naturaleza |
|---|---|---|
| `period.startDate`, `period.endDate` | rango consultado | — |
| `currency` | `"PEN"` por defecto | — |
| `operating_income.ordinary_income` | (70x sin 709) − 709 − 74 | FR-004 |
| `operating_income.sublease_and_other_income` | siempre `0.00` (toda la 75 va a "otros") | FR-005 |
| `operating_income.total` | ordinarios + subarrendamiento | FR-003 |
| `sales_costs` | 69x (deudor) | FR-006 |
| `gross_profit` | ingresos de operación − costo de ventas | FR-007 |
| `operating_expenses.distribution_expenses` | 95x (deudor) | FR-009 |
| `operating_expenses.administrative_expenses` | 94x (deudor) | FR-010 |
| `operating_expenses.total` | distribución + administración | FR-008 |
| `operating_profit` | margen bruto − gastos de operación | FR-011 |
| `exchange_difference_net` | 776 (acreedor) − 676 (deudor) | FR-012 |
| `financial_income` | 77x (acreedor) sin 776 | FR-013 |
| `financial_expenses` | 67x (deudor) sin 676 | FR-014 |
| `other_revenues_and_expenses` | (75 + 76) − (65 + 66) | FR-015 |
| `result_before_taxes` | beneficio operativo + ingresos financieros − gastos financieros + diferencia de cambio + otros ingresos y gastos | FR-016 |
| `income_tax_expense` | 88 (deudor) | FR-017 |
| `net_profit` | resultado antes de impuestos − impuesto a la renta | FR-018 |

**Invariantes** (se verifican en pruebas, FR-026 / SC-002):

1. `operating_income.total = ordinary_income + sublease_and_other_income`
2. `operating_expenses.total = distribution_expenses + administrative_expenses`
3. `gross_profit = operating_income.total − sales_costs`
4. `operating_profit = gross_profit − operating_expenses.total`
5. `result_before_taxes = operating_profit + financial_income − financial_expenses + exchange_difference_net + other_revenues_and_expenses`
6. `net_profit = result_before_taxes − income_tax_expense`

---

## 5. Reglas de validación resumidas

| Regla | Origen | Comportamiento |
|---|---|---|
| Fecha con formato inválido | Edge Cases | error de validación, sin calcular |
| `startDate > endDate` | Edge Cases (resuelto) | error de validación, sin calcular |
| Campo ausente / sin movimientos | FR-020 | `0.00`, nunca `null` ni `undefined` |
| Importes | FR-021 | 2 decimales en cada línea publicada |
| Asientos anulados | FR-025 | excluidos |
| Cuenta sin movimientos en el rango | FR-020 | `0.00` |

---

## 6. Transiciones de estado

**No aplican**: el reporte no se persiste ni tiene ciclo de vida; se calcula por solicitud a
partir de los movimientos vigentes del rango (Supuestos de la spec).

---

## 7. Ejemplo numérico de referencia

Movimientos del periodo (fixtures para pruebas): ver el ejemplo completo con valores esperados en
[quickstart.md](./quickstart.md#2-escenario-de-referencia-con-valores-esperados) y en
[contracts/income-statement.md](./contracts/income-statement.md#ejemplo-de-salida).
