# Contract: Estado de Resultados por Función

**Feature**: `021-generar-estado-resultados` · **Spec**: [spec.md](../spec.md)
**Interfaz**: servicio de negocio `income-statement` (sin endpoint HTTP en esta iteración)

Este contrato define la **entrada**, la **salida** y los **errores** del servicio. Es estable: los
nombres de campos de salida son el contrato de negocio acordado con el interesado.

---

## 1. Entrada

```typescript
interface IncomeStatementInput {
  /** Identificador de empresa/inquilino. Reservado: no filtra (modelo single-tenant, D8). */
  companyId?: string | number;
  /** Fecha inicial del periodo, formato AAAA-MM-DD (UTC, inclusiva). */
  startDate: string;
  /** Fecha final del periodo, formato AAAA-MM-DD (UTC, inclusiva). */
  endDate: string;
  /**
   * Movimientos contables precargados. Si se omite, el servicio consulta
   * los movimientos almacenados del rango (FR-024).
   */
  movements?: MovementInput[];
}

interface MovementInput {
  /** Código PCGE de la cuenta, p. ej. "701", "691", "95", "776". */
  accountCode: string;
  /** Importe de debe. Ausente/nulo → 0. */
  debit?: number | null;
  /** Importe de haber. Ausente/nulo → 0. */
  credit?: number | null;
  /** Fecha del movimiento (sólo si vienen movimientos crudos). */
  date?: string;
  /** false = asiento anulado, excluido. Por defecto true. */
  status?: boolean;
}
```

### Validaciones de entrada

| Condición | Resultado |
|---|---|
| `startDate` o `endDate` con formato distinto de `AAAA-MM-DD` | error `400` (ver §3) |
| `startDate > endDate` | error `400` (ver §3) |
| `movements` vacío o ausente y sin movimientos almacenados en el rango | **no es error**: el reporte se devuelve completo en `0.00` (FR-020) |
| `movements` presente con campos `debit`/`credit` nulos o ausentes | se tratan como `0.00` |

---

## 2. Salida

```typescript
export interface IncomeStatementResult {
  period: { startDate: string; endDate: string };
  currency: string;
  gross_profit: number;
  operating_income: {
    total: number;
    ordinary_income: number;
    sublease_and_other_income: number;
  };
  sales_costs: number;
  operating_expenses: {
    total: number;
    distribution_expenses: number;
    administrative_expenses: number;
  };
  operating_profit: number;
  other_revenues_and_expenses: number;
  exchange_difference_net: number;
  financial_income: number;
  financial_expenses: number;
  result_before_taxes: number;
  income_tax_expense: number;
  net_profit: number;
}
```

### Semántica de cada campo

| Campo | Fórmula | FR |
|---|---|---|
| `period` | rango consultado, eco de la solicitud | FR-022 |
| `currency` | `"PEN"` | Supuestos |
| `operating_income.ordinary_income` | (70x sin 709) − saldo deudor 709 − saldo deudor 74 | FR-004 |
| `operating_income.sublease_and_other_income` | siempre `0.00` (toda la Cuenta 75 va a `other_revenues_and_expenses`) | FR-005 |
| `operating_income.total` | `ordinary_income + sublease_and_other_income` | FR-003 |
| `sales_costs` | saldo deudor de 69x (691/692/693); **nunca** usa la 60 | FR-006, FR-027 |
| `gross_profit` | `operating_income.total − sales_costs` | FR-007 |
| `operating_expenses.distribution_expenses` | saldo deudor de 95x | FR-009 |
| `operating_expenses.administrative_expenses` | saldo deudor de 94x | FR-010 |
| `operating_expenses.total` | `distribution + administrative` | FR-008 |
| `operating_profit` | `gross_profit − operating_expenses.total` | FR-011 |
| `exchange_difference_net` | saldo acreedor 776 − saldo deudor 676 | FR-012 |
| `financial_income` | saldo acreedor de 77x **sin** 776 | FR-013 |
| `financial_expenses` | saldo deudor de 67x **sin** 676 | FR-014 |
| `other_revenues_and_expenses` | (75 + 76) − (65 + 66) | FR-015 |
| `result_before_taxes` | `operating_profit + financial_income − financial_expenses + exchange_difference_net + other_revenues_and_expenses` | FR-016 |
| `income_tax_expense` | saldo deudor de 88 | FR-017 |
| `net_profit` | `result_before_taxes − income_tax_expense` | FR-018 |

