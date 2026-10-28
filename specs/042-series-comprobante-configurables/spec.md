# Feature Specification: Series de Comprobante Configurables y Correlativo por Serie

**Feature Branch**: `feature/series-comprobante-configurables`  
**Created**: 2026-10-27  
**Status**: Implemented & Approved  
**Spec Number**: 042  

---

## 1. Purpose & Overview

Permitir que las Boletas y Facturas electrónicas emitidas en la caja y salón del restaurante se numeren con la serie configurada oficialmente por el restaurante, cumpliendo estrictamente con la normativa y estándares de numeración autorizados por la SUNAT en el Perú.

Cada serie posee su propio correlativo incremental independiente, eliminando las series fijas codificadas de forma rígida en el backend y validando en tiempo real tanto en la interfaz de usuario como en los endpoints de la API que ninguna serie con formato inválido sea guardada o emitida.

---

## 2. User Scenarios & Acceptance Criteria

### User Story
> **Como cajero**, quiero que boletas y facturas se numeren con la serie configurada, para cumplir la numeración autorizada por SUNAT.

### Criterios de Aceptación

1. **Criterio 1: Serie configurada y correlativo propio**
   - Dada la serie de boleta configurada como `B002`, cuando se cobra con boleta, entonces el comprobante sale `B002-########` (8 dígitos correlativos según estándar SUNAT, ej. `B002-00000001`) con un correlativo propio de esa serie.
   - El correlativo de una serie no se afecta por comprobantes emitidos en otras series (ej. comprobantes previos en `B001` no desplazan el contador inicial de `B002`).

2. **Criterio 2: Rechazo de series con formato inválido**
   - Una serie con formato inválido (distinto de `B###` para boletas o `F###` para facturas, donde `###` representa exactamente 3 dígitos numéricos) se rechaza:
     - **En la Interfaz**: Los campos de entrada resaltan en rojo con mensajes explicativos y el guardado es bloqueado con notificación de error.
     - **En la API**: Los endpoints `PUT /api/settings/printers` y `POST /api/sales` retornan código HTTP `400 Bad Request` con mensaje descriptivo.

3. **Criterio 3: Desaparición de `F001/B001` fijo de `app/api/sales/route.ts`**
   - Se elimina la asignación estática `const series = docType === "Factura" ? "F001" : "B001";` en `app/api/sales/route.ts`.
   - La serie se resuelve dinámicamente consultando la configuración de comprobantes de la base de datos (`getPrinterConfig()`) o el valor solicitado en la petición de venta.

4. **Criterio 4: Pruebas automatizadas del correlativo por serie**
   - Cobertura de pruebas unitarias y de integración que verifican la independencia del correlativo por serie, la validación de formatos y la correcta numeración de los comprobantes.

---

## 3. Technical Design & Architecture

### 3.1. Módulo de Validación y Formateo (`lib/utils/series-validation.ts`)
- **Expresiones Regulares**:
  - `BOLETA_SERIES_REGEX = /^B\d{3}$/` (Ejemplos válidos: `B001`, `B002`, `B999`).
  - `FACTURA_SERIES_REGEX = /^F\d{3}$/` (Ejemplos válidos: `F001`, `F002`, `F999`).
  - `TICKET_SERIES_REGEX = /^T\d{3}$/` (Control interno de tickets).
- **Funciones Principales**:
  - `isValidVoucherSeries(series: unknown, voucherType?: string): boolean`: Valida si una cadena cumple con la sintaxis reglamentaria según el tipo de comprobante.
  - `formatVoucherCode(series: string, number: number, padLength: number = 8): string`: Genera el código completo de comprobante respetando los 8 dígitos requeridos por SUNAT (ej. `B002-00000001`).

### 3.2. Capa de Servicios (`lib/services/restaurant-config.service.ts`)
- `updatePrinterConfig(printers: Partial<PrinterConfig>)`: Valida que `printers.series.boleta` y `printers.series.factura` cumplan con las reglas de negocio antes de ejecutar el `upsert` en Prisma, lanzando excepción si alguna es inválida.

### 3.3. Endpoint de Configuración de Impresoras (`PUT /api/settings/printers`)
- Intercepta `body.series` antes de persistir.
- Si la serie de boleta o factura no cumple con `isValidVoucherSeries`, responde inmediatamente:
  ```json
  { "error": "Serie de boleta inválida \"...\". Debe cumplir con el formato B### (ej. B001, B002)." }
  ```
  con HTTP `400 Bad Request`.

### 3.4. Endpoint de Registro de Ventas (`POST /api/sales`)
- Resuelve la serie dinámicamente:
  ```typescript
  const printerConfig = await getPrinterConfig();
  const configuredSeries = docType === "Factura"
    ? printerConfig.series.factura
    : printerConfig.series.boleta;
  const series = requestedSeries || configuredSeries;
  ```
- Valida la serie con `isValidVoucherSeries(series, docType)`.
- Calcula el correlativo incremental específico para esa serie:
  ```typescript
  const lastVoucher = await prisma.salesInvoice.findFirst({
    where: { voucherType: docType, series },
    orderBy: { number: "desc" }
  });
  const sequentialNumber = (lastVoucher?.number ?? 0) + 1;
  const fullCode = formatVoucherCode(series, sequentialNumber);
  ```

### 3.5. Interfaz de Configuración (`app/settings/printers/page.tsx`)
- Indicadores visuales en tiempo real para series inválidas.
- Bloqueo preventivo en `handleSave` con alertas `toast.error`.
- Mensajes guía para el usuario respecto al estándar SUNAT: `B001 - B999` y `F001 - F999`.

---

## 4. Verification & Automated Tests

Suite implementada en [`test/series-comprobantes.test.ts`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/test/series-comprobantes.test.ts):
1. Emisión de comprobante Boleta con serie `B002` generando `B002-00000001`.
2. Incremento consecutivo del correlativo propio a `B002-00000002`.
3. Mantenimiento de correlativos independientes simultáneos entre series `B001`, `B002`, `F001`, `F002`.
4. Rechazo con HTTP 400 de series con formato inválido en `PUT /api/settings/printers`.
5. Rechazo con HTTP 400 de series con formato inválido en `POST /api/sales`.
6. Verificación estática de que `app/api/sales/route.ts` no contiene `F001`/`B001` hardcodeados.
