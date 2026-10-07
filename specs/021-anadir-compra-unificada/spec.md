# Feature Specification: Añadir Compra Unificada

**Feature Branch**: `021-anadir-compra-unificada`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la nueva feature 
*añadir compra unificada*, que reemplaza el flujo anterior de Orden de Compra + 
Recepción + Comprobante + Pago por un único formulario que registra todo el acto 
de compra en una sola transacción."

> **Nota de procedencia**: especificación de una **feature aún no implementada**. 
> Los requisitos derivan del rediseño del flujo de compras (retroalimentación del 
> profesor, 2026-10) y de las decisiones tomadas con el equipo. Las tablas de la 
> base de datos ya existen y están aplicadas en Neon. Este spec es la fuente de 
> verdad para la implementación que se hará en las siguientes sesiones.

---

## Purpose

Registrar una compra completa (proveedor, comprobante, insumos con IGV por línea, 
y método de pago) en un único formulario que crea, en una sola transacción:

- `PurchaseOrder` con estado directo `FullyReceived`
- `PurchaseOrderItem` por cada línea con snapshot de IGV
- `PurchaseInvoice` (comprobante del proveedor)
- `PurchasePayment` si el pago es Contado
- `InventoryMovement` por cada línea (entrada de stock)
- Actualización de `Supply.currentStock`, `Supply.lastCost` y `Supply.averageCost`

Reemplaza los módulos separados de Orden de Compra, Recepción, Comprobante y Pago.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar una compra al contado (Priority: P1)

Como encargado de almacén, quiero registrar una compra al contado con su 
comprobante para que el stock aumente automáticamente y quede constancia 
contable en un solo paso.

**Why this priority**: es el caso más común en una pollería y desbloquea todo 
el flujo de inventario.

**Independent Test**: completar el formulario con proveedor + comprobante + 1 
línea + pago Contado → verificar que se crean las 5 filas esperadas y que el 
stock sube.

**Acceptance Scenarios**:

1. **Given** proveedor existente, comprobante válido y una línea con cantidad > 0,
   **When** el usuario guarda con método de pago "Contado",
   **Then** en una sola transacción se crean: `PurchaseOrder` (status = `FullyReceived`),
   `PurchaseOrderItem`, `PurchaseInvoice`, `PurchasePayment` y `InventoryMovement`;
   el stock del insumo sube; aparece el toast "Compra registrada exitosamente".

2. **Given** el mismo escenario pero con método "Crédito",
   **When** el usuario guarda,
   **Then** NO se crea `PurchasePayment`, la factura queda pendiente, y el stock 
   sube igual.

3. **Given** un insumo con `currentStock: 10` y `averageCost: 9.00`,
   **When** se registra una compra de 5 unidades a 10.00 cada una,
   **Then** el insumo queda con `currentStock: 15`, `lastCost: 10.00`, 
   `averageCost: 9.33` (promedio ponderado móvil redondeado a 2 decimales).

---

### User Story 2 - Registrar una compra con IGV mixto (Priority: P1)

Como encargado de almacén, quiero que el sistema calcule el IGV por línea según 
la configuración de cada insumo, para que las compras con distintos tratamientos 
tributarios queden correctas.

**Why this priority**: es el requisito explícito del profesor sobre el flujo 
unificado (imagen "Lógica de Recepción Mixta de Insumos").

**Independent Test**: registrar una compra con 2 líneas, una con insumo `Included` 
y otra con insumo `Excluded`, y verificar los subtotales e IGV por línea.

**Acceptance Scenarios**:

1. **Given** un insumo con `affectationIgv: "Included"` y precio unitario 100,
   **When** se agrega a una línea con cantidad 1,
   **Then** el sistema calcula `subtotal_line = 84.75`, `igv_line = 15.25`, 
   `final_amount_line = 100.00`.

2. **Given** un insumo con `affectationIgv: "Excluded"` y precio unitario 50,
   **When** se agrega a una línea con cantidad 1,
   **Then** el sistema calcula `subtotal_line = 50.00`, `igv_line = 9.00`, 
   `final_amount_line = 59.00`.

3. **Given** el formulario con ambas líneas,
   **When** se visualiza el pie de página,
   **Then** se muestra: `Subtotal General = 134.75`, `IGV General = 24.25`, 
   `Monto Total = 159.00`.

4. **Given** una compra guardada con mezcla de IGV,
   **When** se consulta el `PurchaseOrderItem` en la BD,
   **Then** cada línea conserva la "foto" de su afectación y sus montos 
   (`affectation_igv_applied`, `subtotal_line`, `igv_line`, `final_amount_line`).

---

### User Story 3 - Crear un proveedor en línea (Priority: P2)

Como encargado de almacén, quiero poder crear un proveedor sin salir del 
formulario de compra, para no interrumpir el flujo.

