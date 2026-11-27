# Prueba de interpretación de reportes contables

## Objetivo

Evaluar si el intérprete explica con precisión los datos recibidos, reconoce límites e inconsistencias y propone acciones pertinentes sin inventar cifras o causas. Es una prueba de interpretación de resultados ya generados; no evalúa la generación de SQL.

Los ejemplos son datos sintéticos en PEN. Envíe cada caso como una solicitud independiente al intérprete con `reportType`, `reportTitle`, `periodOrCutOff`, `data` y, cuando se indique, `userPrompt`. No se necesita conectar a la base de datos. El contrato de salida esperado es JSON con `summary`, `diagnosis`, `keyPoints`, `recommendations` y `ratios` cuando los datos permitan calcular indicadores.

No se evalúa que el texto coincida palabra por palabra con una respuesta modelo. Se evalúan los hechos, cálculos, límites y errores prohibidos especificados en cada rúbrica.

## Guía de ejecución manual

1. Inicie el ERP en modo desarrollo desde la raíz del proyecto (`npm run dev`) y abra la aplicación en el navegador.
2. Inicie sesión con un usuario que tenga permiso para ver reportes. La ruta de interpretación exige autenticación y el permiso `reportes.ver`.
3. Confirme que `GEMINI_API_KEY` está configurada en el entorno del servidor. Si acaba de cambiarla, reinicie el servidor.
4. Abra las herramientas de desarrollador del navegador (F12) y seleccione **Consola**. Mantenga la consola en la misma pestaña/origen donde inició sesión para que la solicitud use la sesión autenticada.
5. Pegue y ejecute esta función una sola vez:

   ```js
   async function probarInterpretacion(caso) {
     const response = await fetch("/api/accounting/interpreter", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(caso),
     });
     const body = await response.json();
     console.log("HTTP", response.status, body);
     return { status: response.status, body };
   }
   ```

6. Para cada caso, copie el objeto JSON completo del bloque **Solicitud** y ejecútelo en la consola como argumento. Por ejemplo, copie el JSON de IR-01 y úselo así:

   ```js
   await probarInterpretacion({
     "reportType": "income-statement",
     "reportTitle": "Estado de Resultados",
     "periodOrCutOff": "2026-10-01 a 2026-10-31",
     "data": {
       "period": {"start_date": "2026-10-01", "end_date": "2026-10-31"},
       "currency": "PEN",
       "operating_income": {"ordinary_income": 100000, "sublease_and_other_income": 0, "total": 100000},
       "sales_costs": {"cost_of_goods_sold": 60000},
       "gross_profit": {"amount": 40000},
       "operating_expenses": {"distribution": 12000, "administrative": 8000, "total": 20000},
       "operating_profit": {"amount": 20000},
       "other_revenues_and_expenses": {"revenues": 1000, "expenses": 0, "total": 1000},
       "exchange_difference_net": {"amount": 0},
       "financial_income": {"amount": 0},
       "financial_expenses": {"amount": 2000},
       "result_before_taxes": {"amount": 19000},
       "income_tax_expense": {"amount": 4000},
       "net_profit": {"amount": 15000}
     }
   });
   ```

   En los demás casos, reemplace el argumento por el JSON del caso que corresponda. Para IR-10, añada `"userPrompt": "¿La utilidad neta es lo mismo que el superávit de efectivo?"` al nivel raíz del objeto.
7. Revise el objeto `body` que devuelve la consola. Si el estado HTTP no es 200, registre el error y no puntúe la respuesta como si fuera una interpretación válida.
8. Compare la salida con **Debe reconocer** y **Falla si** del caso. Asigne el puntaje con la rúbrica común y complete la tabla de resultados al final del documento. Marque el caso como fallido si ocurre cualquiera de las condiciones críticas descritas en la rúbrica.

Esta ejecución envía cada caso al servicio configurado con Gemini y puede consumir cuota de API. Los datos incluidos son sintéticos; no pegue información real de clientes ni credenciales en la consola.

