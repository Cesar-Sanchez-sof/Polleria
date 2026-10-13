# Quickstart: Estado de Flujos de Efectivo

**Feature**: 025-cash-flow-statement | **Fase**: 1 | **Objetivo**: validar el feature de extremo a extremo

## Prerrequisitos

- Node.js 20+ y dependencias instaladas (`npm install`)
- Base de datos PostgreSQL accesible (Neon o local) con `npx prisma db push` aplicado y seed corrido (`npm run db:seed`)
- Variables de entorno en `.env` (ver README)

## 1. Pruebas unitarias del cálculo puro (SC-003, FR-007/FR-008)

```bash
npx vitest run lib/accounting/cash-flow-statement.test.ts
```

**Resultado esperado**: todos los escenarios en verde, incluyendo obligatoriamente:
- **Conciliación exitosa** (US2): datos consistentes → `is_reconciled: true`, `cash_at_end` = saldo final real de 101|104.
- **Período vacío**: todo en 0.00, conciliado.
- **Pérdida neta**: `net_profit < 0`, operación puede ser negativa.
- Cuentas ausentes = 0.00 sin error; redondeos exactos a 2 decimales.

## 2. Pruebas de la ruta API

```bash
npx vitest run app/api/cash-flow-statement/route.test.ts
```

**Resultado esperado**: 400 (fecha mal formada y `desde > hasta`), 404 (sin cuentas activas), 200 (happy path con Prisma mockeado), 500 (fallo de BD) — patrón idéntico a `app/api/general-ledger/route.test.ts`.

## 3. Suite completa (regresión)

```bash
npm test
```

**Resultado esperado**: sin roturas en los 17+ archivos de test existentes (balance-sheet, daily-book, general-ledger, journal-entries, usuarios, purchases…).

## 4. Validación manual end-to-end

Levantar el servidor:

```bash
npm run dev
```

Consultar el reporte de un período con movimiento:

```bash
curl "http://localhost:3000/api/cash-flow-statement?desde=2026-01-01&hasta=2026-01-31"
```

**Verificar**:
1. HTTP 200 con la estructura de [contracts/cash-flow-statement-api.md](./contracts/cash-flow-statement-api.md).
2. Todos los montos con exactamente 2 decimales.
3. `net_cash_increase = operating + investing + financing` (verificación aritmética manual).
4. `cash_at_end = cash_at_beginning + net_cash_increase`.
5. Si los asientos del período son consistentes y completos: `is_reconciled: true` (SC-001). Para probar la detección de diferencias (SC-005): anular un asiento que afecte la Cuenta 10 en el período y re-consultar → `is_reconciled: false` y `reconciliation_difference` ≠ 0.

Consultas inválidas:

```bash
# 400 — formato inválido
curl "http://localhost:3000/api/cash-flow-statement?desde=31-12-2025&hasta=2026-01-31"
# 400 — desde > hasta
curl "http://localhost:3000/api/cash-flow-statement?desde=2026-01-31&hasta=2026-01-01"
```

## 5. Documentación Swagger

Visitar `http://localhost:3000/api/docs` y verificar que el endpoint **Cash Flow Statement** aparece documentado con sus parámetros y respuestas.

## 6. Prueba de rendimiento (SC-002)

Con un período de ≥10,000 movimientos (poblar via seed o asientos masivos en staging), medir el tiempo de la consulta curl: debe ser < 3 s. El cálculo usa agregación en BD (`groupBy`), por lo que el volumen de filas transferidas a Node es proporcional al número de cuentas (~300 máx.), no a los movimientos.

## Troubleshooting

| Sintoma | Causa probable |
|---|---|
| `is_reconciled: false` inesperado | Asientos anulados mal contabilizados, efectivo afectado por cuentas fuera del modelo (46, 63), o capturas inconsistentes — usar `reconciliation_difference` para ubicar la brecha |
| Cifras 0.00 en todo el reporte | Período sin asientos vigentes (`status = true`) — verificar `journal_entry` en la ventana |
| 404 en la consulta | No se ha corrido `npm run db:seed` (catálogo `accounting_account` vacío) |
