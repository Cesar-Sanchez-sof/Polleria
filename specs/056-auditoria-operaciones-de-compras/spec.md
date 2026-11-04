# Feature Specification: Auditoría de las operaciones de compras

**Feature Branch**: `feature/rrhh-empleados-horarios`
**Created**: 2026-11-04
**Status**: Implemented
**Spec Number**: 056

---

## 1. Propósito y alcance

Dejar constancia en la bitácora de auditoría (`audit_log`, módulo **Compras**) de cada operación
de compras que mueve dinero, inventario o proveedores: quién la hizo, cuándo, desde qué IP y con
qué datos (antes/después). Además, las compras quedan a nombre del **usuario que las registra**
(antes se asignaban a «cualquier empleado activo»).

## 2. Historias de usuario

- **HU-056.1**: como auditor/administrador consulto en Seguridad → Auditoría (filtro «Compras»)
  todas las operaciones de compras con su detalle.

## 3. Operaciones auditadas

| Operación | Acción | Entidad | Detalle |
|---|---|---|---|
| Orden de compra | CREATE | OrdenCompra | N.°, proveedor, total, líneas |
| Compra unificada (recepción + comprobante) | CREATE | Compra | comprobante, condición, total, líneas |
| Comprobante de una orden | CREATE | ComprobanteCompra | orden, total, condición |
| Pago a crédito | CREATE | PagoCompra | monto, saldo antes y después |
| Compra sin comprobante | CREATE | CompraSinComprobante | tipo, categoría, monto, proveedor informal |
| Anulación de compra sin comprobante | STATUS_CHANGE | CompraSinComprobante | motivo, monto |
| Alta / edición / (des)activación de proveedor | CREATE / UPDATE / STATUS_CHANGE | Proveedor | antes / después |

## 4. Reglas

1. El registro se hace **después** de confirmar la transacción: un fallo de la bitácora nunca
   revierte la compra (`logAudit` no lanza).
2. Se guarda usuario, IP (cabeceras `x-forwarded-for` / `x-real-ip`) y datos sin contraseñas ni tokens.
3. La compra se atribuye al empleado del usuario con sesión, salvo que se indique otro explícitamente.

## 5. Componentes

- `lib/services/purchases/purchase-audit.ts` (`auditPurchase`, `sessionEmployeeId`).
- Server actions: `purchase-order.ts`, `invoices.ts`, `purchase-without-voucher.ts`, `supplier.ts`.
- Consulta: `/security/audit` (filtro por módulo «Compras»).
- Tests: `lib/services/purchases/purchases.service.test.ts` (sin regresiones).

## 6. Criterios de aceptación

- [x] Registrar una compra crea un registro «Compras / Compra» con el usuario y el total.
- [x] Editar un proveedor guarda los datos antes y después.
- [x] Si la auditoría falla, la compra igual se registra.