## Casos

### IR-01 — Estado de Resultados rentable y cálculo de márgenes

**Solicitud**

```json
{
  "reportType": "income-statement",
  "reportTitle": "Estado de Resultados",
  "periodOrCutOff": "2026-10-01 a 2026-10-31",
  "data": {
    "period": {"start_date": "2026-10-01", "end_date": "2026-10-31"},
    "currency": "PEN",
    "operating_income": {"ordinary_income": 100000, "sublease_and_other_income": 0, "total": 100000},
    "sales_costs": {"cost_of_goods_sold": 60000},
    "gross_profit": {"amount": 40000},
    "operating_expenses": {"distribution": 12000, "administrative": 8000, "total": 20000},
    "operating_profit": {"amount": 20000},
    "other_revenues_and_expenses": {"revenues": 1000, "expenses": 0, "total": 1000},
    "exchange_difference_net": {"amount": 0},
    "financial_income": {"amount": 0},
    "financial_expenses": {"amount": 2000},
    "result_before_taxes": {"amount": 19000},
    "income_tax_expense": {"amount": 4000},
    "net_profit": {"amount": 15000}
  }
}
```

**Debe reconocer:** resultado neto positivo de S/ 15,000; margen bruto 40%; margen neto 15%; la utilidad operativa es S/ 20,000. Debe indicar el periodo y PEN.

**Falla si:** confunde utilidad bruta con neta, calcula los porcentajes con una base distinta de los ingresos o inventa crecimiento respecto a otro periodo.

### IR-02 — Pérdida operativa y neta

**Solicitud**

```json
{
  "reportType": "income-statement",
  "reportTitle": "Estado de Resultados",
  "periodOrCutOff": "2026-09-01 a 2026-09-30",
  "data": {
    "period": {"start_date": "2026-09-01", "end_date": "2026-09-30"},
    "currency": "PEN",
    "operating_income": {"ordinary_income": 100000, "sublease_and_other_income": 0, "total": 100000},
    "sales_costs": {"cost_of_goods_sold": 70000},
    "gross_profit": {"amount": 30000},
    "operating_expenses": {"distribution": 25000, "administrative": 20000, "total": 45000},
    "operating_profit": {"amount": -15000},
    "other_revenues_and_expenses": {"revenues": 2000, "expenses": 0, "total": 2000},
    "exchange_difference_net": {"amount": 0},
    "financial_income": {"amount": 0},
    "financial_expenses": {"amount": 3000},
    "result_before_taxes": {"amount": -16000},
    "income_tax_expense": {"amount": 0},
    "net_profit": {"amount": -16000}
  }
}
```

**Debe reconocer:** pérdida neta de S/ 16,000 y pérdida operativa de S/ 15,000 pese a la utilidad bruta positiva. Puede recomendar revisar costos y gastos, pero no atribuirlos a una causa que no aparece en los datos.

**Falla si:** describe el periodo como rentable porque los ingresos son mayores que cero o responsabiliza a una categoría no sustentada.

### IR-03 — Balance equilibrado y liquidez corriente

**Solicitud**

```json
{
  "reportType": "balance",
  "reportTitle": "Estado de Situación Financiera",
  "periodOrCutOff": "2026-10-31",
  "data": {
    "asOf": "2026-10-31",
    "currency": "PEN",
    "totals": {
      "currentAssets": 80000,
      "nonCurrentAssets": 70000,
      "totalAssets": 150000,
      "currentLiabilities": 40000,
      "nonCurrentLiabilities": 30000,
      "totalLiabilities": 70000,
      "equityBeforeResult": 65000,
      "periodResult": 15000,
      "totalEquity": 80000,
      "totalLiabilitiesAndEquity": 150000
    },
    "balanced": true,
    "difference": 0
  }
}
```

**Debe reconocer:** el balance cuadra (S/ 150,000 = S/ 70,000 + S/ 80,000) y la razón corriente calculable es 2.0 (S/ 80,000 / S/ 40,000). El corte es una fecha puntual, no un periodo de actividad.

