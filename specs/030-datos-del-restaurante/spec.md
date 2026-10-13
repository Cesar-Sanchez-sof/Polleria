# Feature Specification: Configuración de Datos del Restaurante / Empresa

**Feature Branch**: `feature/config-mesas-cobro-mozo-e2e`  
**Created**: 2026-10-13  
**Status**: Approved  
**Spec Number**: 030  

---

## 1. Purpose & Overview

Centralizar los datos fiscales, comerciales y de contacto del restaurante (**Razón Social**, **RUC**, **Nombre Comercial**, **Dirección fiscal**, **Teléfono**, **Correo** y **Mensaje de pie de ticket**). Estos datos alimentan automáticamente los comprobantes de venta (Boletas, Facturas y Tickets térmicos de 80mm/58mm) garantizando la identidad de marca y el cumplimiento normativo.

---

## 2. User Scenarios & Requirements

### User Story 1 - Administración de Datos Fiscales y Comerciales (Priority: P1)
Como dueño o gerente, quiero una interfaz centralizada donde configurar:
- **RUC** (11 dígitos, validado con formato SUNAT).
- **Razón Social** oficial.
- **Nombre Comercial** (ej. "Pollería & Brasas El Buen Sabor").
- **Dirección fiscal** y Distrito / Ciudad.
- **Teléfono** y correo de contacto para comensales.
- **Mensaje de despedida** para el pie del ticket (ej. "¡Gracias por su visita! Vuelva pronto").

### User Story 2 - Vista Previa en Tiempo Real del Ticket (Priority: P2)
Como cajero o administrador, quiero visualizar al instante una simulación gráfica de cómo se verá el encabezado y pie del comprobante impreso en papel térmico de 80mm mientras realizo los cambios.

---

## 3. Technical Design

- **Endpoints**:
  - `GET /api/settings/restaurant`: Obtiene la configuración actual de la empresa.
  - `PUT /api/settings/restaurant`: Actualiza los datos fiscales y de contacto.
- **Integración**: Los datos son consumidos por el componente de impresión de tickets (`app/sales/page.tsx`) y los reportes de facturación.
