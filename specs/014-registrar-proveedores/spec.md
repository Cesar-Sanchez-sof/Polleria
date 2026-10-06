# Feature Specification: Registrar Proveedores

**Feature Branch**: `014-registrar-proveedores`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *registrar
proveedores* (catálogo con RUC/DNI, contacto y estado de actividad), describiendo el
comportamiento real implementado."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y por las pruebas automatizadas
> (`lib/services/purchases/purchases.service.test.ts`, bloque "Módulo 1: Proveedores"), con
> evidencia en [Evidencia de verificación](#evidencia-de-verificación). No se describen
> funcionalidades futuras ni reglas ausentes en la implementación. Órdenes de compra,
> recepción y facturas de proveedor son features separadas.

---

## Purpose

Mantener el catálogo de proveedores de la empresa (documento, razón social, contacto y
dirección) con alta, edición y activación/desactivación, para que el resto del módulo de
Compras pueda referenciarlos.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dar de alta un proveedor (Priority: P1)

Como usuario de Compras, quiero registrar un proveedor con su RUC o DNI y razón social para
poder usarlo en órdenes de compra.

**Why this priority**: es la operación central del catálogo; sin proveedores no se puede emitir
una orden de compra (la orden exige `supplierId`).

**Independent Test**: enviar `createSupplier({ ruc: "20123456789", businessName: "…" })` → se
crea el registro; con un documento repetido lanza el error de duplicado.

**Acceptance Scenarios**:

1. **Given** no existe ese documento, **When** se envía un RUC de 11 dígitos con razón social,
   **Then** se crea el proveedor con `active: true` y se muestra el toast "Proveedor registrado
   exitosamente".
2. **Given** el documento tiene 11 caracteres, **When** el usuario elige tipo "DNI" en el
   diálogo, **Then** la validación de cliente exige 8 → `toast.error("El DNI debe tener
   exactamente 8 dígitos")` y no se envía.
3. **Given** un documento de longitud distinta de 8 u 11, **When** se invoca
   `createSupplier`, **Then** lanza `El documento debe tener 8 dígitos (DNI) u 11 dígitos
   (RUC)`.
4. **Given** razón social vacía, **When** se invoca el servicio, **Then** lanza `La razón
   social o nombre es obligatorio`.
5. **Given** un proveedor con ese documento ya registrado, **When** se intenta crear otro,
   **Then** lanza `Ya existe un proveedor registrado con el documento <doc>`.
6. **Given** datos opcionales vacíos (contacto, dirección, teléfono, correo), **When** se
   guarda, **Then** se persisten como `null`.

---

### User Story 2 - Editar un proveedor (Priority: P1)

Como usuario, quiero corregir los datos de un proveedor existente sin duplicarlo.

**Why this priority**: es la otra mitad del ciclo de vida del catálogo.

**Independent Test**: `updateSupplier(id, { … })` con el mismo documento conserva el registro;
con un documento ya usado por otro lanza duplicado.

**Acceptance Scenarios**:

1. **Given** un proveedor existente, **When** se actualiza sin cambiar el documento, **Then**
   se guardan los cambios y aparece el toast "Proveedor actualizado exitosamente".
2. **Given** un id inexistente, **When** se actualiza, **Then** lanza `Proveedor no
   encontrado`.
3. **Given** otro proveedor ya usa el nuevo documento, **When** se intenta cambiar el
   documento, **Then** lanza `Ya existe un proveedor registrado con el documento <doc>`.
4. **Given** el payload no trae `active`, **When** se actualiza, **Then** se conserva el valor
   actual del proveedor.

---

### User Story 3 - Activar o desactivar un proveedor (Priority: P2)

Como usuario, quiero alternar el estado de un proveedor para retirarlo del catálogo sin
borrarlo.

**Why this priority**: es un control secundario; el catálogo no permite borrado físico.

**Independent Test**: `setSupplierStatus(id, false)` → el proveedor queda `Inactivo` con el
toast "Proveedor desactivado exitosamente".

**Acceptance Scenarios**:

1. **Given** un proveedor activo, **When** se pulsa el ícono de energía, **Then** pasa a
   `Inactivo` y el estado local se actualiza sin recargar.
2. **Given** un proveedor inactivo, **When** se pulsa de nuevo, **Then** vuelve a `Activo`.
3. **Given** un id inexistente, **When** se cambia el estado, **Then** la acción falla y se
   muestra el toast de error con el mensaje devuelto.

---

### Edge Cases

- **Sin borrado físico**: no existe función `deleteSupplier`; además `PurchaseOrder` y
  `PurchaseInvoice` referencian al proveedor con `onDelete: Restrict`, así que la única baja
  es la desactivación (`active`).
- **El tipo de documento no se guarda**: `documentType` (RUC/DNI) es estado del diálogo; en
  base sólo vive `ruc` y la UI infiere el tipo por longitud (`length === 8 ? "DNI" : "RUC"`).
- **El servidor valida longitud, no dígitos**: `createSupplier`/`updateSupplier` comprueban
  `length === 8 || length === 11`, no que sean numéricos; los dígitos se garantizan sólo en
  cliente (`.replace(/\D/g, "")`).
- **Desactivar un proveedor con id inexistente**: `setSupplierStatus` no verifica existencia y
  la excepción cruda de Prisma llega al toast (sin mensaje propio).
- **Proveedores inactivos siguen siendo utilizables**: ningún componente del módulo de
  Compras filtra por `active`, así que un proveedor "Inactivo" sigue apareciendo en los
  formularios de órdenes y facturas.
- **Orden local vs. servidor**: el servidor ordena por `businessName` ascendente, pero al
  crear/actualizar la tabla local inserta el registro nuevo **al inicio** (no se reordena) hasta
  la siguiente carga.
- **Búsqueda limitada**: sólo cubre `ruc`, `businessName` y `contactPerson` (no dirección,
  teléfono ni correo).
- **Errores de carga silenciosos**: `getSuppliers()` hace `catch → []`, por lo que un fallo de
  base de datos se confunde con "catálogo vacío".
- **Sin límites de longitud en cliente**: `businessName` (150) y `address` (150) no tienen
  `maxLength` en el diálogo → un valor más largo produce un error crudo de Prisma.
- **Sin control de acceso**: ni la página ni los Server Actions validan sesión, cookie ni rol.
- **Estado local sin recarga**: tras crear/editar/desactivar no se vuelve a consultar al
  servidor; los cambios viven en `useState` hasta recargar la página.

---

## Functionalidades / Functionalities

- **Página `/purchases/suppliers`** (Server Component con `dynamic = "force-dynamic"`):
  "Gestión de Proveedores" con tabla, búsqueda y alta/edición.
- **Server Actions** (`lib/services/purchases/supplier.ts`, `"use server"`):
  `getSuppliers`, `createSupplier`, `updateSupplier`, `setSupplierStatus`.
- **`SupplierDialog`**: alta y edición con selector de tipo de documento.
- **Acciones en tabla**: editar y activar/desactivar.
- **Tarjeta del dashboard de Compras**: "1. Gestión de Proveedores" con el badge
  `"<n> activos"` (cuenta sólo los `active`).

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Documento obligatorio** | `ruc` debe tener exactamente 8 (DNI) o 11 (RUC) caracteres. |
| BR-2 | **Razón social obligatoria** | No se permite nombre vacío ni sólo espacios (se `.trim()`). |
| BR-3 | **Documento único** | No pueden existir dos proveedores con el mismo `ruc` (unicidad de columna + chequeo explícito). |
| BR-4 | **Actividad por defecto** | Un proveedor nuevo nace `active: true` salvo indicación. |
| BR-5 | **Baja lógica** | Sólo se alterna `active`; no hay borrado físico. |
| BR-6 | **Opcionales a `null`** | Contacto, dirección, teléfono y correo vacíos se guardan como `null`. |
| BR-7 | **Orden al listar** | `orderBy: { businessName: "asc" }`. |
| BR-8 | **Sin control de acceso** | Ninguna acción valida sesión ni rol. |

## Endpoint / Transporte

**No existe endpoint REST propio**: la funcionalidad opera mediante **Server Actions**
(módulos marcados con `"use server"`), invocados directamente desde los componentes cliente.

| Acción | Firma | Efecto |
|--------|-------|--------|
| Listar | `getSuppliers()` | `prisma.supplier.findMany` ordenado por razón social; en error devuelve `[]`. |
| Crear | `createSupplier(data)` | Valida documento/razón social/duplicado y crea. |
| Editar | `updateSupplier(id, data)` | Valida, comprueba existencia y duplicado si cambia el documento, y actualiza. |
| Estado | `setSupplierStatus(id, active)` | Actualiza `active` sin verificar existencia. |

### Campos de `SupplierInput`

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `ruc` | string | Sí | 8 o 11 caracteres (el alias `documentType` no se persiste). |
| `businessName` | string | Sí | Se guarda recortado. |
| `contactPerson` | string | No | `null` si vacío. |
| `address` | string | No | `null` si vacío; columna de 150 caracteres. |
| `phone` | string | No | Sólo dígitos en cliente, `maxLength` 9. |
| `email` | string | No | `type="email"` en cliente; sin validación en servidor. |
| `active` | boolean | No | En edición, si falta se conserva el valor actual. |

### Respuesta

Cada acción devuelve la entidad creada/actualizada de Prisma; la UI la fusiona en su estado
local. Los errores se lanzan como `Error` y llegan al cliente como mensaje de toast.

## Permissions

- **Requerido**: ninguno. Los Server Actions no verifican sesión/cookie/rol y no existe
  middleware de autorización activo (`middleware.ts` inexistente, `proxy.ts.desactivado`).
- Cualquier cliente que alcance la aplicación puede crear, editar y activar/desactivar
  proveedores.
- El enlace "Proveedores" del sidebar y la tarjeta del dashboard no aplican filtro de rol.

## Validations

**Servidor** (por acción): longitud de documento → razón social no vacía → existencia (sólo
al editar) → duplicado (sólo si cambia el documento).

**Cliente** (`SupplierDialog`): longitud exacta según el tipo seleccionado con
`toast.error("El <tipo> debe tener exactamente <n> dígitos")`; sólo dígitos en número de
documento y teléfono; `required` en documento y razón social; `type="email"` en correo.

## Acceptance Criteria

1. **When** se completa el formulario con un documento válido y único **Then** se crea el
   proveedor, se cierra el diálogo y se muestra "Proveedor registrado exitosamente".
2. **When** el documento no tiene la longitud exigida **Then** el cliente bloquea el envío con
   el toast documentado y el servidor rechaza con su propio mensaje si se le invoca
   directamente.
3. **When** se intenta duplicar un documento **Then** ninguna de las vías crea el registro.
4. **When** se edita **Then** los cambios se reflejan en la fila sin recargar la página.
5. **When** se alterna el estado **Then** el badge cambia entre "Activo" e "Inactivo" y el
   toast informa "activado"/"desactivado".
6. **When** no hay proveedores (o la carga falla) **Then** la tabla muestra "No se encontraron
   proveedores registrados."

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Listar el catálogo completo ordenado por razón social en la página de
  proveedores, con `dynamic = "force-dynamic"`.
- **FR-002**: Permitir crear proveedores con documento, razón social y datos de contacto
  opcionales, validando longitud, obligatoriedad y unicidad del documento.
- **FR-003**: Permitir editar un proveedor existente, revalidando y comprobando duplicados
  sólo cuando cambia el documento.
- **FR-004**: Permitir alternar `active` desde la tabla con confirmación por toast.
- **FR-005**: Ofrecer búsqueda local por documento, razón social y persona de contacto.
- **FR-006**: Mantener el estado local sincronizado tras cada operación (alta al inicio,
  edición in situ, cambio de estado in situ).
- **FR-007**: Mostrar el conteo de proveedores activos en el dashboard de Compras.

### Non-Functional Requirements

- **NFR-001**: Transporte por Server Actions (sin endpoint REST propio) y página
  `force-dynamic` (sin caché).
- **NFR-002**: Los fallos de carga se degradan a lista vacía (`catch → []` + `console.error`).
- **NFR-003**: Sin autenticación ni autorización en ninguna de las acciones.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ningún alta sobrevive con un documento duplicado o con longitud inválida.
- **SC-002**: Un proveedor queda desactivado sin desaparecer del histórico (baja lógica).
- **SC-003**: Tras cada operación la tabla refleja el cambio sin recargar la página.
- **SC-004**: El badge del dashboard coincide con el número de filas marcadas "Activo".
- **SC-005**: Todos los rechazos de validación muestran el mensaje exacto documentado.

---

## Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US1 (listado) | `getSuppliers()` en `app/purchases/suppliers/page.tsx` |
| FR-002 | US1 escenarios 1-6 | `createSupplier` + `SupplierDialog.handleSubmit` |
| FR-003 | US2 escenarios 1-4 | `updateSupplier` |
| FR-004 | US3 escenarios 1-3 | `setSupplierStatus` + `handleToggleStatus` |
| FR-005 | Edge "búsqueda limitada" | `filtered` en `SuppliersTable` |
| FR-006 | Edge "estado local" | `handleSuccess` / `setSuppliers` |
| FR-007 | Dashboard | `totalSuppliers` en `app/purchases/page.tsx` |

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| Server Actions: listar, crear, editar y cambiar estado con sus mensajes | `lib/services/purchases/supplier.ts` líneas 1-100 |
| Validación de longitud (8/11), razón social y duplicado en alta | `lib/services/purchases/supplier.ts` líneas 27-54 |
| Existencia, revalidación y duplicado en edición | `lib/services/purchases/supplier.ts` líneas 56-93 |
| `setSupplierStatus` sin chequeo de existencia | `lib/services/purchases/supplier.ts` líneas 95-100 |
| Modelo `Supplier` (`ruc` único, `active` por defecto, `Restrict`) | `prisma/schema.prisma` líneas 184-197 |
| Página `force-dynamic` que pasa el catálogo a la tabla | `app/purchases/suppliers/page.tsx` líneas 1-31 |
| Tabla: columnas, búsqueda, badges y acciones | `components/purchases/suppliers/SuppliersTable.tsx` líneas 43-183 |
| Diálogo: tipo de documento, validación de longitud, toasts y botones | `components/purchases/suppliers/SupplierDialog.tsx` líneas 88-113 y 128-236 |
| Inferencia DNI/RUC por longitud en la tabla | `components/purchases/suppliers/SuppliersTable.tsx` líneas 131-136 |
| Badge de activos en el dashboard | `app/purchases/page.tsx` líneas 36, 47-55 |
| Enlace "Proveedores" del sidebar | `components/personalized/Sidebar.tsx` líneas 252-260 |
| Pruebas (alta válida y documento inválido) | `lib/services/purchases/purchases.service.test.ts` líneas 89-115 |
| Ausencia de filtros por `active` en los formularios de Compras | `components/purchases/**` (sin coincidencias de `.active` fuera de `SuppliersTable`) |

**No existen pruebas de `updateSupplier` ni de `setSupplierStatus`.**

**Fuera de alcance**: órdenes de compra, recepción, facturas y pagos a proveedor, y cualquier
uso de los proveedores en el módulo de Contabilidad.

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