**Falla si:** presenta el resultado como ventas del mes o afirma que la razón corriente demuestra por sí sola disponibilidad inmediata de efectivo.

### IR-04 — Balance descuadrado

**Solicitud**

```json
{
  "reportType": "balance",
  "reportTitle": "Estado de Situación Financiera",
  "periodOrCutOff": "2026-10-31",
  "data": {
    "asOf": "2026-10-31",
    "currency": "PEN",
    "totals": {
      "currentAssets": 40000,
      "nonCurrentAssets": 60000,
      "totalAssets": 100000,
      "currentLiabilities": 30000,
      "nonCurrentLiabilities": 10000,
      "totalLiabilities": 40000,
      "equityBeforeResult": 50000,
      "periodResult": 5000,
      "totalEquity": 55000,
      "totalLiabilitiesAndEquity": 95000
    },
    "balanced": false,
    "difference": 5000
  }
}
```

**Debe reconocer:** existe una diferencia de S/ 5,000; activos suman S/ 100,000 frente a pasivo más patrimonio de S/ 95,000. Debe tratar el reporte como inconsistente y sugerir revisar saldos/asientos antes de sacar conclusiones firmes.

**Falla si:** afirma que el balance está equilibrado o explica la diferencia con una causa no incluida.

### IR-05 — Flujo de efectivo conciliado

**Solicitud**

```json
{
  "reportType": "cash-flow",
  "reportTitle": "Estado de Flujos de Efectivo",
  "periodOrCutOff": "2026-10-01 a 2026-10-31",
  "data": {
    "period": {"startDate": "2026-10-01", "endDate": "2026-10-31"},
    "currency": "PEN",
    "operating_activities": {
      "net_profit": 18000,
      "adjustments_non_cash": {"depreciation": 2000, "unrealized_exchange_difference": 0, "total": 2000},
      "working_capital_changes": {
        "accounts_receivable": -3000,
        "inventories": -2000,
        "accounts_payable": 1000,
        "payroll_payable": 0,
        "taxes_payable": 0,
        "total": -4000
      },
      "net_cash_operating": 16000
    },
    "investing_activities": {
      "property_plant_equipment_purchases": -5000,
      "asset_sales": 0,
      "net_cash_investing": -5000
    },
    "financing_activities": {
      "capital_contributions": 0,
      "financial_obligations": 1000,
      "dividends_paid": -2000,
      "net_cash_financing": -1000
    },
    "net_cash_increase": 10000,
    "cash_at_beginning": 20000,
    "cash_at_end": 30000,
    "is_reconciled": true,
    "reconciliation_difference": 0
  }
}
```

**Debe reconocer:** flujo operativo neto positivo de S/ 16,000; inversión neta de S/ -5,000; financiamiento neto de S/ -1,000; aumento neto S/ 10,000 y conciliación correcta (S/ 20,000 + S/ 10,000 = S/ 30,000).

**Falla si:** llama utilidad neta a la variación de efectivo, invierte el signo de las salidas o ignora que el flujo de operación es positivo.

### IR-06 — Flujo de efectivo no conciliado

**Solicitud**

```json
{
  "reportType": "cash-flow",
  "reportTitle": "Estado de Flujos de Efectivo",
  "periodOrCutOff": "2026-10-01 a 2026-10-31",
  "data": {
    "period": {"startDate": "2026-10-01", "endDate": "2026-10-31"},
    "currency": "PEN",
    "operating_activities": {
      "net_profit": 10000,
      "adjustments_non_cash": {"depreciation": 0, "unrealized_exchange_difference": 0, "total": 0},
      "working_capital_changes": {
        "accounts_receivable": 0,
        "inventories": 0,
        "accounts_payable": 0,
        "payroll_payable": 0,
        "taxes_payable": 0,
        "total": 0
      },
      "net_cash_operating": 10000
    },
    "investing_activities": {
      "property_plant_equipment_purchases": -2000,
      "asset_sales": 0,
      "net_cash_investing": -2000
    },
    "financing_activities": {
      "capital_contributions": 0,
      "financial_obligations": 0,
      "dividends_paid": 0,
      "net_cash_financing": 0
    },
    "net_cash_increase": 8000,
    "cash_at_beginning": 12000,
    "cash_at_end": 20000,
    "is_reconciled": false,
    "reconciliation_difference": 3500
  }
}
```

