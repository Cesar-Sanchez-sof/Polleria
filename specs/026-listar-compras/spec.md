# Feature Specification: Listar Compras

**Feature Branch**: `022-listar-compras`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature 
*listar compras*, que reemplaza la pantalla antigua de 'Comprobantes de 
Compra' y ofrece un historial unificado con KPIs, filtros, y registro 
de pagos parciales."

> **Nota de procedencia**: el backend parcialmente existe en 
> `lib/services/purchases/invoices.ts` (`getPurchaseVouchers`, 
> `registerPurchasePayment`, `getPaymentTypes`). El frontend aún no 
> existe. Esta spec define el comportamiento final esperado.

---

## Purpose

Ofrecer un historial auditable de todas las compras registradas con su 
estado de pago, permitiendo registrar abonos a facturas al crédito y 
visualizar el detalle de cada compra (líneas, IGV, proveedor, pagos).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el historial de compras (Priority: P1)

Como administrador, quiero ver todas las compras registradas con su 
proveedor, comprobante, montos y estado de pago, para auditar las 
compras del negocio.

**Independent Test**: con 3 facturas en BD, la tabla muestra 3 filas 
con su estado de pago calculado.

**Acceptance Scenarios**:

1. **Given** la página `/purchases/list` se abre,
   **When** se cargan los datos,
   **Then** se muestra una tabla con: Fecha, Proveedor, Comprobante 
   (tipo + serie + número), Subtotal, IGV, Total, Estado de Pago 
   (badge), Acciones.

2. **Given** una factura con 0 pagos y total > 0,
   **Then** el badge dice "Pendiente" (rojo).

3. **Given** una factura con pagos parciales (0 < Σ < total),
   **Then** el badge dice "Parcial" (amarillo).

4. **Given** una factura con Σ pagos >= total,
   **Then** el badge dice "Pagado" (verde).

5. **Given** la fecha de emisión,
   **Then** se muestra en formato `dd/mm/yyyy`.

---

### User Story 2 - Filtrar y buscar compras (Priority: P2)

Como usuario, quiero filtrar las compras por estado de pago y buscar 
por proveedor o número de comprobante.

**Acceptance Scenarios**:

1. **Given** el buscador,
   **When** se escribe "avicola" o un número de comprobante,
   **Then** la tabla filtra por coincidencias en razón social o 
   número/serie del comprobante.

2. **Given** el filtro de estado,
   **When** se elige "Pendientes",
   **Then** solo muestra las compras con `estadoPago === "Pendiente"`.

3. **Given** los filtros combinados,
   **Then** se aplican con AND lógico.

---

### User Story 3 - Ver el detalle de una compra (Priority: P1)

Como usuario, quiero abrir el detalle de una compra para ver las 
líneas de insumos, sus cantidades, precios, IGV por línea y pagos 
registrados.

**Acceptance Scenarios**:

1. **Given** la fila de una compra,
   **When** se pulsa "Ver detalle",
   **Then** se abre un diálogo o drawer con:
   - Datos del proveedor
   - Datos del comprobante
   - Tabla de líneas (insumo, cantidad, precio, IGV, monto)
   - Lista de pagos registrados con fecha, monto y método
   - Saldo pendiente

2. **Given** una compra al crédito con saldo > 0,
   **Then** el detalle muestra el botón "Registrar Pago".

---

### User Story 4 - Registrar un pago parcial (Priority: P1)

Como administrador, quiero registrar abonos a una factura al crédito, 
pudiendo hacerlo en varias veces.

**Acceptance Scenarios**:

1. **Given** una factura pendiente con saldo S/ 100,
   **When** el usuario abre "Registrar Pago" e ingresa monto 40 + 
   tipo de pago,
   **Then** en una transacción se crea `PurchasePayment` con 
   `amount: 40`, y el estado cambia a "Parcial".

