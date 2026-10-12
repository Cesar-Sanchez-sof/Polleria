# Feature Specification: Compra Menor Sin Comprobante

**Feature Branch**: `017-compra-menor-sin-comprobante`

**Created**: 2026-10-05
**Updated**: 2026-10-11
**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature 
*compra menor sin comprobante*, que registra compras informales sin 
boleta ni factura. Cubre dos tipos: insumos de cocina (que ingresan al 
inventario) y gastos operativos (que solo van a contabilidad). Incluye 
anulación con motivo."

> **Nota de procedencia**: especificación **actualizada** para reflejar 
> el nuevo alcance con categorías de gasto y anulación. Alta de insumos 
> (spec `015`), proveedores (spec `014`), transformación (spec `023`) 
> son features separadas.

---

## Purpose

Registrar compras informales (sin boleta ni factura) de dos tipos:

1. **Insumo de cocina**: mercadería que ingresa al inventario (pollo, 
   papa, aceite, sal). Aumenta `currentStock` y recalcula costos.
2. **Gasto operativo**: servicios o gastos que no van al inventario 
   (cantante, personal eventual, transporte, suministros de limpieza). 
   Se registra solo para contabilidad.

Ambos tipos permiten anulación con motivo, sin eliminar el registro.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar una compra de insumo de cocina (Priority: P1)

Como encargado de almacén, quiero registrar una compra informal de un 
insumo de cocina para que el stock aumente y el costo promedio se 
actualice correctamente.

**Acceptance Scenarios**:

1. **Given** un insumo con stock 10 y averageCost 8.00,
   **When** se registra una compra de 5 unidades por S/ 50 (costo 
   unitario 10.00),
   **Then** en una transacción se crea la `InformalPurchase` con 
   `purchaseType: InventoryItem`, un `InventoryMovement` con 
   `informalPurchaseId` linkeado, y el insumo queda con 
   `currentStock: 15`, `lastCost: 10.00`, `averageCost: 8.67`.

2. **Given** que el mismo formulario, **When** se completa con 
   insumo, cantidad y monto válidos, **Then** aparece el toast 
   "Compra menor registrada exitosamente".

3. **Given** sin insumo seleccionado, **When** se envía, **Then** 
   error `Debe seleccionar un insumo`.

4. **Given** cantidad 0 o negativa, **When** se envía, **Then** 
   `La cantidad debe ser mayor a 0`.

5. **Given** monto 0 o negativo, **When** se envía, **Then** 
   `El monto pagado debe ser mayor a 0`.

---

### User Story 2 - Registrar un gasto operativo (Priority: P1)

Como administrador, quiero registrar un gasto operativo informal 
(cantante, mozo eventual, transporte) para que quede constancia 
contable sin contaminar el inventario.

**Acceptance Scenarios**:

1. **Given** el usuario selecciona "Gasto operativo" en el toggle,
   **When** completa descripción "Cantante aniversario", categoría 
   "Servicios eventuales", monto 300, fecha,
   **Then** se crea `InformalPurchase` con `purchaseType: 
   OperatingExpense`, `expenseCategory: EventServices`, 
   `itemDescription: "Cantante aniversario"`, `supplyId: null`.

2. **Given** la misma operación, **Then** NO se crea ningún 
   `InventoryMovement` y ningún `Supply` se modifica.

3. **Given** sin descripción, **When** se envía, **Then** error 
   `La descripción del gasto es obligatoria`.

4. **Given** sin categoría, **When** se envía, **Then** error 
   `Debe seleccionar una categoría de gasto`.

5. **Given** un gasto operativo registrado, **When** se ve la tabla,
   **Then** la fila muestra `purchaseType: "Gasto"`, la categoría 
   legible, y la descripción.

---

### User Story 3 - Ver el historial con filtros (Priority: P2)

Como usuario, quiero ver todas las compras menores con su tipo y 
categoría, y poder filtrar por tipo, para auditar lo registrado.

**Acceptance Scenarios**:

1. **Given** compras registradas, **When** se carga la página, 
   **Then** la tabla lista Fecha, Tipo (badge), Insumo/Descripción, 
   Categoría, Cantidad, Monto, Costo Unit., Lugar/Proveedor, 
   Registrado por, Estado, Acciones.

2. **Given** el filtro "Solo insumos", **When** se aplica, **Then** 
   solo muestra `purchaseType: InventoryItem`.

3. **Given** el filtro "Solo gastos", **Then** solo muestra 
   `purchaseType: OperatingExpense`.

4. **Given** el buscador, **When** escribes "pollo", **Then** filtra 
   por nombre de insumo, descripción o lugar.

5. **Given** una compra anulada, **Then** muestra badge gris 
   "Anulado" y se ve en el historial.

---

### User Story 4 - Anular una compra (Priority: P1)

Como administrador, quiero anular una compra menor registrada por 
error, dejando constancia del motivo y revirtiendo el stock si 
corresponde.

**Acceptance Scenarios**:

1. **Given** una compra de insumo de 5 unidades y stock actual 20,
   **When** se anula con motivo "Error de tipeo",
   **Then** en una transacción:
   - Se crea `InventoryMovement` inverso (quantity: -5)
   - El insumo queda con `currentStock: 15`
   - La compra queda con `anulado: true`, `motivoAnulacion`, 
     `anuladoPor`, `anuladoAt`

2. **Given** una compra de insumo de 10 unidades, **When** el stock 
   actual del insumo es 3 (< 10), **Then** se rechaza con error 
   `Stock insuficiente para revertir. Stock actual: 3, necesario: 10`.

3. **Given** un gasto operativo, **When** se anula, **Then** solo 
   se marca como anulado, no toca stock.

4. **Given** una compra ya anulada, **When** se intenta anular de 
   nuevo, **Then** error `Esta compra ya está anulada`.

5. **Given** sin motivo, **When** se intenta anular, **Then** error 
   `El motivo de anulación es obligatorio`.

---

### Edge Cases

- **Sin límite de monto**: no se valida tope de monto ni de cantidad.
- **Fecha libre**: se acepta cualquier fecha; default hoy.
- **Responsable automático**: `getOrCreateActiveEmployee` (activo → 
  cualquiera → empleado por defecto DNI 00000000).
- **Movimiento enlazado**: `InventoryMovement.informalPurchaseId` 
  apunta a la compra. Trazabilidad completa.
- **Costos actualizados**: `lastCost` y `averageCost` se actualizan 
  con promedio ponderado móvil al registrar un insumo de cocina.
- **No se actualiza `affectationIgv`**: la compra informal nunca 
  toca ese campo. Solo la compra formal lo hace.
- **Sin IGV en compras informales**: no se separa IGV en el asiento 
  contable ni en los cálculos. El monto pagado es el monto completo.
- **Refresco del servidor**: `router.refresh()` tras registrar o 
  anular.
- **Categorías amigables**: el usuario ve 5 categorías legibles; el 
  backend las mapea a cuentas PCGE (responsabilidad de Contabilidad).
- **`affectationIgv: null` en insumos nuevos**: al crear un insumo 
  desde esta pantalla, se crea con `null`. Se resuelve cuando se 
  compre formalmente.
- **Sin control de acceso**: Server Actions sin autenticación.

---

## Functionalidades / Functionalities

- **Página `/purchases/purchase-without-voucher`** (Server 
  Component, `force-dynamic`).
- **Server Actions**:
  - `registerPurchaseWithoutVoucher(data)` — crear compra 
    (condicional por tipo)
  - `annulInformalPurchase(id, motivo, employeeId)` — anular
  - `getPurchasesWithoutVoucher()` — historial con todos los campos
- **Formulario "Registrar Compra Menor"** con:
  - Toggle: Insumo de cocina / Gasto operativo
  - Selector de insumo (solo si Insumo) o descripción (solo si Gasto)
  - Selector de categoría (solo si Gasto)
  - Cantidad, Monto, Fecha
  - Lugar/Proveedor, Motivo (opcional en Gastos)
  - Botón "+ Crear Insumo"
- **Tabla "Historial"** con KPIs, búsqueda, filtros, botón anular.
- **Diálogo "Anular compra"** con motivo obligatorio.

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Tipo de compra** | `purchaseType`: `InventoryItem` (insumo) u `OperatingExpense` (gasto). |
| BR-2 | **Insumo obligatorio si InventoryItem** | Debe existir `supplyId` y el insumo debe existir. |
| BR-3 | **Descripción y categoría obligatorias si OperatingExpense** | `itemDescription` y `expenseCategory` requeridos. |
| BR-4 | **Cantidad y monto positivos** | `quantity > 0` y `amountPaid > 0` para insumos. |
| BR-5 | **Costo unitario implícito** | `unitCost = amountPaid / quantity` para insumos. |
| BR-6 | **Ingreso atómico** | Toda operación ocurre en `prisma.$transaction`. |
| BR-7 | **Stock y promedio** | Para insumos: `currentStock += quantity`, `lastCost = unitCost`, `averageCost = promedio ponderado móvil`. |
| BR-8 | **Movimiento enlazado** | `InventoryMovement.informalPurchaseId` se llena con el id de la compra. |
| BR-9 | **Sin IGV** | En compras informales NUNCA se separa IGV. No se toca `affectationIgv`. |
| BR-10 | **Anulación con motivo** | Requiere `motivo` no vacío. Marca `anulado: true` + `anuladoAt` + `anuladoPor` + `motivoAnulacion`. |
| BR-11 | **Reversión de stock al anular** | Para insumos: crea movimiento inverso y resta del stock. Bloquea si stock < cantidad comprada. |
| BR-12 | **Historial inmutable** | No se eliminan registros; solo se anulan. |
| BR-13 | **6 categorías de gasto** | CasualStaff, EventServices, TransportAndDelivery, CleaningSupplies, OtherMinorExpenses. |
| BR-14 | **Sin control de acceso** | Server Actions sin validación de sesión/rol. |

