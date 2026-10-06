# Feature Specification: Generar Comprobante de Venta (Emisión, Archivo S3 e Impresión)

**Feature Branch**: `020-generar-comprobante-venta`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *generar
comprobante de venta*". Por decisión de usuario el alcance es **"todas las anteriores"**:
(1) emisión en ventanilla/mozo, (2) emisión automática por webhook de Mercado Pago con
archivo en S3, (3) servicio de almacenamiento S3 de comprobantes y (4) impresión del ticket
térmico de 80 mm.

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y por las pruebas
> `test/consulta-documento-s3.test.ts` (sección 2) y `test/mercadopago.test.ts`, con evidencia
> en [Evidencia de verificación](#evidencia-de-verificación). No se describen funcionalidades
> futuras ni reglas ausentes en la implementación. La **visualización** de comprobantes es la
> spec `018` y el **flujo de cobro** (validaciones, métodos de pago, vuelto, partes y cierre
> de pedido) está ampliamente descrito en la spec `019`; aquí se documenta la
> **generación del comprobante** como tal: su creación de registro, su archivo y su
> representación impresa.

---

## Purpose

Generar el comprobante de venta (Boleta `B001` / Factura `F001`) por los tres caminos
implementados en la aplicación —cobro manual, notificación de Mercado Pago y representación
impresa— garantizando correlativo único, IGV 18 %, archivo en el bucket `comprobantes` y
salida en rollo térmico de 80 mm.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generar el comprobante al cobrar (Priority: P1)

Como cajero o mozo, quiero que al confirmar el cobro se cree el comprobante con su número
correlativo para entregarlo al cliente.

**Why this priority**: es el camino principal de generación.

**Independent Test**: `POST /api/sales` → `201` con `invoice.fullCode` incremental por
(serie, tipo) y el registro `SalesInvoice` persistido.

**Acceptance Scenarios**:

1. **Given** un cobro válido, **When** el servidor procesa la petición, **Then** crea
   `SalesInvoice` (`status: "Issued"`) con `number = último + 1`, `subtotal = total/1.18` e
   `igv = total − subtotal`.
2. **Given** `voucherType: "Factura"`, **Then** serie `F001`; con `"Boleta"` **o
   `"Ticket"`**, **Then** serie `B001` (el "Ticket" del mozo se persiste como Boleta).
3. **Given** dos cobros consecutivos, **Then** los números son correlativos sin repetirse
   (restricción única `[voucherType, series, number]`).

*(El detalle del cobro —métodos, vuelto, partes, cierre y asientos— está en la spec `019`;
este escenario sólo cubre la creación del comprobante.)*

---

### User Story 2 - Generar el comprobante automáticamente desde Mercado Pago (Priority: P1)

Como sistema, quiero recibir la notificación de un pago aprobado y generar el comprobante,
cerrar el pedido, liberar la mesa, contabilizar y archivarlo en S3.

**Why this priority**: es el único camino automático de generación e incluye archivo
persistente.

**Independent Test**: `POST /api/webhooks/mercadopago` con `data.id` → `200` y comprobante
`B001` correlativo archivado.

**Acceptance Scenarios**:

1. **Given** una notificación sin `data.id`, **When** se recibe, **Then** `200`
   `{ "message": "Webhook recibido sin ID de pago." }` (no procesa nada).
2. **Given** `MERCADO_PAGO_WEBHOOK_SECRET` configurado y firma HMAC inválida, **When** se
   recibe, **Then** `401` `{ "error": "Firma de webhook inválida.", "detail": ... }`.
3. **Given** secreto no configurado, **When** llega cualquier notificación, **Then** se
   acepta en "modo relajado" y continúa.
4. **Given** el pago no aprobado, **Then** `200` `{ "message": "Pago no aprobado aún." }`.
5. **Given** `external_reference = "PED-34"` y pedido abierto, **When** el pago está
   aprobado, **Then** `200` y en transacción: `SalesInvoice` Boleta `B001` + `SalesPayment`
   (método POS/Tarjeta) + pedido `Closed` + mesas libres + asientos con responsable
   "Mercado Pago".
6. **Given** el pedido ya `Closed`, **Then** `200` "El pedido ya se encontraba cerrado."
   (idempotente, sin duplicar).
7. **Given** error inesperado, **Then** `200` `{ "message": "Error registrado en servidor.",
   "detail": ... }` (Mercado Pago nunca ve un 5xx).

---

### User Story 3 - Archivar el comprobante en S3 (Priority: P2)

Como encargado, quiero que cada comprobante quede guardado en el bucket `comprobantes` bajo
una ruta organizada por tipo y fecha.

**Why this priority**: sólo el webhook archiva actualmente; el servicio es reutilizable.

**Independent Test**: `buildVoucherS3Key` → `boletas/2026/09/29/B001-000145.pdf`.

**Acceptance Scenarios**:

1. **Given** metadatos de una Boleta `B001-145` del 2026-09-29, **When** se construye la
   clave, **Then** es `boletas/2026/09/29/B001-000145.pdf` (Factura → `facturas/`, Ticket →
   `tickets/`).
2. **Given** credenciales S3 ausentes o con `TU_KEY`, **When** se sube, **Then** responde
   `estado: "simulado"` con la `publicUrl` calculada (no falla).
3. **Given** credenciales válidas, **When** se sube, **Then** `PUT` público
   (`x-amz-acl: public-read`) y `estado: "guardado"`; si el PUT falla, **Then** vuelve a
   `estado: "simulado"` con mensaje de fallback.
4. **Given** un lote de 20 comprobantes, **When** se procesa con
   `uploadVouchersBatch(..., { maxConcurrency: 20 })`, **Then** 20 workers en paralelo, 20
   claves únicas y `failed: 0`.

---

### User Story 4 - Imprimir el comprobante en ticketera (Priority: P2)

Como cajero, quiero imprimir el ticket en un rollo de 80 mm sin la interfaz de la aplicación.

**Why this priority**: es la representación física del comprobante ya generado.

**Independent Test**: botón "Imprimir en Ticketera" → `window.print()` con `@page size:
80mm auto`.

**Acceptance Scenarios**:

1. **Given** el modal "Comprobante Emitido" abierto, **When** se revisa el documento, **Then**
   contiene cabecera, identificación, ítems, OP. GRAVADA, I.G.V. (18 %), TOTAL, método de
   pago, VUELTO (sólo si `change > 0`) y pie de agradecimiento.
2. **Given** se pulsa "Imprimir en Ticketera", **When** el navegador imprime, **Then** se
   aplica `@media print`: página de 80 mm, sin `header`/`aside`/`nav`/`button`/`.no-print`,
   ticket en monoespaciada a 80 mm con `margin: 0`.
3. **Given** se pulsa "Cerrar", **Then** el modal se cierra sin imprimir.

---

### Edge Cases

- **Aprobación simulada sin token**: si `MERCADO_PAGO_ACCESS_TOKEN` no está configurado,
  `getMercadoPagoPayment` devuelve `status: "approved"` y
  `status_detail: "simulated_without_token"` → **cualquier notificación con pedido válido
  genera comprobante**.
- **Firma opcional**: sin `MERCADO_PAGO_WEBHOOK_SECRET` (o con valor `TU_WEBHOOK_SECRET`) la
  validación HMAC se salta en "modo relajado"; con secreto se exige HMAC-SHA256 del manifiesto
  `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` con ventana de **600 segundos**.
- **El webhook siempre responde `200`** (incluso errores), por lo que Mercado Pago no
  reintentará y un fallo queda sólo en el log.
- **Cliente de reserva**: si no existe un `Customer` con documento `00000000` se usa
  `customerId = 1` sin verificar que ese id corresponda a ese documento.
- **Método de pago del webhook**: `findFirst` de un `PaymentType` cuyo nombre contenga
  "POS" o "Tarjeta"; si no hay, id `1` ("Efectivo"), aunque el pago sea con tarjeta.
- **Correlativo del webhook distinto al de la API**: busca el último número **sólo por
  `series: "B001"`** (sin filtrar `voucherType`), mientras que `POST /api/sales` filtra por
  tipo **y** serie; ambas escrituras comparten la restricción única, así que un conflicto de
  correlativo revierte la transacción del webhook (que responde `200` con el detalle).
- **Mesas unidas no procesadas**: el webhook libera sólo `order.tables`; **no** interpreta
  `[Mesas unidas: ...]` de `pm.notes` como sí hace `POST /api/sales`.
- **"PDF" sin PDF**: `uploadVoucherToS3` se invoca **sin binario**, así que el objeto subido
  es el texto por defecto `Comprobante B001-<n>` con `Content-Type: application/pdf` (no hay
  generación real de PDF en la aplicación).
- **Archivo best-effort**: un fallo de S3 sólo emite `console.warn` y no afecta la respuesta
  del webhook.
- **Lote sin uso productivo**: `uploadVouchersBatch` sólo se invoca desde pruebas.
- **Servicios MP sin llamadas de producción**: `startMercadoPagoCharge` y
  `generateTapToPayDeepLink` sólo se usan en pruebas; la UI de cobro no los invoca (ver spec
  `019`).
- **`voucherModalOpen` muerto**: estado declarado en la página de ventas pero nunca usado.
- **Fecha de la clave S3 en hora local**: usa `getFullYear/getMonth/getDate` (no UTC), por lo
  que cerca de medianoche la carpeta puede diferir de la fecha UTC del comprobante.
- **Emisión sin control de acceso**: `POST /api/sales` no valida sesión/cookie/rol; el único
  control del webhook es la firma (opcional).
- **La venta desde el webhook no dispara S3 para el cobro manual**: `POST /api/sales` **no**
  archiva en S3; sólo el webhook lo hace.

---

## Functionalidades / Functionalities

- **`POST /api/sales`** (resumen; detalle en spec `019`): crea el comprobante con correlativo.
- **`POST /api/webhooks/mercadopago`**: generación automática + archivo S3 + asientos.
- **`GET /api/webhooks/mercadopago`**: handshake de verificación de URL con Mercado Pago.
- **`lib/services/s3-storage.service`**: clave dinámica, subida individual y lote por lotes.
- **Modal "Comprobante Emitido" + `@media print`**: documento térmico de 80 mm.

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Correlativo por serie** | `number = último + 1`; `Factura` → `F001`, `Boleta`/`Ticket` → `B001`; única por `[voucherType, series, number]`. |
| BR-2 | **Importes** | `total = Σ subtotales`, `subtotal = round(total/1.18)`, `igv = total − subtotal`. |
| BR-3 | **Estado** | Todo comprobante nace con `status: "Issued"` e `issuedAt = ahora`. |
| BR-4 | **Firma del webhook** | HMAC-SHA256 de `id:<dataId>;request-id:<xRequestId>;ts:<ts>;` con clave `MERCADO_PAGO_WEBHOOK_SECRET`; tolerancia ±600 s; sin secreto → modo relajado. |
| BR-5 | **Idempotencia** | Pedido `Closed` → `200` sin generar otro comprobante. |
| BR-6 | **Respuesta del webhook** | Siempre `200` (éxito, rechazo o error interno). |
| BR-7 | **Archivo S3** | Bucket `comprobantes`, clave `{boletas\|facturas\|tickets}/{aaaa}/{mm}/{dd}/{serie}-{número a 6 dígitos}.{ext}`; endpoint por defecto `https://s3.neon.tech`. |
| BR-8 | **Modos de S3** | Sin credenciales → `simulado`; con credenciales → `PUT` público; fallo del `PUT` → `simulado` (fallback). |
| BR-9 | **Lote S3** | 20 workers, hasta 3 intentos por ítem con espera exponencial de `50 ms × intento`. |
| BR-10 | **Impresión** | `@page size: 80mm auto`, documento a 80 mm monoespaciada, se ocultan cabecera, menús, botones y `.no-print`. |
| BR-11 | **Vuelto en el ticket** | Se imprime únicamente si `change > 0` (ver spec `018`: el `GET` siempre devuelve `change: 0`). |

## Endpoints

| Method | Path | Summary |
|--------|------|---------|
| POST | `/api/sales` | Genera el comprobante al cobrar (detalle en spec `019`). |
| POST | `/api/webhooks/mercadopago` | Genera el comprobante automáticamente y lo archiva en S3. |
| GET | `/api/webhooks/mercadopago` | Handshake de verificación de URL de Mercado Pago. |

### POST `/api/webhooks/mercadopago` — Entrada

Acepta el cuerpo IPN (`body.data.id`, `body.type`) o parámetros de query
(`?data.id=...&topic=payment`). Cabeceras: `x-signature` (`ts=...,v1=...`) y `x-request-id`.

### POST `/api/webhooks/mercadopago` — Respuestas

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Sin `paymentId` | `{ "message": "Webhook recibido sin ID de pago." }` |
| 401 | Firma inválida | `{ "error": "Firma de webhook inválida.", "detail": "..." }` |
| 200 | Pago no aprobado | `{ "message": "Pago no aprobado aún." }` |
| 200 | Sin pedido asociado | `{ "message": "Pago verificado sin pedido asociado directo." }` |
| 200 | Pedido inexistente | `{ "error": "Pedido 999 no encontrado." }` |
| 200 | Pedido ya cerrado | `{ "message": "El pedido ya se encontraba cerrado." }` |
| 200 | Éxito | `{ "message": "Pago procesado, mesa liberada y comprobante archivado con éxito." }` |
| 200 | Excepción interna | `{ "message": "Error registrado en servidor.", "detail": "..." }` |

### GET `/api/webhooks/mercadopago` — Respuesta (200)

```json
{ "status": "active", "service": "Webhook Mercado Pago - Pollería ERP", "date": "2026-10-05T19:12:00.000Z" }
```

### Resultado del archivo S3 (`uploadVoucherToS3`)

```json
{
  "idComprobante": 12,
  "s3Key": "boletas/2026/10/05/B001-000451.pdf",
  "publicUrl": "https://s3.neon.tech/comprobantes/boletas/2026/10/05/B001-000451.pdf",
  "bucket": "comprobantes",
  "estado": "simulado",
  "message": "Ubicación organizada en bucket 'comprobantes' preparada exitosamente.",
  "timeMs": 1
}
```

## Permissions

- **`POST /api/sales`**: ninguno (sin `requireRole`, sin sesión; ver spec `019`).
- **Webhook**: única validación = firma HMAC opcional (`MERCADO_PAGO_WEBHOOK_SECRET`). Sin
  secreto configurado **cualquier cliente puede generar comprobantes y cerrar pedidos**.
- **S3**: depende de las variables `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (o variantes
  `S3_*`, `NEON_S3_*`); sin ellas opera en modo simulado.
- No hay middleware activo (`middleware.ts` inexistente, `proxy.ts.desactivado`).

## Validations

**Servidor**

- Webhook: `paymentId` presente → firma → pago aprobado → `orderId` parseable de
  `external_reference` (`PED-<n>` o número) → pedido existente y no `Closed`.
- HMAC: cabecera con `ts` y `v1`, `|ahora − ts| ≤ 600 s`, digesto hex coincidente
  (case-insensitive).

**Cliente**: sin validaciones nuevas; el modal de ticket sólo renderiza y llama a
`window.print()`.

## Acceptance Criteria

1. **When** se confirma un cobro **Then** existe un `SalesInvoice` con número correlativo y
   los importes calculados por el servidor.
2. **When** llega una notificación de Mercado Pago con pedido abierto y pago aprobado **Then**
   se genera un comprobante `B001`, se cierra el pedido, se libera la mesa, se crean los
   asientos y se intenta el archivo en S3.
3. **When** el pedido ya estaba cerrado **Then** no se duplica el comprobante (respuesta
   idempotente `200`).
4. **When** el archivo S3 está en modo simulado **Then** la clave y la URL pública siguen la
   estructura documentada.
5. **When** se imprime **Then** la salida tiene 80 mm de ancho, tipografía monoespaciada y no
   aparecen elementos de la interfaz.
6. **When** la firma es inválida con secreto configurado **Then** la respuesta es `401` y no
   se escribe nada.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Crear el comprobante en `POST /api/sales` con correlativo, serie e importes
  calculados en servidor (implementación detallada en spec `019`).
- **FR-002**: Exponer `POST /api/webhooks/mercadopago` con extracción de `paymentId`,
  verificación de firma, consulta de estado del pago y resolución de pedido.
- **FR-003**: Generar en transacción la Boleta `B001`, el pago, el cierre del pedido, la
  liberación de mesas y los asientos de venta con responsable "Mercado Pago".
- **FR-004**: Archivar el comprobante en S3 tras la transacción, sin bloquear la respuesta.
- **FR-005**: Exponer `GET /api/webhooks/mercadopago` como handshake activo.
- **FR-006**: Implementar `buildVoucherS3Key`, `uploadVoucherToS3` (modos simulado/guardado)
  y `uploadVouchersBatch` (concurrencia y reintentos).
- **FR-007**: Mostrar el documento térmico de 80 mm con identificación, ítems, totales,
  método de pago y pie, e imprimirlo con `window.print()`.
- **FR-008**: Definir las reglas `@media print` (`@page 80mm`, ocultamiento de UI) en
  `globals.css`.

### Non-Functional Requirements

- **NFR-001**: La generación automática es idempotente y nunca responde fuera de `200`
  excepto por firma inválida (`401`).
- **NFR-002**: El archivo en S3 es *best-effort*: un fallo no impide la generación.
- **NFR-003**: Modo seguro sin credenciales (S3 y Mercado Pago) para desarrollo y pruebas.
- **NFR-004**: `export const dynamic = "force-dynamic"` en las rutas de venta y webhook.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cada comprobante generado tiene `number` único dentro de su serie.
- **SC-002**: La clave S3 generada coincide con
  `{tipo}/{aaaa}/{mm}/{dd}/{serie}-{número a 6 dígitos}.{ext}` (prueba automática).
- **SC-003**: 20 comprobantes archivados en lote terminan con `successful: 20` y `failed: 0`
  (prueba automática).
- **SC-004**: Con secreto configurado, una firma alterada produce `401` y ninguna escritura
  (prueba automática).
- **SC-005**: La representación impresa reproduce ítems e importes del comprobante abierto.

---

## Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US1 | `app/api/sales/route.ts` (202-247) |
| FR-002 | US2 escenarios 1-4 | `app/api/webhooks/mercadopago/route.ts` (24-77) |
| FR-003 | US2 escenarios 5-6 | Transacción del webhook (126-177) |
| FR-004 | US2 escenario 5 | Archivo del webhook (179-192) |
| FR-005 | — | `GET` del webhook (204-210) |
| FR-006 | US3 escenarios 1-4 | `lib/services/s3-storage.service.ts` (95-256) |
| FR-007 | US4 escenarios 1-3 | Modal del ticket (3234-3358) |
| FR-008 | US4 escenario 2 | `app/globals.css` (253-297) |

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| Webhook completo: extracción, firma, pago, pedido y respuestas | `app/api/webhooks/mercadopago/route.ts` líneas 24-198 |
| Handshake `GET` | `app/api/webhooks/mercadopago/route.ts` líneas 204-210 |
| Transacción del webhook (factura, pago, `Closed`, mesas, asientos) | `app/api/webhooks/mercadopago/route.ts` líneas 117-177 |
| Archivo S3 y respuesta final del webhook | `app/api/webhooks/mercadopago/route.ts` líneas 179-193 |
| Pago simulado sin token y consulta oficial | `lib/services/mercadopago.service.ts` líneas 133-155 |
| Verificación HMAC (modo relajado, formato, ±600 s, manifiesto) | `lib/services/mercadopago.service.ts` líneas 160-215 |
| Configuración de bucket/endpoint/credenciales | `lib/services/s3-storage.service.ts` líneas 52-89 |
| Clave dinámica `{tipo}/{aaaa}/{mm}/{dd}/{serie}-{n}.ext` | `lib/services/s3-storage.service.ts` líneas 95-110 |
| Subida individual (modos simulado/guardado/fallback) | `lib/services/s3-storage.service.ts` líneas 116-185 |
| Lote con 20 workers y reintentos | `lib/services/s3-storage.service.ts` líneas 193-256 |
| Creación del comprobante en el cobro manual | `app/api/sales/route.ts` líneas 202-247 |
| Documento térmico (cabecera, identificación, ítems, totales, pie) | `app/sales/page.tsx` líneas 3248-3337 |
| Botones "Cerrar" e "Imprimir en Ticketera" (`window.print()`) | `app/sales/page.tsx` líneas 3339-3356 |
| Reglas `@media print` de 80 mm y ocultamiento de UI | `app/globals.css` líneas 253-297 |
| Pruebas S3 (clave, bucket, modo simulado, lote de 20) | `test/consulta-documento-s3.test.ts` sección 2, líneas 32-127 |
| Pruebas Mercado Pago (deep link, modo simulado, firmas válida/falsa) | `test/mercadopago.test.ts` líneas 20-113 |

**No existen pruebas automatizadas del `POST /api/webhooks/mercadopago`** (sólo de sus
helpers `verifyMercadoPagoWebhookSignature` y del servicio S3).

**Fuera de alcance**: flujo de cobro, métodos de pago y cierre de pedido (spec `019`),
listado y visualización de comprobantes (spec `018`), creación de clientes (spec `016`),
generación real de PDF/XML (no existe en el código) y el servicio `startMercadoPagoCharge`
(sólo se usa en pruebas).

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