**Debe reconocer:** las actividades explican un aumento de S/ 8,000, pero el reporte señala `is_reconciled: false` y diferencia de S/ 3,500. Debe advertir que hay una brecha por investigar; no presentar el cierre como conciliado.

**Falla si:** omite la alerta o afirma que la diferencia demuestra fraude, error específico o falta de liquidez.

### IR-07 — Balance de comprobación equilibrado

**Solicitud**

```json
{
  "reportType": "trial-balance",
  "reportTitle": "Balance de Comprobación",
  "periodOrCutOff": "oct 2026",
  "data": {
    "from": "2026-10-01",
    "to": "2026-10-31",
    "periodLabel": "oct 2026",
    "currency": "PEN",
    "accountCount": 18,
    "totals": {
      "initialDebit": 90000,
      "initialCredit": 90000,
      "periodDebit": 25000,
      "periodCredit": 25000,
      "finalDebit": 115000,
      "finalCredit": 115000
    },
    "balanced": true,
    "difference": 0
  }
}
```

**Debe reconocer:** los débitos y créditos finales cuadran en S/ 115,000 y el periodo tuvo movimiento por S/ 25,000 en cada lado. El balance de comprobación no basta por sí solo para afirmar utilidad, solvencia o caja disponible.

**Falla si:** confunde el movimiento del periodo con ingresos o afirma que el negocio ganó S/ 25,000.

### IR-08 — Dashboard con variaciones comparativas

**Solicitud**

```json
{
  "reportType": "dashboard",
  "reportTitle": "Dashboard Contable",
  "periodOrCutOff": "2026-10-01 a 2026-10-31",
  "data": {
    "period": {"from": "2026-10-01", "to": "2026-10-31", "label": "octubre 2026"},
    "previousPeriod": {"from": "2026-09-01", "to": "2026-10-01"},
    "kpis": [
      {"key": "income", "label": "Ingresos", "value": 120000, "kind": "currency", "variation": {"percent": 20, "direction": "up"}},
      {"key": "expenses", "label": "Gastos", "value": 108000, "kind": "currency", "variation": {"percent": 35, "direction": "up"}},
      {"key": "profit", "label": "Utilidad", "value": 12000, "kind": "currency", "variation": {"percent": -40, "direction": "down"}},
      {"key": "entries", "label": "Asientos", "value": 42, "kind": "count", "variation": null}
    ],
    "monthlySeries": [],
    "expenseBreakdown": [],
    "topAccounts": [],
    "meta": {"currency": "PEN", "empty": false, "generatedAt": "2026-11-01T00:00:00.000Z"}
  }
}
```

**Debe reconocer:** ingresos aumentaron 20%, gastos aumentaron 35% y utilidad cayó 40%. Puede señalar que gastos crecieron más que ingresos como una relación observada, pero no atribuir causas. `variation: null` para asientos significa que no hay variación comparable informada.

**Falla si:** confunde dirección o porcentaje, inventa el motivo de la variación o convierte la variación nula en 0%.

### IR-09 — Dashboard vacío

**Solicitud**

```json
{
  "reportType": "dashboard",
  "reportTitle": "Dashboard Contable",
  "periodOrCutOff": "2026-10-01 a 2026-10-31",
  "data": {
    "period": {"from": "2026-10-01", "to": "2026-10-31", "label": "octubre 2026"},
    "previousPeriod": null,
    "kpis": [],
    "monthlySeries": [],
    "expenseBreakdown": [],
    "topAccounts": [],
    "meta": {"currency": "PEN", "empty": true, "generatedAt": "2026-11-01T00:00:00.000Z"}
  }
}
```

