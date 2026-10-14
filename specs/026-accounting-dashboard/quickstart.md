# Quickstart: Dashboard Contable (Resumen Financiero)

**Feature**: 026-accounting-dashboard | **Objetivo**: validar el feature de extremo a extremo

## Prerrequisitos

- Node.js 20+ y dependencias instaladas (`npm install`)
- Base de datos PostgreSQL accesible (Neon o local) con `npx prisma db push` aplicado y seed corrido (`npm run db:seed`)
- Variables de entorno en `.env`

## 1. Pruebas unitarias del cálculo puro (SC-002)

```bash
npx vitest run lib/accounting/dashboard.test.ts
```

**Resultado esperado** (30 tests): los 7 KPI con valores correctos (P&L del rango, saldos acumulados 10*/12*/42*), pérdida negativa, variación % con 1 decimal y `null` sin período anterior o `|anterior| < 0.005`, serie mensual con meses vacíos en 0 y tope de 12 meses, distribución de gastos por categoría PCGE (percent suman 100), top 8 cuentas, rango por defecto (periodo OPEN o 12 meses) y rango vacío → `meta.empty = true`.

## 2. Pruebas de la ruta API

```bash
npx vitest run app/api/accounting/dashboard/route.test.ts
```

**Resultado esperado** (10 tests): 200 con KPIs + serie + breakdown + topAccounts, 400 (fecha inválida / ausente / rango invertido), 404 sin cuentas activas, 500 en fallo Prisma, y `previousPeriod`/variaciones con datos previos.

## 3. Suite completa (regresión)

```bash
npm test
```

**Resultado esperado**: 21 archivos, 313 tests, 0 fallos.

## 4. Validación manual end-to-end

Levantar el servidor:

```bash
npm run dev
```

### 4.1 Endpoint

```bash
curl "http://localhost:3000/api/accounting/dashboard?desde=2026-01-01&hasta=2026-01-31"
```

**Verificar**: HTTP 200 con `period.label`, 7 `kpis`, `monthlySeries`, `expenseBreakdown`, `topAccounts` y `meta`; montos con 2 decimales; `utilidad = ingresos − gastos`.

### 4.2 Coincidencia exacta con reportes oficiales (SC-002)

```bash
curl "http://localhost:3000/api/balance-sheet?hasta=2026-01-31"
```

Comparar: `ingresos` del dashboard ≈ resultado del estado de resultados para el mismo rango (mismas cuentas P&L con los mismos filtros de vigencia); `caja_bancos` = grupo "Efectivo y equivalentes" del balance a la misma fecha; `por_cobrar`/`por_pagar` = grupos 12/42 del balance. **Diferencia esperada: 0.00** en los tres valores P&L del rango cuando se compara contra un estado de resultados del mismo rango.

### 4.3 Periodo anterior y variaciones (FR-002)

Con datos en dos períodos consecutivos de igual duración, el payload incluye `previousPeriod` y las variaciones con `direction` up/down/flat; sin datos previos → `variation: null` y `previousPeriod: null`.

### 4.4 Errores

```bash
# 400 — formato inválido
curl "http://localhost:3000/api/accounting/dashboard?desde=31-01-2026&hasta=2026-01-31"
# 400 — rango invertido
curl "http://localhost:3000/api/accounting/dashboard?desde=2026-01-31&hasta=2026-01-01"
```

## 5. Pantalla `/accounting/dashboard` (checklist UI)

Con el servidor dev levantado, abrir `http://localhost:3000/accounting/dashboard` (enlace "Dashboard Contable" en el sidebar, sección CONTABILIDAD):

- [ ] Período por defecto: periodo contable abierto si existe; si no, últimos 12 meses (visible en el header).
- [ ] 7 tarjetas KPI con valor, moneda PEN y badge de variación (o "Sin comparación").
- [ ] Utilidad negativa mostrada en rojo como pérdida, sin montos confusos.
- [ ] 4 gráficos (ingresos vs gastos, utilidad mensual, distribución de gastos, top cuentas) con leyenda, ejes y tooltip al interactuar.
- [ ] Cambiar el rango actualiza KPIs y gráficos sin recarga; cambios rápidos muestran el último rango (FR-014).
- [ ] Rango vacío → "Sin movimientos en el periodo"; error de red → mensaje + botón "Reintentar" (nunca pantalla en blanco).
- [ ] Cambiar de período tarda < 3 s (SC-005).

## 6. Documentación Swagger

Visitar `http://localhost:3000/api/docs` y verificar el endpoint **Accounting Dashboard** con sus parámetros `desde`/`hasta` y respuestas 200/400/404/500.

## Troubleshooting

| Síntoma | Causa probable |
|---|---|
| `meta.empty: true` inesperado | Sin asientos vigentes (`status = true`) en el rango |
| Serie mensual en 0 pero hay datos | Fecha `entry_date` fuera del rango seleccionado |
| Variaciones `null` | Período anterior sin datos o con valor 0 (`|anterior| < 0.005`) |
| 404 en la consulta | Catálogo `accounting_account` vacío (correr seed) |
