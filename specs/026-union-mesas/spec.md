# Feature Specification: Unión de Mesas y Control de Disponibilidad

**Feature Branch**: `feature/config-mesas-cobro-mozo-e2e`  
**Created**: 2026-10-13  
**Status**: Approved  
**Spec Number**: 026  

---

## 1. Purpose & Overview

Garantizar que al juntar mesas físicas en el salón (por ejemplo, tomar la Mesa 2 y anexar a esta la Mesa 3 para atender a un grupo numeroso), **todas las mesas involucradas pasen inmediatamente a estado ocupado con 0 disponibilidad**. Asimismo, asegurar que al emitir la boleta de venta o comprobante, éste refleje **únicamente la mesa principal**, manteniendo la cuenta unificada y liberando todas las mesas involucradas al momento del cobro.

---

## 2. User Scenarios & Requirements

### User Story 1 - Anexión Atómica y Estado Ocupado (0 Disponibilidad) (Priority: P1)
Como mozo, cuando tomo un pedido en la Mesa 2 y anexo la Mesa 3:
1. Ambas mesas (Mesa 2 y Mesa 3) quedan vinculadas a la comanda activa.
2. Ambas mesas reportan estado `occupied: true`.
3. El conteo de mesas disponibles en el salón disminuye contabilizando ambas mesas como no disponibles (`available` decrementa en 2).
4. La Mesa 3 muestra visualmente que está en uso como mesa anexa a la Mesa 2 (`[Anexa a Mesa 2]`).

### User Story 2 - Emisión de Boleta con Mesa Única (Priority: P1)
Como cajero o comensal, al solicitar la cuenta y emitir la boleta:
1. El comprobante de pago consigna como origen **únicamente la mesa principal** (ejemplo: `Mesa 2`).
2. No se duplican ni confunden números de mesa en el ticket impreso ni en el archivo digital.

### User Story 3 - Liberación Total de Mesas al Cobrar (Priority: P1)
Al completarse el cobro del pedido (ya sea en caja o por el mozo):
1. La comanda pasa a estado `Closed`.
2. Tanto la mesa principal (Mesa 2) como todas las mesas anexas (Mesa 3) se liberan simultáneamente y vuelven a estar disponibles (`occupied: false`).

---

## 3. Technical Changes

- **Backend (`POST /api/orders`)**: Creación de registros en `OrderTable` tanto para la mesa principal como para cada mesa en `additionalTables`.
- **Backend (`GET /api/tables`)**: Reconocimiento de mesas anexas mediante `activeOrder` y cálculo exacto de aforo disponible (`summary.available`).
- **Backend (`POST /api/sales` & `GET /api/sales`)**: Identificación de la mesa principal para el campo `origin` del comprobante y liberación de todas las mesas anexas registradas en `order.tables`.
- **Frontend (`app/sales/page.tsx`)**: Renderizado del ticket térmico con origen único y badges informativos en la vista de salón.