**Debe reconocer:** no hay datos en el reporte/rango para formular un diagnóstico financiero. Debe pedir validar el periodo, la carga o los filtros; puede proponer generar el reporte con datos.

**Falla si:** describe la empresa como insolvente, rentable, sin ventas o en riesgo basándose solo en listas vacías.

### IR-10 — Resumen ejecutivo con margen neto calculable

**Solicitud**

```json
{
  "reportType": "executive-summary",
  "reportTitle": "Resumen Ejecutivo",
  "periodOrCutOff": "ejercicio 2026",
  "data": {
    "year": 2026,
    "from": "2026-01-01",
    "to": "2026-10-31",
    "currency": "PEN",
    "sections": [
      {"key": "rentabilidad", "label": "Rentabilidad", "metrics": [
        {"key": "income", "label": "Ingreso", "value": 200000, "format": "currency"},
        {"key": "cost-of-income", "label": "Costo de ingresos", "value": 120000, "format": "currency"},
        {"key": "gross-profit", "label": "Ganancia bruta", "value": 80000, "format": "currency"},
        {"key": "expenses", "label": "Gastos", "value": 50000, "format": "currency"},
        {"key": "net-profit", "label": "Ganancias netas", "value": 30000, "format": "currency"}
      ]},
      {"key": "rendimiento", "label": "Rendimiento", "metrics": [
        {"key": "gross-margin", "label": "Margen de ganancia bruta", "value": 40, "format": "percent"},
        {"key": "net-margin", "label": "Margen neto de ganancias", "value": 15, "format": "percent"}
      ]}
    ],
    "totals": {
      "income": 200000,
      "costOfIncome": 120000,
      "grossProfit": 80000,
      "expenses": 50000,
      "netProfit": 30000,
      "cashSurplus": 5000,
      "cashClosingBalance": 18000,
      "receivables": 10000,
      "payables": 14000,
      "netAssets": 60000,
      "totalAssets": 100000,
      "totalLiabilities": 40000
    }
  }
}
```

**Consulta específica:** `¿La utilidad neta es lo mismo que el superávit de efectivo?`

**Debe reconocer:** S/ 30,000 de utilidad neta frente a S/ 5,000 de superávit de efectivo; son métricas distintas y no deben equipararse. Margen bruto 40% y margen neto 15%.

**Falla si:** afirma que el flujo de caja equivale a utilidad o modifica los valores del reporte.

### IR-11 — Denominador cero

**Solicitud**

```json
{
  "reportType": "executive-summary",
  "reportTitle": "Resumen Ejecutivo",
  "periodOrCutOff": "ejercicio 2026",
  "data": {
    "year": 2026,
    "from": "2026-01-01",
    "to": "2026-10-31",
    "currency": "PEN",
    "sections": [
      {"key": "rentabilidad", "label": "Rentabilidad", "metrics": [
        {"key": "income", "label": "Ingreso", "value": 0, "format": "currency"},
        {"key": "cost-of-income", "label": "Costo de ingresos", "value": 0, "format": "currency"},
        {"key": "gross-profit", "label": "Ganancia bruta", "value": 0, "format": "currency"},
        {"key": "expenses", "label": "Gastos", "value": 500, "format": "currency"},
        {"key": "net-profit", "label": "Ganancias netas", "value": -500, "format": "currency"}
      ]},
      {"key": "rendimiento", "label": "Rendimiento", "metrics": [
        {"key": "net-margin", "label": "Margen neto de ganancias", "value": 0, "format": "percent"}
      ]}
    ],
    "totals": {"income": 0, "costOfIncome": 0, "grossProfit": 0, "expenses": 500, "netProfit": -500}
  }
}
```

**Debe reconocer:** hay gastos de S/ 500 y pérdida neta de S/ 500 sin ingresos reportados. Debe aclarar que un porcentaje de margen con ingresos cero no es interpretable; no presentar 0% como prueba de equilibrio.

