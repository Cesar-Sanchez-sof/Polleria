# Feature Specification: Generar Balance (Estado de Situación Financiera)

**Feature Branch**: `007-generar-balance`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *generar
balance* (Balance General / Estado de Situación Financiera), describiendo el comportamiento real
implementado."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y por las pruebas unitarias del constructor
> (`lib/accounting/balance-sheet.test.ts`), referenciadas en
> [Evidencia de verificación](#evidencia-de-verificación). No se describen funcionalidades
> futuras ni reglas ausentes en la implementación. El Estado de Resultados y la contabilización
> de cierres son features distintas y quedan **fuera de alcance**.

---

## Purpose

Generar el **Estado de Situación Financiera (Balance General)** a una fecha de corte, conforme al
PCGE y a la presentación de activo/pasivo/patrimonio, con el Resultado del ejercicio incorporado
al patrimonio para comprobar la ecuación `Activo = Pasivo + Patrimonio`. Disponible vía API
(`GET /api/balance-sheet`) y en la pantalla `/accounting/balance`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generar el balance a una fecha de corte (Priority: P1)

Como usuario de contabilidad, quiero elegir una fecha de corte y ver el Balance General con sus
totales y su estado de cuadre, para verificar la posición financiera de la empresa.

**Why this priority**: es la funcionalidad central; todo lo demás (filtro de fecha, impresión,
chips) depende del estado devuelto por el endpoint.

**Independent Test**: `GET /api/balance-sheet` (sin `hasta`, usa hoy) → `200` con
`reportTitle: "Estado de Situación Financiera"`, `currency: "PEN"`, `lines[]`, `totals{}`,
`balanced` y `difference`.

**Acceptance Scenarios**:

1. **Given** existen cuentas activas y asientos vigentes, **When** se solicita
   `GET /api/balance-sheet?hasta=2026-03-31`, **Then** se responde `200` con el estado que
   incluye secciones `ACTIVO`, `PASIVO`, `PATRIMONIO`, subtotales por sección y los totales en
   `totals`.
2. **Given** los movimientos están completos, **When** se genera el balance, **Then**
   `balanced: true` y `difference: 0` (Activo = Pasivo + Patrimonio, con el resultado del
   ejercicio dentro del patrimonio).
3. **Given** faltan movimientos, **When** se genera el balance, **Then** `balanced: false` y
   `difference` contiene la diferencia en soles (positiva si el activo es mayor).
4. **Given** `hasta` no cumple `YYYY-MM-DD` (p. ej. `31/03/2026`), **When** se solicita,
   **Then** se responde `400` con
   `{ "error": "La fecha de corte (hasta) debe tener el formato YYYY-MM-DD." }`.
5. **Given** no hay cuentas contables activas, **When** se solicita, **Then** se responde `404`
   con `{ "error": "No hay cuentas contables activas para elaborar el balance." }`.
6. **Given** un fallo de base de datos, **When** se solicita, **Then** se responde `500` con
   `{ "error": "No se pudo generar el Estado de Situación Financiera." }` y se loguea
   `[api/balance-sheet] prisma:` (o `[api/balance-sheet] error:`).
7. **Given** que no hay autenticación en la ruta, **When** se solicita sin sesión, **Then** se
   responde `200` igual que con sesión.

---

### User Story 2 - Cambiar la fecha de corte y ver el resultado (Priority: P2)

Como usuario, quiero modificar la fecha y que el balance se recargue solo, para comparar cortes
sin botón adicional.

**Why this priority**: comodidad sobre la P1; implementa debounce, control de carreras y estados
de carga/error de la UI.

**Independent Test**: cambiar el `<input type="date">` → tras un `setTimeout(0)` se llama
`load(nuevaFecha)`; si hay una petición anterior en vuelo, su resultado se descarta
(`requestRef`).

**Acceptance Scenarios**:

1. **Given** la pantalla abierta, **When** cambia la fecha, **Then** se muestra
   "Generando Estado de Situación Financiera…" mientras carga y luego la tabla.
2. **Given** una fecha con formato inválido en cliente, **When** se intenta cargar, **Then** se
   muestra "La fecha de corte debe tener el formato válido." sin llamar a la API y se limpia el
   estado previo (`statement = null`).
3. **Given** la API devuelve un error, **When** falla la carga, **Then** se muestra el mensaje del
   cuerpo (`error`) en un recuadro rojo y la tabla se reemplaza por ese error.
4. **Given** que el usuario cambia de fecha rápidamente, **When** llega la respuesta más vieja,
   **Then** se ignora (no sobrescribe la más reciente).
5. **Given** `statement === null` y sin error ni carga, **When** se renderiza, **Then** aparece
   "Selecciona una fecha de corte para generar el balance."

---

### User Story 3 - Imprimir el balance (Priority: P3)

Como usuario, quiero imprimir el estado con el navegador para archivarlo o entregarlo.

**Why this priority**: valor agregado; no altera los datos.

**Independent Test**: pulsar "Imprimir" → `window.print()` con estilos `print:hidden` que ocultan
filtros y chips de resumen.

**Acceptance Scenarios**:

1. **Given** un balance generado, **When** se pulsa "Imprimir", **Then** se abre el diálogo de
   impresión con cabecera, tabla, nota normativa y sin los controles de la UI.
2. **Given** la fecha actual es la de corte, **When** se renderiza el filtro, **Then** el botón
   "Hoy" está deshabilitado (`disabled={!hasCustomDate}`).

---

### Edge Cases

- **Fecha fuera de rango con formato válido** (`2026-13-45`): el regex no valida calendario y
  `parseUtcDate` usa `Date.UTC`, que **normaliza (rollover)** el mes/día → se consulta un instante
  distinto al que parecía el usuario; la cadena original se conserva en `statement.asOf`.
- **Cuentas fuera de los prefijos de alcance**: los totales de sección sólo suman los códigos
  listados en cada `scopeMatch` (Activo corriente: `10,12,16,20,24,25`; Activo no corriente:
  `33,39`; Pasivo corriente: `40,41,42,46`; Pasivo no corriente: `45,47,49`; Patrimonio:
  `50,59`). Una cuenta activa con otro prefijo (p. ej. un Activo `18` o un Pasivo `43`) **no
  aparece ni suma** y puede provocar un descuadre.
- **Pasivo no corriente sin grupos definidos** (`NON_CURRENT_LIABILITY_GROUPS = []`): esas
  cuentas sólo pueden aparecer bajo la subsección automática "Otros".
- **Cuentas cabecera de un dígito** ("1", "2", …): `isDetailAccount()` las ignora (no suman ni se
  listan).
- **Saldos casi nulos**: montos con `|amount| < 0.005` se omiten del reporte (`isMeaningful`).
- **Cuentas inactivas**: excluidas (`where: { active: true }`), aunque su saldo exista.
- **Asientos anulados**: `entry.status = true` es obligatorio en ambos agregados.
- **Saldos de historial vs. año**: cuentas de balance (Activo/Pasivo/Patrimonio) usan el
  acumulado **hasta** la fecha; las de Ingreso/Gasto/Costo usan sólo `01-ene del año de la fecha
  de corte → fecha de corte`.
- **Pérdida del ejercicio**: `periodResult` puede ser negativo; el chip "Resultado del ejercicio"
  se muestra en rojo.
- **Sin cuentas / sin movimientos**: si no hay cuentas activas → `404`; si las hay pero no hay
  movimientos, el balance se devuelve con todos los montos en `0` y `balanced: true`.

---

## Functionalities

- **GET `/api/balance-sheet?hasta=YYYY-MM-DD`** construye y devuelve el estado completo.
- **`buildBalanceSheet()`** (`lib/accounting/balance-sheet.ts`) agrupa las cuentas por prefijo
  PCGE en secciones/subsecciones/subtotales, calcula el resultado del ejercicio y el cuadre.
- **Pantalla `/accounting/balance`**: selector de fecha (por defecto hoy UTC), botones "Hoy" e
  "Imprimir", tabla del estado, banda de cuadre/descuadre, nota normativa y 4 chips de resumen.
- Cabecera del informe: `companyName`, `reportTitle` y "Al {fecha} · Expresado en PEN (Soles)".

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Naturaleza firmada** | `signedBalance`: Activo, Gasto y Costo → `débito − crédito`; Pasivo, Patrimonio e Ingreso → `crédito − débito`. |
| BR-2 | **Alcance por prefijo** | Sólo se listan y suman códigos dentro del `scopeMatch` de cada sección; el resto se ignora silenciosamente. |
| BR-3 | **Agrupación** | Dentro de cada sección, las cuentas se agrupan por prefijo (p. ej. `10` → "Efectivo y equivalentes de efectivo") y las no cubiertas por un grupo conocido van a "Otros". |
| BR-4 | **Orden** | Cuentas ordenadas por `code` con `localeCompare(code, "es")`. |
| BR-5 | **Resultado del ejercicio** | `Σ ingresos − Σ gastos − Σ costos` sólo sobre cuentas detalle; se agrega al patrimonio con una nota de que está *pendiente de cierre a Resultados acumulados*. |
| BR-6 | **Cuadre** | `difference = round2(totalActivos − (totalPasivo + totalPatrimonio))`; `balanced = |difference| < 0.005`. |
| BR-7 | **Redondeo** | Todos los importes se redondean a 2 decimales (`round2`). |
| BR-8 | **Fechas** | Saldos de balance: `entryDate <= hasta`; resultado: `01-ene del año de hasta <= entryDate <= hasta`; siempre con `status = true`. |
| BR-9 | **Sólo cuentas activas** | El endpoint considera únicamente `active: true`. |
| BR-10 | **Empresa** | `companyName = COMPANY_NAME ‖ NEXT_PUBLIC_COMPANY_NAME ‖ "Pollería ERP"`. |
| BR-11 | **Sin control de acceso** | La ruta no valida sesión, cookie ni rol (no hay middleware activo). |

## Endpoint

| Method | Path | Summary |
|--------|------|---------|
| GET | `/api/balance-sheet` | Estado de Situación Financiera a una fecha de corte. |

### Request

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `hasta` | string `YYYY-MM-DD` | No | hoy (UTC) | Fecha de corte (inclusive). |

Sin cuerpo. Otros query strings se ignoran.

### Response (200)

```json
{
  "asOf": "2026-03-31",
  "currency": "PEN",
  "companyName": "Pollería ERP",
  "reportTitle": "Estado de Situación Financiera",
  "normativeNote": "Elaborado conforme al PCGE y a la presentación del Estado de Situación Financiera (activo, pasivo y patrimonio). Saldos en soles (PEN) a la fecha de corte, con asientos vigentes. El Resultado del ejercicio se incorpora al patrimonio para cumplir la ecuación contable Activo = Pasivo + Patrimonio.",
  "lines": [
    { "key": "assets", "code": null, "label": "ACTIVO", "amount": null, "kind": "section", "indent": 0 },
    { "key": "current-assets", "code": null, "label": "Activo corriente", "amount": null, "kind": "subsection", "indent": 0 },
    { "key": "ca-cash", "code": null, "label": "Efectivo y equivalentes de efectivo", "amount": null, "kind": "subsection", "indent": 1 },
    { "key": "ca-101", "code": "101", "label": "Caja", "amount": 500, "kind": "account", "indent": 2 },
    { "key": "ca-cash-total", "code": null, "label": "Total efectivo y equivalentes de efectivo", "amount": 500, "kind": "subtotal", "indent": 1 },
    { "key": "current-assets-total", "code": null, "label": "Total activo corriente", "amount": 3200, "kind": "subtotal", "indent": 0 },
    { "key": "total-assets", "code": null, "label": "TOTAL ACTIVO", "amount": 11200, "kind": "total", "indent": 0 },
    { "key": "total-liabilities", "code": null, "label": "TOTAL PASIVO", "amount": 780, "kind": "total", "indent": 0 },
    { "key": "period-result", "code": null, "label": "Resultado del ejercicio", "amount": 1070, "kind": "account", "indent": 1 },
    { "key": "period-result-note", "code": null, "label": "Utilidad (pérdida) del ejercicio según cuentas de ingreso, gasto y costo (PCGE), pendiente de cierre a Resultados acumulados.", "amount": null, "kind": "note", "indent": 2 },
    { "key": "total-liabilities-equity", "code": null, "label": "TOTAL PASIVO Y PATRIMONIO", "amount": 11200, "kind": "total", "indent": 0 }
  ],
  "totals": {
    "currentAssets": 3200,
    "nonCurrentAssets": 8000,
    "totalAssets": 11200,
    "currentLiabilities": 780,
    "nonCurrentLiabilities": 0,
    "totalLiabilities": 780,
    "equityBeforeResult": 9350,
    "periodResult": 1070,
    "totalEquity": 10420,
    "totalLiabilitiesAndEquity": 11200
  },
  "balanced": true,
  "difference": 0
}
```

> El ejemplo trunca `lines[]` por brevedad; la respuesta real incluye todas las secciones
> (`ACTIVO`, `PASIVO`, `PATRIMONIO`), sus subsecciones y subtotales. Los importes provienen del
> caso de prueba `baseAccounts` de `lib/accounting/balance-sheet.test.ts`.
>
> `kind` sólo puede ser: `section`, `subsection`, `account`, `subtotal`, `total`, `note`.
> `indent` (0-2) controla la sangría en la tabla.

### Errors

| Status | Condition | Body |
|--------|-----------|------|
| 400 | `hasta` no cumple `^\d{4}-\d{2}-\d{2}$` | `{ "error": "La fecha de corte (hasta) debe tener el formato YYYY-MM-DD." }` |
| 404 | Ninguna cuenta contable activa | `{ "error": "No hay cuentas contables activas para elaborar el balance." }` |
| 500 | Excepción inesperada (p. ej. error de Prisma) | `{ "error": "No se pudo generar el Estado de Situación Financiera." }` |

No existe `401`/`403`: la operación no requiere autenticación.

## Permissions

- **Requerido**: ninguno. La ruta no usa `requireRole` ni verifica sesión/cookie, y no existe
  middleware de autorización activo en el proyecto (`middleware.ts` inexistente,
  `proxy.ts.desactivado`).
- En la práctica cualquier cliente que alcance la aplicación puede leer los saldos de la empresa.
- El enlace "Balance General" del sidebar (`/accounting/balance`) no aplica filtro de rol.
- Para comparar: `POST`/`PATCH` de `/api/accounting-periods` sí exigen rol `ADMIN` (spec `001`).

## Validations

- **Servidor**: únicamente el formato de `hasta` (regex `^\d{4}-\d{2}-\d{2}$`). No se valida que
  la fecha exista en el calendario ni que sea anterior a hoy.
- **Cliente**: mismo regex en `load()` con mensaje "La fecha de corte debe tener el formato
  válido." (evita la llamada).
- Cualquier excepción se captura y responde `500` con el mensaje documentado; los errores de
  Prisma se loguean con su código (`[api/balance-sheet] prisma: <code> <mensaje>`).

## Acceptance Criteria

1. **When** se llama el endpoint con una fecha válida **Then** se recibe `200` con `lines`,
   `totals`, `balanced` y `difference`, y con `currency: "PEN"` y
   `reportTitle: "Estado de Situación Financiera"`.
2. **When** `hasta` viene vacío **Then** se usa la fecha de hoy en UTC (`todayIsoUtc()`).
3. **When** los asientos están completos **Then** `balanced: true` y
   `totalAssets === totalLiabilitiesAndEquity`.
4. **When** sólo se envía un Activo de 100 y un Patrimonio de 50 **Then** `balanced: false` y
   `difference: 50` (caso cubierto por pruebas).
5. **When** cambia la fecha en la UI **Then** se vuelve a consultar automáticamente y la respuesta
   obsoleta se descarta.
6. **When** la API falla **Then** la UI muestra el mensaje del cuerpo en un recuadro de error.
7. **When** el resultado del ejercicio es negativo **Then** se muestra el importe con signo y en
   rojo en el chip de resumen.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Exponer `GET /api/balance-sheet` con parámetro opcional `hasta` (default: hoy UTC).
- **FR-002**: Obtener los saldos con dos agregaciones en paralelo (`groupBy` de débito/crédito):
  histórico hasta `hasta` y del ejercicio (`01-ene` del año → `hasta`).
- **FR-003**: Aplicar la naturaleza firmada por tipo de cuenta (BR-1) y descartar cuentas cabecera
  de un dígito y montos `< 0.005`.
- **FR-004**: Clasificar Activo en corriente/no corriente, Pasivo en corriente/no corriente y
  Patrimonio, agrupando por prefijo PCGE y agregando "Otros" para los no cubiertos.
- **FR-005**: Calcular `Resultado del ejercicio` (ingresos − gastos − costos) e incorporarlo al
  patrimonio con su nota.
- **FR-006**: Devolver `totals`, `balanced` y `difference`, y detectar descuadres.
- **FR-007**: Responder `400` por formato de fecha, `404` sin cuentas activas y `500` ante
  excepciones.
- **FR-008**: Mostrar en `/accounting/balance` la tabla, la banda de cuadre/descuadre, la nota
  normativa, los chips de resumen y el estado de carga/error.
- **FR-009**: Recargar automáticamente al cambiar la fecha, con debounce (`setTimeout(0)`) y
  protección contra carreras (`requestRef`).
- **FR-010**: Permitir restablecer la fecha a hoy ("Hoy") e imprimir ("Imprimir" →
  `window.print()`).

### Non-Functional Requirements

- **NFR-001**: La ruta es dinámica (`export const dynamic = "force-dynamic"`) y el front-end usa
  `getJson` sin caché: la respuesta nunca se sirve estáticamente.
- **NFR-002**: Los saldos se calculan con **2 consultas agregadas** (`Promise.all` de dos
  `groupBy`), sin traer línea de asiento individual (sin N+1).
- **NFR-003**: Presentación alineada a PCGE/SUNAT: secciones normalizadas, importes en PEN con
  formato `es-PE` y nota normativa incluida en el JSON.
- **NFR-004**: La pantalla es imprimible: los controles de filtro y chips se ocultan con
  `print:hidden`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una sola llamada al endpoint devuelve un estado listo para imprimir (secciones,
  subtotales, totales y nota normativa) sin peticiones adicionales.
- **SC-002**: Con movimientos completos, `balanced === true` y `difference === 0`; con datos
  incompletos el descuadre se expone explícitamente en `difference` y en la banda de la UI
  ("Descuadre de S/ X …").
- **SC-003**: El 100 % de las respuestas exitosas incluye los 10 campos de `totals` y sólo
  presenta cuentas activas y asientos vigentes.
- **SC-004**: Cambiar la fecha produce siempre un estado consistente (ninguna respuesta antigua
  sobrescribe a la reciente).
- **SC-005**: Los errores se informan con el mensaje exacto de la API (400/404/500), nunca en
  silencio.

---

## Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US1 | `GET(request)` con `searchParams.get("hasta") ?? todayIsoUtc()` |
| FR-002 | US1 escenarios 1-3 | `Promise.all` de dos `prisma.journalEntryDetail.groupBy` |
| FR-003 | Edge cases | `signedBalance`, `isDetailAccount`, `isMeaningful` |
| FR-004 | US1 | `appendGroup` + constantes `*_GROUPS` y `scopeMatch` |
| FR-005 | US1 escenario 2 | `computePeriodResult` y línea `period-result` |
| FR-006 | US1 escenarios 2-3 | `totals`, `balanced`, `difference` |
| FR-007 | US1 escenarios 4-6 | `catch` + ramas 400/404 en la ruta |
| FR-008 | US1/US2 (UI) | `BalanceSheetTable` (banda, tabla, chips) |
| FR-009 | US2 escenarios 1-4 | `useEffect` + `setTimeout(0)` + `requestRef` |
| FR-010 | US3 | `BalanceSheetFilters` ("Hoy" / "Imprimir") |

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| Parámetro `hasta`, default hoy UTC, regex y respuestas 400/404/500 | `app/api/balance-sheet/route.ts` líneas 33-45, 37-58, 134-144 |
| Cuentas activas y orden por código | `app/api/balance-sheet/route.ts` líneas 47-51 |
| Dos agregados en paralelo (histórico y del año, `status: true`) | `app/api/balance-sheet/route.ts` líneas 62-85 |
| P&L usa agregado de período; el resto, el histórico; redondeo a 2 decimales | `app/api/balance-sheet/route.ts` líneas 106-120 |
| `companyName` por variables de entorno con fallback "Pollería ERP" | `app/api/balance-sheet/route.ts` líneas 122-125 |
| `dynamic = "force-dynamic"` y log de errores Prisma | `app/api/balance-sheet/route.ts` líneas 11 y 134-143 |
| `signedBalance`, `round2`, `isMeaningful`, `isDetailAccount` | `lib/accounting/balance-sheet.ts` líneas 67-84, 162-165 |
| Grupos y `scopeMatch` de cada sección (`NON_CURRENT_LIABILITY_GROUPS = []`) | `lib/accounting/balance-sheet.ts` líneas 92-160 y 308-450 |
| Subsección automática "Otros" para cuentas no cubiertas | `lib/accounting/balance-sheet.ts` líneas 224-259 |
| `computePeriodResult` y notas de resultado/pérdida | `lib/accounting/balance-sheet.ts` líneas 264-275 y 451-469 |
| `totals`, `balanced`, `difference`, `normativeNote` | `lib/accounting/balance-sheet.ts` líneas 471-515 |
| Pruebas: cuadre 11200 = 780 + 10420, secciones, descuadre 50, pérdida −150 | `lib/accounting/balance-sheet.test.ts` líneas 24-114 |
| Servicio `getBalanceSheet`, `formatPen`, `formatCutOffDate`, `buildBalanceSheetQuery` | `lib/services/balance-sheet.service.ts` líneas 11-44 |
| `getJson` propaga `error` de la API como `ApiError` | `lib/services/http.ts` líneas 34-47 |
| Página: fecha por defecto hoy, debounce, `requestRef`, estados de carga/error | `app/accounting/balance/page.tsx` líneas 27-64 |
| Bandas "Cuadra: …" / "Descuadre de …", cabecera, tabla, nota y chips | `app/accounting/balance/components/BalanceSheetTable.tsx` líneas 55-188 |
| Estados vacío/carga/error ("Generando Estado de Situación Financiera…", "Selecciona una fecha de corte…") | `app/accounting/balance/components/BalanceSheetTable.tsx` líneas 29-53 |
| Filtros: input date, "Hoy" (deshabilitado si es hoy), "Imprimir" | `app/accounting/balance/components/BalanceSheetFilters.tsx` líneas 33-69 |
| Enlace "Balance General" del sidebar | `components/personalized/Sidebar.tsx` líneas 320-326 |
| Sin pruebas de la ruta (sólo del constructor) | `app/api/balance-sheet/` contiene únicamente `route.ts` |

**Fuera de alcance de esta especificación**: Estado de Resultados / Estado de Ganancias y
Pérdidas, cierre contable de períodos (spec `001`), asientos de ajuste y exportación a
PDF/Excel (sólo existe impresión del navegador).

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