**Why this priority**: reduce fricción pero no es bloqueante.

**Independent Test**: pulsar "+ Nuevo proveedor" → completar diálogo → confirmar → 
el proveedor aparece seleccionado en el formulario.

**Acceptance Scenarios**:

1. **Given** el formulario de compra abierto,
   **When** el usuario pulsa "+ Nuevo proveedor",
   **Then** se abre el `SupplierDialog` existente.

2. **Given** el diálogo completado y confirmado,
   **When** el proveedor se crea exitosamente,
   **Then** el diálogo se cierra, el proveedor queda seleccionado automáticamente 
   en el formulario, y no se pierde el contenido ya ingresado en las otras líneas.

---

### User Story 4 - Crear un insumo en línea (Priority: P1)

Como encargado de almacén, quiero poder crear un insumo mientras escribo en la 
fila de detalle, sin salir del flujo de compra.

**Why this priority**: es la forma principal de dar de alta insumos en el nuevo 
flujo; sin esto, el usuario debe abandonar la compra para crear el insumo.

**Independent Test**: escribir un nombre no existente en la fila → pulsar 
"Crear '[nombre]'" → completar el diálogo → la fila queda con el insumo 
seleccionado.

**Acceptance Scenarios**:

1. **Given** el usuario escribe "Queso fresco" en la fila de insumo y no existe,
   **When** se muestra el dropdown de búsqueda,
   **Then** aparece una opción al final: `+ Crear "Queso fresco"`.

2. **Given** el usuario selecciona esa opción,
   **When** el diálogo se abre,
   **Then** el campo nombre viene pre-rellenado con "Queso fresco", y el 
   usuario completa unidad, tipo y afectación IGV.

3. **Given** el insumo se crea exitosamente,
   **When** se cierra el diálogo,
   **Then** el insumo aparece seleccionado en la fila, con `currentStock: 0`, 
   y también impacta en Inventario/Insumos.

---

### User Story 5 - Buscar insumos con autocompletado (Priority: P1)

Como encargado de almacén, quiero escribir en la fila de insumo y ver 
coincidencias en tiempo real para encontrar rápido el insumo correcto.

**Independent Test**: escribir "po" → aparece "Pollo entero", "Pollo 
rostizado", etc.

**Acceptance Scenarios**:

1. **Given** el usuario escribe 1+ caracteres,
   **When** el sistema busca,
   **Then** muestra insumos cuyo nombre contenga el texto (case-insensitive), 
   máximo 10 resultados.

2. **Given** el usuario selecciona un insumo existente,
   **When** se confirma la selección,
   **Then** la fila autocompleta: unidad de medida, afectación IGV y costo 
   referencial (`lastCost` si existe).

3. **Given** el usuario cambia el insumo seleccionado por otro,
   **When** se confirma,
   **Then** los campos autocompletados se actualizan al nuevo insumo.

---

### User Story 6 - Calcular totales en tiempo real (Priority: P2)

Como usuario, quiero ver los totales actualizarse mientras completo el 
formulario, para saber cuánto estoy pagando antes de guardar.

**Independent Test**: cambiar cantidad o precio en una línea → el pie de página 
se actualiza inmediatamente.

**Acceptance Scenarios**:

1. **Given** una línea con cantidad 2, precio 10, afectación `Included`,
   **When** se modifica la cantidad a 3,
   **Then** los campos `subtotal_line`, `igv_line`, `final_amount_line` y los 
   totales del pie se recalculan inmediatamente.

2. **Given** el formulario vacío,
   **When** se agrega la primera línea,
   **Then** el pie de página muestra el subtotal/IGV/total de esa línea.

---

### Edge Cases

- **Sin líneas**: el botón "Guardar Compra" está deshabilitado si no hay al 
  menos una línea con cantidad > 0.
- **Sin proveedor**: igual, bloqueado.
- **Sin tipo/serie/número de comprobante**: bloqueado.
- **Comprobante duplicado** (mismo proveedor + tipo + serie + número): el 
  backend rechaza con "Ya existe un comprobante con ese número para este 
  proveedor".
- **Cantidad con más de 2 decimales**: se redondea o rechaza (definir con el 
  equipo).
- **Precio unitario negativo**: bloqueado en cliente y servidor.
- **Cantidad en 0**: la línea se considera "vacía" y no se guarda, sin bloquear.
- **Insumo con `affectationIgv` sin definir**: default `Excluded`.
- **Fallback de `receivedById`**: si el usuario logueado no tiene empleado 
  asociado, usar el primer empleado activo (helper `getOrCreateActiveEmployee` 
  que ya existe).
- **Fallo en la transacción**: si algo falla a mitad, la BD queda intacta 
  (rollback automático).
- **Concurrencia**: si dos usuarios guardan el mismo comprobante casi al mismo 
  tiempo, el constraint UNIQUE del backend rechaza el segundo.