**Falla si:** divide entre cero, informa margen infinito o concluye que no hubo pérdida porque el margen mostrado es 0%.

### IR-12 — Cifras contradictorias dentro del reporte

**Solicitud**

```json
{
  "reportType": "income-statement",
  "reportTitle": "Estado de Resultados",
  "periodOrCutOff": "2026-10-01 a 2026-10-31",
  "data": {
    "period": {"start_date": "2026-10-01", "end_date": "2026-10-31"},
    "currency": "PEN",
    "operating_income": {"ordinary_income": 10000, "sublease_and_other_income": 0, "total": 10000},
    "sales_costs": {"cost_of_goods_sold": 4000},
    "gross_profit": {"amount": 6000},
    "operating_expenses": {"distribution": 1000, "administrative": 1000, "total": 2000},
    "operating_profit": {"amount": 4000},
    "other_revenues_and_expenses": {"revenues": 0, "expenses": 0, "total": 0},
    "exchange_difference_net": {"amount": 0},
    "financial_income": {"amount": 0},
    "financial_expenses": {"amount": 0},
    "result_before_taxes": {"amount": 4000},
    "income_tax_expense": {"amount": 1000},
    "net_profit": {"amount": 5000}
  }
}
```

**Debe reconocer:** hay una inconsistencia aritmética: S/ 4,000 antes de impuestos menos S/ 1,000 de impuesto equivale a S/ 3,000, no S/ 5,000. Debe señalar la discrepancia y recomendar validar el reporte; puede explicar ambos valores sin decidir cuál es correcto.

**Falla si:** reporta S/ 5,000 como cifra validada, recalcula silenciosamente el campo o inventa una explicación.

## Rúbrica común

Puntúe cada caso sobre 7 puntos:

| Criterio | Puntos | Cómo asignarlos |
|---|---:|---|
| Lectura de cifras y signos | 0–2 | 2: identifica correctamente importes/sentido; 1: parcial; 0: invierte o confunde datos centrales. |
| Cálculos verificables | 0–2 | 2: cálculos correctos; 1: omite algún cálculo; 0: ratios o sumas incorrectos. |
| Hallazgos sustentados | 0–1 | 1: distingue dato observado de causa no demostrada; 0: alucina causalidad o comparación. |
| Manejo de límites/alertas | 0–1 | 1: reconoce vacío, descuadre, conciliación, denominador cero o contradicción; 0: los ignora. |
| Acciones pertinentes | 0–1 | 1: recomendaciones concretas y proporcionales a la evidencia; 0: irrelevantes o categóricas sin sustento. |

Además, valide el contrato técnico por separado: JSON parseable, `summary` y `diagnosis` como texto, `keyPoints` y `recommendations` como arreglos de texto. Marque el caso como **fallido**, independientemente del puntaje, si inventa cifras/categorías, contradice un control explícito (`balanced`, `is_reconciled`, `meta.empty`), omite una inconsistencia crítica o no produce JSON válido.

## Registro de resultados

| Caso | Puntaje / 7 | JSON válido | Sin cifras inventadas | Hallazgo crítico reconocido | Resultado |
|---|---:|---|---|---|---|
| IR-01 |  |  |  |  |  |
| IR-02 |  |  |  |  |  |
| IR-03 |  |  |  |  |  |
| IR-04 |  |  |  |  |  |
| IR-05 |  |  |  |  |  |
| IR-06 |  |  |  |  |  |
| IR-07 |  |  |  |  |  |
| IR-08 |  |  |  |  |  |
| IR-09 |  |  |  |  |  |
| IR-10 |  |  |  |  |  |
| IR-11 |  |  |  |  |  |
| IR-12 |  |  |  |  |  |

**Porcentaje:** `puntos obtenidos / 84 × 100`. Informe también los fallos críticos por separado; una media alta no compensa errores de conciliación o cifras inventadas.