2. **Given** el mismo escenario, **When** el usuario intenta registrar 
   150 (mayor al saldo),
   **Then** el backend rechaza con "El monto supera el saldo pendiente 
   (S/ 100.00)".

3. **Given** el saldo pendiente es 60 y el usuario registra 60,
   **Then** el estado cambia a "Pagado".

4. **Given** el monto es 0 o negativo,
   **Then** se rechaza con "El monto del pago debe ser mayor a 0".

5. **Given** no se selecciona tipo de pago,
   **Then** se rechaza con "Debe seleccionar un tipo de pago".

---

### Edge Cases

- **Compra sin pagos**: estado "Pendiente".
- **Compra con pagos completos**: estado "Pagado".
- **Compra con pagos parciales**: estado "Parcial".
- **Comprobante duplicado**: el UNIQUE constraint del schema lo 
  rechaza a nivel BD.
- **Fecha de emisión muy antigua o futura**: se muestra tal cual.
- **Decimales**: se muestran 2 decimales con `toFixed(2)`.
- **Sin resultados tras filtros**: empty state con mensaje.
- **Error de carga**: se degrada a lista vacía (patrón de otros 
  servicios).
- **Documento del proveedor**: si es DNI (8 chars), se muestra 
  "DNI"; si es RUC (11), "RUC".

---

## Functionalidades / Functionalities

- **Página `/purchases/list`** (Server Component, `force-dynamic`): 
  "Listar Compras" con KPI cards, filtros y tabla.
- **Reutiliza `getPurchaseVouchers`, `registerPurchasePayment` y 
  `getPaymentTypes`** existentes en `invoices.ts`.
- **Componente `<PurchasesTable />`**: tabla con estados de pago.
- **Componente `<PurchaseDetailDialog />`**: detalle con líneas y pagos.
- **Componente `<RegisterPaymentDialog />`**: registro de abonos.
- **Sidebar link** ya existe ("Listar Compras" → `/purchases/list`).

### Bloques de la página

**KPIs (arriba, grid 4 cols)**
- Total Compras (count)
- Monto Total (suma de `totalAmount`)
- Pendientes (count)
- Pagadas (count)

**Filtros (debajo de KPIs)**
- Buscador: por proveedor (businessName/ruc) o comprobante 
  (tipo+serie+número).
- Select de estado: Todos / Pendiente / Parcial / Pagado.

**Tabla**
- Columnas: Fecha, Proveedor, Comprobante, Subtotal, IGV, Total, 
  Estado, Acciones.
- Acciones: "Ver detalle", "Registrar Pago" (si saldo > 0).

---

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Estado calculado** | El estado de pago se calcula comparando Σ pagos contra totalAmount (no se guarda en BD). |
| BR-2 | **Pendiente** | `Σ pagos = 0`. |
| BR-3 | **Parcial** | `0 < Σ pagos < totalAmount`. |
| BR-4 | **Pagado** | `Σ pagos >= totalAmount` y `totalAmount > 0`. |
| BR-5 | **Pago ≤ saldo** | El monto de un pago no puede superar el saldo pendiente + tolerancia de 0.01. |
| BR-6 | **Pago > 0** | El monto debe ser > 0. |
| BR-7 | **Tipo de pago obligatorio** | Debe seleccionarse un tipo de pago activo. |
| BR-8 | **Atomicidad** | El registro de pago ocurre en `prisma.$transaction`. |
| BR-9 | **Sin eliminación** | No hay endpoint para eliminar compras o pagos. |

---

## Endpoint / Transporte

**Server Actions existentes** en `lib/services/purchases/invoices.ts`:

| Acción | Firma | Efecto |
|--------|-------|--------|
| Listar | `getPurchaseVouchers()` | Retorna invoices con `estadoPago`, `totalPagado`, `saldoPendiente`. |
| Registrar pago | `registerPurchasePayment(invoiceId, paymentTypeId, amount)` | Transacción: crea PurchasePayment. |
| Tipos de pago | `getPaymentTypes()` | Retorna tipos activos. |

