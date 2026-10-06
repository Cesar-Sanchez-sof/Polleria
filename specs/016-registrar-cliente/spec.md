# Feature Specification: Registrar Cliente

**Feature Branch**: `016-registrar-cliente`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *registrar
cliente* (alta de cliente con DNI/RUC, nombre y teléfono desde el módulo de Ventas),
describiendo el comportamiento real implementado."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y por las pruebas del validador de documento
> (`test/gestion-mesas.test.ts`, bloque de `validateCustomerDocument`), referenciadas en
> [Evidencia de verificación](#evidencia-de-verificación). No se describen funcionalidades
> futuras ni reglas ausentes en la implementación. La consulta de libros contables
> (libro mayor) **se omite deliberadamente**: ya está cubierta por la spec `013` según
> decisión del usuario. Cobro, facturación y listado de clientes son features separadas.

---

## Purpose

Registrar un cliente (persona natural con DNI o persona jurídica con RUC) con sus datos de
contacto para poder emitirle comprobantes y seleccionarlo en el cobro de ventanilla.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar un cliente nuevo (Priority: P1)

Como cajero o mozo, quiero dar de alta un cliente con su documento y nombre para facturarle
o identificarlo en una venta.

**Why this priority**: es la operación central; el alta alimenta la pestaña "Clientes" y el
selector de facturación de la caja.

**Independent Test**: `POST /api/customers` con `{ "personType": "Natural", "documentNumber":
"47829103", "firstName": "Juan" }` → `201` con `{ "message": "Cliente registrado con éxito.",
"customer": { … } }`.

**Acceptance Scenarios**:

1. **Given** sin cliente con ese documento, **When** se envía un DNI de 8 dígitos con nombre,
   **Then** `201`, el nombre y apellido se guardan en **MAYÚSCULAS**, `totalPurchases: 0` y
   `active: true`, y la UI muestra "Cliente registrado con éxito.".
2. **Given** `firstName` vacío, **When** se envía, **Then** `400`
   `{ "error": "El nombre o razón social es obligatorio." }`.
3. **Given** un DNI de 7 dígitos, **When** se envía, **Then** `400`
   `{ "error": "El DNI debe contener exactamente 8 dígitos numéricos." }`.
4. **Given** un RUC de 11 dígitos que no empieza por 10/15/17/20, **When** se envía,
   **Then** `400` `{ "error": "El RUC debe comenzar con los dígitos 10, 15, 17 o 20." }`.
5. **Given** ya existe un cliente con ese `personType` + `documentNumber`, **When** se envía
   de nuevo, **Then** `400`
   `{ "error": "Ya existe un cliente registrado con el documento <doc>." }`.
6. **Given** el cuerpo no es JSON válido, **When** se envía, **Then** `400`
   `{ "error": "Datos del cliente no válidos." }`.
7. **Given** un fallo inesperado, **When** se envía, **Then** `500`
   `{ "error": "Error interno al guardar los datos del cliente." }`.

---

### User Story 2 - Completar los datos con consulta a RENIEC/SUNAT (Priority: P2)

Como usuario, quiero pulsar "Consultar" junto al número de documento para rellenar
automáticamente el nombre o la razón social.

**Why this priority**: es una ayuda al alta, no un requisito (el formulario se puede llenar a
mano).

**Independent Test**: `GET /api/document-lookup?tipo=dni&numero=47829103` →
`{ "success": true, "data": { …, "fuente": … } }` y la UI rellena nombre y apellidos.

**Acceptance Scenarios**:

1. **Given** un documento vacío, **When** se pulsa "Consultar", **Then** la UI muestra
   `toast.warning("Ingrese un número de documento para consultar.")` y no hace la petición.
2. **Given** un documento con formato inválido, **When** se llama al endpoint, **Then** `400`
   con el mensaje de `validateCustomerDocument`.
3. **Given** sin token `JSON_PE_TOKEN`, **When** se consulta, **Then** la respuesta sigue
   siendo `success: true` con `fuente: "simulado"` y nombres de prueba
   (`47829103` → "JUAN CARLOS PÉREZ RODRÍGUEZ", `20601234567` → "INVERSIONES GASTRONÓMICAS
   PERÚ S.A.C.").
4. **Given** la consulta falla, **When** hay error, **Then**
   `500` `{ "error": "No se pudo consultar el documento. Intente nuevamente." }` y un toast
   de error en la UI.

---

### User Story 3 - Ver y seleccionar clientes registrados (Priority: P2)

Como usuario, quiero ver el listado de clientes con sus compras y poder elegir uno para
facturar.

**Why this priority**: es la pantalla donde vive el botón de alta y el resultado inmediato de
éste.

**Independent Test**: pestaña "Clientes (N)" → tabla con documento, tipo, nombre, teléfono,
compras y botón "Facturar".

**Acceptance Scenarios**:

1. **Given** clientes en base, **When** se abre la pestaña, **Then** la tabla muestra los
   campos con badge "Natural"/"Jurídica", el conteo de compras y el botón "Facturar".
2. **Given** un texto de búsqueda, **When** se escribe, **Then** se filtra por documento,
   nombre, apellidos y nombre completo (cliente, sin volver al servidor).
3. **Given** no hay coincidencias, **When** se filtra, **Then** se muestra "No se encontraron
   customers registrados."
4. **Given** un cliente, **When** se pulsa "Facturar", **Then** se rellena la caja con sus
   datos, el tipo de comprobante se fija en "Factura" si es Jurídico o "Boleta" si es
   Natural, se salta a la pestaña Caja y aparece `toast.info("Cliente <nombre> seleccionado
   para facturación.")`.

---

### Edge Cases

- **Segundo "cliente general" sin documento**: el chequeo de duplicados **omite** documentos
  vacíos o `"00000000"` (se guarda como `00000000`), pero la restricción única de base de
  datos es `(personType, documentNumber)` → según el código, un segundo alta sin documento
  choca con esa restricción y responde el `500` genérico en lugar de un `400` de duplicado.
- **Duplicado sólo por tipo**: la unicidad es por combinación `personType + documentNumber`,
  así que un DNI y un RUC iguales (imposibles en la práctica) o dos personas de distinto tipo
  con el mismo número no chocan.
- **Mayúsculas sólo en servidor**: `firstName` y `lastName` se guardan `.toUpperCase()`, pero
  la UI mantiene lo que tecleó hasta el `loadData()` posterior.
- **Apellidos opcionales**: para persona natural el campo no es obligatorio; si se omite,
  `lastName` es `null` y el nombre completo se compone sólo con `firstName`.
- **Persona Jurídica ignora apellidos**: el formulario ni siquiera pinta el campo y el envío
  no lo incluye.
- **`personType` se normaliza**: `"Juridico"` se convierte en `"Legal"`; cualquier otro valor
  cae en `"Natural"`.
- **Teléfono sin validación**: sólo se recorta; la columna admite 20 caracteres y la UI no
  impone `maxLength`.
- **Sin edición ni baja**: `PUT`/`PATCH`/`DELETE` **no existen** en `/api/customers`; el campo
  `active` siempre es `true` y no hay botón para modificar o desactivar un cliente.
- **Alta con documento duplicado desde la UI**: el modal permanece abierto y muestra el
  mensaje del servidor en un toast.
- **Recarga completa tras el alta**: `registerNewCustomer` llama a `loadData()`, que refresca
  mesas, platos, pedidos y clientes (no sólo el listado de clientes).
- **Datos simulados por defecto**: sin `JSON_PE_TOKEN` la consulta "RENIEC/SUNAT" devuelve
  nombres inventados con `fuente: "simulado"` (advertido en la documentación del servicio).
- **Límites de columna sin control en cliente**: `firstName`/`lastName` (100) y
  `documentNumber` (11) no tienen `maxLength` en el formulario → un valor más largo produce
  un error crudo de Prisma (500).
- **Sin control de acceso**: ni `GET` ni `POST` validan sesión, cookie ni rol (no hay
  middleware activo).

---

## Functionalidades / Functionalities

- **`POST /api/customers`**: alta de cliente con validación de documento, unicidad y
  normalización.
- **`GET /api/customers?q=`**: listado con `totalPurchases` (usado por la pestaña).
- **`GET/POST /api/document-lookup`**: consulta DNI/RUC (json.pe o modo simulado).
- **Pestaña "Clientes (N)"** de `/sales`: tabla, búsqueda local y botón "+ Nuevo Cliente".
- **Diálogo "Registrar Nuevo Cliente"** con selector de tipo de persona, consulta de
  documento, campos y acciones Cancelar/Guardar.
- Acción "Facturar" por fila (paso a la caja).

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Nombre obligatorio** | `firstName` (nombres o razón social) no puede estar vacío. |
| BR-2 | **Formato de documento** | Natural: DNI de exactamente 8 dígitos numéricos; Jurídica: RUC de 11 dígitos que empieza por 10, 15, 17 o 20. Vacío o `00000000` siempre es válido. |
| BR-3 | **Documento único por tipo** | No puede repetirse la pareja `(personType, documentNumber)`; el chequeo de duplicado se salta cuando el documento es vacío o `00000000`. |
| BR-4 | **Normalización** | Nombre y apellidos se guardan en mayúsculas y recortados; documento sin espacios; `Juridico → Legal`. |
| BR-5 | **Cliente nuevo activo** | `active: true` y `totalPurchases: 0`. |
| BR-6 | **Comprobante por tipo** | Persona Jurídica → "Factura"; Natural → "Boleta" al seleccionar para facturar. |
| BR-7 | **Alta sin recarga parcial** | Tras registrar se ejecuta `loadData()` (recarga todo el módulo). |
| BR-8 | **Sin control de acceso** | Ninguna ruta valida sesión ni rol. |

## Endpoints

| Method | Path | Summary |
|--------|------|---------|
| POST | `/api/customers` | Registra un cliente. |
| GET | `/api/customers` | Lista clientes (máx. 100, con conteo de compras). |
| GET/POST | `/api/document-lookup` | Consulta DNI/RUC en json.pe (o simulado). |

### Request (POST `/api/customers`)

| Campo | Alias aceptado | Tipo | Requerido | Notas |
|-------|----------------|------|-----------|-------|
| `personType` | `tipo_persona` | `Natural` \| `Legal` \| `Juridico` | No | Default `Natural`; `Juridico` → `Legal`. |
| `documentNumber` | `nro_doc` | string | No | Vacío → se guarda `00000000`. |
| `firstName` | `nombre` | string | **Sí** | Se guarda en MAYÚSCULAS. |
| `lastName` | `apellido` | string | No | Se guarda en MAYÚSCULAS; sólo Natural en la UI. |
| `phone` | `telefono` | string | No | Sólo se recorta. |

### Response (201)

```json
{
  "message": "Cliente registrado con éxito.",
  "customer": {
    "id": 7,
    "documentNumber": "47829103",
    "firstName": "JUAN CARLOS",
    "lastName": "PÉREZ RODRÍGUEZ",
    "fullName": "JUAN CARLOS PÉREZ RODRÍGUEZ",
    "phone": "987654321",
    "personType": "Natural",
    "active": true,
    "totalPurchases": 0
  }
}
```

### Errores

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Cuerpo no JSON | `{ "error": "Datos del cliente no válidos." }` |
| 400 | Sin nombre | `{ "error": "El nombre o razón social es obligatorio." }` |
| 400 | Documento inválido | `{ "error": "El DNI debe contener exactamente 8 dígitos numéricos." }` / `{ "error": "El RUC debe contener exactamente 11 dígitos numéricos." }` / `{ "error": "El RUC debe comenzar con los dígitos 10, 15, 17 o 20." }` |
| 400 | Duplicado | `{ "error": "Ya existe un cliente registrado con el documento <doc>." }` |
| 500 | Fallo inesperado | `{ "error": "Error interno al guardar los datos del cliente." }` |

**`GET /api/customers`**: `200` `{ "data": [ { id, documentNumber, firstName, lastName,
fullName, phone, personType, active, totalPurchases } ] }` (orden `id` desc, `take: 100`,
búsqueda `q` en documento/nombre/apellidos); `500` `{ "error": "No se pudo obtener la lista de
clientes." }`.

**`/api/document-lookup`**: `400` `{ "error": "Debe ingresar el número de documento." }` o el
mensaje del validador; `200` `{ "success": true, "data": { tipo, numero, nombreCompleto,
…, fuente: "json.pe" | "simulado" } }`; `500` `{ "error": "No se pudo consultar el documento.
Intente nuevamente." }`.

No existen respuestas `401`/`403`.

## Permissions

- **Requerido**: ninguno. `POST`/`GET /api/customers` y `/api/document-lookup` no usan
  `requireRole` ni verifican sesión/cookie, y no existe middleware de autorización activo
  (`middleware.ts` inexistente, `proxy.ts.desactivado`).
- Cualquier cliente que alcance la aplicación puede registrar clientes y consultar datos de
  identidad.
- La pestaña "Clientes" y su botón "+ Nuevo Cliente" no aplican filtro de rol.

## Validations

**Servidor** (en orden): cuerpo JSON → `firstName` no vacío → `validateCustomerDocument` →
duplicado (si el documento no es vacío/`00000000`) → creación.

**Cliente** (`registerNewCustomer`): `toast.warning("El nombre o razón social es
obligatorio.")` si falta nombre; `validateCustomerDocument` con `toast.error(mensaje)` antes
de enviar; protección `savingCustomer` ("Guardando..."). La consulta de documento valida
primero que haya número escrito.

## Acceptance Criteria

1. **When** se completa el formulario con datos válidos **Then** el cliente queda registrado,
   el modal se cierra, se limpian los campos y se muestra "Cliente registrado con éxito.".
2. **When** el documento tiene formato inválido o se duplica **Then** la API responde `400`
   con el mensaje exacto y la UI lo muestra sin cerrar el modal.
3. **When** el usuario pulsa "Consultar" **Then** el formulario se rellena con el resultado
   (real con token, simulado sin él).
4. **When** el alta termina **Then** el listado de la pestaña refleja el cliente con 0 compras
   y badge de tipo correcto.
5. **When** se selecciona "Facturar" **Then** la caja queda precargada con el comprobante
   adecuado al tipo de persona.
6. **When** no hay clientes **Then** se muestra el estado vacío documentado.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Exponer `POST /api/customers` con alias en español, validación de nombre,
  formato de documento y unicidad por `(personType, documentNumber)`.
- **FR-002**: Normalizar el alta (mayúsculas, recortes, `00000000`, `Juridico → Legal`,
  `active: true`, `totalPurchases: 0`).
- **FR-003**: Exponer `GET /api/customers` con búsqueda `q`, máximo 100 registros y conteo de
  facturas emitidas.
- **FR-004**: Exponer `/api/document-lookup` con la misma validación de documento y con modo
  simulado cuando no hay token.
- **FR-005**: Ofrecer en la UI el diálogo de alta con selector de tipo de persona, consulta de
  documento, apellidos sólo para Natural y guardado con estados de carga.
- **FR-006**: Listar y buscar clientes localmente en la pestaña "Clientes".
- **FR-007**: Seleccionar un cliente para facturar (relleno de caja + comprobante según tipo).
- **FR-008**: Recargar el módulo (`loadData()`) tras un alta exitosa.

### Non-Functional Requirements

- **NFR-001**: `export const dynamic = "force-dynamic"` en las tres rutas; el listado se pide
  con `cache: "no-store"`.
- **NFR-002**: Sin autenticación, sin paginación (lista tope de 100) y sin operaciones de
  edición/borrado.
- **NFR-003**: La consulta externa degrada a datos simulados si no hay token o si la API
  falla, sin bloquear el alta.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Todo alta exitosa responde `201` con `message: "Cliente registrado con éxito."`
  y un cliente `active` con `totalPurchases: 0`.
- **SC-002**: Cero clientes con documento duplicado dentro del mismo tipo de persona.
- **SC-003**: Ningún cliente se persiste con nombre vacío o con un documento de formato
  inválido.
- **SC-004**: Tras el alta, el contador de la pestaña `Clientes (N)` refleja el nuevo cliente
  en la siguiente carga.
- **SC-005**: Todos los rechazos devuelven el mensaje exacto documentado (400/500) y la UI lo
  muestra en un toast.

---

## Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US1 escenarios 1-7 | `POST` de `app/api/customers/route.ts` |
| FR-002 | US1 escenario 1 / edge mayúsculas | Normalización en el `POST` |
| FR-003 | US3 escenarios 1-2 | `GET` de `app/api/customers/route.ts` + `listCustomers` |
| FR-004 | US2 escenarios 1-4 | `app/api/document-lookup/route.ts` + `document-lookup.service.ts` |
| FR-005 | US1, US2 (UI) | Diálogo "Registrar Nuevo Cliente" y `registerNewCustomer` |
| FR-006 | US3 escenarios 2-3 | `filteredCustomers` |
| FR-007 | US3 escenario 4 | `selectCustomerForSale` |
| FR-008 | US1 escenario 1 | `await loadData()` tras el alta |

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| `POST` completo: alias, validaciones, duplicado, normalización y respuestas | `app/api/customers/route.ts` líneas 60-139 |
| `GET` con búsqueda, `_count`, `take: 100` y orden `id` desc | `app/api/customers/route.ts` líneas 14-58 |
| `normalizePersonType` (`Juridico → Legal`) | `app/api/customers/route.ts` líneas 9-12 |
| Reglas de documento (DNI 8, RUC 11 + prefijos, vacío/`00000000` válidos) | `lib/utils/sales-helpers.ts` líneas 66-107 |
| Modelo `Customer` y restricción única `(personType, documentNumber)` | `prisma/schema.prisma` líneas 408-420 |
| Servicios `createCustomer` / `listCustomers` (fetch sin caché y manejo de error) | `lib/services/tables.service.ts` líneas 330-358 |
| Pestaña, búsqueda, botón "+ Nuevo Cliente" y tabla con "Facturar" | `app/sales/page.tsx` líneas 2182-2281 |
| Contador de la pestaña `Clientes (N)` | `app/sales/page.tsx` líneas 1085-1094 |
| `registerNewCustomer` (validaciones, toasts, reset y `loadData()`) | `app/sales/page.tsx` líneas 930-964 |
| Diálogo: tipo de persona, "Consultar", campos y botones Guardar/Cancelar | `app/sales/page.tsx` líneas 3041-3176 |
| `lookupIdentityDocument` de UI (relleno según destino) | `app/sales/page.tsx` líneas 265-305 |
| `selectCustomerForSale` (comprobante por tipo y salto a Caja) | `app/sales/page.tsx` líneas 966-973 |
| Endpoint de consulta con validación y mensajes | `app/api/document-lookup/route.ts` líneas 1-68 |
| Servicio externo json.pe con token y modo simulado | `lib/services/document-lookup.service.ts` líneas 27-139 |
| `loadData()` incluye `listCustomers()` | `app/sales/page.tsx` líneas 150-161 |
| Pruebas del validador de documento (DNI/RUC/vacío) | `test/gestion-mesas.test.ts` líneas 81-106 |

**No existen pruebas automatizadas de `POST/GET /api/customers` ni de
`/api/document-lookup`.**

**Fuera de alcance**: edición/baja de clientes (no existen), selección y cobro de la venta,
emisión de comprobantes, ventanas de búsqueda de clientes en caja y el Libro Diario/Libro
Mayor (spec `013`).

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
