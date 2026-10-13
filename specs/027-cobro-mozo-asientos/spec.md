# Feature Specification: Cobro Mozo (Boleta y Factura) y Asientos Contables Diferenciados

**Feature Branch**: `feature/config-mesas-cobro-mozo-e2e`  
**Created**: 2026-10-13  
**Status**: Approved  
**Spec Number**: 027  

---

## 1. Purpose & Overview

Permitir que el mozo realice el cobro directamente en mesa con su dispositivo móvil pudiendo emitir **Boleta de Venta** o **Factura Electrónica** según lo solicite el comensal. Asimismo, garantizar que el motor de contabilización automática genere **asientos contables diferenciados según el método de pago utilizado** (Pago con Tarjeta / POS vs Pago con Yape / Billetera Digital vs Pago en Efectivo), cumpliendo con las normas contables del PCGE y requerimientos de SUNAT.

---

## 2. User Scenarios & Requirements

### User Story 1 - Selección de Boleta o Factura en Cobro Mozo (Priority: P1)
Como mozo, al realizar el cobro desde la mesa:
1. Puedo seleccionar si el comensal requiere **Boleta** (con DNI opcional o cliente general) o **Factura** (ingresando RUC de 11 dígitos y Razón Social).
2. La interfaz valida los datos requeridos antes de procesar el pago.

### User Story 2 - Asientos Contables Diferenciados por Medio de Pago (Priority: P1)
Como contador de la empresa, cuando se registra una venta:
1. **Pago con Tarjeta (POS / Tap to Pay)**:
   - Debe cargarse a la **Cuenta 104 (Bancos - Cuentas Corrientes / POS)**.
   - Glosa: "Cobro venta con Tarjeta/POS (Bancos)".
2. **Pago con Yape / Plin (Billetera Digital)**:
   - Debe cargarse a la **Cuenta 102 (Billeteras Digitales / Fondos Sujetos a Restricción)**.
   - Glosa: "Cobro venta con Yape / Billetera Digital".
3. **Pago en Efectivo**:
   - Debe cargarse a la **Cuenta 101 (Caja)**.
   - Glosa: "Cobro venta en Efectivo".
4. **Comprobante (Boleta vs Factura)**:
   - El asiento de provisión (121 vs 401 + 701) refleja explícitamente si se trata de una Boleta (`B001-...`) o Factura (`F001-...`).

---

## 3. Technical Changes

- **Accounting Service (`lib/services/accounting-posting.service.ts`)**:
  - Catálogo de cuentas: inclusión de `digitalWallet: "102"` (Billeteras Digitales).
  - Selección dinámica y resolución automática de cuentas de cobro según el método (`pickPaymentAccountId`).
  - Generación de asientos con glosas claras y precisas.
- **Frontend (`app/sales/page.tsx`)**:
  - Modal de cobro mozo: selector de comprobante (Boleta / Factura) y campos para RUC y Razón Social cuando se selecciona Factura.