- **Insumo recién creado en línea**: la fila queda seleccionada, pero el insumo 
  no aparece en Inventario/Insumos hasta la próxima carga (comportamiento 
  aceptado, igual que en otros módulos).

---

## Functionalidades / Functionalities

- **Página `/purchases/add`** (Client Component): formulario unificado con 3 
  bloques.
- **Server Actions** (`lib/services/purchases/purchase-order.ts` reescrito): 
  `registerUnifiedPurchase(data)`.
- **Componente `<PurchaseOrderForm />`** (reescrito): contiene los 3 bloques.
- **Componente `<SupplySearchSelect />`** (nuevo): selector con búsqueda 
  dinámica y opción "Crear '[nombre]'".
- **Reutilización de `<SupplierDialog />`** existente para crear proveedor en 
  línea.
- **Reutilización de `<SupplyDialog />`** existente para crear insumo en línea, 
  con opción de pre-rellenar el nombre.

### Bloques del formulario

**Bloque A — Proveedor**
- Selector con autocompletado (busca por RUC o razón social).
- Botón "+ Nuevo proveedor" que abre el `SupplierDialog`.

**Bloque B — Comprobante y Pago**
- Tipo de comprobante (Factura / Boleta / Otro).
- Serie (4 chars).
- Número (numérico).
- Fecha de emisión (Date, default hoy).
- Método de pago: Contado / Crédito.
- (Si Contado) Tipo de pago concreto: Caja, Banco, Yape, etc.

**Bloque C — Detalle de Insumos (líneas)**
- Tabla editable con: insumo, unidad, cantidad, precio unitario, 
  afectación IGV, subtotal, IGV, monto final.
- Botón "+ Agregar línea" y botón de eliminar por fila.
- Cálculo automático en cada cambio.

**Pie de página**
- Subtotal General.
- IGV General.
- Monto Total.
- Botón "Guardar Compra".

---

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Transacción única** | Todos los INSERTs ocurren en un `prisma.$transaction`. Si algo falla, nada se guarda. |
| BR-2 | **Estado directo** | `PurchaseOrder` nace con `status = 'FullyReceived'`, `receivedById` y `receivedAt`. |
| BR-3 | **Snapshot IGV** | `PurchaseOrderItem` guarda `affectationIgvApplied`, `subtotalLine`, `igvLine`, `finalAmountLine` (foto inmutable). |
| BR-4 | **Cálculo IGV Incluido** | `subtotal = (cantidad × precio) / 1.18`; `igv = (cantidad × precio) − subtotal`. |
| BR-5 | **Cálculo IGV Excluido** | `subtotal = cantidad × precio`; `igv = subtotal × 0.18`. |
| BR-6 | **Costo unitario del movimiento** | `unitCost = precio_unitario` si `Excluded`, o `precio / 1.18` si `Included`. |
| BR-7 | **Promedio ponderado** | `nuevoPromedio = (stockAntes × avgAntes + cantidad × precioNeto) / (stockAntes + cantidad)`. |
| BR-8 | **Movimiento linkeado** | Cada `InventoryMovement` (tipo `Purchase`) se linkea a su `PurchaseOrderItem`. |
| BR-9 | **Comprobante único** | No puede existir 2 veces la misma combinación (proveedor, tipo, serie, número). |
| BR-10 | **Pago condicional** | Solo se crea `PurchasePayment` si el método es "Contado". |
| BR-11 | **Sin eliminación de compras** | Una compra registrada no se elimina; si se requiere, se crea una Nota de Crédito (fuera de alcance). |

---

## Endpoint / Transporte

**No existe endpoint REST propio**: se usa **Server Action** `registerUnifiedPurchase`.

| Acción | Firma | Efecto |
|--------|-------|--------|
| Registrar | `registerUnifiedPurchase(data: UnifiedPurchaseInput)` | Transacción: crea PurchaseOrder + Items + Invoice + Payment (si contado) + InventoryMovements; actualiza Supplies. |
| Buscar insumos | `searchSupplies(query: string, limit?: number)` | Retorna hasta 10 insumos cuyo nombre coincida. |
| Buscar proveedores | Ya existe `getSuppliers()` | Filtrar en cliente. |

### Campos de `UnifiedPurchaseInput`

```typescript
interface UnifiedPurchaseInput {
  supplierId: number;
  receivedById?: number;        // fallback: helper getOrCreateActiveEmployee
  voucherType: string;          // "Factura" | "Boleta" | "Otro"
  series: string;
  number: number;
  issuedAt: Date | string;
  paymentCondition: "Contado" | "Credito";
  paymentTypeId?: number;       // obligatorio si Contado
  items: Array<{
    supplyId: number;
    quantity: number;
    unitPrice: number;
    affectationIgv: "Included" | "Excluded";
  }>;
}