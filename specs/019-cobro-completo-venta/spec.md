# Feature Specification: Cobro Completo de la Venta (Efectivo, Yape, Tarjeta y Pago en Partes)

**Feature Branch**: `019-cobro-completo-venta`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *cobro en
efectivo*, ampliada por decisión de usuario a **cobro completo (todos los métodos)**:
emisión de comprobante, cierre del pedido, liberación de mesas y asientos contables."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y por las pruebas unitarias de
> `test/gestion-mesas.test.ts` (secciones 1, 2, 3 y 8), con evidencia en
> [Evidencia de verificación](#evidencia-de-verificación). No se describen funcionalidades
> futuras, integraciones reales con pasarelas ni reglas ausentes en la implementación. La
> **visualización** de los comprobantes emitidos es la spec `018`; aquí sólo se documenta su
> **emisión (cobro)**.

---

## Purpose

Cobrar una comanda (mesa o pedido para llevar) emitiendo un comprobante fiscal, cerrando el
pedido, liberando las mesas asociadas y generando los asientos contables del cobro, con
cualquiera de los métodos soportados: **efectivo (con vuelto)**, **Yape QR**, **Tarjeta/POS**
y **pago en partes (mixto)**, desde dos puntos de entrada: **ventanilla (caja)** y **móvil
(mozo en mesa)**.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cobrar en ventanilla en efectivo con vuelto (Priority: P1)

Como cajero, quiero seleccionar una comanda, ingresar el efectivo que entrega el cliente y
emitir el comprobante para cobrar y liberar la mesa.

**Why this priority**: es el flujo principal de caja y el nombre original de la feature.

**Independent Test**: `POST /api/sales` con `paymentTypeId` de "Efectivo" y
`amountReceived >= total` → `201`, pedido `Closed`, mesa `active: true` y hasta 4 asientos.

**Acceptance Scenarios**:

1. **Given** la pestaña "Caja y ventanilla" con comandas pendientes, **When** se elige una
   cuenta, **Then** se muestran consumo, tipo de comprobante, datos del cliente, métodos de
   pago y desglose (subtotal, IGV 18 %, total).
2. **Given** método "Efectivo", **When** se ingresa un monto mayor al total, **Then** el
   panel muestra "Vuelto a Entregar" (botones rápidos S/20, S/50, S/100, S/200).
3. **Given** monto entregado menor al total, **When** se pulsa "Emitir Comprobante y Cobrar
   en Ventanilla", **Then** no se envía nada y aparece el toast exacto
   *"El monto entregado (S/ X) es menor al total a pagar (S/ Y). Faltan S/ Z."*
4. **Given** cobro válido, **When** el servidor responde, **Then** `201` con
   `message: "Venta registrada, pedido cerrado, mesa liberada y asientos contables
   generados."`, se abre el ticket y la lista de pendientes ya no incluye la comanda.
5. **Given** un fallo (pedido inexistente, cerrado, cancelado, período contable cerrado),
   **When** se cobra, **Then** `400`/`404`/`500` con el mensaje documentado y la UI muestra
   ese mensaje en toast de error.

---

### User Story 2 - Emitir comprobante con Yape, Tarjeta/POS o pago en partes (Priority: P1)

Como cajero, quiero cobrar con otros medios de pago (incluido dividir la cuenta en partes)
para emitir el comprobante correspondiente.

**Why this priority**: es el resto de métodos incluidos en el alcance ampliado.

**Independent Test**: `POST /api/sales` con `payments[]` cuya suma difiera del total en más
de S/ 0.05 → `400`; si coincide → `201` con N pagos.

**Acceptance Scenarios**:

1. **Given** "Yape QR" o "Tarjeta / POS" seleccionados, **When** se cobra, **Then** el
   servidor resuelve el `paymentTypeId` por nombre (`yape` → "Yape"; `pos`/`tarjeta` →
   "Tarjeta / POS") y emite el comprobante sin pedir monto entregado.
2. **Given** "Pagar en Partes", **When** hay menos de 2 partes con monto > 0, **Then** no se
   envía y se informa *"Para pagar en partes debe ingresar al menos 2 formas de pago con
   montos mayores a S/ 0."*
3. **Given** partes cuya suma no coincide con el total (± S/ 0.05), **When** se confirma,
   **Then** toast con la suma y el total; con la suma exacta, **Then** `201` y la UI muestra
   "¡Excelente! Cuenta 100% cubierta con las partes indicadas." antes de enviar.
4. **Given** el pago en partes confirmado, **When** se responde `201`, **Then** `invoice.
   paymentMethod` es `Pago en Partes (Efectivo: S/ 40.00 + Yape: S/ 60.00)` y se crean tantos
   `SalesPayment` como partes.

---

### User Story 3 - Cobrar desde el mozo en la mesa (Priority: P1)

Como mozo, quiero cobrar en la mesa con celular (Tap to Pay, Yape QR, efectivo o en partes)
para emitir el ticket y liberar la mesa sin ir a ventanilla.

**Why this priority**: segundo punto de emisión real de la aplicación.

**Independent Test**: botón "Cobrar en Mesa (Mozo)" → modal → "Confirmar Cobro y Liberar
Mesa" → `POST /api/sales` con `voucherType: "Ticket"` y `customer: 00000000 / CLIENTE SALÓN`.

**Acceptance Scenarios**:

1. **Given** una mesa ocupada (salón) o un cobro pendiente de tipo Mesa, **When** se pulsa
   el botón de cobro del mozo, **Then** se abre el modal "Cobro Móvil / Mozo" con el total en
   grande y los 4 métodos (Tap to Pay por defecto).
2. **Given** "Efectivo" en mesa, **When** se ingresa el monto recibido, **Then** aparece
   "Vuelto a devolver" y se bloquea el envío si es insuficiente (mismo toast de la ventanilla).
3. **Given** "En Partes" en mesa, **When** la suma no cubre el total, **Then** badge
   "Falta: S/ X" y, al confirmar, la validación del servidor rechaza con `400`.
4. **Given** cobro mozo exitoso, **When** responde el servidor, **Then** toast *"¡Cobro
   realizado por el Mozo! Mesa liberada con éxito."*, se abre el ticket y se recargan los
   datos.

---

### User Story 4 - Que el cobro cierre el pedido, libere mesas y contabilice (Priority: P1)

Como sistema, quiero que cada cobro cierre el pedido, libere la mesa (incluidas las mesas
unidas) y registre los asientos contables en un período abierto.

**Why this priority**: son los efectos transaccionales que hacen útil el cobro.

**Independent Test**: `POST /api/sales` en transacción → `SalesInvoice` + `SalesPayment` +
`salesOrder.status = "Closed"` + `diningTable.active = true` + 4 `JournalEntry`.

**Acceptance Scenarios**:

1. **Given** un pedido con mesa, **When** se cobra, **Then** la transacción crea la factura
   (`status: "Issued"`), un pago, cierra el pedido y marca la mesa como libre.
2. **Given** `pm.notes` con `[Mesas unidas: 3, 4]`, **When** se cobra, **Then** esas mesas
   también quedan `active: true`.
3. **Given** cuentas contables inactivas o período cerrado, **When** se cobra, **Then** la
   transacción revierte completa (no queda factura) y responde `500` "No se pudo completar el
   cobro y cierre de la venta."
4. **Given** el cobro confirmado, **When** se genera el diario, **Then** existen hasta 4
   asientos vinculados a la factura (provisión, cobro y costos).

---

### Edge Cases

- **"Ticket" se guarda como "Boleta"**: el servidor normaliza `docType` (sólo acepta
  `Factura` o `Boleta`; cualquier otra opción, incluido el `voucherType: "Ticket"` del mozo,
  persiste como **Boleta serie B001**).
- **Correlativo fuera de la transacción**: `findFirst` del último número ocurre antes del
  `£transaction`; dos cobros simultáneos pueden competir y el segundo falla por la única
  `[voucherType, series, number]` → `500` (sin reintentos).
- **Vuelto no persistido**: `amountReceived`/`change` sólo viajan en la respuesta; `SalesPayment`
  guarda el total (o cada parte), por lo que el ticket listado en la spec `018` nunca muestra
  vuelto.
- **`gateway` no persistido**: `{ provider: "mercado_pago", mode: tap_to_pay|qr|manual }` sólo
  se refleja en la respuesta (`status: "completed"`), no se guarda en base de datos.
- **Sin integración real con Mercado Pago en el cobro**: la UI sólo muestra instrucciones
  ("Tap to Pay", "Código QR Local"); el servicio `mercadopago.service` (`initPayment`, deep
  link `mercadopago://point/pay`) **no es invocado por el flujo de cobro** — sólo lo usa el
  webhook `/api/webhooks/mercadopago`.
- **Estado `tapToPayDetectado` muerto**: se declara y se reinicia a `false`, pero nunca se
  pone en `true`.
- **Resolución de método por nombre y fallback**: si ningún `PaymentType` activo coincide con
  "efectivo"/"yape"/"pos|tarjeta", se usa `paymentTypes[0]?.id ?? 1`; si la carga de
  `/api/payment-methods` falló, igualmente se envía el id `1`.
- **Efectivo sin monto ingresado**: si `amountGiven` está vacío no hay validación ni vuelto;
  el servidor recibe `amountReceived = total` y `change = 0`.
- **Doble validación de efectivo**: cliente (`calculateChangeAmount`) y servidor
  (`amountReceived < total` → `400`) con mensajes distintos.
- **Tolerancia ± S/ 0.05** en la suma de partes, aplicada tanto en UI como en servidor.
- **IGV recalculado por el servidor**: `subtotal = total / 1.18` redondeado; los importes que
  envíe el cliente se ignoran (sólo se usa el total de los ítems del pedido).
- **Cliente creado automáticamente**: si el documento + tipo de persona no existe, el POST crea
  un `Customer` (por defecto `00000000` / "CLIENTE GENERAL"; el mozo envía "CLIENTE SALÓN").
- **Factura prellenada**: al elegir "Factura" la UI rellena RUC `20601234567` y "EMPRESA
  GASTRONÓMICA S.A.C." si el documento no tiene 11 dígitos.
- **Cobro mozo sólo para Mesas**: en la pestaña "Cobros No Cobrados" el botón "Cobro Mozo"
  aparece únicamente si `tipo === "Mesa"`; los pedidos *Llevar* sólo van a ventanilla.
- **Asientos estimados**: costo = 40 % del subtotal (70 % mercadería / 30 % insumos), no hay
  costo real por receta; si el costo redondeado es 0 no se crean los asientos de costo.
- **Denominación del cobro contable**: con pago en partes el nombre se une
  (`"Efectivo + Yape"`), y la elección de cuenta 101 vs 104 depende de que el nombre contenga
  "efectivo"/"cash" (con partes que incluyen efectivo se usa **101 Caja**; sólo Yape/POS →
  **104 Bancos**).
- **Sin anulación/devolución de cobros**: no existe `PATCH`/`DELETE` en `/api/sales`.
- **Sin control de acceso**: ni `POST` ni `GET /api/sales` validan sesión, cookie ni rol.

---

## Functionalidades / Functionalities

- **`POST /api/sales`**: emisión de comprobante, cobro (simple o en partes), cierre del
  pedido, liberación de mesas y asientos contables.
- **`GET /api/payment-methods`**: métodos de pago activos con flags de compatibilidad.
- **Pestaña "Caja y ventanilla"** (`/sales?tab=cashier`): flujo de cobro en ventanilla.
- **Modal "Cobro Móvil / Mozo"**: cobro en mesa desde el celular del mozo.
- **Auxiliares**: `calculateTotals` (IGV 18 %), `calculateChangeAmount` (vuelto) y
  `postSaleJournalEntries` (asientos).

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Pedido cobrable** | El pedido debe existir, no estar `Closed` ni `Cancelled` y tener ítems. |
| BR-2 | **Importes** | Total = Σ subtotales de ítems; subtotal = `total / 1.18`; IGV = diferencia (precios de carta con IGV incluido). |
| BR-3 | **Pago simple** | Se resuelve el `paymentTypeId` por nombre del método elegido; `amountReceived` sólo aplica a efectivo. |
| BR-4 | **Pago en partes** | ≥ 2 partes con monto > 0 cuya suma coincida con el total (± S/ 0.05); se persiste un `SalesPayment` por parte. |
| BR-5 | **Vuelto** | Sólo en efectivo: `change = max(0, amountReceived − total)` en la respuesta; nunca se guarda. |
| BR-6 | **Comprobante** | `Factura` → serie `F001`; `Boleta` y `Ticket` → serie `B001`; correlativo incremental por (tipo, serie); `status = "Issued"`. |
| BR-7 | **Cliente** | Se reutiliza `Customer` por documento+tipo o se crea con los datos enviados (por defecto `00000000` / "CLIENTE GENERAL"). |
| BR-8 | **Cierre y mesas** | En una sola transacción: factura, pagos, `salesOrder.status = "Closed"` y `diningTable.active = true` (incluidas mesas unidas de `notes`). |
| BR-9 | **Asientos contables** | Hasta 4 asientos por venta: 1/5 provisión (121 / 401 / 701), 2/5 cobro (101 o 104 / 121), 4/5 costo mercadería (691 / 201) y 5/5 costo insumos (691 / 241); costo estimado 40 % del subtotal (70/30). |
| BR-10 | **Periodo contable** | Los asientos exigen cuentas activas (101, 104, 121, 401, 701, 691, 201, 241) y un período `OPEN`; si falta, la venta entera falla (`500`). |
| BR-11 | **Código de asiento** | Prefijo `MISC/<año>/<mes>/` + correlativo de 4 dígitos con reintentos ante colisión (P2002). |
| BR-12 | **Mozo** | El cobro móvil emite siempre `voucherType: "Ticket"` con cliente fijo `00000000` / "CLIENTE SALÓN". |
| BR-13 | **Sin control de acceso** | Ninguno de los dos endpoints valida sesión, cookie ni rol. |

## Endpoints

| Method | Path | Summary |
|--------|------|---------|
| POST | `/api/sales` | Registra la venta: emite comprobante, cobra, cierra y contabiliza. |
| GET | `/api/payment-methods` | Lista los métodos de pago activos. |

### POST `/api/sales` — Request

Acepta alias en inglés y español (`orderId`/`id_pedido`, `voucherType`/`tipo_comprobante`,
`payments`/`pagos`, `customer`/`cliente`, `amountReceived`/`monto_recibido`,
`gateway`/`pasarela`).

Cobro simple:

```json
{
  "orderId": 34,
  "voucherType": "Boleta",
  "paymentTypeId": 1,
  "amountReceived": 100,
  "customer": { "documentNumber": "47829103", "firstName": "JUAN PEREZ", "personType": "Natural", "phone": "999888777" },
  "gateway": { "provider": "mercado_pago", "mode": "manual" }
}
```

Pago en partes:

```json
{
  "orderId": 34,
  "voucherType": "Boleta",
  "payments": [ { "paymentTypeId": 1, "amount": 40 }, { "paymentTypeId": 2, "amount": 60 } ]
}
```

### POST `/api/sales` — Response (201)

```json
{
  "message": "Venta registrada, pedido cerrado, mesa liberada y asientos contables generados.",
  "journalEntriesCount": 4,
  "journalEntryIds": [11, 12, 13, 14],
  "invoice": {
    "id": 12,
    "voucherType": "Boleta",
    "series": "B001",
    "number": 451,
    "fullCode": "B001-000451",
    "issuedAt": "2026-10-05T19:12:00.000Z",
    "subtotal": 84.75,
    "igv": 15.25,
    "total": 100,
    "paymentMethod": "Efectivo",
    "amountReceived": 100,
    "change": 0,
    "customer": { "firstName": "JUAN PEREZ", "documentNumber": "47829103", "personType": "Natural" },
    "origin": "Mesa 3",
    "items": [ { "name": "1/4 Pollo a la Brasa", "quantity": 2, "unitPrice": 18, "subtotal": 36, "notes": "" } ],
    "gateway": { "provider": "mercado_pago", "mode": "manual", "status": "completed" }
  }
}
```

### POST `/api/sales` — Errors

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Cuerpo no válido | `{ "error": "Datos de venta no válidos." }` |
| 400 | `orderId` ausente o NaN | `{ "error": "ID de pedido inválido." }` |
| 400 | Sin `paymentTypeId` y sin `payments[]` | `{ "error": "Debe seleccionar un método de pago válido." }` |
| 400 | Parte con método inexistente/inactivo | `{ "error": "El método de pago con ID 9 no está disponible." }` |
| 400 | Parte con monto ≤ 0 | `{ "error": "El monto de cada pago parcial debe ser mayor a 0." }` |
| 400 | Método simple inexistente/inactivo | `{ "error": "El método de pago no está disponible." }` |
| 404 | Pedido inexistente | `{ "error": "El pedido a cobrar no existe." }` |
| 400 | Pedido ya cobrado | `{ "error": "Operación inválida: El pedido ya fue cobrado y cerrado anteriormente." }` |
| 400 | Pedido cancelado | `{ "error": "Operación rechazada: Un pedido cancelado no puede convertirse en una venta ni generar cobro." }` |
| 400 | Pedido sin ítems | `{ "error": "El pedido no contiene ítems para ser cobrado." }` |
| 400 | Partes ≠ total (± 0.05) | `{ "error": "La suma de las partes de pago (S/ X) no coincide con el total de la cuenta (S/ Y)." }` |
| 400 | Efectivo insuficiente (servidor) | `{ "error": "El monto entregado (S/ X) es menor al total a cobrar (S/ Y)." }` |
| 500 | Excepción (BD, cuentas, período cerrado, colisión de correlativo) | `{ "error": "No se pudo completar el cobro y cierre de la venta." }` |

No existen respuestas `401`/`403` en este método.

### GET `/api/payment-methods` — Response (200)

```json
{
  "data": [
    { "id": 1, "name": "Efectivo", "active": true,
      "gatewayConfig": { "supportsTapToPay": false, "supportsQr": false, "preparedProvider": "mercado_pago" } },
    { "id": 2, "name": "Yape", "active": true,
      "gatewayConfig": { "supportsTapToPay": false, "supportsQr": true, "preparedProvider": "mercado_pago" } },
    { "id": 4, "name": "Tarjeta / POS", "active": true,
      "gatewayConfig": { "supportsTapToPay": true, "supportsQr": false, "preparedProvider": "mercado_pago" } }
  ]
}
```

| Status | Condition | Body |
|--------|-----------|------|
| 500 | Excepción de BD | `{ "error": "No se pudieron obtener los métodos de pago." }` |

Métodos sembrados (`prisma/seed.ts`): **Efectivo, Yape, Plin, Tarjeta / POS,
Transferencia**.

## Permissions

- **Requerido**: ninguno. `POST /api/sales` y `GET /api/payment-methods` no usan
  `requireRole` ni verifican sesión/cookie, y no hay middleware activo
  (`middleware.ts` inexistente, `proxy.ts.desactivado`).
- Cualquier cliente que alcance la aplicación puede emitir comprobantes, cerrar pedidos y
  liberar mesas sin autenticación.
- Las pestañas "Caja y ventanilla" y "Cobros No Cobrados" del sidebar no aplican filtro de rol.

## Validations

**Cliente (UI)**

| # | Validación | Mensaje exacto |
|---|-----------|----------------|
| V1 | Comanda seleccionada | `Selecciona una comanda a cobrar.` |
| V2 | Documento (`validateCustomerDocument`, "Legal" si es Factura) | `Documento de cliente no válido.` |
| V3 | Partes con monto > 0 (mínimo 2) | `Para pagar en partes debe ingresar al menos 2 formas de pago con montos mayores a S/ 0.` |
| V4 | Suma de partes = total (± 0.05) | `La suma de las partes (S/ X) debe coincidir con el total de la cuenta (S/ Y).` |
| V5 | Efectivo cubre el total | `El monto entregado (S/ X) es menor al total a pagar (S/ Y). Faltan S/ Z.` |

Errores de red/servidor: `Error al procesar el cobro en ventanilla.` /
`Error al procesar el cobro móvil.` (antes de mostrar el mensaje del servidor).

**Servidor**: ver tabla *Errors*; además el número de comprobante se asigna con
`findFirst(orderBy number desc) + 1` y la restricción única `[voucherType, series, number]`
de `sales_invoice` protege contra duplicados.

## Acceptance Criteria

1. **When** se cobra en efectivo con monto suficiente **Then** se responde `201`, el pedido
   queda `Closed`, la mesa `active: true` y se crean hasta 4 asientos en el período abierto.
2. **When** el efectivo es insuficiente **Then** no hay llamada al servidor y aparece el
   mensaje exacto con la faltante.
3. **When** se cobra en partes **Then** se persiste un `SalesPayment` por parte y
   `invoice.paymentMethod` lista cada método con su importe.
4. **When** el pedido está `Closed` o `Cancelled` **Then** el servidor responde `400` con el
   mensaje documentado y no se modifica nada.
5. **When** falla un asiento (cuentas faltantes o período cerrado) **Then** la transacción
   revierte: no queda `SalesInvoice` y el cliente ve `No se pudo completar el cobro y cierre
   de la venta.`
6. **When** se cobra desde el mozo **Then** el comprobante se emite como Boleta `B001` con
   cliente `00000000` (aunque la UI diga "Ticket") y se abre el ticket para impresión.
7. **When** el cobro termina **Then** la UI limpia el formulario, recarga los datos y la
   comanda desaparece de "Cobros No Cobrados".

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Exponer `POST /api/sales` con alias EN/ES, validación de pedido cobrable,
  resolución de métodos de pago simples y en partes, e IGV recalculado en servidor.
- **FR-002**: Persistir en una única transacción la `SalesInvoice` (`Issued`, serie
  `F001`/`B001` correlativa), los `SalesPayment`, el cierre del pedido y la liberación de
  mesas (incluidas mesas unidas).
- **FR-003**: Generar dentro de la misma transacción hasta 4 asientos de venta
  (provisión, cobro, costo de mercadería y costo de insumos) vinculados a la factura.
- **FR-004**: Responder con `message`, `journalEntriesCount`, `journalEntryIds` e `invoice`
  completo (incluido `change` y `gateway` en eco).
- **FR-005**: Exponer `GET /api/payment-methods` con los métodos activos y sus flags de
  compatibilidad.
- **FR-006**: Implementar la pestaña de ventanilla: selección de comanda, comprobante
  (Boleta/Factura/Ticket), datos del cliente con consulta SUNAT/RENIEC, 4 métodos de pago,
  panel de vuelto, editor de partes con barra de progreso y botón de emisión.
- **FR-007**: Implementar el modal de cobro móvil del mozo con los mismos 4 métodos, vuelto y
  partes, abiert desde el salón y desde "Cobros No Cobrados".
- **FR-008**: Validar en cliente vuelto y suma de partes (`calculateChangeAmount`), mostrando
  los mensajes exactos documentados.
- **FR-009**: Tras el éxito: toast con el mensaje del servidor, apertura del ticket y
  recarga de los datos de la pestaña.

### Non-Functional Requirements

- **NFR-001**: Atomicidad total del cobro (factura, pagos, cierre y asientos en `£transaction`).
- **NFR-002**: `export const dynamic = "force-dynamic"` en ambas rutas; `registerSale` sin
  caché.
- **NFR-003**: Sin autenticación ni autorización en los endpoints de cobro.
- **NFR-004**: Sin integración de pagos reales: la pasarela es sólo metadato de respuesta.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un cobro válido produce exactamente 1 `SalesInvoice`, ≥ 1 `SalesPayment`, un
  pedido `Closed` y ≥ 2 asientos (hasta 4).
- **SC-002**: `invoice.total === Σ items.subtotal` y `subtotal + igv === total` (redondeo a 2
  decimales).
- **SC-003**: La suma de `journalEntryIds` corresponde a asientos balanceados (debe = haber)
  en libros "Ventas" y "Caja y bancos".
- **SC-004**: Ningún caso de error deja datos a medias (pedido sin factura ni asientos).
- **SC-005**: Después del cobro la comanda no aparece en `uncollectedPayments` (spec `012`).

---

## Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US1-US4 | `POST` de `app/api/sales/route.ts` (56-174) |
| FR-002 | US4 escenarios 1-2 | Transacción del `POST` (211-295) |
| FR-003 | US4 escenarios 3-4 | `postSaleJournalEntries` (197-320) |
| FR-004 | US1 escenario 4 | Respuesta `201` (297-343) |
| FR-005 | US2 escenario 1 | `app/api/payment-methods/route.ts` |
| FR-006 | US1-US2 | Pestaña `cashier` (1633-2174) |
| FR-007 | US3 | Modal de cobro móvil (2740-3036) |
| FR-008 | US1 escenario 3, US2 escenario 2 | `calculateChangeAmount` + partes |
| FR-009 | US1 escenario 4, US3 escenario 4 | Éxito de ambos `execute*Payment` |

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| `POST` completo: alias, validaciones, IGV, cliente, serie/correlativo y respuesta | `app/api/sales/route.ts` líneas 56-343 |
| Errores `400`/`404` y `500` con mensajes exactos | `app/api/sales/route.ts` líneas 59-173 y 344-350 |
| Transacción: factura, pagos, `Closed`, mesas y mesas unidas | `app/api/sales/route.ts` líneas 211-295 |
| Asientos de venta (provisión, cobro, costos 4/5 y 5/5) | `lib/services/accounting-posting.service.ts` líneas 197-320 |
| Cuentas usadas, costo estimado 40 % (70/30) y elección 101 vs 104 | `lib/services/accounting-posting.service.ts` líneas 19-41 y 172-179 |
| Período contable obligatorio y reintentos de código `MISC/...` | `lib/services/accounting-posting.service.ts` líneas 57-78 y 121-127 |
| `GET /api/payment-methods` y flags derivados del nombre | `app/api/payment-methods/route.ts` líneas 6-32 |
| Métodos de pago sembrados | `prisma/seed.ts` líneas 67-82 |
| Estado de caja/mozo (método, partes, comprobante, procesando) | `app/sales/page.tsx` líneas 213-249 |
| Totales, IGV y vuelto en UI | `app/sales/page.tsx` líneas 337-357; `lib/utils/sales-helpers.ts` líneas 20-61 |
| Helper de partes (`add`/`remove`/`update`/`autofill`) y salto a ventanilla | `app/sales/page.tsx` líneas 647-714 |
| `executeCounterPayment`: validaciones, mixto, resolución de método y éxito | `app/sales/page.tsx` líneas 716-819 |
| `openWaiterPayment` y `executeWaiterPayment` (payload Ticket/CLIENTE SALÓN) | `app/sales/page.tsx` líneas 824-925 |
| Botón "Cobrar en Mesa (Mozo)" desde el salón | `app/sales/page.tsx` líneas 1330-1351 |
| Botones "Cobro Mozo" (sólo Mesa) y "Ventanilla" en Cobros No Cobrados | `app/sales/page.tsx` líneas 1593-1613 |
| Pestaña Caja: lista, comprobante, cliente, métodos, vuelto, partes, totales y botón | `app/sales/page.tsx` líneas 1633-2174 |
| Modal Cobro Móvil: total, métodos, Tap to Pay, Yape, efectivo, partes y footer | `app/sales/page.tsx` líneas 2740-3036 |
| Servicio `registerSale` (POST + manejo de error) | `lib/services/tables.service.ts` líneas 300-328 |
| `listPaymentMethods` (`cache: "no-store"`) | `lib/services/tables.service.ts` líneas 290-298 |
| Enlaces del sidebar: "Caja y ventanilla" y "Cobros No Cobrados" | `components/personalized/Sidebar.tsx` líneas 156-163 y 183-191 |
| Esquema `SalesInvoice` / `SalesPayment` y restricción única | `prisma/schema.prisma` líneas 502-538 |
| Pruebas: IGV (sección 1), vuelto (sección 2), documento (sección 3) y payloads de cobro (sección 8) | `test/gestion-mesas.test.ts` líneas 12-45, 47-77, 79+ y 198-229 |
| Ausencia de integración real: `mercadopago.service` sólo se importa desde el webhook | `app/api/webhooks/mercadopago/route.ts` línea 6; `test/mercadopago.test.ts` líneas 1-47 |

**No existen pruebas automatizadas del método `POST /api/sales`** (sólo pruebas unitarias de
los helpers y de la forma de los payloads).

**Fuera de alcance**: visualización e impresión de comprobantes (spec `018`), listado de
cobros pendientes (spec `012`), creación de clientes (spec `016`), webhook y servicio real de
Mercado Pago (`/api/webhooks/mercadopago`, `lib/services/mercadopago.service`), anulación o
devolución de ventas (no existe) y reportes contables derivados (specs `007`, `013`).

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
