# Data Model: Dashboard Contable (Resumen Financiero)

**Feature**: `026-accounting-dashboard` | **Fase 1** | **Fecha**: 2026-10-12

## 1. Persistencia

**No hay modelo persistido nuevo.** La feature es 100 % de lectura sobre los modelos
existentes de Prisma (sin migraciones):

| Modelo existente | Uso en el dashboard |
|---|---|
| `AccountingAccount` (`prisma/schema.prisma:597`) | catálogo de cuentas (`code`, `name`, `type`, `active`) para clasificar KPI y "mayor movimiento" |
| `JournalEntry` (`:636`) | fuente de fechas (`entryDate`), vigencia (`status`) y conteo de asientos |
| `JournalEntryDetail` (`:667`) | montos `debit`/`credit` (Decimal 12,2) que se agregan |
| `AccountingPeriod` (`:619`) | periodo OPEN por defecto (`startDate`, `endDate`, `status`) |

Relaciones usadas: `JournalEntryDetail.entry → JournalEntry`, `JournalEntryDetail.account →
AccountingAccount`, `JournalEntry.period → AccountingPeriod`.

## 2. Entidades de dominio del feature (del spec)

- **Período contable (rango de consulta)**: `desde`/`hasta` (YYYY-MM-DD). Define el
  contexto de KPI P&L y series; los saldos de balance se acumulan hasta `hasta`.
- **Indicador (KPI)**: valor agregado + comparación con el período anterior equivalente.
- **Serie de datos**: punto mensual `YYYY-MM` con ingresos/gastos/utilidad.
- **Cuenta con mayor movimiento**: cuenta (`code`, `name`) + monto movido del período.

## 3. Contrato de datos (payload de `GET /api/accounting/dashboard`)

```text
DashboardPayload
├── period: { desde: string, hasta: string, label: string }     // rango visible (FR-008)
├── previousPeriod: { desde, hasta } | null                      // para la comparación
├── kpis: Kpi[]
│     Kpi = { key, label, value: number, kind: "currency" | "count",
│             variation: { percent: number, direction: "up"|"down"|"flat" } | null }
│     keys: "ingresos" | "gastos" | "utilidad" | "caja_bancos" |
│           "por_cobrar" | "por_pagar" | "asientos"
├── monthlySeries: Array<{ month: "YYYY-MM", label,
│                          ingresos, gastos, utilidad }>        // últimos 12 meses (FR-003/004)
├── expenseBreakdown: Array<{ category, code, amount, percent }> // gastos por tipo/prefijo (FR-005)
├── topAccounts: Array<{ code, name, amount }>                   // top 8 (FR-006)
└── meta: { currency: "PEN", empty: boolean, generatedAt }
```

> Nota FR-005: el spec pide "distribución de gastos por **categoría de cuenta**". Decisión
> de implementación: categoría = grupo PCGE por prefijo de cuenta de las de naturaleza
> Gasto/Costo (`60 Costo de ventas`, `62 Gastos de personal`, `63 Servicios`, `64
> Arrendamientos`, `65 Otros gastos de gestión`, `67 Gastos financieros`, `68
> Impuestos y contribuciones`, `69 Costos no deducibles`, `Otros`), reutilizando la
> misma lógica de prefijos que `lib/accounting/balance-sheet.ts`.

### Reglas de validación (del spec y research)

| Regla | Origen |
|---|---|
| `desde`/`hasta` obligatorios con formato `YYYY-MM-DD`; `desde <= hasta`; si no → `400` | FR-007/FR-008, patrón balance |
| Solo cuentas `active = true` y asientos `status = true` | FR-009 (coincidencia con reportes) |
| Importes redondeados a 2 decimales (`round2`), moneda PEN | FR-012 |
| `variation = null` cuando el período anterior no existe o `|anterior| < 0.005` | FR-002, edge case |
| Si no hay cuentas activas → `404 { error }`; error interno → `500 { error }` | patrón `/api/balance-sheet` |
| `meta.empty = true` y series `[]` cuando no hay movimientos en el rango | FR-011, edge cases |

## 4. Estados de la interfaz (transiciones)

```text
[IDLE/cargando] --éxito, con datos--> [CON DATOS] --cambia rango--> [cargando] ...
[cargando] --éxito, sin datos------> [VACÍO] (KPI en 0 + "Sin movimientos…")
[cargando] --rechazo---------------> [ERROR] --> (Reintentar) --> [cargando]
[cargando] --llega respuesta de un rango anterior--> se descarte (requestRef, FR-014)
```

No hay estados de escritura (solo lectura; sin transiciones de negocio).

## 5. Sin cambios

`prisma/schema.prisma`, modelos existentes, reportes existentes (`balance-sheet`,
`daily-book`, `general-ledger`) y sus contratos permanecen intactos.
