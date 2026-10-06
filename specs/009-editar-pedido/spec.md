# Feature Specification: Editar Pedido (Modificar Comanda)

**Feature Branch**: `009-editar-pedido`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *editar
pedido* (modificar una comanda activa: platos, cantidades, notas y observación), describiendo el
comportamiento real implementado."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y por las pruebas de la regla de edición
> (`test/gestion-mesas.test.ts`, sección 4), referenciadas en
> [Evidencia de verificación](#evidencia-de-verificación). No se describen funcionalidades
> futuras ni reglas ausentes en la implementación. Tomar (spec `008`), cancelar (spec `010`) y
> cobrar son features separadas.

---

## Purpose

Permitir modificar una comanda **activa** antes de que sea servida o cobrada: agregar/quitar
platos, cambiar cantidades, notas por plato y la observación de la mesa, reemplazando el conjunto
de líneas del pedido.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Modificar una comanda en curso (Priority: P1)

Como mozo, quiero editar la comanda de una mesa que aún no está servida para agregar o quitar
platos antes de que cocine.

**Why this priority**: es la única operación de esta feature; depende de un pedido existente y
no servido.

**Independent Test**: `PUT /api/orders/{id}` con `items` no vacíos sobre un pedido `Received` →
`200` con `{ "message": "Pedido actualizado exitosamente." }`.

**Acceptance Scenarios**:

1. **Given** un pedido `Received` con 2 líneas, **When** se envía `PUT` con 3 líneas, **Then** el
   pedido queda con exactamente 3 líneas (las anteriores se eliminan) y responde `200`.
2. **Given** un pedido en estado `Served`, **When** se envía `PUT`, **Then** `400` con
   `{ "error": "Operación rechazada: No se puede editar un pedido que ya ha sido servido." }`.
3. **Given** un pedido `Closed` o `Cancelled`, **When** se envía `PUT`, **Then** `400` con
   `{ "error": "Operación rechazada: El pedido ya se encuentra cerrado o cancelado." }`.
4. **Given** un `id` no numérico, **When** se envía, **Then** `400`
   `{ "error": "ID de pedido inválido." }`.
5. **Given** un `id` inexistente, **When** se envía, **Then** `404`
   `{ "error": "El pedido no existe." }`.
6. **Given** `items: []`, **When** se envía, **Then** `400`
   `{ "error": "El pedido debe contener al menos un producto." }`.

---

### User Story 2 - Editar desde la tarjeta del salón (Priority: P1)

Como usuario, quiero pulsar "Modificar" en la comanda de la mesa para abrir el modal con sus
platos cargados.

**Why this priority**: es la única puerta de entrada de la edición en la UI.

**Independent Test**: con un pedido `Received`, pulsar "Modificar" → se abre el modal "Modificar
Conmada Activa" con los ítems y la observación precargados.

**Acceptance Scenarios**:

1. **Given** un pedido editable, **When** se pulsa "Modificar", **Then** el modal abre en modo
   edición con `tableNote`/`notes` y las líneas cargadas.
2. **Given** un pedido no editable (`editable: false`, estado `Served`), **When** se pulsa,
   **Then** el botón está deshabilitado.
3. **Given** un pedido en estado que `canEditOrder()` no reconoce (p. ej. `Cancelled`),
   **When** se llama a `openEditOrder`, **Then** se muestra el toast
   "El pedido no puede ser modificado porque ya fue servido o cerrado." y no se abre el modal.
4. **Given** el modal abierto en edición, **When** se pulsa "Guardar Cambios", **Then** se envía
   el `PUT`, se muestra "Comanda actualizada correctamente." y se recargan los datos.

---

### Edge Cases

- **La edición es de reemplazo total**: no se envían deltas; se borran todas las líneas
  (`deleteMany`) y se recrean → **los `id` de las líneas cambian** en cada edición.
- **`dishStatus` de las líneas recreadas**: se asigna `existingOrder.status` (p. ej.
  `"Received"`), no `"Pending"`; el valor real de cocina de cada línea se pierde al editar.
- **Sin ajuste de stock**: el `PUT` **no** reserva ni libera stock (sólo lo hacen crear y
  cancelar) → agregar cantidades en la edición no descuenta inventario.
- **No se puede cambiar la mesa ni el tipo de pedido**: sólo ítems, notas de línea y observación.
  El bloque de "mesas unidas" no se muestra en modo edición y `additionalTables` se reinicia.
- **Observación de pedido "Para Llevar"**: `notes` sólo se actualiza si el pedido tiene vínculo
  de mesa (`existingOrder.tables.length > 0`); los pedidos Llevar conservan su nota anterior.
- **Precios**: siempre re-leídos de la BD (`unitPrice`/`subtotal` recalculados).
- **Cantidad fraccionaria**: `Math.floor` al persistir (igual que en la creación).
- **`editable: true` en pedidos cancelados**: el DTO calcula `editable = status !== "Served" &&
  status !== "Closed"`, por lo que un pedido `Cancelled` reporta `editable: true` aunque el
  servidor lo rechace; la UI lo bloquea con `canEditOrder()`.
- **Estados desconocidos**: el servidor sólo bloquea `Served`/`Closed`/`Cancelled`; cualquier
  otro valor de estado sería editable vía API.
- **Ediciones simultáneas**: al ser reemplazo total, la última petición gana (no hay bloqueo).
- **Nota de línea > 100 caracteres**: se trunca con `.slice(0, 100)`.

---

## Functionalities

- **`PUT /api/orders/{id}`**: reemplaza las líneas del pedido y actualiza la observación de la
  mesa.
- **`GET /api/orders/{id}`**: devuelve el pedido (misma ruta; fuera de alcance detallado, pero es
  el que permite precargar la edición).
- Modal "Modificar Comanda Activa" con carta, cantidades, nota por plato y observación.
- Botón "Modificar" en la tarjeta de mesa y regla `canEditOrder()` para habilitarlo.

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Editable** | El servidor rechaza `Served`, `Closed` y `Cancelled`; la UI sólo permite `Received`/`Preparing`/`Pending` (y sus alias en español) vía `canEditOrder()`. |
| BR-2 | **Reemplazo total** | `orderItem.deleteMany` + recreación de todas las líneas dentro de una transacción. |
| BR-3 | **Precios oficiales** | `unitPrice` y `subtotal` provienen del plato en BD (`round2(precio × cantidad)`). |
| BR-4 | **Observación de mesa** | Se actualiza con `orderTable.updateMany` y `.slice(0, 100)`, sólo si el pedido tiene mesas. |
| BR-5 | **Sin efectos de stock** | La edición no reserva ni devuelve stock. |
| BR-6 | **Sin efectos de cocina** | El pedido no cambia de estado; sólo sus líneas son reemplazadas. |
| BR-7 | **Sin control de acceso** | No se valida sesión, cookie ni rol (no hay middleware activo). |

## Endpoint

| Method | Path | Summary |
|--------|------|---------|
| PUT | `/api/orders/{id}` | Reemplaza las líneas de una comanda activa. |

### Request

```json
{
  "notes": "Mesa junto a la ventana",
  "items": [
    { "dishId": 2, "quantity": 3, "notes": "bien cocido" },
    { "dishId": 7, "quantity": 1 }
  ]
}
```

| Campo | Alias aceptado | Tipo | Notas |
|-------|----------------|------|-------|
| `items[]` | — | array | Obligatorio, no vacío. |
| `items[].dishId` | `id_plato` | number | Debe existir y estar `active`. |
| `items[].quantity` | `cantidad` | number | Mínimo 1 (se persiste con `Math.floor`). |
| `items[].notes` | `observaciones` | string | Truncada a 100 caracteres. |
| `notes` | `observacion` | string | Sólo se aplica si el pedido tiene mesa(s); truncada a 100 caracteres. |

### Response (200)

```json
{ "message": "Pedido actualizado exitosamente." }
```

La respuesta **no** incluye el pedido actualizado; la UI recarga con `GET /api/tables` y
`GET /api/orders`.

### Errors

| Status | Condition | Body |
|--------|-----------|------|
| 400 | `id` no numérico | `{ "error": "ID de pedido inválido." }` |
| 400 | Cuerpo no interpretable | `{ "error": "Datos de edición no válidos." }` |
| 400 | Sin ítems | `{ "error": "El pedido debe contener al menos un producto." }` |
| 400 | Pedido `Served` | `{ "error": "Operación rechazada: No se puede editar un pedido que ya ha sido servido." }` |
| 400 | Pedido `Closed`/`Cancelled` | `{ "error": "Operación rechazada: El pedido ya se encuentra cerrado o cancelado." }` |
| 400 | Producto inválido | `{ "error": "El producto con ID 9 no es válido." }` |
| 400 | Cantidad < 1 | `{ "error": "La cantidad de cada producto debe ser mayor a 0." }` |
| 404 | Pedido inexistente | `{ "error": "El pedido no existe." }` |
| 500 | Fallo inesperado | `{ "error": "No se pudo actualizar el pedido." }` |

No existen respuestas `401`/`403`.

## Permissions

- **Requerido**: ninguno. `PUT /api/orders/{id}` no usa `requireRole` ni verifica sesión/cookie, y
  no existe middleware de autorización activo (`middleware.ts` inexistente,
  `proxy.ts.desactivado`).
- Cualquier cliente que alcance la aplicación puede editar cualquier comanda no cerrada.
- El control de "editabilidad" es **de negocio, no de autorización**: depende del estado del
  pedido, no de quién pide.

## Validations

**Servidor** (en orden): `id` numérico → cuerpo JSON → `items` no vacío → existencia del pedido
→ estado (`Served` / `Closed`+`Cancelled`) → productos activos → cantidad ≥ 1 → transacción de
reemplazo.

**Cliente**: `canEditOrder(status)` antes de abrir el modal (toast de advertencia); botón
"Modificar" con `disabled={!pedido.editable}`; botón "Guardar Cambios" deshabilitado sin ítems o
con `savingOrder`.

## Acceptance Criteria

1. **When** se envía un `PUT` válido **Then** el pedido conserva exactamente las líneas enviadas,
   con precios de BD y `total` recalculado en la siguiente lectura.
2. **When** el pedido estaba `Served`, `Closed` o `Cancelled` **Then** la API responde `400` con
   el mensaje documentado y no modifica nada.
3. **When** la edición incluye observación y el pedido tiene mesa **Then** `orderTable.notes`
   queda con el nuevo texto (máx. 100 caracteres).
4. **When** la edición tiene lugar **Then** el stock de cocina no varía y el estado del pedido
   no cambia.
5. **When** la UI guarda **Then** muestra "Comanda actualizada correctamente." y refresca el
   salón.
6. **When** la API devuelve un error **Then** la UI muestra su mensaje en toast y el modal sigue
   abierto.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Exponer `PUT /api/orders/{id}` con los alias en español documentados.
- **FR-002**: Rechazar la edición de pedidos `Served`, `Closed` y `Cancelled` con sus mensajes.
- **FR-003**: Reemplazar todas las líneas del pedido en una única transacción, con precios de BD
  y redondeo a 2 decimales.
- **FR-004**: Actualizar la observación de la mesa (máx. 100 caracteres) sólo si el pedido tiene
  vínculo con mesas.
- **FR-005**: No alterar stock, estado del pedido, mesa ni tipo de pedido.
- **FR-006**: Devolver `{ message }` y dejar la recarga de datos a la UI.
- **FR-007**: Habilitar la edición desde la tarjeta sólo para pedidos editables y precargar el
  modal con líneas y observación.

### Non-Functional Requirements

- **NFR-001**: `export const dynamic = "force-dynamic"`; la escritura no se cachea.
- **NFR-002**: Reemplazo atómico (`deleteMany` + `create` en `prisma.$transaction`): el pedido
  nunca queda sin líneas a medias.
- **NFR-003**: Sin autenticación ni auditoría de quién editó ni de la versión anterior (no se
  guardan históricos de la comanda).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Después de una edición exitosa, el pedido contiene **sólo** las líneas enviadas
  (las eliminadas desaparecen del salón y del cobro).
- **SC-002**: Ningún pedido servido, cerrado o cancelado puede ser modificado (400 documentado).
- **SC-003**: El total del pedido siempre coincide con `Σ round2(precio BD × cantidad)`.
- **SC-004**: La edición nunca cambia el stock de cocina ni el estado del pedido.
- **SC-005**: Todos los rechazos devuelven el mensaje exacto documentado (400/404/500).

---

## Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US1 | Alias `id_plato`, `cantidad`, `observaciones`, `observacion` |
| FR-001/FR-002 | US1 escenarios 2-6 | Validaciones del `PUT` con sus mensajes |
| FR-003 | US1 escenario 1 | `prisma.$transaction` con `deleteMany` + `create` |
| FR-004 | Edge case observación | `orderTable.updateMany` con `.slice(0, 100)` |
| FR-005 | Edge cases stock/estado | El `PUT` no contiene llamadas a Redis ni `salesOrder.update` |
| FR-006 | US1 escenario 1 | `Response.json({ message: "Pedido actualizado exitosamente." })` |
| FR-007 | US2 escenarios 1-4 | `openEditOrder`, `canEditOrder`, botón "Modificar" |

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| `PUT` completo: validaciones, mensajes 400/404, transacción de reemplazo y respuesta | `app/api/orders/[id]/route.ts` líneas 82-181 |
| Bloqueos por estado `Served` y `Closed`/`Cancelled` | `app/api/orders/[id]/route.ts` líneas 112-123 |
| Líneas recreadas con `dishStatus: existingOrder.status` | `app/api/orders/[id]/route.ts` líneas 154-164 |
| Observación actualizada sólo si `existingOrder.tables.length > 0` y truncada a 100 | `app/api/orders/[id]/route.ts` líneas 167-173 |
| Ausencia de reservas/liberaciones de stock en la edición (sólo se importa `releaseDishStock` para el `PATCH` de cancelación) | `app/api/orders/[id]/route.ts` líneas 3 y 82-181 |
| `editable` calculado como `status !== "Served" && status !== "Closed"` | `app/api/orders/route.ts` líneas 70 y `app/api/orders/[id]/route.ts` línea 73 |
| Regla `canEditOrder()` (Received/Preparing/Pending + alias en español) | `lib/utils/sales-helpers.ts` líneas 114-124 |
| Servicio `editOrder()` (PUT y propagación de errores) | `lib/services/tables.service.ts` líneas 238-255 |
| Apertura del modal en modo edición con precarga y toast de bloqueo | `app/sales/page.tsx` líneas 479-508 |
| Guardado de edición, toast "Comanda actualizada correctamente." y recarga | `app/sales/page.tsx` líneas 555-564 y 586-587 |
| Botón "Modificar" con `disabled={!pedido.editable}` | `app/sales/page.tsx` líneas 1355-1372 |
| Modal: título "Modificar Comanda Activa", sin bloqueo de mesas unidas en edición (`!isEditing`) | `app/sales/page.tsx` líneas 2484-2498 |
| Botón "Guardar Cambios" / "Enviando..." | `app/sales/page.tsx` líneas 2697-2714 |
| Pruebas de la regla de edición | `test/gestion-mesas.test.ts` sección 4 (líneas 110-127) |

**No existen pruebas automatizadas de la ruta `PUT /api/orders/{id}`.**

**Fuera de alcance**: toma de pedido (spec `008`), cancelación (spec `010`), transiciones de
cocina, cobro/facturación y creación de pedidos "Para Llevar".

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
