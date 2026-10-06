# Feature Specification: Consultar Libro Mayor

**Feature Branch**: `013-consultar-libro-mayor`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *consultar
libro mayor* (movimientos de una cuenta contable con saldo corriente y periodo), describiendo el
comportamiento real implementado."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y por las pruebas automatizadas del endpoint
> (`app/api/general-ledger/route.test.ts`, 18 casos) y del servicio
> (`lib/services/general-ledger.service.test.ts`, 7 casos), referenciadas en
> [Evidencia de verificación](#evidencia-de-verificación). No se describen funcionalidades
> futuras ni reglas ausentes en la implementación. El plan contable es la spec `003`, el detalle
> de asientos una función relacionada y el balance la spec `007`.

---

## Purpose

Consultar los movimientos de una cuenta contable en orden cronológico (del más antiguo al más
reciente), con el saldo corriente después de cada movimiento, el saldo anterior al periodo y los
totales de débito/haber del periodo consultado.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver los movimientos de una cuenta (Priority: P1)

Como contador, quiero seleccionar una cuenta contable y ver todos sus movimientos con su saldo
corriente para conciliarla.

**Why this priority**: es la operación central; todo lo demás (periodo, detalle del asiento)
depende de ella.

**Independent Test**: `GET /api/general-ledger?codigo=101` → `200` con `cuenta`, `saldoAnterior`,
`saldoFinal`, `totales` y `movimientos[]` con `saldo` progresivo.

**Acceptance Scenarios**:

1. **Given** la cuenta "101" tiene movimientos, **When** se solicita
   `GET /api/general-ledger?codigo=101`, **Then** se responde `200` con la cuenta
   (`codigo`, `nombre`, `tipo`), `saldoAnterior: 0` (sin `desde`), los movimientos ordenados por
   fecha y `totales { debe, haber, movimientos }`.
2. **Given** no se envía `codigo`, **When** se solicita, **Then** `400`
   `{ "error": "Debe indicar la cuenta contable a consultar." }`.
3. **Given** un código inexistente, **When** se solicita, **Then** `404`
   `{ "error": "Cuenta contable no encontrada." }`.
4. **Given** la base de datos falla, **When** se solicita, **Then** `500`
   `{ "error": "No se pudo obtener el libro mayor." }`.
5. **Given** la cuenta no tiene movimientos, **When** se solicita, **Then** `200` con
   `movimientos: []` y `totales.movimientos: 0`.
6. **Given** que no hay autenticación, **When** se solicita sin sesión, **Then** se procesa igual.

---

### User Story 2 - Filtrar por periodo (Priority: P1)

Como contador, quiero acotar la consulta a un rango de fechas para ver el periodo y su saldo
anterior.

**Why this priority**: es el segundo parámetro del endpoint y define el saldo inicial.

**Independent Test**: `?codigo=101&desde=2026-01-01&hasta=2026-03-31` → movimientos de ese rango
(inclusivo) y `saldoAnterior` = `Σdebe − Σhaber` de los movimientos anteriores a `desde`.

**Acceptance Scenarios**:

1. **Given** movimientos anteriores a `desde`, **When** se consulta el periodo, **Then** aparece
   `saldoAnterior` distinto de 0 y la tabla muestra la fila "Balance before period".
2. **Given** `desde` con formato inválido (`01/01/2026`), **When** se solicita, **Then** `400`
   `{ "error": "La fecha inicial debe tener el formato AAAA-MM-DD." }`.
3. **Given** `hasta` con formato inválido, **When** se solicita, **Then** `400`
   `{ "error": "La fecha final debe tener el formato AAAA-MM-DD." }`.
4. **Given** `desde > hasta`, **When** se solicita, **Then** `400`
   `{ "error": "La fecha inicial no puede ser posterior a la fecha final." }`.
5. **Given** el usuario elige un rango invertido en la UI, **When** cambia el filtro, **Then** la
   pantalla **no consulta** y muestra ese mismo aviso (el `min`/`max` de los inputs además impide
   elegirlo).

---

### User Story 3 - Abrir el asiento de un movimiento (Priority: P2)

Como usuario, quiero pulsar un movimiento para ver el detalle completo del asiento que lo
originó.

**Why this priority**: es una navegación de apoyo sobre la consulta principal.

**Independent Test**: clic en una fila → `GET /api/journal-entries/{id}` y se abre el diálogo de
detalle con reintentos si falla.

**Acceptance Scenarios**:

1. **Given** la lista cargada, **When** se pulsa una fila, **Then** se abre el diálogo con el
   detalle del asiento (mismo componente que la pantalla de asientos).
2. **Given** el detalle falla, **When** se produce el error, **Then** se muestra el mensaje de
   error con botón de reintento.
3. **Given** otra consulta se dispara mientras el detalle carga, **When** llegan respuestas,
   **Then** sólo la última escribe el estado (`detailRequestRef`).

---

### Edge Cases

- **Asientos anulados se incluyen**: el endpoint **no filtra `entry.status`**, por lo que los
  movimientos de asientos anulados aparecen con `estado: "Anulado"` y la tabla les pone el badge
  "Cancelled"; además **también entran en el saldo anterior**. (A diferencia del balance, que
  sólo usa `status: true`.)
- **Saldo siempre con naturaleza deudora**: `saldo = Σ(debe − haber)` sin considerar el tipo de
  cuenta; para cuentas de naturaleza acreedora el saldo se expresa con signo negativo y se
  etiqueta "acreedor" (`tipoSaldo`).
- **Umbrales de etiqueta**: `deudor` si `saldo > 0.004`, `acreedor` si `saldo < -0.004`, si no
  `null` (sin etiqueta).
- **Sin `desde`**: `saldoAnterior` se fija en `0` (no se calcula histórico anterior).
- **Sin paginación**: se devuelven todos los movimientos del periodo en una sola respuesta.
- **Fila de saldo anterior oculta** si `|saldoAnterior| < 0.005`.
- **Rango invertido en cliente**: suspende la consulta y sustituye el error por el aviso de
  filtro; la tabla no muestra los datos del último periodo válido.
- **Selecciona la primera cuenta automáticamente**: al cargar el plan contable se preselecciona
  `data[0].codigo`; si el plan está vacío, se muestra "Selecciona una cuenta contable para ver su
  libro mayor."
- **Plan contable que falla**: el error se muestra tanto en el filtro como en la tabla
  ("No se pudo cargar el plan contable.").
- **Idioma mixto**: cabecera y filtros en español; encabezados de tabla y estados vacíos en
  inglés (`Date`, `Entry`, `Description`, `Module / Reference`, `Debit`, `Credit`, `Balance`,
  `Debtor`/`Creditor`, `Retry`, `Clear filters`, "No movements exist for the selected account and
  period").
- **Refresco por cambio de filtros**: debounce `setTimeout(0)` con protección de carreras
  (`requestRef`); la tabla cargando conserva los datos previos con `opacity-60`.

---

## Functionalities

- **`GET /api/general-ledger`**: movimientos de una cuenta con saldo corriente, saldo anterior,
  totales y referencia del documento origen.
- **Pantalla `/accounting/ledger`**: selector de cuenta, filtros "De"/"A", tabla cronológica con
  saldo progresivo y detalle del asiento.
- Cabecera con contador de movimientos (`N movimiento(s) en el periodo`).
- Acciones de la tabla: clic en fila (detalle), "Retry" (reintentar), "Clear filters" (limpiar
  fechas).

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Cuenta obligatoria** | Sin `codigo` no se consulta nada (400). |
| BR-2 | **Periodo inclusive** | `desde` y `hasta` son inclusivos (`gte`/`lte`); el saldo anterior usa `entryDate < desde`. |
| BR-3 | **Orden cronológico** | `entryDate` ascendente, luego `id` del asiento y luego `id` del detalle. |
| BR-4 | **Saldo progresivo** | `saldo_i = saldoAnterior + Σ(debe − haber)` desde el primer movimiento, redondeado a 2 decimales. |
| BR-5 | **Naturaleza del saldo** | Siempre `debe − haber` (naturaleza deudora), con etiqueta `deudor`/`acreedor` por signo. |
| BR-6 | **Incluye anulados** | No se filtra `entry.status`; los anulados se marcan `estado: "Anulado"`. |
| BR-7 | **Referencia origen** | `Boleta/Factura/Ticket SERIE-NUM`, `… de compra` o `Planilla MM/AAAA` según el documento asociado; `null` si no hay. |
| BR-8 | **Totales** | `totales.debe`/`totales.haber` = sumas de los movimientos del periodo; `saldoFinal = saldoAnterior + debe − haber`. |
| BR-9 | **Sin control de acceso** | No se valida sesión, cookie ni rol (no hay middleware activo). |

## Endpoint

| Method | Path | Summary |
|--------|------|---------|
| GET | `/api/general-ledger` | Movimientos de una cuenta con saldo y totales. |

### Request

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `codigo` | string | Sí | Código de la cuenta contable. |
| `desde` | `YYYY-MM-DD` | No | Inicio del periodo (inclusive). |
| `hasta` | `YYYY-MM-DD` | No | Fin del periodo (inclusive). |

Sin cuerpo.

### Response (200)

```json
{
  "cuenta": { "codigo": "101", "nombre": "Caja", "tipo": "Activo" },
  "saldoAnterior": 1500,
  "saldoFinal": 1700,
  "totales": { "debe": 400, "haber": 200, "movimientos": 2 },
  "movimientos": [
    {
      "id": 57,
      "idAsiento": 12,
      "numero": "AJ-0012",
      "fecha": "2026-02-10",
      "glosa": "Cobro de venta del día",
      "descripcion": "Ingreso en Caja",
      "modulo": "Ventas",
      "referencia": "Boleta B001-000451",
      "estado": "Registrado",
      "debe": 400,
      "haber": 0,
      "saldo": 1900,
      "tipoSaldo": "deudor"
    },
    {
      "id": 58,
      "idAsiento": 13,
      "numero": "AJ-0013",
      "fecha": "2026-02-11",
      "glosa": "Pago a proveedor",
      "descripcion": "Salida de Caja",
      "modulo": "Compras",
      "referencia": null,
      "estado": "Anulado",
      "debe": 0,
      "haber": 200,
      "saldo": 1700,
      "tipoSaldo": "deudor"
    }
  ]
}
```

### Errors

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Falta `codigo` | `{ "error": "Debe indicar la cuenta contable a consultar." }` |
| 400 | `desde` mal formateado | `{ "error": "La fecha inicial debe tener el formato AAAA-MM-DD." }` |
| 400 | `hasta` mal formateado | `{ "error": "La fecha final debe tener el formato AAAA-MM-DD." }` |
| 400 | Rango invertido | `{ "error": "La fecha inicial no puede ser posterior a la fecha final." }` |
| 404 | Cuenta inexistente | `{ "error": "Cuenta contable no encontrada." }` |
| 500 | Fallo de base de datos | `{ "error": "No se pudo obtener el libro mayor." }` |

No existen respuestas `401`/`403`.

## Permissions

- **Requerido**: ninguno. La ruta no usa `requireRole` ni verifica sesión/cookie, y no existe
  middleware de autorización activo (`middleware.ts` inexistente, `proxy.ts.desactivado`).
- Cualquier cliente que alcance la aplicación puede leer los movimientos y saldos de cualquier
  cuenta.
- El enlace "Libro Mayor" del sidebar no aplica filtro de rol.

## Validations

**Servidor**: `codigo` presente → formato de `desde` → formato de `hasta` → `desde <= hasta` →
existencia de la cuenta.

**Cliente**: `invalidRange = from > to` **suspende la consulta** y muestra el aviso en lugar de
llamar a la API; los inputs de fecha usan `max`/`min` del otro extremo para impedir elegir un
rango invertido; errores del plan contable y de la consulta se muestran con botón "Retry".

## Acceptance Criteria

1. **When** se consulta una cuenta **Then** la respuesta contiene `cuenta`, `saldoAnterior`,
   `saldoFinal`, `totales` y `movimientos` con `saldo` progresivo y `tipoSaldo`.
2. **When** se define un periodo **Then** los extremos son inclusivos y `saldoAnterior` refleja
   los movimientos anteriores a `desde`.
3. **When** hay asientos anulados en la cuenta **Then** aparecen con `estado: "Anulado"` y son
   visibles en la tabla con badge.
4. **When** la cuenta no tiene movimientos en el periodo **Then** la API responde lista vacía y
   la UI muestra "No movements exist for the selected account and period" con opción de limpiar
   filtros.
5. **When** los filtros cambian **Then** la consulta se repite con protección de carreras y sólo
   la última respuesta escribe el estado.
6. **When** el usuario pulsa una fila **Then** se abre el detalle del asiento correspondiente.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Exponer `GET /api/general-ledger` con `codigo` obligatorio y `desde`/`hasta`
  opcionales.
- **FR-002**: Calcular el saldo anterior con un `aggregate` de débito/haber anteriores a `desde`.
- **FR-003**: Devolver los movimientos ordenados cronológicamente con saldo progresivo, etiqueta
  de naturaleza y referencia del documento origen.
- **FR-004**: Incluir los asientos anulados marcándolos como `Anulado`.
- **FR-005**: Devolver `totales { debe, haber, movimientos }` y `saldoFinal`.
- **FR-006**: Responder `400`/`404`/`500` con los mensajes documentados.
- **FR-007**: Ofrecer en la UI el selector de cuenta (carga única del plan contable, primera
  cuenta preseleccionada) y los filtros de fecha con limpieza.
- **FR-008**: Pintar la tabla cronológica con skeleton, estados de error/cuenta ausente/sin
  movimientos, fila de saldo anterior, fila de totales y contador en la cabecera.
- **FR-009**: Abrir el detalle del asiento desde cualquier fila con control de carreras y
  reintento.

### Non-Functional Requirements

- **NFR-001**: `export const dynamic = "force-dynamic"` en la ruta y `getJson` sin caché en el
  servicio (cubierto por pruebas).
- **NFR-002**: Sin paginación: la respuesta incluye todos los movimientos del periodo en una
  sola carga; el saldo se calcula en el servidor con un único `findMany` + un `aggregate`.
- **NFR-003**: Sin autenticación ni auditoría de consultas.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Para cualquier cuenta y periodo, `saldoFinal === saldoAnterior + totales.debe −
  totales.haber` (redondeado a 2 decimales).
- **SC-002**: Cada `movimientos[i].saldo` coincide con el saldo acumulado de los movimientos
  anteriores más el saldo anterior.
- **SC-003**: El 100 % de los rechazos devuelve el mensaje exacto documentado (400/404/500) y la
  UI lo muestra con la opción de reintentar cuando corresponde.
- **SC-004**: Un rango invertido nunca llega a la API desde la pantalla (se avisa en cliente).
- **SC-005**: Cambiar la cuenta o el periodo produce siempre un estado coherente (ninguna
  respuesta antigua sobrescribe a la reciente).

---

## Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US1 escenarios 1-2 | Lectura de `codigo`/`desde`/`hasta` y sus 400 |
| FR-002 | US2 escenario 1 | `journalEntryDetail.aggregate` con `entryDate < desde` |
| FR-003 | US1 escenario 1 | `findMany` con `orderBy` triple y `select` del asiento |
| FR-004 | Edge case anulados | Ausencia de filtro `status` + campo `estado` |
| FR-005 | US1 escenario 1 | Cálculo de `totales` y `saldoFinal` |
| FR-006 | US1 escenarios 2-4 / US2 escenarios 2-4 | Ramas 400/404/500 de la ruta |
| FR-007 | US1, US2 (UI) | `LedgerEffects`/`LedgerFilters` y carga del plan contable |
| FR-008 | US1 escenario 5 / US2 escenario 5 | `LedgerTable` (skeleton, estados, totales) |
| FR-009 | US3 escenarios 1-3 | `openDetail` + `JournalEntryDetail` |

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| `GET` completo: parámetros, 4 validaciones 400, 404 y 500 | `app/api/general-ledger/route.ts` líneas 33-68 y 163-169 |
| Saldo anterior (`aggregate` con `entryDate < desde`, sin filtro de estado) | `app/api/general-ledger/route.ts` líneas 74-85 |
| Orden cronológico triple y `select` con documentos de origen | `app/api/general-ledger/route.ts` líneas 87-122 |
| Saldo progresivo, `tipoSaldo` (0.004) y `estado` `Registrado`/`Anulado` | `app/api/general-ledger/route.ts` líneas 124-146 |
| `totales`, `saldoFinal` y forma de la respuesta | `app/api/general-ledger/route.ts` líneas 148-162 |
| Referencia (venta/compra/planilla) y `dynamic = "force-dynamic"` | `app/api/general-ledger/route.ts` líneas 6-27 |
| Tipos `GeneralLedger`, `GeneralLedgerMovement` y serializador de query | `lib/services/general-ledger.service.ts` líneas 14-64 |
| Reexportes `listAccountingAccounts`/`getJournalEntry` (plan contable y detalle) | `lib/services/general-ledger.service.ts` líneas 66-75 |
| Pantalla: carga del plan, preselección, debounce y control de carreras | `app/accounting/ledger/page.tsx` líneas 63-115 |
| Rango invertido que suspende la consulta y estados derivados | `app/accounting/ledger/page.tsx` líneas 59-60, 107-115 y 165-177 |
| Filtros con `max`/`min` y avisos de rango/plan contable | `app/accounting/ledger/components/LedgerFilters.tsx` líneas 96-150 |
| Tabla: skeleton, error con Retry, sin cuenta, sin movimientos, saldo anterior y totales | `app/accounting/ledger/components/LedgerTable.tsx` líneas 94-258 |
| Clic en fila → detalle del asiento y badge "Cancelled" | `app/accounting/ledger/components/LedgerTable.tsx` líneas 211-239 |
| Pruebas del endpoint (18 casos, incl. anulados, formatos, rango invertido, 500) | `app/api/general-ledger/route.test.ts` líneas 72-343 |
| Pruebas del servicio (7 casos: query, sin caché, propagación de errores) | `lib/services/general-ledger.service.test.ts` líneas 51-116 |
| Enlace "Libro Mayor" del sidebar | `components/personalized/Sidebar.tsx` líneas 310-318 |

**Fuera de alcance**: alta/modificación de asientos (specs `001`/`002`), plan contable (spec
`003`), balance (spec `007`) y el diálogo de detalle del asiento en sí mismo (pantalla de
asientos).

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