## Endpoint / Transporte

**Server Actions** en `lib/services/purchases/purchase-without-voucher.ts`:

| Acción | Firma | Efecto |
|--------|-------|--------|
| Registrar | `registerPurchaseWithoutVoucher(data)` | Transacción condicional por tipo. |
| Anular | `annulInformalPurchase(id, motivo, employeeId)` | Marca anulado + revierte stock si aplica. |
| Historial | `getPurchasesWithoutVoucher()` | Lista completa con todos los campos y relaciones. |

### Campos de `PurchaseWithoutVoucherInput`

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `purchaseType` | `"InventoryItem" \| "OperatingExpense"` | No | Default `InventoryItem`. |
| `supplyId` | number | Solo InventoryItem | |
| `expenseCategory` | enum de 5 categorías | Solo OperatingExpense | |
| `itemDescription` | string (max 200) | Solo OperatingExpense | |
| `quantity` | number | Solo InventoryItem | `> 0`. |
| `amountPaid` | number | Sí | `> 0`. |
| `date` | Date \| string | No | Default `now()`. |
| `informalPlaceOrVendor` | string (max 150) | No | |
| `reason` | string (max 150) | No | Obligatorio para insumos. |

## Permissions

- **Requerido**: ninguno. Sin middleware de autorización activo.

## Validations

**Servidor** — orden:
1. `purchaseType` presente (default InventoryItem)
2. Si InventoryItem: `supplyId`, `quantity > 0`, `amountPaid > 0`, insumo existe
3. Si OperatingExpense: `itemDescription` no vacío, `expenseCategory` válido, `amountPaid > 0`
4. Al anular: motivo no vacío, compra existe, no está anulada, si es insumo: stock suficiente

**Cliente** — mismos mensajes antes de invocar la acción.

## Acceptance Criteria

1. **When** se registra un insumo válido, **Then** se crean `InformalPurchase` + `InventoryMovement` linkeados + se actualiza `Supply`.
2. **When** se registra un gasto válido, **Then** solo se crea `InformalPurchase`, sin tocar inventario.
3. **When** se anula un insumo con stock suficiente, **Then** se revierte el stock y se marca anulado.
4. **When** se anula un insumo con stock insuficiente, **Then** se rechaza con mensaje claro.
5. **When** se anula un gasto, **Then** solo se marca como anulado.
6. **When** falta un campo obligatorio según el tipo, **Then** se rechaza con mensaje específico.
7. **When** el historial se carga, **Then** muestra KPIs, filtros y tipo por fila.
8. **When** no hay compras, **Then** empty state.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Registrar compras con `purchaseType` (InventoryItem o OperatingExpense).
- **FR-002**: Para InventoryItem: crear `InformalPurchase` + `InventoryMovement` linkeado + actualizar `currentStock`, `lastCost`, `averageCost`.
- **FR-003**: Para OperatingExpense: crear `InformalPurchase` sin tocar inventario.
- **FR-004**: 6 categorías de gasto legibles para el usuario.
- **FR-005**: Anulación con motivo obligatorio; reversión de stock para insumos.
- **FR-006**: Bloqueo de anulación si stock insuficiente.
- **FR-007**: Listar historial con todos los campos y relaciones.
- **FR-008**: KPIs, búsqueda y filtros por tipo/estado.
- **FR-009**: Validaciones específicas por tipo de compra.
- **FR-010**: Refresco del servidor tras operaciones.

### Non-Functional Requirements

- **NFR-001**: Server Actions; página `force-dynamic`.
- **NFR-002**: Escritura transaccional; lectura con `catch → []`.
- **NFR-003**: Sin autenticación ni autorización.

---

## Success Criteria *(mandatory)*

- **SC-001**: Todo InventoryItem registrado incrementa stock exactamente en `quantity`.
- **SC-002**: Todo InventoryItem tiene `unitCost = amountPaid / quantity` y su `InventoryMovement.informalPurchaseId` no es null.
- **SC-003**: `averageCost` se actualiza por promedio ponderado móvil.
- **SC-004**: Ningún OperatingExpense modifica inventario.
- **SC-005**: Ninguna anulación deja stock negativo.
- **SC-006**: Toda anulación deja registro con motivo, fecha y empleado.

---

## Fuera de alcance

- Compras con comprobante (van a "Añadir Compra" o Contabilidad).
- Edición de compras ya registradas.
- Eliminación física de compras.
- Adjuntar imágenes de boletas.
- Reportes de Kardex específicos.
- Autorización por rol.

---

## Dudas abiertas

- [NECESITA ACLARACIÓN] ¿La anulación también revierte el `averageCost`? (Decisión actual: NO, se mantiene histórico)
- [NECESITA ACLARACIÓN] ¿Se permite anular compras de meses anteriores? (Decisión actual: SÍ, sin restricción)

---

*Última actualización: 2026-10-11*