# Quickstart — Validación del Estado de Resultados por Función

**Feature**: `021-generar-estado-resultados` · **Spec**: [spec.md](./spec.md)
**Contrato**: [contracts/income-statement.md](./contracts/income-statement.md) ·
**Modelo**: [data-model.md](./data-model.md)

Guía de validación ejecutable. No incluye implementación: sólo cómo correr las pruebas y qué
esperar.

---

## 1. Requisitos y comandos

| Requisito | Detalle |
|---|---|
| Node.js | versión usada por el proyecto (Next.js 16) |
| Dependencias | `npm install` |
| Base de datos | **no necesaria** para las pruebas unitarias del cálculo; sí para cualquier prueba que toque Prisma |
| Variable `DATABASE_URL` | sólo requerida si se ejecuta el servidor de la aplicación |

```bash
# suite completa (patrón del repositorio)
npm test

# sólo las pruebas de esta feature
npx vitest run lib/accounting/income-statement.test.ts
npx vitest run lib/services/income-statement.service.test.ts

# en observación durante el desarrollo
npm run test:watch

# calidad
npm run lint
```

**Resultado esperado**: todas las pruebas en verde, sin errores de tipo ni de lint.

---

## 2. Escenario de referencia (con valores esperados)

Periodo `2025-06-01` → `2025-06-30`. Movimientos de prueba:

| Cuenta | Descripción | Debe | Haber |
|---|---|---:|---:|
| 701 | Ventas de mercaderías | — | 1.000,00 |
| 709 | Devoluciones en ventas | 50,00 | — |
| 74 | Descuentos concedidos | 30,00 | — |
| 691 | Costo de mercaderías vendidas | 400,00 | — |
| 95 | Gastos de distribución | 100,00 | — |
| 94 | Gastos de administración | 60,00 | — |
| 77 | Ingresos financieros (distintos de 776) | — | 20,00 |
| 776 | Diferencia de cambio (ingreso) | — | 10,00 |
| 67 | Gastos financieros (distintos de 676) | 15,00 | — |
| 676 | Diferencia de cambio (gasto) | 5,00 | — |
| 754 | Alquileres (ingresos operativos no principales) | — | 500,00 |
| 76 | Otros ingresos no financieros | — | 40,00 |
| 65 | Servicios básicos | 25,00 | — |
| 66 | Servicios de terceros | 15,00 | — |
| 88 | Impuesto a la renta del ejercicio | 100,00 | — |

