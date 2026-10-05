# Feature Specification: Cancelar Pedido (Anular Comanda)

**Feature Branch**: `010-cancelar-pedido`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *cancelar
pedido* (anular una comanda con motivo y responsable, liberando mesas y stock), describiendo el
comportamiento real implementado."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código; el comportamiento se apoya en las reglas
> cubiertas por `test/gestion-mesas.test.ts` (exclusión de pedidos cerrados/cancelados de los
> cobros pendientes) y `test/redis-stock.test.ts` (devolución de stock), referenciadas en
> [Evidencia de verificación](#evidencia-de-verificación). No se describen funcionalidades
> futuras ni reglas ausentes en la implementación. Tomar (spec `008`), editar (spec `009`) y
> cobrar son features separadas.

---

## Purpose

Anular una comanda **antes o después de ser servida** (pero nunca si ya está cobrada/cerrada),
registrando el motivo y el responsable en las notas de la mesa, liberando las mesas ocupadas y
devolviendo el stock reservado en cocina.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cancelar una comanda con motivo (Priority: P1)

Como mozo o supervisor, quiero cancelar una comanda indicando el motivo y mi nombre, para que la
mesa quede libre y el stock vuelva a cocina con trazabilidad del porqué.

**Why this priority**: es la única operación de esta feature; es además la vía de reversión de la
reserva de stock junto con el fallo de creación.

**Independent Test**: `PATCH /api/orders/{id}` con `{ "status": "Cancelled", "reason": "…" }` →
`200` con `{ "message": "Estado del pedido actualizado a Cancelled." }`, mesas con
`active: true` y stock devuelto.

**Acceptance Scenarios**:

1. **Given** un pedido `Received` en la Mesa 3, **When** se envía `PATCH` con
   `status: "Cancelled"` y `reason: "Cliente desistió"`, **Then** el pedido queda `Cancelled`,
   la Mesa 3 tiene `active: true`, sus notas contienen
   `[CANCELADO por <usuario>: Cliente desistió]` y se devuelve el stock de sus líneas.
2. **Given** un pedido sin `reason`, **When** se envía la cancelación, **Then** `400` con
   `{ "error": "Debe indicar el motivo de la cancelación." }`.
3. **Given** un pedido ya `Cancelled`, **When** se envía de nuevo, **Then** `400` con
   `{ "error": "El pedido ya se encuentra cancelado." }`.
4. **Given** un pedido `Closed` (ya cobrado), **When** se envía cualquier `PATCH`, **Then** `400`
   con `{ "error": "No se puede alterar el estado de un pedido ya cerrado." }`.
5. **Given** un estado no permitido (`Closed`, `foo`), **When** se envía, **Then** `400` con
   `{ "error": "Estado inválido. Los estados permitidos son: Received, Preparing, Served,
   Cancelled." }`.
6. **Given** un pedido inexistente, **When** se envía, **Then** `404`
   `{ "error": "Pedido no encontrado." }`.

---

### User Story 2 - Cancelar desde la tarjeta del salón con auditoría (Priority: P1)

Como usuario, quiero pulsar "Cancelar Comanda" y completar un modal con motivo (obligatorio) y
responsable, para dejar constancia antes de anular.

**Why this priority**: es la única puerta de entrada de la cancelación en la UI.

**Independent Test**: pulsar "Cancelar Comanda" en una tarjeta ocupada → modal con los datos del
pedido, motivo con botones rápidos y confirmación bloqueada mientras falte el motivo.

**Acceptance Scenarios**:

1. **Given** una comanda activa, **When** se pulsa "Cancelar Comanda", **Then** se abre el modal
   "Cancelar Comanda #PED-…" con el aviso de reglas, origen, total, ítems y los campos de
   usuario (por defecto "Mozo Salón") y motivo.
2. **Given** el modal abierto sin motivo, **When** se mira el botón, **Then**
   "Confirmar Cancelación" está deshabilitado (`disabled={cancellingOrder || !cancelReason.trim()}`).
3. **Given** un pedido ya cobrado (`Closed`), **When** se intenta abrir el modal, **Then** no se
   abre y se muestra el toast "No se puede cancelar un pedido que ya fue cobrado y cerrado."
4. **Given** la confirmación correcta, **When** termina la petición, **Then** se muestra el toast
   con el mensaje del servidor, se cierra el modal y se recargan los datos (`loadData()`).
5. **Given** un fallo de la API, **When** falla, **Then** se muestra el toast de error y el modal
   permanece abierto.

---

### Edge Cases

- **Motivo truncado**: la etiqueta `[CANCELADO por <usuario>: <motivo>]` se construye sobre la
  nota previa recortada a 45 caracteres y todo se trunca a 100 → motivos largos se cortan.
- **No hay tabla de auditoría**: el motivo y el responsable **sólo** persisten como texto dentro
  de `order_table.notes`; el modelo `SalesOrder` no guarda `cancelledReason` ni `cancelledBy`.
- **Mesas unidas**: se reactivan (poniendo `active: true` por número) sólo si la nota anterior
  contiene el patrón `[Mesas unidas: 1, 2]`; si el tag no existe o está ya truncado, esas mesas
  adicionales no se reactivan.
- **Pedido "Para Llevar"**: la cancelación no toca mesas (bucle vacío de `order.tables`).
- **Cancelación desde estado `Served`**: está permitida y devuelve el stock aunque los platos ya
  se hayan servido.
- **Orden de efectos**: el estado y las mesas se actualizan en la transacción de BD, pero la
  devolución de stock (Redis) ocurre **después y fuera** de ella, con `catch(() => {})` → si
  Redis falla, el stock no se devuelve y el error queda silenciado.
- **Usuario por defecto**: si falta `user`, el servidor usa `"Personal"`; la UI envía
  `"Mozo Salón"` por defecto.
- **Carrera**: dos cancelaciones simultáneas → la segunda recibe `400` sólo si la primera ya
  confirmó (no hay bloqueo optimista).
- **Cancelado sigue reportando `editable: true`**: el DTO sólo excluye `Served`/`Closed`, pero el
  `PUT` de edición rechaza `Cancelled` (spec `009`).

---

## Functionalidades / Functionalities

- **`PATCH /api/orders/{id}`** con `status: "Cancelled"`: anula el pedido, libera mesas y devuelve
  stock. *En la misma operación se implementan las transiciones de cocina `Received → Preparing →
  Served`, fuera de alcance aquí.*
- **Modal "Cancelar Comanda"** con aviso de reglas, datos del pedido, responsable, motivo
  obligatorio y motivos rápidos.
- Botón "Cancelar Comanda" al pie de la tarjeta de cada mesa ocupada.

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Estados permitidos** | `Received`, `Preparing`, `Served`, `Cancelled` (con alias en español `Recibido`, `Preparando`, `Servido`, `Cancelado`); `Closed` **no** es un estado transicionable por esta ruta. |
| BR-2 | **Pedido cerrado es inmutable** | Un pedido `Closed` rechaza cualquier `PATCH`. |
| BR-3 | **Motivo obligatorio** | Cancelar exige `reason`/`motivo` no vacío. |
| BR-4 | **No re-cancelar** | Un pedido ya `Cancelled` rechaza la segunda cancelación. |
| BR-5 | **Liberación de mesas** | Al cancelar, la mesa principal y las del tag `[Mesas unidas: …]` pasan a `active: true`. |
| BR-6 | **Trazabilidad en notas** | Se añade `[CANCELADO por <user>: <reason>]` a `order_table.notes` (nota previa recortada a 45, total 100). |
| BR-7 | **Devolución de stock** | Cada línea del pedido devuelve su cantidad con `releaseDishStock` (fuera de la transacción, errores silenciados). |
| BR-8 | **Sin efectos contables** | No se crean ventas, comprobantes ni movimientos de inventario/contables. |
| BR-9 | **Sin control de acceso** | No se valida sesión, cookie ni rol (no hay middleware activo). |

## Endpoint

| Method | Path | Summary |
|--------|------|---------|
| PATCH | `/api/orders/{id}` | Cambia el estado del pedido; con `Cancelled` lo anula. |

### Request

```json
{
  "status": "Cancelled",
  "reason": "Cliente desistió de esperar",
  "user": "Mozo Salón"
}
```

| Campo | Alias aceptado | Tipo | Requerido | Notas |
|-------|----------------|------|-----------|-------|
| `status` | `estado` | string | Sí | Alias español→inglés; válido: `Received`, `Preparing`, `Served`, `Cancelled`. |
| `reason` | `motivo` | string | Sí (sólo al cancelar) | Obligatorio y no vacío. |
| `user` | `usuario` | string | No | Default servidor: `"Personal"`; default UI: `"Mozo Salón"`. |

### Response (200)

```json
{ "message": "Estado del pedido actualizado a Cancelled." }
```

### Errors

| Status | Condition | Body |
|--------|-----------|------|
| 400 | `id` no numérico | `{ "error": "ID de pedido inválido." }` |
| 400 | Estado no permitido | `{ "error": "Estado inválido. Los estados permitidos son: Received, Preparing, Served, Cancelled." }` |
| 400 | Pedido `Closed` | `{ "error": "No se puede alterar el estado de un pedido ya cerrado." }` |
| 400 | Ya cancelado | `{ "error": "El pedido ya se encuentra cancelado." }` |
| 400 | Sin motivo | `{ "error": "Debe indicar el motivo de la cancelación." }` |
| 404 | Pedido inexistente | `{ "error": "Pedido no encontrado." }` |
| 500 | Fallo inesperado | `{ "error": "No se pudo actualizar el estado del pedido." }` |

No existen respuestas `401`/`403`.

## Permissions

- **Requerido**: ninguno. `PATCH /api/orders/{id}` no usa `requireRole` ni verifica sesión, y no
  existe middleware de autorización activo (`middleware.ts` inexistente,
  `proxy.ts.desactivado`).
- Cualquier cliente que alcance la aplicación puede cancelar cualquier comanda.
- El campo "Usuario / Mozo Responsable" es **texto libre** capturado en la UI: no se comprueba
  contra usuarios reales (no existe autenticación ni tabla de usuarios en uso para esto).

## Validations

**Servidor** (en orden): `id` numérico → cuerpo JSON → `status`/alias → existencia del pedido →
bloqueo por `Closed` → bloqueo por ya cancelado → motivo no vacío (sólo al cancelar) →
transacción.

**Cliente**: `openCancelModal` bloquea `Closed` con toast; el modal exige motivo (botón
deshabilitado y validación extra en `executeCancellation` con toast "Debe indicar el motivo de
la cancelación."); protección con `cancellingOrder` ("Cancelando...").

## Acceptance Criteria

1. **When** se cancela un pedido activo **Then** responde `200`, el estado pasa a `Cancelled`,
   sus mesas quedan libres y el stock de cada línea se devuelve.
2. **When** el pedido tenía mesas unidas **Then** también se reactivan (si el tag sigue en las
   notas) y la nota queda con el tag de cancelación.
3. **When** falta el motivo **Then** la API responde `400` y la UI no envía la petición.
4. **When** el pedido está cobrado (`Closed`) **Then** ni la API ni la UI permiten cancelarlo.
5. **When** la cancelación tiene éxito **Then** la UI muestra "Estado del pedido actualizado a
   Cancelled.", cierra el modal y refresca el salón; la mesa aparece como "Libre".
6. **When** la cancelación tiene éxito **Then** no se crean ventas ni movimientos contables.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Aceptar `PATCH /api/orders/{id}` con alias en español para `status`, `reason` y
  `user`.
- **FR-002**: Rechazar estados no permitidos, pedidos `Closed`, re-cancelaciones y motivos vacíos
  con los mensajes documentados.
- **FR-003**: Al cancelar, en una transacción: actualizar el estado, reactivar las mesas
  (principal y unidas) y escribir la etiqueta de cancelación en las notas.
- **FR-004**: Devolver el stock de todas las líneas del pedido tras la cancelación.
- **FR-005**: No generar ventas, comprobantes ni movimientos contables por cancelar.
- **FR-006**: Ofrecer en la UI el modal de cancelación con aviso de reglas, datos del pedido,
  responsable, motivo obligatorio y motivos rápidos.
- **FR-007**: Bloquear en la UI la cancelación de pedidos `Closed`.

### Non-Functional Requirements

- **NFR-001**: `export const dynamic = "force-dynamic"`; la escritura no se cachea.
- **NFR-002**: Estado y mesas se actualizan en **una** transacción de base de datos; la devolución
  de stock es un efecto posterior fuera de esa transacción y sus errores se silencian con
  `catch(() => {})`.
- **NFR-003**: Sin autenticación ni tabla de auditoría: la trazabilidad vive en el texto de
  `order_table.notes` (limitado a 100 caracteres).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras cancelar, la mesa aparece inmediatamente como "Libre" en `GET /api/tables` y
  el pedido sale de los cobros pendientes.
- **SC-002**: Ninguna comanda se cancela sin motivo (validación doble: UI y API).
- **SC-003**: El stock devuelto corresponde exactamente a las cantidades de las líneas del
  pedido cancelado.
- **SC-004**: Un pedido cobrado (`Closed`) nunca puede ser cancelado (400 o toast, según la vía).
- **SC-005**: Todos los rechazos devuelven el mensaje exacto documentado (400/404/500).

---

## Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US1 escenario 1 | `statusAliases` y lectura de `reason`/`user` en el `PATCH` |
| FR-002 | US1 escenarios 2-6 | Validaciones del `PATCH` con sus mensajes |
| FR-003 | US1 escenario 1 | `prisma.$transaction` con `salesOrder.update`, `diningTable.update` y tag en `orderTable.update` |
| FR-004 | US1 escenario 1 / BR-7 | `releaseDishStock` por cada `orderItem` |
| FR-005 | US1 escenario 1 | El `PATCH` no toca `salesInvoice` ni `inventoryMovement` |
| FR-006 | US2 escenarios 1-2, 4-5 | Modal `cancelModalOpen` y `executeCancellation` |
| FR-007 | US2 escenario 3 | `openCancelModal` con bloqueo por `Closed` |

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| `PATCH` completo: alias, estados válidos, bloqueos, motivo y respuesta | `app/api/orders/[id]/route.ts` líneas 184-310 |
| `validStatuses` y mensaje de estado inválido | `app/api/orders/[id]/route.ts` líneas 199-217 |
| Bloqueo de pedidos `Closed` y de re-cancelación | `app/api/orders/[id]/route.ts` líneas 227-241 |
| Transacción: estado, `dishStatus: "Served"` (al servir) y liberación de mesas | `app/api/orders/[id]/route.ts` líneas 243-255 |
| Tag `[CANCELADO por …]`, reactivación de mesas unidas por regex y recorte de notas | `app/api/orders/[id]/route.ts` líneas 256-294 |
| Devolución de stock por línea con `catch(() => {})` | `app/api/orders/[id]/route.ts` líneas 296-302 |
| `dynamic = "force-dynamic"` y ausencia de autenticación | `app/api/orders/[id]/route.ts` líneas 1-5 |
| Servicio `cancelOrder(id, reason, user)` con default `"Mozo Salón"` | `lib/services/tables.service.ts` líneas 273-288 |
| Botón "Cancelar Comanda" en la tarjeta | `app/sales/page.tsx` líneas 1403-1425 |
| Bloqueo de `Closed`, reset de campos y default de usuario | `app/sales/page.tsx` líneas 608-617 |
| Validación de motivo, toast y recarga en `executeCancellation` | `app/sales/page.tsx` líneas 619-642 |
| Modal: título, aviso de reglas, datos del pedido, campos y motivos rápidos | `app/sales/page.tsx` líneas 3363-3445 |
| Botones "Regresar" / "Confirmar Cancelación" (deshabilitado sin motivo) | `app/sales/page.tsx` líneas 3448-3475 |
| Exclusión de pedidos `Closed`/`Cancelled` de los cobros pendientes | `test/gestion-mesas.test.ts` sección 7 (líneas 181-194) |
| Devolución/rollback de stock en cocina | `test/redis-stock.test.ts` (liberación y rollback por plato agotado) |

**No existen pruebas automatizadas de la ruta `PATCH /api/orders/{id}`.**

**Fuera de alcance**: transiciones de cocina `Received → Preparing → Served` (misma ruta),
tomar (spec `008`), editar (spec `009`), cobro/facturación y listado de pedidos.

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