**Garantías de forma**

- Todos los campos son **números** (nunca `null`, `undefined` ni texto) y con **2 decimales**.
- Los importes conservan signo: una pérdida se publica negativa (no se trunca a cero).
- Se cumplen las 6 invariantes listadas en [data-model.md §4](../data-model.md#4-datos-de-salida).

### Ejemplo de salida

Entrada: periodo `2025-06-01` → `2025-06-30` con los movimientos del ejemplo de
[quickstart.md §2](../quickstart.md#2-escenario-de-referencia-con-valores-esperados).

```json
{
  "period": { "startDate": "2025-06-01", "endDate": "2025-06-30" },
  "currency": "PEN",
  "gross_profit": 520.00,
  "operating_income": { "total": 920.00, "ordinary_income": 920.00, "sublease_and_other_income": 0.00 },
  "sales_costs": 400.00,
  "operating_expenses": { "total": 160.00, "distribution_expenses": 100.00, "administrative_expenses": 60.00 },
  "operating_profit": 360.00,
  "other_revenues_and_expenses": 500.00,
  "exchange_difference_net": 5.00,
  "financial_income": 20.00,
  "financial_expenses": 15.00,
  "result_before_taxes": 870.00,
  "income_tax_expense": 100.00,
  "net_profit": 770.00
}
```

---

## 3. Errores

El servicio **rechaza** (lanza) con un objeto de error que expone `status` y `message`, siguiendo
la convención de `lib/services/usuarios.service.ts` (`ErrorUsuario`):

| `status` | `message` | Cuándo |
|---|---|---|
| 400 | `La fecha inicial es obligatoria y debe tener el formato AAAA-MM-DD.` | formato de `startDate` |
| 400 | `La fecha final es obligatoria y debe tener el formato AAAA-MM-DD.` | formato de `endDate` |
| 400 | `El periodo es inválido: la fecha inicial no puede ser posterior a la final.` | `startDate > endDate` |
| 500 | `No se pudo generar el Estado de Resultados.` | fallo de consulta/inesperado |

- Ningún error de cálculo devuelve `null` ni un reporte parcial: o se devuelve completo, o se
  rechaza.
- Un periodo **sin movimientos** no es error (responde en `0.00`).

---

## 4. Comportamiento frente a datos

| Situación | Comportamiento |
|---|---|
| Cuentas 94, 95, 67, 77 u 88 sin asientos | sus líneas valen `0.00` |
| Sólo hay compras (60) y ventas (70) | ingresos y costo de ventas con valor; el resto en `0.00` |
| Movimientos con `status: false` (anulados) | excluidos del rango |
| Movimientos fuera del rango de fechas | excluidos |
| Cuenta con saldo contrario a su naturaleza | se publica con su signo real |

---

## 5. Evolución

- Añadir campos a la salida es **compatible**; renombrar o eliminar campos no lo es.
- Si en el futuro se decide mover la Cuenta 75 de "otros ingresos y gastos" a "ingresos de
  operación", cambia `operating_income.sublease_and_other_income` y
  `other_revenues_and_expenses` simultáneamente (FR-005 / FR-015) y **requiere versión mayor**
  de este contrato.
- La exposición del reporte como endpoint HTTP está fuera de este alcance (D11); si se agrega,
  este contrato se reutiliza como esquema de respuesta.