---

## Permissions

- **Requerido**: ninguno. Server Actions no verifican sesión/rol.
- (Pendiente: middleware de autorización fuera de alcance).

---

## Validations

**Cliente**:
- Monto > 0.
- Tipo de pago seleccionado.
- Si monto > saldo pendiente: advertencia antes de enviar.

**Servidor** (ya implementadas en `registerPurchasePayment`):
- Monto > 0.
- paymentTypeId válido.
- Voucher existe.
- Monto ≤ saldo pendiente + 0.01.

---

## Acceptance Criteria

1. **When** se abre `/purchases/list`, **Then** se muestran KPIs + 
   tabla con todas las compras.
2. **When** se filtra por "Pendientes", **Then** solo aparecen las 
   que tienen 0 pagos.
3. **When** se busca por RUC del proveedor, **Then** filtra 
   correctamente.
4. **When** se abre el detalle de una compra, **Then** muestra 
   líneas + pagos + saldo.
5. **When** se registra un pago válido, **Then** se crea, se actualiza 
   el estado y se muestra toast.
6. **When** se intenta un pago > saldo, **Then** se rechaza con 
   mensaje.
7. **When** no hay compras, **Then** empty state.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Listar todas las PurchaseInvoices con su estado de pago 
  calculado.
- **FR-002**: Mostrar KPIs (total, monto, pendientes, pagadas).
- **FR-003**: Buscar por proveedor o comprobante.
- **FR-004**: Filtrar por estado de pago.
- **FR-005**: Ver detalle de cada compra (líneas + pagos + saldo).
- **FR-006**: Registrar pagos parciales o totales.
- **FR-007**: Rechazar pagos > saldo pendiente.
- **FR-008**: Empty state cuando no hay compras o filtros sin 
  coincidencias.

### Non-Functional Requirements

- **NFR-001**: Server Actions, sin endpoints REST propios.
- **NFR-002**: `dynamic = "force-dynamic"` en la página.
- **NFR-003**: Errores de lectura se degradan a `[]`.
- **NFR-004**: Coherencia visual con Suppliers e Inventory (KPI cards, 
  badges, filtros).

---

## Success Criteria *(mandatory)*

- **SC-001**: El estado de pago de cada compra coincide con la suma 
  real de sus pagos.
- **SC-002**: Un pago nunca supera el saldo pendiente.
- **SC-003**: Los filtros se combinan correctamente.
- **SC-004**: El detalle muestra información completa (líneas, pagos, 
  saldo).
- **SC-005**: Coherencia visual con el resto del sistema.

---

## Requirements Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US1 | `getPurchaseVouchers` existente |
| FR-002 | US1 | Cálculo en el cliente |
| FR-003 | US2 | Filtro local en componente |
| FR-004 | US2 | Filtro local en componente |
| FR-005 | US3 | `<PurchaseDetailDialog />` nuevo |
| FR-006 | US4 | `registerPurchasePayment` existente |
| FR-007 | US4 | Validación en backend existente |
| FR-008 | Edge | Empty state |

---

## Fuera de alcance

- Eliminación de compras o pagos.
- Edición de compras.
- Notas de crédito/débito.
- Exportación a PDF/Excel.
- Notificaciones de vencimiento.
- Autorización por rol.

---

## Dudas abiertas

- [NECESITA ACLARACIÓN] ¿El detalle se abre en Dialog o en Drawer?
- [NECESITA ACLARACIÓN] ¿Se muestra la fecha de vencimiento en compras 
  al crédito? (requeriría campo nuevo en BD — fuera de alcance por 
  ahora)
- [NECESITA ACLARACIÓN] ¿Se permite registrar un pago con fecha 
  retroactiva?

---

*Esta especificación describe la feature a implementar. Se actualizará 
según las decisiones que se tomen durante el desarrollo.*

---

## Evidencia de verificación

*(Se completará al terminar la implementación.)*

---

*Última actualización: 2026-10-07*