# Feature Specification: Renombrado a "Cobros No Realizados" y Corrección de Fechas de Cobro / Asientos (Huso Horario Perú)

**Feature Branch**: `feature/config-mesas-cobro-mozo-e2e`  
**Created**: 2026-10-13  
**Status**: Approved  
**Spec Number**: 035  

---

## 1. Purpose & Overview

1. **Renombrado UX/UI en Ventas**:
   - Cambiar la terminología de *"Cobros No Cobrados"* a **"Cobros No Realizados"** en la pestaña de ventas, tarjetas de resumen, banners informativos y listado de comandas pendientes tanto en salón como en pedidos para llevar.
   - Mantener consistencia con el Sidebar del sistema donde ya figura como *Cobros No Realizados*.

2. **Precisión de Fechas en Comprobantes y Asientos Contables (Huso Horario Perú `America/Lima`)**:
   - Garantizar que al momento de cobrar una venta (Boleta, Factura, Cobro Mozo o Caja):
     - La fecha de emisión (`issuedAt`) y creación (`createdAt`) de la **Boleta / Factura** se registre exactamente en la fecha y hora local de Perú (`America/Lima`, UTC-5).
     - La fecha contable (`entryDate`) de los **Asientos Contables** (Libro Diario, Provisión, Cobro y Costo de Ventas) se asigne al día calendario peruano correspondiente, evitando que ventas nocturnas (después de las 19:00 horas Perú / 00:00 UTC) se graben erróneamente con la fecha del día siguiente.
     - Los asientos de apertura, movimientos de caja y cierre de sesión utilicen la fecha local peruana.

---

## 2. Requirements & Business Rules

### User Story 1 - Renombrado a "Cobros No Realizados" (Priority: P1)
Como cajero, mozo o administrador:
- Al ingresar al módulo de Ventas, la pestaña secundaria debe titularse **"Cobros No Realizados"** (en móviles: *"Pendientes"*).
- El encabezado del listado debe indicar **"Detalle de Cobros No Realizados"**.
- El estado vacío debe indicar **"¡Al día! No hay cobros pendientes de realizar"**.

### User Story 2 - Registro Preciso de Fecha de Boleta y Cobro (Priority: P1)
Como cajero o mozo:
- Al registrar el cobro de un pedido en mesa o ventanilla:
  - `SalesInvoice.issuedAt` almacena la fecha calendario exacta en Perú (`Date.UTC(YYYY, MM - 1, DD)` correspondiente al huso `America/Lima`).
  - `SalesPayment.paidAt` almacena la marca de tiempo exacta del pago.
  - La respuesta de la API y el ticket impreso reflejan la hora local de emisión.

### User Story 3 - Asientos Contables en la Fecha Correcta (Priority: P1)
Como contador o administrador:
- Al generarse los asientos contables de la venta:
  - `JournalEntry.entryDate` corresponde a la fecha local de la venta en Perú (`America/Lima`).
  - El prefijo del código de asiento (`MISC/YYYY/MM/XXXX`) y la vinculación con el periodo contable (`AccountingPeriod`) se calculan con el mes y año local de Perú.
  - Las ventas nocturnas entre las 19:00 y las 23:59 no se saltan al día siguiente en el libro diario.

---

## 3. Technical Changes

1. [`app/sales/page.tsx`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/sales/page.tsx):
   - Modificación de etiquetas de pestaña y textos a *"Cobros No Realizados"*.
2. [`app/api/sales/route.ts`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/api/sales/route.ts):
   - Normalización de fechas de cobro en `issuedAt`, `paidAt` y `entryDate` utilizando la zona horaria `America/Lima`.
3. [`lib/services/accounting-posting.service.ts`](file:///c:/Users/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/lib/services/accounting-posting.service.ts):
   - Corrección en `toPeruDateOnly`: Si la fecha de entrada ya está a medianoche UTC (`00:00:00.000Z`, típica de columnas `@db.Date`), se preserva dicho día calendario UTC en lugar de aplicar el offset local (-5h), evitando que retroceda a las 19:00 del día anterior.
   - Ajuste de `getCodePrefix` para derivar el año y mes directamente a partir de la fecha calculada en `toPeruDateOnly`.
4. [`app/api/sales/route.ts`](file:///c:/Users/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/api/sales/route.ts):
   - Envío de `now` como `entryDate` al invocar `postSaleJournalEntries` para registrar la fecha y hora de la transacción.
   - Inclusión de los asientos contables relacionados (`journalEntries`) con sus timestamps de creación (`createdAt`) en el listado de ventas (`GET /api/sales`).
5. **Visualización de Fecha y Hora de Creación en UI y API**:
   - `JournalEntrySummary`, `JournalEntryDetail` y `DailyBookEntry`: Exposición de `createdAt` en formato ISO.
   - [`JournalEntryTable.tsx`](file:///c:/Users/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/accounting/(records)/entries/components/JournalEntryTable.tsx): Columna de fecha con fecha contable y hora de creación (`formatTimePeru`), con tooltip de fecha y hora completa (`formatDateTimePeru`).
   - [`JournalEntryDetail.tsx`](file:///c:/Users/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/accounting/(records)/entries/components/JournalEntryDetail.tsx): Tarjeta dedicada "Creado (Fecha y hora)" mostrando `DD/MM/YYYY HH:mm:ss` en huso horario `America/Lima`.
   - [`DailyJournalTable.tsx`](file:///c:/Users/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/accounting/(records)/journal/components/DailyJournalTable.tsx): Encabezado de asiento en el Libro Diario mostrando la hora de creación.

