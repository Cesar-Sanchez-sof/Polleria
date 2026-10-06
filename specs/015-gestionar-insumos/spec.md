# Feature Specification: Gestionar Insumos (Inventario e Insumos)

**Feature Branch**: `015-gestionar-insumos`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *gestionar
insumos* (alta de insumos, consulta de stock y registro de ajustes/mermas), describiendo el
comportamiento real implementado."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y por las pruebas automatizadas
> (`lib/services/purchases/purchases.service.test.ts`, bloque "Módulo 5: Insumos y Ajuste de
> Inventario"), con evidencia en [Evidencia de verificación](#evidencia-de-verificación). No se
> describen funcionalidades futuras ni reglas ausentes en la implementación. Órdenes de compra,
> recepción, transformación y compra sin comprobante modifican el stock por caminos separados,
> fuera de alcance aquí.

---

## Purpose

Alta de insumos (materia prima y producto terminado) con su unidad de medida y stock mínimo de
alerta, consulta del inventario con estado de stock y registro de ajustes/mermas por conteo
físico dejando trazabilidad en el Kardex.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear un insumo (Priority: P1)

Como usuario de Compras, quiero registrar un insumo con su unidad de medida y stock mínimo
para poder controlarlo en inventario.

**Why this priority**: sin insumos no hay inventario ni órdenes de compra ni transformaciones.

**Independent Test**: `createSupply({ name: "Pollo Entero", unitOfMeasure: "KG" })` → se crea
con `currentStock: 0` y `active: true`.

**Acceptance Scenarios**:

1. **Given** un nombre y unidad válidos, **When** se invoca `createSupply`, **Then** se crea
   el insumo con `currentStock: 0`, `minimumStock` (por defecto 0) y `active: true`, y se
   muestra "Insumo creado exitosamente".
2. **Given** nombre vacío, **When** se invoca, **Then** lanza `El nombre del insumo es
   obligatorio`.
3. **Given** unidad de medida vacía, **When** se invoca, **Then** lanza `La unidad de medida
   es obligatoria`.
4. **Given** no se envía `type`, **When** se crea, **Then** queda `RawMaterial`
   ("Materia Prima").
5. **Given** el diálogo se abre con "Stock Mínimo de Alerta" = 5, **When** se guarda sin
   tocarlo, **Then** `minimumStock` persiste en 5 (o `0` si el valor se vacía).

---

### User Story 2 - Ver el inventario con su estado de stock (Priority: P1)

Como usuario, quiero ver todos los insumos con su stock actual, mínimo y una alerta de bajo
stock para saber qué reponer.

**Why this priority**: es la vista que da sentido al módulo y alimenta el dashboard de
Compras.

**Independent Test**: con un insumo `currentStock <= minimumStock`, la fila muestra el badge
"Bajo Stock"; si no, "Óptimo".

**Acceptance Scenarios**:

1. **Given** insumos en base, **When** se abre `/purchases/inventory`, **Then** la tabla lista
   código `INS-###`, nombre, tipo, unidad, stock actual y mínimo con 2 decimales.
2. **Given** `currentStock` igual al mínimo, **When** se muestra la fila, **Then** aparece
   "Bajo Stock" (la comparación es `<=`).
3. **Given** la búsqueda "INS-0" o un tipo, **When** se filtra, **Then** sólo se muestran las
   coincidencias de nombre, código derivado o tipo.
4. **Given** no hay insumos (o la carga falló), **When** se muestra, **Then** aparece "No se
   encontraron insumos en el inventario."

---

### User Story 3 - Registrar un ajuste o merma (Priority: P1)

Como responsable de almacén, quiero cargar el stock físico real con un motivo para corregir
el inventario dejando registro en el Kardex.

**Why this priority**: es la única vía de la pantalla para modificar `currentStock`.

**Independent Test**: `registerInventoryAdjustment(1, 15, "Ajuste por conteo físico")` con
stock 10 → crea un movimiento con `quantity: 5` y el insumo queda en 15.

**Acceptance Scenarios**:

1. **Given** un insumo con stock 10, **When** se registra stock real 15 con motivo, **Then**
   en una transacción se crea `InventoryMovement` con `quantity = 15 − 10 = 5` y el insumo
   pasa a 15; toast "Ajuste de inventario registrado correctamente".
2. **Given** el tipo "Merma", **When** se registra stock real 6 con motivo, **Then** el
   movimiento se crea como `Shrinkage` y el toast dice "Merma de inventario registrado
   correctamente".
3. **Given** cantidad negativa, **When** se invoca el servicio, **Then** lanza `La cantidad
   real no puede ser negativa`.
4. **Given** motivo vacío, **When** se invoca, **Then** lanza `El motivo del ajuste o merma
   es obligatorio` (y el cliente bloquea con el mismo texto).
5. **Given** un `supplyId` inexistente, **When** se invoca, **Then** lanza `Insumo no
   encontrado`.
6. **Given** stock real igual al actual, **When** se registra, **Then** se crea un movimiento
   con `quantity: 0` (no hay validación de diferencia).

---

### Edge Cases

- **No existe edición de insumos**: no hay `updateSupply` ni botón de modificar/desactivar;
  nombre, tipo, unidad y stock mínimo son **inmutables** después del alta (sólo cambia
  `currentStock`, y sólo por los caminos de inventario).
- **`active` siempre `true`**: no hay ninguna función que ponga un insumo inactivo; el campo
  existe en el modelo pero no se explota.
- **Kardex sin pantalla**: la página se titula "Kardex e Inventario de Insumos" y existe
  `getInventoryMovements(supplyId?)`, pero **ningún componente la consume** → la lista de
  movimientos no está visible en la UI.
- **Stock inicial en 0**: crear un insumo no deja cargar cantidad inicial; el stock debe
  venir después de una recepción, transformación, compra sin comprobante o ajuste.
- **Código derivado**: `INS-###` se calcula en cliente a partir del `id` (`padStart(3, "0")`);
  con más de 999 insumos el código supera los 3 dígitos.
- **Números en el diálogo**: el campo de stock físico usa `parseFloat(e.target.value) || 0`,
  así que vaciar el campo equivale a 0 (podría poner el stock a cero sin querer).
- **Comparación de bajo stock con `<=`**: un insumo exactamente en el mínimo ya se marca
  "Bajo Stock".
- **Orden local vs. servidor**: el servidor ordena por `name` ascendente, pero el insumo
  nuevo se inserta **al inicio** de la tabla local hasta la siguiente carga.
- **Errores de carga silenciosos**: `getSupplies()` hace `catch → []`, confundiéndose con
  inventario vacío.
- **Límite de nombre**: la columna es `VarChar(50)` sin `maxLength` en el diálogo → un nombre
  más largo produce un error crudo de Prisma.
- **Alta desde otros formularios**: `SupplyDialog` también se abre desde Orden de Compra,
  Transformación (con `prefilledType={FinishedProduct}`) y Compra sin Comprobante; el insumo
  creado allí queda con stock 0 y no aparece en esa lista hasta que se refresque.
- **Sin control de acceso**: ni la página ni los Server Actions validan sesión, cookie ni rol.

---

## Functionalidades / Functionalities

- **Página `/purchases/inventory`** (Server Component, `dynamic = "force-dynamic"`):
  "Kardex e Inventario de Insumos" con tabla, búsqueda y acciones.
- **Server Actions** (`lib/services/purchases/supply.ts`, `"use server"`): `getSupplies`,
  `createSupply`, `registerInventoryAdjustment` y `getInventoryMovements` (esta última sin
  consumidores).
- **`SupplyDialog`**: alta de insumo (reutilizable en 4 pantallas del módulo).
- **`AdjustmentDialog`**: carga de stock físico real con tipo (Ajuste/Merma) y motivo.
- **Tarjeta del dashboard de Compras**: "5. Inventario e Insumos" con badge
  `"<n> bajo stock"` si hay insumos en alerta, si no `"<n> insumos"`.

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Nombre y unidad obligatorios** | No se crea un insumo sin nombre ni `unitOfMeasure` (no vacíos). |
| BR-2 | **Stock inicial en 0** | Todo insumo nace con `currentStock: 0` y `active: true`. |
| BR-3 | **Tipo por defecto** | `SupplyType.RawMaterial` si no se indica. |
| BR-4 | **Ajuste por diferencia** | El movimiento registra `cantidad física − stock del sistema` y el stock pasa a la cantidad física. |
| BR-5 | **Ajuste atómico** | Movimiento + actualización de stock ocurren en la misma transacción `prisma.$transaction`. |
| BR-6 | **Motivo obligatorio y cantidad ≥ 0** | El ajuste exige motivo no vacío y cantidad real no negativa. |
| BR-7 | **Estado de stock** | "Bajo Stock" cuando `currentStock <= minimumStock`; en otro caso "Óptimo". |
| BR-8 | **Tipos de registro** | La UI ofrece sólo `Adjustment` y `Shrinkage`; el servicio acepta cualquier `InventoryMovementType` y por defecto usa `Adjustment`. |
| BR-9 | **Sin control de acceso** | Ninguna acción valida sesión ni rol. |

## Endpoint / Transporte

**No existe endpoint REST propio**: la funcionalidad opera mediante **Server Actions**
(`"use server"`), invocados desde los componentes cliente.

| Acción | Firma | Efecto |
|--------|-------|--------|
| Listar | `getSupplies()` | `prisma.supply.findMany` ordenado por `name`; en error devuelve `[]`. |
| Crear | `createSupply(data)` | Valida nombre/unidad y crea con stock 0. |
| Ajustar | `registerInventoryAdjustment(supplyId, actualQuantity, reason, movementType?)` | Transacción: movimiento + `currentStock = actualQuantity`. |
| Kardex | `getInventoryMovements(supplyId?)` | Movimientos ordenados por `movedAt` descendente (**sin consumidores en la UI**). |

### Campos de `SupplyInput`

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `name` | string | Sí | Se guarda recortado; columna de 50 caracteres. |
| `type` | `RawMaterial` \| `FinishedProduct` | No | Default `RawMaterial`. |
| `unitOfMeasure` | string | Sí | Se guarda recortado; el diálogo escribe en mayúsculas. |
| `minimumStock` | number | No | Default `0`; el diálogo arranca en 5. |

### Respuesta

`createSupply` devuelve la entidad creada; `registerInventoryAdjustment` devuelve
`{ movement, supply }` con el insumo ya actualizado. Los errores se lanzan como `Error` y
llegan al cliente como mensaje de toast.

## Permissions

- **Requerido**: ninguno. Los Server Actions no verifican sesión/cookie/rol y no existe
  middleware de autorización activo (`middleware.ts` inexistente, `proxy.ts.desactivado`).
- Cualquier cliente que alcance la aplicación puede crear insumos y reescribir el stock de
  cualquiera de ellos.
- Los enlaces "Inventario / Insumos" (sidebar) y la tarjeta del dashboard no aplican filtro de
  rol.

## Validations

**Servidor**: nombre no vacío → unidad no vacía (alta); cantidad no negativa → motivo no vacío
→ existencia del insumo (ajuste).

**Cliente**: `required` en nombre, unidad, stock físico y motivo; `min="0"` y `step="0.01"` en
los campos numéricos; bloqueo extra de motivo vacío con
`toast.error("El motivo del ajuste o merma es obligatorio")`.

## Acceptance Criteria

1. **When** se crea un insumo **Then** queda con stock 0, tipo por defecto y estado activo, y
   la tabla lo muestra con su código `INS-###`.
2. **When** el stock real es menor o igual al mínimo **Then** la fila marca "Bajo Stock".
3. **When** se registra un ajuste **Then** el movimiento y el nuevo stock se persisten juntos
   y la tabla local refleja el valor actualizado sin recargar.
4. **When** faltan nombre, unidad o motivo, o la cantidad es negativa **Then** se rechaza con
   el mensaje exacto documentado.
5. **When** no hay insumos (o la carga falla) **Then** se muestra el estado vacío documentado.
6. **When** un insumo necesita editar su nombre o unidad **Then** no hay ninguna acción
   disponible para hacerlo (sólo alta y ajuste).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Listar el inventario completo ordenado por nombre en `/purchases/inventory`
  con `dynamic = "force-dynamic"`.
- **FR-002**: Permitir crear insumos validando nombre y unidad, con stock inicial 0, tipo por
  defecto y stock mínimo configurable.
- **FR-003**: Mostrar por fila el código derivado, tipo, unidad, stock actual/mínimo a 2
  decimales y el estado "Bajo Stock"/"Óptimo".
- **FR-004**: Registrar ajustes y mermas en transacción, con movimiento firmado igual a la
  diferencia y motivo obligatorio.
- **FR-005**: Ofrecer búsqueda local por nombre, código y tipo.
- **FR-006**: Mantener el estado local sincronizado tras crear un insumo o aplicar un ajuste.
- **FR-007**: Publicar en el dashboard de Compras el conteo de insumos en bajo stock.

### Non-Functional Requirements

- **NFR-001**: Transporte por Server Actions (sin endpoint REST propio) y página
  `force-dynamic`.
- **NFR-002**: La escritura del stock es transaccional; los errores de lectura se degradan a
  lista vacía (`catch → []` + `console.error`).
- **NFR-003**: Sin autenticación ni autorización en ninguna de las acciones.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Todo insumo creado existe con `currentStock: 0` y `active: true`.
- **SC-002**: Tras un ajuste, `currentStock` coincide exactamente con la cantidad física
  cargada y existe un `InventoryMovement` con la diferencia y el motivo.
- **SC-003**: La regla `<=` marca siempre como "Bajo Stock" a los insumos en o por debajo del
  mínimo (misma regla que usa el badge del dashboard).
- **SC-004**: Todos los rechazos muestran el mensaje exacto documentado.
- **SC-005**: El inventario se consulta sin paginación ni recargas adicionales para verlo
  completo.

---

## Requirements Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US2 | `getSupplies()` en `app/purchases/inventory/page.tsx` |
| FR-002 | US1 escenarios 1-5 | `createSupply` + `SupplyDialog` |
| FR-003 | US2 escenarios 1-3 | `InventoryTable` (código, badges, `toFixed(2)`) |
| FR-004 | US3 escenarios 1-6 | `registerInventoryAdjustment` + `AdjustmentDialog` |
| FR-005 | US2 escenario 3 | `filtered` en `InventoryTable` |
| FR-006 | Edges de estado local | `handleNewSupplySuccess` / `handleAdjustmentSuccess` |
| FR-007 | US2 escenario 2 | `lowStockSupplies` en `app/purchases/page.tsx` |

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| Server Actions: listar, crear, ajustar y leer movimientos con sus mensajes | `lib/services/purchases/supply.ts` líneas 1-104 |
| Validaciones de alta (nombre/unidad), tipo por defecto y stock inicial 0 | `lib/services/purchases/supply.ts` líneas 24-42 |
| Ajuste: validaciones, transacción, `quantity` firmado y `currentStock` | `lib/services/purchases/supply.ts` líneas 44-84 |
| `getInventoryMovements` sin consumidores | `lib/services/purchases/supply.ts` líneas 86-104 (grep sin usos) |
| Modelos y enums (`Supply`, `SupplyType`, `InventoryMovementType`) | `prisma/schema.prisma` líneas 32-49, 235-255 y 278-298 |
| Página `force-dynamic` que pasa el inventario a la tabla | `app/purchases/inventory/page.tsx` líneas 1-31 |
| Tabla: columnas, código `INS-###`, regla `<=`, estados y búsqueda | `components/purchases/inventory/InventoryTable.tsx` líneas 41-161 |
| Diálogo de alta (defaults `KG`/5, tipo en mayúsculas, botones) | `components/purchases/inventory/SupplyDialog.tsx` líneas 43-74 y 85-159 |
| Diálogo de ajuste: resumen de diferencia, tipos, motivo y toasts | `components/purchases/inventory/AdjustmentDialog.tsx` líneas 64-91 y 103-188 |
| Reutilización del diálogo de alta en otras 3 pantallas | `components/purchases/add/PurchaseOrderForm.tsx` 373-377, `transformation/TransformationForm.tsx` 357-362, `manual-entry/PurchaseWithoutVoucherForm.tsx` 218-222 |
| Badge del dashboard (`bajo stock` / `insumos`) | `app/purchases/page.tsx` líneas 37-39, 80-87 |
| Enlace "Inventario / Insumos" del sidebar | `components/personalized/Sidebar.tsx` líneas 234-242 |
| Pruebas (stock inicial 0 y ajuste recalculando stock) | `lib/services/purchases/purchases.service.test.ts` líneas 117-159 |
| Otros caminos que modifican el stock | `lib/services/purchases/receiving.ts` 105, `transformation.ts` 73/106, `purchase-without-voucher.ts` 63 |

**No existen pruebas de `getSupplies` ni de `getInventoryMovements`.**

**Fuera de alcance**: órdenes de compra, recepción de mercadería, transformación de insumos,
compra sin comprobante y cualquier ajuste contable del inventario.

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
