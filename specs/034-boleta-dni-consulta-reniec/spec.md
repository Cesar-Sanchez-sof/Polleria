# Feature Specification: Emisión de Boleta con DNI, Consulta a json.pe y Fallback a Cliente Default

**Feature Branch**: `feature/config-mesas-cobro-mozo-e2e`  
**Created**: 2026-10-13  
**Status**: Approved  
**Spec Number**: 034  

---

## 1. Purpose & Overview

Permitir que al momento de cobrar una venta emitiendo una **Boleta Electrónica** (tanto en caja/ventanilla como en cobro móvil de mozo), el usuario pueda:
1. **Ingresar DNI (8 dígitos)** opcionalmente para personalizar el comprobante del cliente.
2. **Consultar en tiempo real mediante json.pe / RENIEC** para autocompletar nombres y apellidos del cliente sin digitación manual.
3. **Manejar Fallback a Cliente Default**: Si el mozo o cajero deja el DNI en blanco o no lo completa, la venta se emite automáticamente con el cliente genérico del sistema (`documentNumber: "00000000"`, `firstName: "CLIENTES VARIOS"`), garantizando que no se bloquee ni retrase el cobro.

---

## 2. User Scenarios & Requirements

### User Story 1 - Ingreso de DNI en Boleta (Priority: P1)
Como mozo o cajero, al cobrar una mesa o pedido con **Boleta**:
- El formulario presenta el campo para ingresar el DNI de 8 dígitos.
- Se indica visualmente que es opcional y que en blanco aplica *CLIENTES VARIOS*.

### User Story 2 - Consulta Automática a json.pe (RENIEC) (Priority: P1)
Como mozo o cajero, al ingresar los 8 dígitos del DNI:
- El sistema ejecuta la consulta a `/api/document-lookup?tipo=dni&numero=...` (vía API json.pe con fallback resiliente).
- Al encontrar los datos, autocompleta el nombre y apellidos completos del cliente.
- Muestra notificación toast de confirmación: *"Datos RENIEC/SUNAT: [Nombre]"*.
- Se mantiene el botón de búsqueda manual para consultar en cualquier momento.

### User Story 3 - Cobro Transparente con Cliente Default (Priority: P1)
Como mozo o cajero, si el comensal no desea brindar su DNI o tiene prisa:
- El personal deja el campo de DNI vacío.
- El sistema procesa la venta emitiendo la boleta con `documentNumber: "00000000"` y nombre `CLIENTES VARIOS`.
- No genera advertencias bloqueantes ni errores de validación.

### User Story 4 - Factura Electrónica con RUC Obligatorio (Priority: P1)
Como cajero o mozo, si se selecciona **Factura**:
- El campo solicita obligatoriamente el RUC de 11 dígitos y la Razón Social.
- Permite la consulta a SUNAT vía json.pe.

---

## 3. Technical Design

### A. Endpoint de Consulta de Documentos
- [`app/api/document-lookup/route.ts`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/api/document-lookup/route.ts): Soporta consulta GET/POST para `tipo=dni` y `tipo=ruc` consumiendo `lib/services/document-lookup.service.ts`.

### B. Frontend Ventanilla y Cobro Mozo
- [`app/sales/page.tsx`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/sales/page.tsx):
  - Extensión de `lookupIdentityDocument` para soportar destino `"mozo"`.
  - Integración del campo DNI y botón de consulta en el modal de cobro móvil del mozo (`waiterPaymentModal`).
  - Auto-consulta al completar 8 dígitos (DNI) u 11 dígitos (RUC).
  - Normalización de cliente default `00000000` / `CLIENTES VARIOS` cuando no se ingrese documento en Boletas.
