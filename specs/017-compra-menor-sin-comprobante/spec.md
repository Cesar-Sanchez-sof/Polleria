# Feature Specification: Compra Menor Sin Comprobante

**Feature Branch**: `017-compra-menor-sin-comprobante`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *compra
menor sin comprobante* (ingreso directo de compras informales al inventario), describiendo el
comportamiento real implementado."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y por la prueba automatizada
> (`lib/services/purchases/purchases.service.test.ts`, bloque "Módulo 7: Compra sin
> comprobante"), con evidencia en [Evidencia de verificación](#evidencia-de-verificación). No
> se describen funcionalidades futuras ni reglas ausentes en la implementación. Alta de
> insumos (spec `015`), proveedores (spec `014`), recepción de órdenes y transformación son
> features separadas; esta spec documenta **sólo** el registro de la compra informal y su
> ingreso a inventario.

---

## Purpose

Registrar una compra informal (sin boleta ni factura) de un insumo, ingresando la mercadería
directamente al inventario con su costo unitario implícito y dejando el movimiento en el
Kardex, además de conservar el historial de estas compras.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar una compra informal (Priority: P1)

Como encargado de almacén, quiero cargar una compra de emergencia (insumo, cantidad y monto
pagado) para que el stock aumente sin necesidad de una orden de compra ni comprobante.

**Why this priority**: es la única operación de la pantalla y la que modifica el inventario.

**Independent Test**: `registerPurchaseWithoutVoucher({ supplyId: 1, quantity: 5, amountPaid:
50 })` con stock 10 → `currentStock` pasa a 15.

**Acceptance Scenarios**:

1. **Given** un insumo con stock 10, **When** se registra cantidad 5 y monto S/ 50, **Then**
   en una transacción se crea la `InformalPurchase`, un `InventoryMovement`
   (`InformalPurchase`, `quantity: 5`, `unitCost: 10`) y el insumo queda en 15; toast "Compra
   menor registrada exitosamente".
2. **Given** sin insumo seleccionado, **When** se envía, **Then** lanza y muestra `Debe
   seleccionar un insumo`.
3. **Given** cantidad 0 o negativa, **When** se envía, **Then** `La cantidad debe ser mayor a
   0`.
4. **Given** monto 0 o negativo, **When** se envía, **Then** `El monto pagado debe ser mayor
   a 0`.
5. **Given** un `supplyId` inexistente, **When** se envía, **Then** `Insumo no encontrado`.
6. **Given** no se envía `employeeId`, **When** se registra, **Then** el responsable se toma
   automáticamente (primer empleado activo) o se crea el empleado por defecto si la tabla
   está vacía.

---

### User Story 2 - Ver el historial de compras informales (Priority: P2)

Como usuario, quiero ver las compras menores registradas con su fecha, insumo, monto, costo
unitario y motivo para auditar lo ingresado al inventario.

**Why this priority**: es la vista de soporte; no modifica datos.

**Independent Test**: con compras registradas, la tabla muestra cada fila con costo unitario
`monto / cantidad`.

**Acceptance Scenarios**:

1. **Given** compras registradas, **When** se carga la página, **Then** la tabla lista Fecha
   (formato `es-PE`), Insumo, Cantidad (2 decimales + unidad), Monto Pagado, Costo Unitario,
   Lugar/Proveedor y Motivo.
2. **Given** una compra sin lugar ni motivo, **When** se muestra, **Then** aparecen "-" y
   "Compra menor de emergencia" respectivamente.
3. **Given** no hay compras, **When** se carga, **Then** se muestra "No se registran compras
   menores sin comprobante."

---

### Edge Cases

- **Sin límite de monto**: pese al nombre ("menor", "bajo monto") y al badge del dashboard
  ("Registro directo"), **no se valida ningún tope** de monto ni de cantidad.
- **Fecha libre**: el campo fecha se envía tal cual y se guarda como `@db.Date` sin impedir
  fechas futuras ni pasadas; por defecto es el día actual.
- **Responsable automático**: el formulario **no envía `employeeId`**, así que
  `getOrCreateActiveEmployee` elige el primer empleado activo (`id` ascendente), luego
  cualquier empleado, y si no hay ninguno crea/actúa `Employee` con DNI `00000000`
  ("Administrador Sistema").
- **Movimiento no enlazado**: el `InventoryMovement` se crea **sin** `informalPurchaseId`, por
  lo que la relación compra↔movimiento no se persiste (sólo el texto del `reason`).
- **Motivo compartido**: si el usuario escribe un motivo, éste se copia al `reason` del
  movimiento; si lo deja vacío, el movimiento recibe `Compra menor sin comprobante #<id>`.
- **Costos promedio nunca se actualizan**: `lastCost` y `averageCost` del insumo **no se
  escriben en ninguna parte de la aplicación** (permanecen en 0).
- **El empleado no se muestra**: la interfaz de la tabla tipa `employee`, pero la columna no
  existe en el render.
- **Sin edición ni anulación**: no hay acciones para corregir o eliminar una compra registrada
  ni el movimiento que generó.
- **Refresco del servidor**: tras registrar se llama `router.refresh()`, por lo que el
  historial se actualiza con la nueva versión del Server Component (no con estado local).
- **Sin paginación ni búsqueda**: el historial lista todas las compras (`date` descendente).
- **Lista de insumos silenciosa**: si `getSupplies()` falla, la página recibe `[]` y el
  selector aparece vacío (indistinguible de "sin insumos").
- **Alta de insumo en línea**: el botón "+ Crear Insumo" abre `SupplyDialog`; al crearlo se
  añade a la lista **y queda seleccionado**.
- **Costo unitario recalculado en cliente**: la tabla divide `amountPaid / quantity` de nuevo
  en vez de leer el `unitCost` persistido.
- **Sin control de acceso**: la acción es un Server Action sin validación de sesión, cookie ni
  rol (no hay middleware activo).

---

## Functionalidades / Functionalities

- **Página `/purchases/purchase-without-voucher`** (Server Component,
  `dynamic = "force-dynamic"`): formulario + historial.
- **Server Action** `registerPurchaseWithoutVoucher` (`"use server"`): alta con transacción
  completa de inventario.
- **Server Action** `getPurchasesWithoutVoucher()`: historial ordenado por fecha descendente.
- **Formulario "Registrar Compra Menor Directa"** con cálculo visible del costo unitario
  implícito y alta de insumo en línea.
- **Tabla "Historial de Compras Sin Comprobante"**.
- Tarjeta del dashboard de Compras: "7. Compra Menor Sin Comprobante" con badge "Registro
  directo".

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Insumo obligatorio** | Debe existir `supplyId` y el insumo debe existir en base. |
| BR-2 | **Cantidad y monto positivos** | `quantity > 0` y `amountPaid > 0` (servidor y cliente). |
| BR-3 | **Costo unitario implícito** | `unitCost = amountPaid / quantity`; se persiste en el movimiento y se previsualiza en el formulario. |
| BR-4 | **Ingreso atómico** | Compra + movimiento + suma de stock ocurren en la misma `prisma.$transaction`. |
| BR-5 | **Stock se suma** | `currentStock += quantity`; el tipo de movimiento es `InformalPurchase`. |
| BR-6 | **Responsable resuelto automáticamente** | `getOrCreateActiveEmployee` (pedido → activo → cualquiera → empleado por defecto DNI 00000000). |
| BR-7 | **Historial inmutable** | No existen edición, anulación ni borrado de compras informales. |
| BR-8 | **Sin control de acceso** | Ninguna acción valida sesión ni rol. |

## Endpoint / Transporte

**No existe endpoint REST propio**: la funcionalidad opera mediante **Server Actions**
(`lib/services/purchases/purchase-without-voucher.ts`, `"use server"`).

| Acción | Firma | Efecto |
|--------|-------|--------|
| Registrar | `registerPurchaseWithoutVoucher(data)` | Transacción: `InformalPurchase` + `InventoryMovement` + suma de stock. |
| Historial | `getPurchasesWithoutVoucher()` | Compras con `supply` y `employee`, orden `date` desc; en error devuelve `[]`. |

### Campos de `PurchaseWithoutVoucherInput`

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `supplyId` | number | Sí | El formulario **no** envía `employeeId`. |
| `quantity` | number | Sí | `> 0`; `step 0.01` en la UI. |
| `amountPaid` | number | Sí | `> 0`; monto total pagado en S/. |
| `date` | `Date \| string` | No | Default `now()`; la UI envía la fecha elegida (por defecto hoy). |
| `informalPlaceOrVendor` | string | No | Hasta 150 caracteres en BD. |
| `reason` | string | No | Hasta 150 caracteres; copiado al `reason` del movimiento. |

### Respuesta y errores

La acción devuelve la `InformalPurchase` creada. Los errores se lanzan como `Error` y llegan
al cliente como `toast.error(err.message || "Error al registrar la compra menor")`:

| Condición | Mensaje |
|-----------|---------|
| Sin `supplyId` | `Debe seleccionar un insumo` |
| Cantidad ≤ 0 | `La cantidad debe ser mayor a 0` |
| Monto ≤ 0 | `El monto pagado debe ser mayor a 0` |
| Insumo inexistente | `Insumo no encontrado` |

Éxito (cliente): `toast.success("Compra menor registrada exitosamente")`.

## Permissions

- **Requerido**: ninguno. Es un Server Action sin verificación de sesión/cookie/rol y no
  existe middleware de autorización activo (`middleware.ts` inexistente,
  `proxy.ts.desactivado`).
- Cualquier cliente que alcance la aplicación puede modificar el inventario y ver el
  historial.
- El enlace "Compra Menor sin Comprobante" del sidebar no aplica filtro de rol.

## Validations

**Servidor** (en orden): `supplyId` → `quantity > 0` → `amountPaid > 0` → dentro de la
transacción: resolución de empleado → existencia del insumo → creación.

**Cliente** (mismos mensajes): seleccionar insumo, cantidad y monto con
`min="0.01"`/`step="0.01"` y `required`; los tres chequeos se replican con `toast.error`
antes de invocar la acción; el botón de envío se bloquea con `loading` ("Guardando...").

## Acceptance Criteria

1. **When** se completa el formulario con datos válidos **Then** se registra la compra, el
   stock del insumo aumenta en la cantidad indicada, aparece el movimiento en el Kardex y se
   muestra "Compra menor registrada exitosamente".
2. **When** faltan insumo, cantidad o monto **Then** se rechaza con el mensaje exacto
   documentado (cliente y servidor).
3. **When** la compra tiene éxito **Then** el formulario se limpia (conservando la fecha) y
   el historial se refresca con la fila nueva.
4. **When** se observa el costo unitario **Then** coincide con `monto / cantidad` tanto en la
   previsualización como en la tabla.
5. **When** no hay compras **Then** la tabla muestra el estado vacío documentado.
6. **When** el inventario se consulta después **Then** el insumo refleja el nuevo
   `currentStock` (regla cubierta por la prueba del bloque Módulo 7).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Registrar compras informales validando insumo, cantidad y monto con los
  mensajes documentados.
- **FR-002**: Dentro de una transacción, crear la compra, resolver el empleado responsable,
  crear el `InventoryMovement` con `unitCost` y sumar la cantidad al `currentStock` del
  insumo.
- **FR-003**: Listar el historial completo con sus relaciones (`supply`, `employee`) en orden
  descendente por fecha.
- **FR-004**: Ofrecer en la UI el formulario con selector de insumo, cantidad, monto, fecha,
  lugar/proveedor, motivo y previsualización del costo unitario.
- **FR-005**: Permitir crear un insumo desde el propio formulario y seleccionarlo al
  confirmarse.
- **FR-006**: Pintar el historial con fecha localizada, montos a 2 decimales y valores
  alternativos para campos vacíos.
- **FR-007**: Refrescar la página del servidor tras cada registro exitoso.

### Non-Functional Requirements

- **NFR-001**: Transporte por Server Actions (sin endpoint REST propio) y página
  `force-dynamic`.
- **NFR-002**: Toda la escritura es transaccional; los fallos de lectura se degradan a listas
  vacías (`catch → []` + `console.error`).
- **NFR-003**: Sin autenticación ni autorización en ninguna de las acciones.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras registrar una compra de N unidades, `currentStock` del insumo aumenta
  exactamente en N (prueba del bloque Módulo 7).
- **SC-002**: Cada registro genera exactamente un `InventoryMovement` con
  `movementType: InformalPurchase` y `unitCost = amountPaid / quantity`.
- **SC-003**: Ninguna compra se registra con cantidad o monto ≤ 0 o sin insumo.
- **SC-004**: El historial muestra siempre la suma de todas las compras registradas, sin
  paginación.
- **SC-005**: Todos los rechazos muestran el mensaje exacto documentado.

---

## Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US1 escenarios 2-5 | Validaciones de `registerPurchaseWithoutVoucher` |
| FR-002 | US1 escenarios 1, 6 | Cuerpo transaccional + `getOrCreateActiveEmployee` |
| FR-003 | US3 escenarios 1-3 | `getPurchasesWithoutVoucher` |
| FR-004 | US1 (UI) | `PurchaseWithoutVoucherForm` |
| FR-005 | Edge "alta de insumo en línea" | `handleSupplyCreated` + `SupplyDialog` |
| FR-006 | US3 escenarios 1-2 | `PurchasesWithoutVoucherTable` |
| FR-007 | US1 escenario 1 / edge refresco | `router.refresh()` tras el alta |

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| Server Action completa: validaciones, transacción, movimiento y suma de stock | `lib/services/purchases/purchase-without-voucher.ts` líneas 17-70 |
| `unitCost = amountPaid / quantity` y `reason` por defecto `Compra menor sin comprobante #id` | `lib/services/purchases/purchase-without-voucher.ts` líneas 50-60 |
| Ausencia de `informalPurchaseId` en el movimiento y de actualización de `lastCost`/`averageCost` | `lib/services/purchases/purchase-without-voucher.ts` líneas 52-66 (grep sin usos de `lastCost`/`averageCost` en la app) |
| Historial con `supply`/`employee` y orden `date` desc | `lib/services/purchases/purchase-without-voucher.ts` líneas 72-85 |
| Resolución automática de empleado y creación del por defecto (DNI 00000000) | `lib/services/purchases/employee-helper.ts` líneas 6-58 |
| Modelo `InformalPurchase` (Decimal 10,2, `@db.Date`, `Restrict`) | `prisma/schema.prisma` líneas 386-402 |
| Página `force-dynamic` con formulario e historial | `app/purchases/purchase-without-voucher/page.tsx` líneas 1-37 |
| Formulario: defaults, costos, validaciones, toasts y `router.refresh()` | `components/purchases/manual-entry/PurchaseWithoutVoucherForm.tsx` líneas 39-99 |
| Campos, botón "+ Crear Insumo" y previsualización del costo unitario | `components/purchases/manual-entry/PurchaseWithoutVoucherForm.tsx` líneas 102-223 |
| Tabla: columnas, valores alternativos y estado vacío | `components/purchases/manual-entry/PurchasesWithoutVoucherTable.tsx` líneas 37-95 |
| Tarjeta del dashboard ("Registro directo") | `app/purchases/page.tsx` líneas 96-103 |
| Enlace "Compra Menor sin Comprobante" del sidebar | `components/personalized/Sidebar.tsx` líneas 261-269 |
| Prueba: compra de 5 sobre stock 10 → 15 | `lib/services/purchases/purchases.service.test.ts` líneas 263-279 |

**No existen pruebas de `getPurchasesWithoutVoucher` ni de la UI.**

**Fuera de alcance**: alta de insumos (spec `015`), órdenes de compra, recepción de mercadería,
facturas de proveedor, transformación, contabilización de la compra y cualquier reporte de
Kardex.

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
