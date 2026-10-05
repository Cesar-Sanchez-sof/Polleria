# Feature Specification: Ver Mesas (Salón de Mesas)

**Feature Branch**: `006-ver-mesas`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *ver mesas*, describiendo el comportamiento real implementado."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y por las pruebas automatizadas
> (`test/gestion-mesas.test.ts`), referenciadas en
> [Evidencia de verificación](#evidencia-de-verificación). No se describen funcionalidades
> futuras ni reglas ausentes en la implementación. Acciones que **modifican** datos (tomar,
> modificar, anular comandas, cobrar) quedan **fuera de alcance**: aquí sólo se documenta la
> **consulta** del salón.

---

## Purpose

Mostrar el estado actual del salón: todas las mesas con su aforo, su ocupación y, cuando están
ocupadas, la comanda activa (código, hora, estado de cocina, platos y total). Es la pestaña
predeterminada del módulo de Ventas.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el estado de todas las mesas (Priority: P1)

Como mozo o encargado de salón, quiero abrir el módulo de Ventas y ver de un vistazo qué mesas
están libres y cuáles ocupadas con su cuenta, para saber a dónde atender primero.

**Why this priority**: es la pantalla de entrada del módulo (`/sales` sin parámetros muestra esta
pestaña) y alimenta el conteo de ocupación usado por el resto del módulo.

**Independent Test**: `GET /api/tables` → `200` con `{ data: [...], summary: { total, available,
occupied } }`, cada mesa con `id`, `number`, `capacity`, `occupied` y `activeOrder`.

**Acceptance Scenarios**:

1. **Given** hay 12 mesas y 2 con pedido activo, **When** se solicita `GET /api/tables`,
   **Then** se responde `200` con `summary = { total: 12, available: 10, occupied: 2 }` y las
   mesas ordenadas por `number` ascendente.
2. **Given** una mesa con un pedido cuyo estado es `Received`, `Preparing` o `Served`,
   **When** se solicita, **Then** `occupied: true` y `activeOrder` incluye código, hora, platos,
   total y `editable`.
3. **Given** una mesa sin pedidos (o cuyos pedidos están `Closed`/`Cancelled`), **When** se
   solicita, **Then** `occupied: false` y `activeOrder: null`.
4. **Given** la base de datos falla, **When** se solicita, **Then** se responde `500` con
   `{ "error": "No se pudo obtener la información de las mesas." }` y se loguea
   `[api/tables] Error al listar mesas:`.
5. **Given** que no hay autenticación en la ruta, **When** se solicita sin sesión, **Then** se
   responde `200` igual que con sesión.

---

### User Story 2 - Filtrar el salón por estado (Priority: P2)

Como usuario, quiero filtrar el salón por "Todas", "Disponibles" u "Ocupadas" para encontrar
rápidamente una mesa libre o revisar sólo las cuentas abiertas.

**Why this priority**: es una comodidad sobre la P1; no depende de llamadas adicionales.

**Independent Test**: con el listado cargado, activar "Ocupadas" → sólo se renderizan las tarjetas
con `occupied: true`, sin nueva petición a la API.

**Acceptance Scenarios**:

1. **Given** el salón cargado, **When** se pulsa "Disponibles (N)", **Then** se muestran sólo las
   mesas libres y el número `N` corresponde a `summary.available`.
2. **Given** un filtro que no deja resultados, **When** se aplica, **Then** la cuadrícula queda
   vacía **sin** mensaje de "sin resultados" (no existe ese estado vacío en el código).

---

### User Story 3 - Refrescar el salón a mano (Priority: P2)

Como usuario, quiero pulsar el botón de refrescar para ver el estado actualizado de las mesas sin
recargar la página.

**Why this priority**: no hay sondeo automático; sin este botón el usuario no podría ver cambios
producidos en otro navegador.

**Independent Test**: pulsar el ícono de refrescar en el encabezado → se dispara `loadData()` y el
ícono gira mientras `loading` es verdadero.

**Acceptance Scenarios**:

1. **Given** la pantalla abierta, **When** se pulsa "Refrescar datos", **Then** se repiten en
   paralelo las 7 peticiones de carga (`listTables`, `listOrders` ×2, `listDishes`,
   `listPaymentTypes`, `listCustomers`, `listDailySales`) y el estado de mesas se sobrescribe.
2. **Given** que alguna petición falla, **When** termina la carga, **Then** se muestra un toast de
   error (`err.message` o "Error al conectar con la base de datos.") y `loading` pasa a `false`.

---

### Edge Cases

- **Mesa con varios pedidos activos**: la API toma **sólo** `m.orders[0]` (sin `orderBy` sobre la
  relación), por lo que si hubiera más de uno activo se muestra uno de ellos de forma
  no determinista.
- **Mesa desactivada (`active: false`)**: el `findMany` **no filtra** por `active`, así que las
  mesas inactivas también se listan y cuentan en el resumen.
- **Pedido `Served`**: sigue contando como **ocupada** (no está en `CLOSED_STATUSES`), pero su
  `editable` es `false` → el botón "Modificar" aparece deshabilitado.
- **Total de la cuenta**: se recalcula en el servidor sumando `subtotal` de cada línea
  (`items.reduce`), no se lee de una columna de total (el modelo `SalesOrder` no tiene total).
- **Sin estado de carga propio en la pestaña**: mientras `loading` es verdadero sólo gira el ícono
  de refrescar; la cuadrícula se pinta con el estado (inicialmente vacío) hasta que llegan los
  datos.
- **Recuento de ocupación en cliente**: `summary` viene del servidor; el helper
  `calculateTablesSummary()` existe en `lib/utils/sales-helpers.ts` pero sólo lo usan las pruebas.
- **Sin sondeo**: no hay `setInterval` de datos (el único intervalo es el reloj del encabezado).
  El salón sólo se actualiza al montar, al refrescar a mano o tras una acción que llama
  `loadData()`.

---

## Functionalities

- **GET `/api/tables`** devuelve todas las mesas ordenadas por número, con su comanda activa y un
  resumen de ocupación.
- La pestaña "Salón de mesas" (`/sales?tab=tables`, predeterminada) renderiza una tarjeta por mesa
  con aforo, estado (Libre/Ocupada), detalle de la comanda (código, hora, estado de cocina,
  observación, platos, total) y botones de acción hacia otras funcionalidades.
- Filtros locales de salón: Todas / Disponibles / Ocupadas.
- Botón de refrescar en el encabezado del módulo.
- Leyenda de estados de cocina: Recibido / Preparando / Servido.

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Mesa ocupada** | Una mesa está ocupada si tiene un `OrderTable` cuyo pedido **no** está en `Closed` ni `Cancelled` (`CLOSED_STATUSES = ["Closed", "Cancelled"]`). |
| BR-2 | **Único pedido visible** | De los vínculos activos de la mesa sólo se expone `orders[0]` (sin orden explícito). |
| BR-3 | **Editable** | `activeOrder.editable = status !== "Served" && status !== "Closed"` (los `Cancelled` ya fueron excluidos en BR-1). Coincide con la regla de `canEditOrder()` (Received/Preparing/Pending son editables). |
| BR-4 | **Total** | `total = Σ item.subtotal` recalculado en el servidor con redondeo natural de los decimales. |
| BR-5 | **Resumen de ocupación** | `total = mesas.length`, `occupied = mesas con activeOrder`, `available = total − occupied`; se calcula en el servidor y viaja en `summary`. |
| BR-6 | **Orden** | Las mesas se devuelven ordenadas por `number` ascendente. |
| BR-7 | **Aforo** | `capacity` (por defecto 4, SmallInt); visible en la tarjeta como "Aforo N". |
| BR-8 | **Sin control de acceso** | `GET /api/tables` no valida sesión, cookie ni rol (no hay middleware activo). |
| BR-9 | **Mesas inactivas visibles** | No hay filtro por `active`, por lo que las mesas desactivadas se listan igual. |

## Endpoint

| Method | Path | Summary |
|--------|------|---------|
| GET | `/api/tables` | Lista las mesas con su pedido activo y el resumen de ocupación. |

### Request

Sin cuerpo ni parámetros. La función no utiliza la petición (`GET(_request)`), por lo que cualquier
query string no tiene efecto.

### Response (200)

```json
{
  "data": [
    {
      "id": 1,
      "number": 1,
      "capacity": 4,
      "occupied": true,
      "activeOrder": {
        "id": 15,
        "orderTableId": 7,
        "code": "PED-0015",
        "orderType": "Mesa",
        "orderedAt": "2026-10-05T19:12:00.000Z",
        "status": "Preparing",
        "tableNotes": "",
        "items": [
          {
            "id": 31,
            "dishId": 2,
            "name": "1/2 pollo",
            "quantity": 1,
            "unitPrice": 35,
            "subtotal": 35,
            "dishStatus": "Pending",
            "notes": ""
          }
        ],
        "total": 35,
        "editable": true
      }
    },
    {
      "id": 2,
      "number": 2,
      "capacity": 4,
      "occupied": false,
      "activeOrder": null
    }
  ],
  "summary": { "total": 12, "available": 11, "occupied": 1 }
}
```

### Errors

| Status | Condition | Body |
|--------|-----------|------|
| 500 | Excepción inesperada al consultar la base de datos | `{ "error": "No se pudo obtener la información de las mesas." }` |

No existen respuestas `400`/`404`: la operación no acepta entradas.

## Permissions

- **Requerido**: ninguno. La ruta no usa `requireRole` ni verifica sesión/cookie, y no existe
  middleware de autorización activo en el proyecto (`middleware.ts` inexistente,
  `proxy.ts.desactivado`).
- En la práctica cualquier cliente que alcance la aplicación puede ver el salón y sus montos.
- El enlace "Salón de mesas" del sidebar (`/sales?tab=tables`) no aplica filtro de rol.

## Validations

- No hay validaciones de entrada (endpoint sin parámetros ni cuerpo).
- Cualquier excepción se captura y responde `500` con el mensaje documentado, registrándola con
  `console.error("[api/tables] Error al listar mesas:", error)`.

## Acceptance Criteria

1. **When** se llama `GET /api/tables` **Then** se recibe `200` con `{ data, summary }`, mesas
   ordenadas por `number` y cada una con `id`, `number`, `capacity`, `occupied`, `activeOrder`.
2. **When** una mesa tiene pedido activo **Then** `occupied: true` y `activeOrder` expone código,
   tipo, hora, estado, notas de mesa, ítems (`name`, `quantity`, `unitPrice`, `subtotal`,
   `dishStatus`, `notes`), `total` y `editable`.
3. **When** todos los pedidos de una mesa están `Closed` o `Cancelled` **Then** la mesa aparece
   libre (`occupied: false`, `activeOrder: null`) y baja el contador `occupied` del resumen.
4. **When** el usuario cambia el filtro del salón **Then** sólo se altera el renderizado local;
   no se emiten nuevas peticiones.
5. **When** se pulsa el refrescar del encabezado **Then** se vuelve a pedir `/api/tables` y el
   ícono anima durante la carga.
6. **When** la base de datos falla **Then** la API responde `500` con el mensaje documentado y la
   UI muestra un toast de error.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Exponer `GET /api/tables` con la lista de mesas y su resumen de ocupación.
- **FR-002**: Marcar como ocupada toda mesa con un pedido no cerrado ni cancelado.
- **FR-003**: Devolver el pedido activo con su detalle de platos, total y bandera `editable`.
- **FR-004**: Ordenar las mesas por número y ofrecer `summary { total, available, occupied }`.
- **FR-005**: Mostrar en la pestaña "Salón de mesas" una tarjeta por mesa con aforo, estado
  (Libre/Ocupada), detalle de comanda y acciones (cobrar, modificar, enviar a ventanilla,
  anular) — estas acciones pertenecen a otras features.
- **FR-006**: Permitir filtrar localmente por Todas / Disponibles / Ocupadas.
- **FR-007**: Permitir refrescar manualmente todos los datos del módulo.
- **FR-008**: Manejar errores con respuesta `500` y toast en la UI.

### Non-Functional Requirements

- **NFR-001**: La ruta es dinámica (`export const dynamic = "force-dynamic"`) y el front-end usa
  `fetch(..., { cache: "no-store" })`, por lo que la respuesta nunca se sirve de caché.
- **NFR-002**: La carga inicial hace **una sola** petición de mesas dentro de un `Promise.all` de
  7 peticiones paralelas (no hay N+1 ni consultas por mesa).
- **NFR-003**: No hay sondeo automático ni websockets: la frescura del dato depende del refresco
  manual o de las acciones que vuelven a llamar `loadData()`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una sola llamada a `GET /api/tables` permite pintar todo el salón (estado + detalle
  de comandas + resumen) sin peticiones adicionales por mesa.
- **SC-002**: `summary.occupied + summary.available === summary.total` en toda respuesta exitosa.
- **SC-003**: Cualquier comanda `Closed`/`Cancelled` deja de ocupar su mesa en el siguiente
  refresco (el contador disminuye).
- **SC-004**: Ante un fallo de base de datos el usuario recibe un mensaje de error visible
  (toast) en lugar de una pantalla silenciosa.

---

## Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US1 Consultar estado (1-5) | `GET` en `app/api/tables/route.ts` |
| FR-002 | US1 escenarios 2-3 | `CLOSED_STATUSES` + `occupied: Boolean(activeOrder)` |
| FR-003 | US1 escenario 2 | Bloque `activeOrder` (items, total, editable) |
| FR-004 | US1 escenario 1 | `orderBy: { number: "asc" }` y bloque `summary` |
| FR-005 | US1 (UI) | Pestaña `activeTab === "tables"` en `app/sales/page.tsx` |
| FR-006 | US2 | `tableFilter` + `filteredTables` (`useMemo`, sin red) |
| FR-007 | US3 | Botón "Refrescar datos" → `loadData()` |
| FR-008 | US1 escenario 4 / US3 escenario 2 | `catch` → 500; `toast.error` en `loadData` |

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| Sin `where` en el `findMany` (se listan mesas inactivas) | `app/api/tables/route.ts` líneas 10-31 |
| `CLOSED_STATUSES = ["Closed", "Cancelled"]` | `app/api/tables/route.ts` línea 6 |
| Sólo se toma `m.orders[0]` (sin `orderBy` de la relación) | `app/api/tables/route.ts` línea 35 |
| `total` = suma de `subtotal` y `editable = status !== "Served" && status !== "Closed"` | `app/api/tables/route.ts` líneas 51-65 |
| `summary { total, available, occupied }` y respuesta `{ data, summary }` | `app/api/tables/route.ts` líneas 77-87 |
| Error `500` y log `[api/tables] Error al listar mesas:` | `app/api/tables/route.ts` líneas 88-94 |
| `dynamic = "force-dynamic"` | `app/api/tables/route.ts` línea 4 |
| Tipos `TableItem` / `TablesSummary` y `listTables()` con `cache: "no-store"` | `lib/services/tables.service.ts` líneas 40-63 y 172-180 |
| Filtro local Todas/Disponibles/Ocupadas | `app/sales/page.tsx` líneas 141 y 316-320 |
| Pestaña predeterminada `tables` y sincronía con `?tab=` | `app/sales/page.tsx` líneas 84-105 |
| Contadores en los botones de filtro (usan `summary`) | `app/sales/page.tsx` líneas 1127-1145 |
| Tarjeta de mesa: aforo, badge Libre/Ocupada, detalle de comanda, total | `app/sales/page.tsx` líneas 1165-1305 |
| Sin estado vacío para el filtro (cuadrícula sin mensaje) | `app/sales/page.tsx` (no hay condición sobre `filteredTables.length`) |
| Botón "Refrescar datos" → `loadData()`; ícono gira con `loading` | `app/sales/page.tsx` líneas 1014-1022 |
| Carga en paralelo de 7 fuentes y `toast.error` | `app/sales/page.tsx` líneas 150-180 |
| Único `setInterval` es el reloj (no hay sondeo de mesas) | `app/sales/page.tsx` líneas 108-119 |
| `canEditOrder()` y `calculateTablesSummary()` (sólo usados por pruebas) | `lib/utils/sales-helpers.ts` líneas 114-138 |
| Pruebas de edición de comanda y de ocupación del salón | `test/gestion-mesas.test.ts` secciones 4 y 5 |
| Modelos `DiningTable`, `SalesOrder`, `OrderTable`, `OrderItem` | `prisma/schema.prisma` líneas 422-500 |
| Enlace "Salón de mesas" del sidebar → `/sales?tab=tables` | `components/personalized/Sidebar.tsx` líneas 138-146 |
| Semilla de 12 mesas | `prisma/seed.ts` línea 86 |

**Fuera de alcance de esta especificación** (documentadas en otras features o pendientes):
tomar/editar/anular comandas, cambiar estado de cocina desde la tarjeta, cobros (mozo y
ventanilla) y creación de pedidos "Para Llevar".

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
