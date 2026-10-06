# Feature Specification: Tomar Pedido (Comanda)

**Feature Branch**: `008-tomar-pedido`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *tomar pedido*
(registrar una comanda nueva, en mesa o para llevar), describiendo el comportamiento real
implementado."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y por las pruebas del servicio de stock
> (`test/redis-stock.test.ts`), referenciadas en
> [Evidencia de verificación](#evidencia-de-verificación). No se describen funcionalidades
> futuras ni reglas ausentes en la implementación. La edición y la cancelación de comandas son
> features separadas (specs `009` y `010`), al igual que el cobro y el listado de pedidos.

---

## Purpose

Registrar una comanda nueva —en mesa (con posibilidad de unir mesas) o para llevar— con sus
platos, cantidades, precios oficiales y reservas de stock, dejándola en estado `Received` para
que pase a cocina.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tomar comanda en una mesa libre (Priority: P1)

Como mozo, quiero tocar una mesa libre y registrar su comanda para que quede ocupada y el pedido
llegue a cocina.

**Why this priority**: es la operación principal del módulo de salón; sin ella no hay pedidos.

**Independent Test**: `POST /api/orders` con `orderType: "Mesa"`, `tableId` válido e `items` no
vacíos → `201` con `{ message: "Pedido registrado con éxito.", order }` y la mesa pasa a ocupada.

**Acceptance Scenarios**:

1. **Given** la Mesa 3 está libre, **When** se envía `POST /api/orders` con `tableId: 3` y un
   plato, **Then** se responde `201`, el pedido tiene `status: "Received"`, `code` `PED-XXXXXXXX`
   y la mesa aparece ocupada en `GET /api/tables`.
2. **Given** la mesa ya tiene un pedido activo, **When** se envía otro pedido para esa mesa,
   **Then** se responde `400` con
   `{ "error": "La Mesa 3 ya tiene un pedido activo en curso." }`.
3. **Given** `tableId` inexistente, **When** se envía, **Then** `404`
   `{ "error": "La mesa especificada no existe." }`.
4. **Given** un pedido en mesa sin `tableId`, **When** se envía, **Then** `400`
   `{ "error": "Debe seleccionar una mesa válida para el pedido en mesa." }`.
5. **Given** `items: []`, **When** se envía, **Then** `400`
   `{ "error": "El pedido debe contener al menos un producto." }`.
6. **Given** que no hay autenticación, **When** se envía sin sesión, **Then** se procesa igual
   (no hay verificación de acceso).

---

### User Story 2 - Unir mesas para un mismo cliente (Priority: P2)

Como mozo, quiero añadir mesas libres a la misma comanda cuando el grupo ocupa varias mesas.

**Why this priority**: es una variante de la P1 con validaciones adicionales.

**Independent Test**: `POST /api/orders` con `tableId` y `additionalTables: [5, 6]` → se crean
los vínculos y en las notas queda `[Mesas unidas: 5, 6]`.

**Acceptance Scenarios**:

1. **Given** mesas adicionales libres, **When** se envían en `additionalTables`, **Then** la
   nota de la mesa incluye `[Mesas unidas: 5, 6]` (números ordenados de forma ascendente) y
   todas quedan con `active: false`.
2. **Given** una mesa adicional ocupada o inactiva, **When** se envía, **Then** `400` con
   `{ "error": "La mesa adicional Mesa 6 ya está ocupada o tiene un pedido activo." }`.
3. **Given** que `additionalTables` incluye el id de la mesa principal, **When** se procesa,
   **Then** se elimina de la lista (el servidor filtra `n !== tableId`).

---

### User Story 3 - Tomar pedido para llevar (Priority: P2)

Como atendedor de ventanilla, quiero registrar un pedido "Para Llevar" sin mesa.

**Why this priority**: segundo tipo de pedido soportado por el mismo endpoint.

**Independent Test**: `POST /api/orders` con `orderType: "Llevar"` (sin `tableId`) → `201` y el
pedido no genera vínculo de mesa.

**Acceptance Scenarios**:

1. **Given** `orderType: "Llevar"`, **When** se envía sin mesa, **Then** se crea el pedido y su
   `table` es `null` en la respuesta.
2. **Given** un valor de `orderType` distinto de `"Llevar"`, **When** se envía, **Then** se
   interpreta como `"Mesa"` (el tipo por defecto).

---

### User Story 4 - Reservar stock de cocina (Priority: P1)

Como cocina, quiero que cada comanda descuente el stock de los platos para no vender más de lo
disponible.

**Why this priority**: protección de inventario aplicada antes de crear el pedido.

**Independent Test**: `reserveOrderStock([{ idPlato, cantidad }])` descuenta atómicamente; si un
plato se agota, devuelve `success: false` y repone los ya descontados (rollback).

**Acceptance Scenarios**:

1. **Given** un plato sin stock suficiente, **When** se envía la comanda, **Then** `400` con el
   mensaje `No se pudo confirmar la comanda: El plato '<nombre>' se acaba de agotar. Solo quedan
   <n> porciones disponibles.` y no se crea el pedido.
2. **Given** que dos comandas compiten por el último plato, **When** se procesan, **Then** sólo
   una obtiene el stock (reserva atómica con script Lua, condición de carrera cubierta por
   pruebas).
3. **Given** que la creación en base de datos falla después de reservar, **When** se produce el
   error, **Then** el stock reservado se devuelve (`releaseDishStock`) y se responde `500`.
4. **Given** que Redis no está configurado, **When** se reserva, **Then** se usa el fallback en
   memoria; si el plato nunca tuvo stock fijado, se permite vender sin restricción.

---

### Edge Cases

- **Cantidad fraccionaria** (p. ej. `1.5`): supera la validación (`quantity >= 1`) pero se
  persiste con `Math.floor` → se registra `1` unidad.
- **Precio del cliente ignorado**: `unitPrice` y `subtotal` se recalculan siempre con el precio
  del plato en base de datos.
- **Colisión de código**: `code = "PED-" + últimos 4 dígitos de Date.now() + aleatorio de 4
  dígitos`; no hay reintento por unicidad, una colisión provocaría un error `500`.
- **Nota de mesa muy larga**: en la creación **no** se trunca (a diferencia de la edición, que
  aplica `.slice(0, 100)`), y la columna `order_table.notes` es `VarChar(100)`.
- **Mesa inactiva como "libre"**: la UI ofrece como candidatas a unir las mesas `!occupied`, sin
  comprobar `active`; el servidor sí rechaza las inactivas → puede devolver `400`.
- **Dos mozos, la misma mesa**: sólo uno gana; el otro recibe `400` de mesa ocupada (la mesa se
  marca `active: false` dentro de la transacción).
- **Sin ítems con notas**: `notes` de cada línea se trunca a 100 caracteres y se guarda `null`
  si queda vacío.

---

## Functionalities

- **`POST /api/orders`**: crea una comanda (Mesa o Llevar) con validaciones, reserva de stock y
  transacción atómica.
- **Modal de comanda** en `/sales`: selección de platos por categoría/búsqueda, cantidades, nota
  por plato, observación general, mesas unidas y total en vivo.
- Botones de apertura: tarjeta de mesa libre ("Toca para tomar comanda") y "+ Para Llevar".
- Tras guardar: toast de éxito y recarga completa de datos (`loadData()`).

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Tipo por defecto** | `orderType` sólo acepta `"Llevar"` o `"Mesa"` (cualquier otro valor se interpreta como `"Mesa"`). |
| BR-2 | **Mesa requerida** | Un pedido en mesa exige `tableId` válido que exista en `dining_table`. |
| BR-3 | **Exclusividad de mesa** | No puede haber dos pedidos no cerrados/cancelados en la misma mesa. |
| BR-4 | **Mesas adicionales** | Deben existir, estar `active` y no tener pedido activo; la principal se excluye. Se etiquetan en las notas con `[Mesas unidas: …]`. |
| BR-5 | **Precios oficiales** | `unitPrice`/`subtotal` provienen de la BD (`subtotal = round2(precio × cantidad)`). |
| BR-6 | **Stock** | Reserva atómica por plato **antes** de crear el pedido; si un plato falla se repone lo ya reservado (rollback en lote). |
| BR-7 | **Estado inicial** | El pedido nace `Received` y cada línea nace `dishStatus: "Pending"`. |
| BR-8 | **Mesas ocupadas** | Al confirmar, la mesa principal y las unidas pasan a `active: false`. |
| BR-9 | **Código** | Formato `PED-` + 4 dígitos de timestamp + 4 dígitos aleatorios. |
| BR-10 | **Reversión** | Si la transacción falla, se libera el stock reservado y se responde `500`. |
| BR-11 | **Sin control de acceso** | No se valida sesión, cookie ni rol (no hay middleware activo). |

## Endpoint

| Method | Path | Summary |
|--------|------|---------|
| POST | `/api/orders` | Registra una comanda nueva (Mesa o Llevar). |

*(En la misma ruta existe `GET /api/orders` —listado de pedidos con filtros `orderType`/`status`— fuera del alcance de esta especificación.)*

### Request

```json
{
  "orderType": "Mesa",
  "tableId": 3,
  "additionalTables": [5],
  "notes": "Mesa junto a la ventana",
  "items": [
    { "dishId": 2, "quantity": 2, "notes": "bien cocido" }
  ]
}
```

| Campo | Alias aceptado | Tipo | Notas |
|-------|----------------|------|-------|
| `orderType` | `tipo_pedido` | string | `"Llevar"` o `"Mesa"` (default `"Mesa"`). |
| `tableId` | `id_mesa` | number | Obligatorio si es `"Mesa"`. |
| `additionalTables` | `mesas_adicionales` | number[] | Opcional; se ignoran NaN y la mesa principal. |
| `notes` | `observacion` | string | Observación de la mesa/comanda (se aplica sólo a pedidos en mesa). |
| `items[]` | — | array | Obligatorio, no vacío. |
| `items[].dishId` | `id_plato` | number | Debe existir y estar `active`. |
| `items[].quantity` | `cantidad` | number | Mínimo 1 (se persiste con `Math.floor`). |
| `items[].notes` | `observaciones` | string | Truncada a 100 caracteres. |

### Response (201)

```json
{
  "message": "Pedido registrado con éxito.",
  "order": {
    "id": 42,
    "code": "PED-10427381",
    "orderType": "Mesa",
    "orderedAt": "2026-10-05T19:12:00.000Z",
    "status": "Received",
    "table": { "id": 3, "number": 3 },
    "notes": "Mesa junto a la ventana [Mesas unidas: 5]",
    "items": [
      { "id": 91, "dishId": 2, "name": "1/2 pollo", "quantity": 2, "unitPrice": 35, "subtotal": 70, "dishStatus": "Pending", "notes": "bien cocido" }
    ],
    "total": 70,
    "editable": true
  }
}
```

### Errors

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Cuerpo no interpretable | `{ "error": "Petición no válida." }` |
| 400 | Pedido en mesa sin `tableId` | `{ "error": "Debe seleccionar una mesa válida para el pedido en mesa." }` |
| 400 | Sin ítems | `{ "error": "El pedido debe contener al menos un producto." }` |
| 400 | Mesa con pedido activo | `{ "error": "La Mesa 3 ya tiene un pedido activo en curso." }` |
| 400 | Mesa adicional ocupada o inactiva | `{ "error": "La mesa adicional Mesa 6 ya está ocupada o tiene un pedido activo." }` |
| 400 | Producto inexistente o inactivo | `{ "error": "El producto con ID 9 no existe o no está activo." }` |
| 400 | Cantidad menor a 1 | `{ "error": "La cantidad de cada producto debe ser al menos 1." }` |
| 400 | Stock insuficiente | `{ "error": "No se pudo confirmar la comanda: El plato 'X' se acaba de agotar. Solo quedan N porciones disponibles." }` |
| 404 | Mesa inexistente | `{ "error": "La mesa especificada no existe." }` |
| 500 | Fallo de base de datos (libera el stock reservado) | `{ "error": "No se pudo registrar el pedido. Intente nuevamente." }` |

No existen respuestas `401`/`403`.

## Permissions

- **Requerido**: ninguno. `POST /api/orders` no usa `requireRole` ni verifica sesión/cookie, y no
  existe middleware de autorización activo (`middleware.ts` inexistente, `proxy.ts.desactivado`).
- Cualquier cliente que alcance la aplicación puede crear pedidos y reservar stock.
- El modal de comanda no aplica filtro de rol.

## Validations

**Servidor** (en orden de evaluación): cuerpo JSON interpretable → tipo de pedido y mesa →
ítems no vacíos → existencia y estado de la mesa principal → mesas adicionales → existencia/actividad
de productos → cantidad ≥ 1 → reserva de stock → transacción de creación.

**Cliente** (`saveOrder`): al menos un plato ("Debe agregar al menos un plato a la comanda." en
toast y botón deshabilitado con `orderItems.length === 0`); protección con `savingOrder`
(botón "Enviando...").

## Acceptance Criteria

1. **When** se registra una comanda válida **Then** la respuesta es `201` con `message`, `order`
   (`status: "Received"`, `total` = suma de subtotales, `editable: true`) y la mesa queda ocupada.
2. **When** el pedido incluye mesas adicionales **Then** las notas de la mesa contienen el tag
   `[Mesas unidas: …]` con los números ordenados.
3. **When** falta stock de algún plato **Then** la API responde `400` con el mensaje de
   agotamiento, no se crea ningún pedido y el stock previamente reservado queda repuesto.
4. **When** falla la base de datos **Then** se responde `500` y el stock reservado se libera.
5. **When** la UI guarda correctamente **Then** muestra el toast correspondiente
   ("Pedido para llevar registrado con éxito.", "Mesa N ocupada. Comanda enviada a cocina." o
   "Mesa N ocupada con M mesa(s) unida(s). Comanda enviada a cocina.") y recarga los datos.
6. **When** la API devuelve un error **Then** la UI muestra su mensaje en un toast rojo y el
   modal permanece abierto.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Aceptar `POST /api/orders` con alias en español para todos los campos.
- **FR-002**: Validar tipo/mesa/ítems/productos/cantidades con los mensajes documentados.
- **FR-003**: Verificar exclusividad de la mesa y de las mesas adicionales (pedidos no
  cerrados/cancelados).
- **FR-004**: Reservar stock atómicamente con rollback en lote y devolución si falla la BD.
- **FR-005**: Crear en una única transacción: pedido (`Received`), vínculo de mesa con notas
  (incluido el tag de mesas unidas), `active: false` en las mesas y las líneas con precios de BD.
- **FR-006**: Devolver `201` con el pedido completo (`mapOrderResponse`).
- **FR-007**: Ofrecer en la UI el modal de comanda (mesa, mesas unidas, observación, carta con
  categorías/búsqueda, cantidades, notas por línea y total en vivo).
- **FR-008**: Bloquear el guardado sin ítems y mientras `savingOrder` sea verdadero.

### Non-Functional Requirements

- **NFR-001**: `export const dynamic = "force-dynamic"`; las escrituras no se cachean.
- **NFR-002**: La reserva de stock es atómica (script Lua en Redis) y resistente a condiciones
  de carrera (cubierto por `test/redis-stock.test.ts`).
- **NFR-003**: Toda la creación ocurre en **una** transacción de base de datos; no hay estados
  intermedios visibles si algo falla.
- **NFR-004**: Sin autenticación ni auditoría de quién registró la comanda.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una comanda válida se registra en una sola petición y la mesa pasa a ocupada de
  inmediato en `GET /api/tables`.
- **SC-002**: Nunca queda un pedido sin stock reservado: o se crea completo, o no se crea y el
  stock queda intacto.
- **SC-003**: Ningún pedido puede duplicar una mesa que ya tiene comanda activa (validación
  servidor + marca `active: false` en la misma transacción).
- **SC-004**: El 100 % de los precios persistidos proviene de la base de datos, nunca del
  cliente.
- **SC-005**: Todos los rechazos devuelven el mensaje exacto documentado (400/404/500).

---

## Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US1, US3 | Alias `tipo_pedido`, `id_mesa`, `mesas_adicionales`, `observacion`, `id_plato`, `cantidad`, `observaciones` |
| FR-002 | US1 escenarios 4-6 | Validaciones del `POST` con sus mensajes |
| FR-003 | US1 escenario 2 / US2 | Verificación de `table.orders` y de mesas adicionales |
| FR-004 | US4 escenarios 1-4 | `reserveOrderStock` + `releaseDishStock` en el `catch` |
| FR-005 | US1 escenario 1 / US2 escenario 1 | `prisma.$transaction` con `orderTable.create` y `diningTable.update` |
| FR-006 | US1 escenario 1 | `mapOrderResponse` + `201` |
| FR-007 | US1-US3 (UI) | `Dialog open={orderModalOpen}` y `saveOrder` |
| FR-008 | UI | `disabled={savingOrder \|\| orderItems.length === 0}` |

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| Alias de campos, tipo por defecto `"Mesa"` y filtrado de la mesa principal | `app/api/orders/route.ts` líneas 123-133 |
| Mensajes y códigos 400/404 de validación (mesa, ítems, productos, cantidades) | `app/api/orders/route.ts` líneas 135-218 |
| Reserva de stock previa y `400` con `reservationResult.error` | `app/api/orders/route.ts` líneas 220-236 |
| Generación del código `PED-…` | `app/api/orders/route.ts` líneas 238-241 |
| Transacción: pedido `Received`, tag `[Mesas unidas: …]`, `active: false`, líneas con precios de BD y `dishStatus: "Pending"` | `app/api/orders/route.ts` líneas 243-308 |
| Liberación de stock si falla la BD y `500` final | `app/api/orders/route.ts` líneas 325-337 |
| `dynamic = "force-dynamic"` y ausencia de autenticación | `app/api/orders/route.ts` líneas 1-5 |
| Reserva atómica, rollback en lote y mensaje de agotamiento | `lib/services/redis-stock.service.ts` líneas 215-240 |
| Fallback en memoria y venta libre si no hay stock fijado | `lib/services/redis-stock.service.ts` líneas 167-184 |
| Liberación de stock con `incrby` | `lib/services/redis-stock.service.ts` líneas 190-208 |
| Servicio `createOrder` (fetch sin caché y propagación de `error`) | `lib/services/tables.service.ts` líneas 219-236 |
| Apertura del modal desde mesa libre y desde "+ Para Llevar" | `app/sales/page.tsx` líneas 449-477 |
| Guardado, toasts de éxito y recarga (`loadData`) | `app/sales/page.tsx` líneas 547-593 |
| Candidatas a unir mesas (filtra sólo `!occupied`) | `app/sales/page.tsx` líneas 2498-2539 |
| Modal: observación, categorías, carta, cantidades, notas por línea | `app/sales/page.tsx` líneas 2541-2686 |
| Botón "Confirmar y Enviar a Cocina" deshabilitado / "Enviando..." | `app/sales/page.tsx` líneas 2688-2715 |
| `orderTotal` en vivo (suma precio × cantidad) y `filteredDishes` | `app/sales/page.tsx` líneas 322-335 |
| Pruebas de reserva, sobreventa y rollback de comanda | `test/redis-stock.test.ts` (8 casos) |

**No existen pruebas automatizadas de la ruta `POST /api/orders`** (sólo del servicio de stock y
de reglas de negocio de `lib/utils/sales-helpers.ts`).

**Fuera de alcance**: listado de pedidos (`GET /api/orders`), edición (spec `009`), cancelación
(spec `010`), transiciones de cocina (`Received → Preparing → Served`), cobro y facturación.

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
