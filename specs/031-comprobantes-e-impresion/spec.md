# Feature Specification: Configuración de Comprobantes, Series e Impresoras Térmicas

**Feature Branch**: `refactor/persist-areas-printers-db`  
**Updated**: 2026-10-27  
**Status**: Approved  
**Spec Number**: 031  

---

## 1. Purpose & Overview

Gestionar la parametrización de comanderas e impresoras térmicas del restaurante (Cocina KDS, Bar y Caja de Cobro), así como la definición de series de facturación electrónica (Boletas `B001`, Facturas `F001`, Tickets `T001`), opciones de corte automático y ancho de papel térmico (80mm o 58mm), persistiendo los datos de manera robusta y centralizada en base de datos PostgreSQL mediante Prisma ORM.

---

## 2. User Scenarios & Requirements

### User Story 1 - Configuración de Series de Comprobantes (Priority: P1)
Como administrador, quiero definir las series oficiales para comprobantes de pago:
- Serie de Boleta (ej. `B001`).
- Serie de Factura (ej. `F001`).
- Serie de Ticket de Mesa / Control interno (ej. `T001`).

### User Story 2 - Parametrización de Impresoras Térmicas y Comanderas (Priority: P1)
Como jefe de operaciones, quiero configurar la asignación de impresoras térmicas:
- **Impresora de Cocina**: Comandera para impresión de pedidos de cocina con auto-impresión al confirmar comanda.
- **Impresora de Bar**: Comandera de bebidas y postres.
- **Impresora de Caja**: Impresión de comprobantes finales y vouchers de cobro.
- Configurar IP de red / puerto USB de cada impresora.

### User Story 3 - Parámetros de Impresión y Ticket de Prueba (Priority: P2)
Como cajero, quiero configurar:
- Ancho de papel: 80mm (estándar restaurante) o 58mm (portátil).
- Auto-corte de papel al finalizar impresión.
- Impresión automática de copia para mozo.
- Botón para emitir un **Ticket de Prueba** validando que el formato gráfico se renderice con total claridad.

---

## 3. Technical Design

- **Almacenamiento y Persistencia**:
  - Modelo Prisma `PrinterConfig` (`printer_config` en PostgreSQL):
    - `id` (String, PK, default "default")
    - `paperWidth` (VarChar 10, default "80mm")
    - `autoCut` (Boolean, default true)
    - `autoPrintVoucher` (Boolean, default true)
    - `printWaiterCopy` (Boolean, default false)
    - `series` (Json: boleta, factura, ticket)
    - `kitchenPrinter` (Json: name, ipOrPort, active, autoPrintOnOrder)
    - `barPrinter` (Json: name, ipOrPort, active, autoPrintOnOrder)
    - `cashierPrinter` (Json: name, ipOrPort, active)
    - `createdAt`, `updatedAt` (Timestamp 6)
  - Capa de servicio asíncrona en `restaurant-config.service.ts`:
    - `async getPrinterConfig(): Promise<PrinterConfig>`
    - `async updatePrinterConfig(printers: Partial<PrinterConfig>): Promise<PrinterConfig>`
    - Auto-creación de registro por defecto si no existe en la base de datos.
- **Endpoints REST**:
  - `GET /api/settings/printers`: Obtiene las configuraciones de series e impresoras desde Prisma con `getPrinterConfig()`.
  - `PUT /api/settings/printers`: Actualiza parámetros y asignación de dispositivos en BD con `updatePrinterConfig()`.
- **Frontend**: Vista responsive en `/settings/printers` con pestañas de Series, Comanderas y Ticket de Prueba interactivo.
