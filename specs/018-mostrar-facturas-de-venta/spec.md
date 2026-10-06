# Feature Specification: Mostrar Facturas de Venta

**Feature Branch**: `018-mostrar-facturas-de-venta`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *mostrar
facturas de venta* (listado de comprobantes emitidos con resumen del día y ticket imprimible),
describiendo el comportamiento real implementado."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y por las pruebas del resumen diario
> (`test/gestion-mesas.test.ts`, bloque de `calculateDailySalesSummary`), con evidencia en
> [Evidencia de verificación](#evidencia-de-verificación). No se describen funcionalidades
> futuras ni reglas ausentes en la implementación. El **cobro** que genera estas facturas es
> otra feature (POST `/api/sales`, fuera de alcance); aquí sólo se documenta su
> **visualización**.

---

## Purpose

Mostrar los comprobantes de venta emitidos (Boleta/Factura/Ticket) con su detalle, filtrarlos
por fecha, ofrecer un resumen de lo recaudado del día y permitir ver/imprimir el ticket
térmico de cada comprobante.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver los comprobantes emitidos (Priority: P1)

Como cajero, quiero ver los comprobantes emitidos con su número, fecha, cliente, origen,
método de pago y total para revisar las ventas.

**Why this priority**: es el contenido central de la pestaña.

**Independent Test**: `GET /api/sales?date=today` → `200` con `{ data: [...], dailySummary }`.

**Acceptance Scenarios**:

1. **Given** comprobantes emitidos hoy, **When** se consulta con `date=today` (o `hoy`),
   **Then** se devuelven los de ese día (00:00:00.000 a 23:59:59.999 por `createdAt`) con
   `fullCode`, cliente, `origin`, `paymentMethod`, `total` y `items`.
2. **Given** `date=todas` (o `all`), **When** se consulta, **Then** no se aplica filtro de
   fecha y se devuelven hasta 150 registros (`id` descendente).
3. **Given** no hay comprobantes para el filtro, **When** se abre la pestaña, **Then** la
   tabla muestra "No se han emitido comprobantes para la fecha seleccionada."
4. **Given** un fallo de la base de datos (o una fecha con formato inválido), **When** se
   consulta, **Then** `500`
   `{ "error": "No se pudieron obtener las ventas registradas." }`.
5. **Given** cualquier usuario sin sesión, **When** consulta, **Then** la petición se procesa
   igual (no hay autenticación).

---

### User Story 2 - Ver el resumen recaudado del día (Priority: P1)

Como encargado de caja, quiero ver lo recaudado y su desglose por método de pago para el
arqueo.

**Why this priority**: el resumen viaja en la misma respuesta que el listado.

**Independent Test**: `dailySummary.totalRecaudado` coincide con la suma de `total` de `data`
y `desgloseMetodos` separa efectivo/yape/tarjeta/otros.

**Acceptance Scenarios**:

1. **Given** ventas del día, **When** se carga la pestaña, **Then** aparecen 4 tarjetas:
   "Total Recaudado" (con "N comprobantes emitidos"), "Efectivo en Caja", "Yape QR" y "POS /
   Tap to Pay".
2. **Given** un comprobante pagado con un método que no contiene "efectivo"/"yape"/
   "tarjeta"/"pos", **When** se resume, **Then** su importe cae en `desgloseMetodos.otros`.
3. **Given** comprobantes de distinto tipo, **When** se resume, **Then**
   `desgloseComprobantes` cuenta boletas, facturas y tickets por separado.

---

### User Story 3 - Ver e imprimir el ticket (Priority: P2)

Como usuario, quiero abrir el ticket de un comprobante y mandarlo a la ticketera para
entregarle una copia al cliente.

**Why this priority**: es la única acción de la tabla.

**Independent Test**: botón "Ver Ticket" → modal con formato 80 mm y "Imprimir en
Ticketera" (`window.print()`).

**Acceptance Scenarios**:

1. **Given** la lista cargada, **When** se pulsa "Ver Ticket", **Then** se abre el modal
   "Comprobante Emitido" con número, fecha, cliente, doc, origen, ítems, op. gravada, I.G.V.
   (18 %), total y método de pago.
2. **Given** el ticket abierto, **When** se pulsa "Imprimir en Ticketera", **Then** se invoca
   `window.print()` (la cabecera y el pie del modal llevan clase `no-print`).
3. **Given** el ticket abierto, **When** se pulsa "Cerrar", **Then** el modal se cierra sin
   efectos adicionales.

---

### Edge Cases

- **Filtro por `createdAt`, no por `issuedAt`**: el rango se aplica al campo de creación y la
  fecha mostrada (`issuedAt` en la respuesta) **también se rellena con `createdAt`**.
- **Tope de 150 registros**: no hay paginación; "Todas las Fechas" devuelve como máximo las
  150 más recientes y el `dailySummary` se calcula **sobre esa muestra** (no sobre el total
  real).
- **Pago en partes**: `paymentMethod` toma **sólo `payments[0]`**, por lo que la fila y el
  desglose reflejan únicamente el primer método (los importes de los demás no se reparten).
- **Vuelto ficticio**: el GET responde `amountReceived = totalAmount` y `change = 0`, así que
  el ticket **nunca muestra VUELTO** para los comprobantes listados.
- **Datos de empresa hardcodeados en el ticket**: "POLLERÍA RESTAURANTE", `RUC:
  20601234567` y dirección fijos en el componente (no vienen de base de datos).
- **`status` recibido pero no mostrado**: la respuesta incluye `status` ("Issued") y la tabla
  no lo renderiza; no existe anulación/devolución de facturas (no hay `PATCH`/`DELETE` en
  `/api/sales`).
- **Fecha con formato inválido**: no se valida → `new Date("valor raro")` produce un rango
  inválido y la consulta falla en el `500` documentado.
- **Alias de idioma**: `date`/`fecha`, `today`/`hoy`, `all`/`todas`.
- **Recarga total al cambiar el filtro**: el estado `salesDateFilter` forma parte de
  `loadData`, por lo que pulsar "Hoy"/"Todas las Fechas" reejecuta **las 7 peticiones** del
  módulo (mesas, pedidos, platos, tipos de pago, clientes y ventas).
- **`gateway` no viaja en el GET**: sólo la respuesta del POST incluye datos de la pasarela;
  el ticket no los muestra.
- **`desgloseComprobantes` y `otros` no tienen tarjeta** en la UI (se calculan pero no se
  pintan).
- **Sin control de acceso**: ni `GET` ni `POST /api/sales` validan sesión, cookie ni rol (no
  hay middleware activo).

---

## Functionalidades / Functionalities

- **`GET /api/sales`**: listado de comprobantes (máx. 150) + resumen diario.
- **Pestaña "Ventas Diarias & Facturas (N)"** (`/sales?tab=invoices`; sidebar "Facturas de
  Venta"): tarjetas KPI, filtro de fecha y tabla de comprobantes.
- **Modal "Comprobante Emitido"**: ticket térmico 80 mm con impresión.

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Filtro de fecha por creación** | `today`/`hoy` → día completo; `all`/`todas` → sin filtro; otro valor se interpreta como fecha `AAAA-MM-DD` sobre `createdAt`. |
| BR-2 | **Orden y tope** | `id` descendente, máximo 150 comprobantes, sin paginación. |
| BR-3 | **Formato del número** | `fullCode = <serie>-<número con 6 dígitos>` (p. ej. `B001-000451`). |
| BR-4 | **Origen** | `Mesa N` si el pedido tiene mesa; `Pedido Para Llevar` en caso contrario. |
| BR-5 | **Método de pago visible** | Nombre del primer pago; si no hay, `"Efectivo"`. |
| BR-6 | **Resumen por nombre de método** | Clasificación textual: contiene "efectivo" → efectivo; "yape" → yape; "tarjeta" o "pos" → tarjeta; resto → otros. |
| BR-7 | **Resumen por tipo de comprobante** | Contiene "factura" → facturas; "ticket" → tickets; resto → boletas. |
| BR-8 | **Ticket 80 mm** | Op. gravada + I.G.V. 18 % + total; impresión con `window.print()` ocultando cabecera y pie. |
| BR-9 | **Sin control de acceso** | No se valida sesión, cookie ni rol. |

## Endpoint

| Method | Path | Summary |
|--------|------|---------|
| GET | `/api/sales` | Lista comprobantes emitidos y su resumen. |

### Request

| Parámetro | Alias | Valores | Efecto |
|-----------|-------|---------|--------|
| `date` | `fecha` | `today` / `hoy` | Filtra el día de hoy. |
| | | `all` / `todas` | Sin filtro de fecha. |
| | | `AAAA-MM-DD` | Filtra ese día. |

Sin cuerpo.

### Response (200)

```json
{
  "data": [
    {
      "id": 12,
      "orderId": 34,
      "voucherType": "Boleta",
      "series": "B001",
      "number": 451,
      "fullCode": "B001-000451",
      "issuedAt": "2026-10-05T19:12:00.000Z",
      "subtotal": 84.75,
      "igv": 15.25,
      "total": 100,
      "status": "Issued",
      "paymentMethod": "Efectivo",
      "amountReceived": 100,
      "change": 0,
      "customer": { "id": 3, "firstName": "JUAN PEREZ", "documentNumber": "47829103", "personType": "Natural" },
      "origin": "Mesa 3",
      "items": [ { "name": "1/4 Pollo a la Brasa", "quantity": 2, "unitPrice": 18, "subtotal": 36, "notes": "" } ]
    }
  ],
  "dailySummary": {
    "totalRecaudado": 100,
    "cantidadVentas": 1,
    "desgloseMetodos": { "efectivo": 100, "yape": 0, "tarjeta": 0, "otros": 0 },
    "desgloseComprobantes": { "boletas": 1, "facturas": 0, "tickets": 0 }
  }
}
```

### Errors

| Status | Condition | Body |
|--------|-----------|------|
| 500 | Excepción (BD o fecha inválida) | `{ "error": "No se pudieron obtener las ventas registradas." }` |

No existen respuestas `400`/`401`/`403`/`404` en este método.

## Permissions

- **Requerido**: ninguno. `GET /api/sales` no usa `requireRole` ni verifica sesión/cookie, y
  no existe middleware de autorización activo (`middleware.ts` inexistente,
  `proxy.ts.desactivado`).
- Cualquier cliente que alcance la aplicación puede leer los comprobantes con sus importes,
  clientes y documentos.
- La pestaña y el enlace "Facturas de Venta" del sidebar no aplican filtro de rol.

## Validations

- **Servidor**: ninguna de entrada; todo lo no interpretable como fecha se degrada al `500`
  documentado (log `[api/sales] Error al listar comprobantes y ventas:`).
- **Cliente**: sin validaciones; sólo estados de carga (`loading`) y toast de error
  (`err.message || "Error al conectar con la base de datos."`).

## Acceptance Criteria

1. **When** se elige "Hoy" **Then** sólo aparecen los comprobantes creados hoy y los KPIs
   corresponden a ese día.
2. **When** se elige "Todas las Fechas" **Then** se listan hasta 150 comprobantes recientes y
   el resumen refleja esa lista.
3. **When** hay comprobantes **Then** cada fila muestra `fullCode`, tipo, fecha localizada,
   cliente + documento, origen, método, total y el botón "Ver Ticket".
4. **When** no hay comprobantes **Then** se muestra el estado vacío documentado.
5. **When** se abre un ticket **Then** contiene ítems, op. gravada, I.G.V. 18 %, total y
   método de pago, y puede imprimirse.
6. **When** la consulta falla **Then** se informa el mensaje exacto del `500`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Exponer `GET /api/sales` con los alias de fecha, tope de 150, orden `id`
  descendente y join de cliente, pagos y pedido (con mesas e ítems).
- **FR-002**: Normalizar cada comprobante a `fullCode`, `origin`, `paymentMethod` (primer
  pago), `items[]` y `dailySummary`.
- **FR-003**: Calcular `dailySummary` con total recaudado, desglose por método y conteo por
  tipo de comprobante.
- **FR-004**: Mostrar en la pestaña las 4 tarjetas KPI con el resumen del filtro activo.
- **FR-005**: Mostrar la tabla de comprobantes con badge de tipo, fecha localizada, cliente,
  origen, método, total y estado vacío.
- **FR-006**: Permitir alternar el filtro "Hoy"/"Todas las Fechas" recargando los datos.
- **FR-007**: Abrir el ticket 80 mm de cualquier comprobante e imprimirlo con
  `window.print()`.

### Non-Functional Requirements

- **NFR-001**: `export const dynamic = "force-dynamic"` en la ruta y `cache: "no-store"` en
  el servicio cliente.
- **NFR-002**: Sin paginación: una sola carga con tope de 150; el resumen se deriva de esa
  misma lista (sin consulta agregada en BD).
- **NFR-003**: Sin autenticación y sin operaciones de escritura en este método.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `dailySummary.totalRecaudado` coincide con `Σ total` de `data` y
  `cantidadVentas === data.length`.
- **SC-002**: Cada fila de la tabla corresponde a un registro de `data` con los 7 campos
  visibles.
- **SC-003**: Cambiar el filtro produce siempre una lista y un resumen coherentes entre sí.
- **SC-004**: El ticket abierto reproduce ítems e importes del comprobante seleccionado
  (mismo `fullCode`).
- **SC-005**: Ante un fallo se informa el mensaje exacto documentado (500).

---

## Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US1 escenarios 1-2 | `GET` de `app/api/sales/route.ts` (fechas, `take: 150`) |
| FR-002 | US1 escenario 1 | `formattedList` (map de comprobantes) |
| FR-003 | US2 escenarios 1-3 | `calculateDailySalesSummary` |
| FR-004 | US2 escenario 1 | Tarjetas KPI de la pestaña `invoices` |
| FR-005 | US1 escenario 3 | Tabla "Comprobantes de Venta Emitidos" |
| FR-006 | US1 (filtro) | `salesDateFilter` + `loadData` |
| FR-007 | US3 escenarios 1-3 | Modal del ticket y botón "Imprimir en Ticketera" |

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| `GET` completo: alias, rango por `createdAt`, `take: 150`, joins y respuesta | `app/api/sales/route.ts` líneas 353-459 |
| `dailySummary` calculado sobre la lista formateada | `app/api/sales/route.ts` líneas 447-454 |
| Error `500` y log `[api/sales] Error al listar comprobantes y ventas:` | `app/api/sales/route.ts` líneas 460-466 |
| `dynamic = "force-dynamic"` y ausencia de autenticación | `app/api/sales/route.ts` líneas 1-6 |
| Clasificación por método y por tipo de comprobante | `lib/utils/sales-helpers.ts` líneas 150-201 |
| Servicio `listDailySales` (`date`/`fecha`, `no-store`, manejo de error) | `lib/services/tables.service.ts` líneas 360-369 |
| Tipo `IssuedVoucher` (campos usados por la UI) | `lib/services/tables.service.ts` líneas 76-107 |
| Carga con `salesDateFilter` dentro de `loadData` (7 peticiones) | `app/sales/page.tsx` líneas 150-180 |
| Estado del filtro y de los comprobantes | `app/sales/page.tsx` líneas 131-144 |
| Etiqueta de la pestaña y enlace del sidebar "Facturas de Venta" | `app/sales/page.tsx` líneas 1106-1108; `components/personalized/Sidebar.tsx` líneas 174-182 |
| Tarjetas KPI (recaudado, efectivo, Yape, POS/Tap to Pay) | `app/sales/page.tsx` líneas 2289-2349 |
| Filtro Hoy/Todas las Fechas, badge y tabla con estado vacío | `app/sales/page.tsx` líneas 2351-2469 |
| Botón "Ver Ticket" | `app/sales/page.tsx` líneas 2450-2463 |
| Modal de ticket 80 mm, datos hardcodeados y `window.print()` | `app/sales/page.tsx` líneas 3234-3358 |
| Pruebas del resumen diario (totales y conteos de comprobantes) | `test/gestion-mesas.test.ts` sección 6, líneas 146-165 |

**No existen pruebas automatizadas del método `GET /api/sales`.**

**Fuera de alcance**: emisión/cobro de la venta (POST `/api/sales`, pasarelas y pago en
partes), creación de clientes (spec `016`), anulación de comprobantes (no existe) y reportes
contables derivados.

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