**Salida esperada** (ver [contrato §2](./contracts/income-statement.md#ejemplo-de-salida)):

| Línea | Valor |
|---|---:|
| Ingresos ordinarios | 920,00 |
| Ingresos por subarrendamiento y otros | **0,00** |
| Ingresos de operación (total) | 920,00 |
| Costo de las ventas | 400,00 |
| Margen bruto | 520,00 |
| Gastos de distribución | 100,00 |
| Gastos de administración | 60,00 |
| Gastos de operación (total) | 160,00 |
| Beneficio operativo | 360,00 |
| Diferencia de cambio, neta | 5,00 |
| Ingresos financieros | 20,00 |
| Gastos financieros | 15,00 |
| Otros ingresos y gastos | 500,00 |
| Resultado antes de impuestos | 870,00 |
| Gasto en impuesto sobre la renta | 100,00 |
| Resultado del período | **770,00** |

Comprobaciones que debe satisfacer este escenario:

- `920 = 920 + 0` (ingresos de operación) · `160 = 100 + 60` (gastos de operación)
- `520 = 920 − 400` (margen bruto) · `360 = 520 − 160` (beneficio operativo)
- `870 = 360 + 20 − 15 + 5 + 500` (resultado antes de impuestos)
- `770 = 870 − 100` (resultado del período)
- Los 500,00 de la cuenta 754 **sólo** aparecen en "otros ingresos y gastos" (decisión Q2 = C).

---

## 3. Escenarios de validación

### 3.1 Periodo con sólo ventas y costo (SC-007, FR-020)

Entrada: únicamente `701 haber 1.000,00` y `691 debe 400,00`.

| Esperado | Valor |
|---|---:|
| Ingresos de operación / ordinarios | 1.000,00 |
| Costo de las ventas | 400,00 |
| Margen bruto | 600,00 |
| Gastos, partidas financieras, impuesto y subarrendamiento | 0,00 |
| Resultado antes de impuestos y resultado del período | 600,00 |

Ningún campo puede ser `null`, `undefined` ni texto.

### 3.2 Periodo sin movimientos

Entrada: rango válido sin movimientos.

**Esperado**: reporte completo con **todas** las líneas en `0,00` y `period` = rango pedido; sin
lanzar error.

### 3.3 Periodo invertido (validación)

Entrada: `startDate = 2025-06-30`, `endDate = 2025-06-01`.

**Esperado**: rechazo con `status: 400` y mensaje
`El periodo es inválido: la fecha inicial no puede ser posterior a la final.`; no se calcula
ningún importe.

### 3.4 Asientos anulados y fuera de rango (FR-025)

Entrada: movimientos válidos + movimientos con `status: false` + movimientos con fecha fuera del
rango.

**Esperado**: idéntico al escenario sin esos movimientos; los excluidos no suman.

### 3.5 Devoluciones y descuentos no se descuentan dos veces (Q1 = A)

Entrada: `701 haber 1.000,00`, `709 debe 50,00`.

**Esperado**: ingresos ordinarios `950,00` (no `900,00`).

### 3.6 Coherencia con el Balance General (SC-004)

Con los mismos movimientos del escenario §2:

1. `npx vitest run lib/accounting/income-statement.test.ts` — incluye la prueba que compara
   `net_profit` contra el resultado de período que calcula `computePeriodResult`
   (`lib/accounting/balance-sheet.ts`) con los mismos saldos.
2. **Esperado**: diferencia menor a `0,01`.

---

## 4. Cobertura esperada vs. criterios de éxito

| Criterio | Cómo se valida |
|---|---|
| SC-001 (sin errores, sin nulos) | §3.1 y §3.2 |
| SC-002 (identidades, dif. < 0,01) | §2 (las 6 comprobaciones) |
| SC-003 (2 decimales) | aserción de redondeo en ambas suites |
| SC-004 (coherencia con Balance) | §3.6 |
| SC-006 (< 3 s con 100.000 movimientos) | prueba de rendimiento con fixture generada (tiempo < 3000 ms) |
| SC-007 / SC-008 (líneas en 0,00 / subarrendamiento 0,00) | §3.1 y aserción del escenario §2 |

---

## 5. Fuera de alcance en esta iteración

- **Endpoint HTTP** y documentación Swagger del reporte (D11): no existe
  `app/api/income-statement`; validar manualmente en navegador **no aplica** todavía.
- **Pantalla** de presentación del reporte.
- Migraciones de base de datos: ninguna.

---

## 6. Estado de verificación (post-implementación)

| Paso | Estado |
|---|---|
| §3.1 sólo ventas (todas las demás líneas en `0.00`, sin nulos) | ✅ test `tolerancia a datos ausentes → 3.1` |
| §3.2 sólo ventas y costo de ventas | ✅ test `3.2` |
| §3.3 sólo compras (Cuenta 60 fuera del costo de ventas) | ✅ test `3.3` |
| §3.5 Escenario de referencia (resultado **770.00**) | ✅ test `escenario de referencia` |
| §3.6 SC-004 contra `computePeriodResult` (balance-sheet) | ✅ test `SC-004` |
| SC-006 con 100.000 movimientos (< 3 s) | ✅ test de rendimiento |
| SC-008 subarrendamiento = `0.00` | ✅ aserción en invariantes |

Servicio (`lib/services/income-statement.service.ts`): validación de periodo 400, filtro de asientos
activos y rango UTC, movimientos precargados sin tocar la BD y errores 500 — cubiertos por
`lib/services/income-statement.service.test.ts` (11 tests).
