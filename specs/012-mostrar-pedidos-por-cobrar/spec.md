# Feature Specification: Mostrar Pedidos por Cobrar (Cobros No Cobrados)

**Feature Branch**: `012-mostrar-pedidos-por-cobrar`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *mostrar
pedidos por cobrar* (listado de comandas activas sin cobrar con su importe total), describiendo
el comportamiento real implementado."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y por las pruebas de negocio que cubren la regla
> de inclusión/exclusión (`test/gestion-mesas.test.ts`, sección 7), referenciadas en
> [Evidencia de verificación](#evidencia-de-verificación). No se describen funcionalidades
> futuras ni reglas ausentes en la implementación. El **cobro** (mozo/ventanilla), la cancelación
> (spec `010`) y el listado de pedidos son features separadas: aquí sólo se documenta la
> **visualización** de lo pendiente.

---

## Purpose

Mostrar en una sola vista todas las comandas activas que aún no se han cobrado —mesas ocupadas y
pedidos para llevar— con su detalle, su importe total por cobrar y los accesos a las acciones de
cobro/cancelación.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el listado de cuentas pendientes (Priority: P1)

Como encargado de caja, quiero ver todas las comandas sin cobrar y el importe total acumulado
para saber cuánto falta por recaudar.

**Why this priority**: es el contenido único de esta pantalla; depende de los datos de salón y de
pedidos para llevar.

**Independent Test**: con mesas ocupadas y pedidos "Llevar" activos, ir a
`/sales?tab=payments` → banner con "N Pendientes" y `formatCurrency(totalPorCobrar)`.

**Acceptance Scenarios**:

1. **Given** 2 mesas ocupadas (una en `Received` y otra en `Served`) y 1 pedido "Llevar" en
   `Preparing`, **When** se abre la pestaña, **Then** se muestran 3 tarjetas y el banner indica
   "3 Pendientes" con la suma de sus totales.
2. **Given** no hay comandas activas, **When** se abre, **Then** aparece el estado vacío
   "¡Al día! No hay cuentas pendientes de cobro".
3. **Given** un pedido "Llevar" `Closed`, **When** se abre, **Then** **no** aparece en el listado
   (tampoco los `Cancelled`).
4. **Given** una mesa con comanda `Closed` (ya cobrada), **When** se abre, **Then** su mesa
   aparece como libre y no genera tarjeta.
5. **Given** una falla de la API, **When** se carga, **Then** se muestra un toast de error y la
   pantalla conserva el último estado cargado.

---

### User Story 2 - Identificar cada cuenta pendiente (Priority: P1)

Como usuario, quiero ver en cada tarjeta la mesa o código, el estado de cocina, la hora, los
platos y el total, para reconocer de qué cuenta se trata.

**Why this priority**: es la información mínima para decidir cobro o cancelación.

**Independent Test**: cada tarjeta muestra identificador, badge de estado, código, hora, líneas
con subtotal y "Total a Cobrar".

**Acceptance Scenarios**:

1. **Given** una tarjeta de mesa, **When** se muestra, **Then** el identificador es
   `Mesa N` con ícono de cubiertos.
2. **Given** una tarjeta "Para Llevar", **When** se muestra, **Then** el identificador es
   `Para Llevar (PED-…)` con ícono de bolsa.
3. **Given** una comanda `Served`/`Preparing`/`Received`, **When** se muestra, **Then** el badge
   dice "Servido" / "Preparando" / "Recibido" respectivamente.

---

### User Story 3 - Actuar sobre cada cuenta (Priority: P2)

Como usuario, quiero botones de "Cobro Mozo", "Ventanilla" y cancelación en cada tarjeta para
pasar a la acción sin buscar en el salón.

**Why this priority**: son accesos a otras features; esta pantalla sólo los abre.

**Independent Test**: en una tarjeta de mesa se muestran los 3 botones; en "Para Llevar" sólo
"Ventanilla" y cancelar.

**Acceptance Scenarios**:

1. **Given** una tarjeta de mesa, **When** se pulsa "Cobro Mozo", **Then** se abre el modal de
   cobro móvil con el método por defecto `pos`.
2. **Given** cualquier tarjeta, **When** se pulsa "Ventanilla", **Then** se carga la comanda en
   la pestaña Caja (`goToCounterPayment`) con 2 partes de pago por defecto (Efectivo y Yape).
3. **Given** cualquier tarjeta, **When** se pulsa el ícono de cancelar, **Then** se abre el modal
   de cancelación (spec `010`) con sus mismas reglas.

---

### Edge Cases

- **Sin sondeo**: el rótulo "Actualizado en tiempo real" no corresponde a un mecanismo en vivo;
  los datos sólo cambian al montar, al pulsar "Refrescar datos" o tras una acción que llama
  `loadData()`.
- **Dos fuentes de datos**: el listado combina `GET /api/tables` y
  `GET /api/orders?orderType=Llevar&status=activos`; si una falla, `loadData` aborta el conjunto
  y muestra toast (pantalla con datos parciales o vacíos).
- **Comandas de cocina aún no servidas**: cuentan como pendientes aunque nadie haya pedido la
  cuenta (cualquier estado activo incluye).
- **Doble exclusión de cerrados/cancelados**: el servidor ya filtra con `status=activos` y el
  memo vuelve a excluir `Closed`/`Cancelled`.
- **Mesas unidas**: sólo aparece la mesa principal de la comanda (una tarjeta por pedido).
- **Pedidos "Llevar"**: provienen de `listOrders({ orderType: "Llevar", status: "activos" })`;
  los de mesa no se duplican porque no tienen tabla.
- **Importe**: `totalPorCobrar` es la suma de `Σ precio × cantidad` (sin desglose de IGV); el
  IGV sólo se calcula al cobrar.
- **Estado vacío con errata**: el texto real contiene "Todas las **tables** y pedidos para llevar
  se encuentran cobrados y cerrados."
- **Búsqueda**: `allOrders` (listado completo de pedidos) no interviene en esta pestaña.

---

## Functionalities

- **Pestaña "Cobros No Cobrados"** (`/sales?tab=payments`) del módulo de Ventas.
- Banner de 3 tarjetas: comandas pendientes, importe total por cobrar y canales de cobro.
- Listado "Detalle de Comandas Activas Sin Cobrar" con estado vacío cuando no hay pendientes.
- Tarjetas por comanda con estado de cocina, detalle de platos, total y acciones.
- Contador en la pestaña del módulo: `Cobros No Cobrados (N)`.

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Inclusión de mesas** | Toda mesa `occupied` con `activeOrder` genera una pendiente (`tipo: "Mesa"`). |
| BR-2 | **Inclusión "Para Llevar"** | Todo pedido de tipo `Llevar` cuyo estado no sea `Closed` ni `Cancelled` genera una pendiente (`tipo: "Llevar"`). |
| BR-3 | **Exclusión** | Los pedidos `Closed` (cobrados) y `Cancelled` (cancelados) nunca aparecen. |
| BR-4 | **Identificador** | `Mesa N` para salón; `Para Llevar (PED-…)` para ventanilla. |
| BR-5 | **Estado de cocina** | Se traduce a "Servido" / "Preparando" / "Recibido"; otros valores se muestran crudos. |
| BR-6 | **Total por cobrar** | `Σ total` de las comandas pendientes, formateado en PEN (`es-PE`). |
| BR-7 | **Cobro Mozo** | El botón sólo existe para comandas de mesa. |
| BR-8 | **Cálculo en cliente** | No hay endpoint propio: todo se deriva de `GET /api/tables` y `GET /api/orders`. |
| BR-9 | **Sin control de acceso** | La pantalla y sus endpoints no validan sesión, cookie ni rol. |

## Endpoint

Esta feature **no tiene endpoint propio**. Consume:

| Method | Path | Uso |
|--------|------|-----|
| GET | `/api/tables` | Mesas ocupadas con su comanda activa (espec. `006`). |
| GET | `/api/orders?orderType=Llevar&status=activos` | Pedidos para llevar no cerrados/cancelados. |

### Request (complemento de la ruta de pedidos)

| Parámetro | Alias | Valor usado | Efecto |
|-----------|-------|-------------|--------|
| `orderType` | `tipo` | `Llevar` | Sólo pedidos para llevar. |
| `status` | `estado` | `activos` (también acepta `active`) | `status NOT IN ('Closed','Cancelled')`. |

`GET /api/orders` devuelve `{ data: [...] }` con cada pedido en el formato público
`{ id, code, orderType, orderedAt, status, table, notes, items, total, editable }`, ordenado por
`id` descendente.

### Errors

| Status | Condition | Body |
|--------|-----------|------|
| 500 | Fallo en el listado de pedidos | `{ "error": "No se pudieron obtener los pedidos." }` |
| 500 | Fallo en el listado de mesas | `{ "error": "No se pudo obtener la información de las mesas." }` (espec. `006`) |

En la UI cualquier fallo de la carga se informa con un toast
(`err.message || "Error al conectar con la base de datos."`).

## Permissions

- **Requerido**: ninguno. Ni la pantalla ni `GET /api/tables` ni `GET /api/orders` validan
  sesión/cookie/rol; no existe middleware de autorización activo (`middleware.ts` inexistente,
  `proxy.ts.desactivado`).
- Cualquier usuario puede ver los importes pendientes y acceder a cobrar o cancelar.
- El enlace "Cobros No Cobrados" del sidebar (`/sales?tab=payments`) no aplica filtro de rol.

## Validations

- Esta pantalla no valida ni envía datos: sólo lectura y navegación hacia otras acciones.
- El filtro de inclusión/exclusión se aplica en el cliente (memo `uncollectedPayments`).

## Acceptance Criteria

1. **When** se abre la pestaña **Then** el banner muestra el número de comandas pendientes y la
   suma de sus totales formateada en soles.
2. **When** hay comandas activas de mesa y para llevar **Then** aparecen ambas clases con su
   identificador, badge de estado, detalle de platos y total.
3. **When** no hay pendientes **Then** se muestra el estado vacío documentado.
4. **When** una comanda pasa a `Closed` (cobro) o `Cancelled` (cancelación) **Then** desaparece
   del listado en la siguiente recarga y baja el contador.
5. **When** se pulsa una acción **Then** se abre el modal o la pestaña correspondiente sin perder
   el contexto de la comanda seleccionada.
6. **When** la carga falla **Then** el usuario ve un toast con el mensaje del error.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Combinar `tables` y `takeoutOrders` en `uncollectedPayments` con las reglas BR-1 a
  BR-4.
- **FR-002**: Calcular `totalPorCobrar` como suma de los totales pendientes.
- **FR-003**: Mostrar banner (3 tarjetas), listado con estado vacío y tarjetas por comanda con
  badge de estado, detalle de líneas y total.
- **FR-004**: Exponer por tarjeta las acciones "Cobro Mozo" (sólo mesa), "Ventanilla" (todas) y
  cancelación (todas).
- **FR-005**: Mantener el contador de la pestaña `Cobros No Cobrados (N)` sincronizado con el
  listado.
- **FR-006**: Refrescar el listado con `loadData()` tras cada acción del módulo.

### Non-Functional Requirements

- **NFR-001**: Cálculo 100 % en cliente sobre datos ya descargados (sin peticiones por tarjeta).
- **NFR-002**: Sin sondeo ni websockets: la actualización depende de la recarga manual o de las
  acciones del módulo.
- **NFR-003**: Las peticiones subyacentes usan `cache: "no-store"` y las rutas son
  `force-dynamic`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con datos cargados, `pendientes.length` coincide con el contador de la pestaña y
  con el número del banner.
- **SC-002**: Ninguna comanda `Closed` o `Cancelled` aparece en el listado (regla cubierta por
  `test/gestion-mesas.test.ts`).
- **SC-003**: `totalPorCobrar` coincide con la suma manual de los "Total a Cobrar" mostrados.
- **SC-004**: Cada comanda pendiente es accionable (cobro mozo/ventanilla/cancelar) sin salir de
  la pestaña.
- **SC-005**: Al no haber pendientes, el usuario ve el estado vacío en lugar de una lista en
  blanco.

---

## Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US1 escenarios 1, 3-4 | `uncollectedPayments` (`useMemo`) |
| FR-002 | US1 escenario 1 | `totalPorCobrar` (`useMemo`) |
| FR-003 | US1 escenario 2 / US2 | Banner, `Detalle de Comandas Activas Sin Cobrar` y tarjetas |
| FR-004 | US3 escenarios 1-3 | Botones "Cobro Mozo", "Ventanilla" y cancelar |
| FR-005 | US1 escenario 1 | Contador `Cobros No Cobrados (N)` en la barra de pestañas |
| FR-006 | US1 escenario 5 | `loadData()` tras acciones y botón "Refrescar datos" |

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| Construcción del listado (mesas ocupadas + "Llevar" no cerrados) | `app/sales/page.tsx` líneas 359-427 |
| `totalPorCobrar` | `app/sales/page.tsx` líneas 429-431 |
| Fuentes de datos: `listTables()` y `listOrders({ orderType: "Llevar", status: "activos" })` | `app/sales/page.tsx` líneas 150-170 |
| Filtro `status=activos` → `status NOT IN (Closed, Cancelled)` | `app/api/orders/route.ts` líneas 77-88 |
| Formato público del pedido y `editable` | `app/api/orders/route.ts` líneas 26-72 |
| Banner de 3 tarjetas (pendientes, importe, canales) | `app/sales/page.tsx` líneas 1459-1502 |
| Listado, estado vacío (con errata "tables") y "Actualizado en tiempo real" | `app/sales/page.tsx` líneas 1504-1525 |
| Tarjetas: identificador, badge de estado, líneas, total y botones | `app/sales/page.tsx` líneas 1527-1626 |
| Acciones: `openWaiterPayment`, `goToCounterPayment`, `openCancelModal` | `app/sales/page.tsx` líneas 824-836, 703-714 y 608-617 |
| Contador de la pestaña | `app/sales/page.tsx` líneas 1063-1067 |
| Enlace del sidebar "Cobros No Cobrados" | `components/personalized/Sidebar.tsx` líneas 183-191 |
| Sin sondeo (sólo reloj con `setInterval`) | `app/sales/page.tsx` líneas 108-119 |
| Pruebas de inclusión/exclusión de cobros pendientes | `test/gestion-mesas.test.ts` sección 7 (líneas 168-194) |

**Fuera de alcance**: ejecución de cobros (mozo/ventanilla/Tap to Pay/pago en partes),
cancelación (spec `010`), emisión de comprobantes y ventas diarias.

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
