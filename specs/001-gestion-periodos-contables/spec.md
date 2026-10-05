# Feature Specification: Gestión de Períodos Contables

**Feature Branch**: `001-gestion-periodos-contables`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Documentar el comportamiento real actualmente implementado de la gestión de períodos contables (creación por mes/año, estados, cierre, restricciones de períodos cerrados, relación con asientos contables, permisos y validaciones)."

> **Nota de procedencia**: esta especificación describe el sistema **ya implementado**. Todo lo
> afirmado fue verificado por lectura de código (rutas indicadas en
> [Evidencia](#evidencia-de-verificación)); no se describen funcionalidades futuras ni reglas
> ausentes en la implementación.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear un período contable de un mes completo (Priority: P1)

Como usuario autorizado, quiero registrar un período contable correspondiente a un mes natural
completo (mes + año) para que el sistema tenga un rango de fechas sobre el cual acepte o rechace
el registro de asientos.

**Why this priority**: sin un período creado no puede registrarse ningún asiento contable
(la existencia de un período que cubra la fecha es condición obligatoria en ambos puntos de
creación de asientos). Es la base de toda la funcionalidad.

**Independent Test**: Desde `/accounting/periods`, pulsar "Crear Periodo" con el mes/año actual
sin período previo → se crea un período con `startDate` = primer día del mes 00:00:00.000 UTC,
`endDate` = último día del mes 23:59:59.999 UTC, `status = OPEN`, y aparece en la lista.

**Acceptance Scenarios**:

1. **Given** no existe período para el mes actual, **When** se envía `POST /api/accounting-periods`
   con `{ month, year }` válidos, **Then** se responde `201` con el período creado en estado `OPEN`.
2. **Given** ya existe un período cuyas fechas de inicio y fin caen dentro del mes solicitado,
   **When** se envía la misma petición, **Then** se responde `400` con
   `"Ya existe un período para el mes y año seleccionados"` y no se crea nada.
3. **Given** se envía `month` distinto de un número entero entre 1 y 12, **When** se procesa la
   petición, **Then** se responde `400` con `"El mes debe ser un número entero entre 1 y 12"`.
4. **Given** se envía `year` que no es número o es menor que 1970, **When** se procesa la
   petición, **Then** se responde `400` con `"year must be a valid integer"`.
5. **Given** la pantalla de creación, **When** se muestra el formulario, **Then** mes y año
   muestran el mes en curso y están deshabilitados (sólo se puede crear el mes actual desde la UI).

---

### User Story 2 - Cerrar un período para detener el registro de asientos (Priority: P2)

Como usuario autorizado, quiero cerrar un período (y poder reabrirlo) para que el sistema deje de
aceptar asientos contables con fecha dentro de ese rango.

**Why this priority**: el cierre es la única regla de control de la funcionalidad; sin él el
período no aporta valor de negocio. La reapertura está implementada en el mismo endpoint.

**Independent Test**: Enviar `PATCH /api/accounting-periods` con `{ periodId }` sobre un período
abierto → el período pasa a `CLOSED` con `closedAt` y `closedById` rellenos; un intento de
registrar un asiento en esa fecha responde `400`.

**Acceptance Scenarios**:

1. **Given** un período en estado `OPEN`, **When** se envía `PATCH /api/accounting-periods` con
   `{ periodId }`, **Then** el período queda en `CLOSED`, `closedAt` = instante de la operación y
   `closedById` = usuario autorizado de la petición.
2. **Given** un período en estado `CLOSED`, **When** se envía `PATCH` sin `reopen`, **Then** se
   responde `400` con `"Period already closed"` y el período no cambia.
3. **Given** un período `CLOSED`, **When** se envía `PATCH` con `{ periodId, reopen: true }`,
   **Then** el período vuelve a `OPEN` y `closedAt`/`closedById` se limpian a `null`.
4. **Given** un `periodId` inexistente, **When** se envía `PATCH`, **Then** se responde `404`
   con `"Period not found"`.
5. **Given** un cuerpo sin `periodId`, **When** se envía `PATCH`, **Then** se responde `400` con
   `"periodId is required"`.
6. **Given** cualquier usuario, **When** intenta cerrar o reabrir desde la interfaz web,
   **Then** no existe acción disponible: la pantalla de períodos no incluye botón de cierre
   (el cierre sólo es posible mediante la API `PATCH`).

---

### User Story 3 - Impedir asientos en período cerrado o inexistente (Priority: P3)

Como sistema, debo rechazar el registro de un asiento contable cuya fecha no esté cubierta por un
período abierto, para que la contabilidad no se escriba en rangos ya cerrados.

**Why this priority**: es la restricción que materializa el cierre; depende de que existan
períodos (P1) y de que se puedan cerrar (P2).

**Independent Test**: Con un período cerrado para el mes X, intentar crear un asiento con fecha en
mes X desde "Asientos / Libro Diario" → la API responde `400` y el diálogo de nuevo asiento
muestra el mensaje devuelto.

**Acceptance Scenarios**:

1. **Given** no existe ningún período que cubra la fecha del asiento, **When** se envía
   `POST /api/journal-entries`, **Then** se responde `400` con
   `"No accounting period found for the given date."`.
2. **Given** existe un período `CLOSED` que cubre la fecha, **When** se envía
   `POST /api/journal-entries`, **Then** se responde `400` con
   `"Cannot register entries in a closed accounting period."` y no se crea el asiento.
3. **Given** un período `OPEN` que cubre la fecha, **When** se envía `POST /api/journal-entries`
   con un asiento válido, **Then** se crea el asiento con `periodId` = id del período.
4. **Given** un período `CLOSED`, **When** se registra una venta, compra o pago que genera asientos
   automáticos con fecha en ese rango, **Then** el servicio lanza
   `'No se pueden registrar asientos en un período cerrado'` y la operación (que corre dentro de
   una transacción) se revierte.
5. **Given** un período `OPEN` pero cuya fecha no esté cubierta por ningún período, **When** se
   genera un asiento automático, **Then** el servicio lanza
   `'No se encontró período contable para la fecha del asiento'`.

---

### User Story 4 - Listar y consultar períodos y sus asientos (Priority: P3)

Como usuario, quiero ver la lista de períodos con sus fechas y estado, filtrarla y entrar a los
asientos de un período.

**Why this priority**: es una consulta de soporte; no bloquea las operaciones anteriores.

**Independent Test**: Abrir `/accounting/periods` → se muestra la tabla con ID, inicio, fin y
estado de cada período; `GET /api/accounting-periods?status=closed` devuelve sólo los cerrados.

**Acceptance Scenarios**:

1. **Given** existen períodos, **When** se carga `/accounting/periods`, **Then** la tabla lista
   todos los períodos sin requerir autenticación en el `GET`.
2. **Given** se consulta `?status=open` o `?status=closed`, **When** se procesa, **Then** se
   filtra por `OPEN` / `CLOSED` respectivamente (cualquier otro valor de `status` no aplica filtro).
3. **Given** se consulta `?month=MM&year=AAAA` con `month` entre 1 y 12, **When** se procesa,
   **Then** sólo se devuelven períodos cuyo `startDate` cae dentro de ese mes (rango UTC).
4. **Given** cada fila de la tabla, **When** se pulsa "Ver Asientos", **Then** se navega a
   `/accounting/journal?from=<startDate>&to=<endDate>`; la página de journal hoy no lee esos
   parámetros de consulta, por lo que abre sin filtros preaplicados.

---

### Edge Cases

- Fecha de asiento sin período contable contiguo (huecos entre meses) → rechazo explícito, tanto
  en el registro manual (`400`) como en el asiento automático (`throw` dentro de la transacción).
- Cierre doble → segundo `PATCH` sin `reopen` responde `400 "Period already closed"`.
- Reapertura de un período ya abierto → la operación se ejecuta sin validación de estado previo:
  vuelve a `OPEN` con `closedAt`/`closedById` en `null`.
- Duplicidad de mes → detectada por solape de `startDate` y `endDate` dentro del mes solicitado,
  no por un índice único en base de datos.
- `POST` con `month`/`year` no numéricos o fuera de rango → `400` con lista `errors`.
- Cookie de sesión ausente o usuario `id = 3` inexistente o con rol distinto de `1` → el helper
  de autorización lanza excepción y el `catch` responde **HTTP 500** (no 401/403).
- `GET` con `month` inválido o ausente → no se aplica filtro de fechas (se listan todos).
- Asientos de "provisión" de venta y de compra se crean **sin** `periodId`, campo obligatorio en
  el esquema (ver [Inconsistencias detectadas](#inconsistencias-detectadas)).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema debe permitir crear períodos contables únicamente como **meses naturales
  completos**, calculando `startDate` y `endDate` en UTC a partir de `{ month, year }`.
- **FR-002**: El sistema debe rechazar la creación de un período si ya existe otro período cuyas
  fechas caen dentro del mes solicitado (un solo período por mes/año).
- **FR-003**: Todo período nuevo debe crearse en estado `OPEN`.
- **FR-004**: El sistema debe mantener dos estados posibles: `OPEN` y `CLOSED` (enumeración
  `PeriodStatus`), sin otros estados intermedios.
- **FR-005**: El sistema debe permitir cerrar un período, registrando `status = CLOSED`,
  `closedAt` (fecha/hora del cierre) y `closedById` (usuario que cierra).
- **FR-006**: El sistema debe permitir reabrir un período cerrado, limpiando `closedAt` y
  `closedById`.
- **FR-007**: El sistema debe impedir cerrar dos veces un período mediante la misma operación
  (devuelve `400`).
- **FR-008**: El sistema debe impedir crear asientos contables cuya fecha no esté cubierta por
  ningún período.
- **FR-009**: El sistema debe impedir crear asientos contables con fecha en un período `CLOSED`,
  tanto en el registro manual como en la generación automática por ventas, compras y pagos.
- **FR-010**: Todo asiento contable debe quedar asociado a un período (`periodId` obligatorio,
  con clave foránea `ON DELETE RESTRICT`).
- **FR-011**: El sistema debe exponer un listado de períodos con filtros opcionales por estado y
  por mes/año, sin requerir autenticación.
- **FR-012**: La creación y el cierre/reapertura de períodos deben exigir autorización
  (rol `ADMIN`).
- **FR-013**: La interfaz de períodos debe permitir crear el período del mes en curso y listar
  los existentes con su estado.
- **FR-014**: No existen operaciones de modificación de fechas ni de eliminación de períodos
  (no hay endpoint `DELETE` ni edición de `startDate`/`endDate`).
- **FR-015**: El cierre de un período **no** ejecuta ningún proceso contable adicional: no
  verifica asientos existentes, no arrastra saldos ni transfiere resultados; sólo cambia el
  estado y los metadatos de cierre.
- **FR-016**: No existe modificación ni anulación de asientos contables (sólo `GET` y `POST`),
  por lo que la restricción del período cerrado aplica únicamente a la **creación** de asientos.

### Reglas de negocio

| # | Regla | Comportamiento observado |
|---|---|---|
| RN-1 | Un período = un mes natural completo | El servidor calcula el rango; el cliente sólo envía `month` y `year`. |
| RN-2 | Un solo período por mes/año | Validación por búsqueda de solape antes de crear; mensaje en español. |
| RN-3 | Los períodos nacen abiertos | `status: "OPEN"` fijado en la creación. |
| RN-4 | Sólo un ADMIN puede crear, cerrar y reabrir | Rol `ADMIN_ROLE_ID = 1` sobre el usuario `id = 3` (hardcodeado). |
| RN-5 | No se escribe contabilidad en un período cerrado | Dos puntos de validación: `POST /api/journal-entries` y `createBalancedEntry()`. |
| RN-6 | No se escribe contabilidad sin período | Misma validación: sin período que cubra la fecha → rechazo. |
| RN-7 | Cerrar/reabrir queda trazado | `closedAt` y `closedById` se rellenan al cerrar y se limpian al reabrir. |

### Validaciones implementadas

**`POST /api/accounting-periods`** (respuesta `400` con `{ errors: [...] }`):

1. `month` debe ser número entre 1 y 12 → `"El mes debe ser un número entero entre 1 y 12"`.
2. `year` debe ser número `>= 1970` → `"year must be a valid integer"`.
3. Unicidad del mes → `"Ya existe un período para el mes y año seleccionados"`.

**`PATCH /api/accounting-periods`**:

1. `periodId` obligatorio → `400` `"periodId is required"`.
2. Período inexistente → `404` `"Period not found"`.
3. Ya cerrado sin `reopen` → `400` `"Period already closed"`.

**Creación de asientos**:

1. `POST /api/journal-entries` sin período que cubra la fecha → `400`
   `"No accounting period found for the given date."`.
2. `POST /api/journal-entries` con período `CLOSED` → `400`
   `"Cannot register entries in a closed accounting period."`.
3. Servicio de asientos automáticos sin período → `throw`
   `'No se encontró período contable para la fecha del asiento'`.
4. Servicio de asientos automáticos con período no abierto → `throw`
   `'No se pueden registrar asientos en un período cerrado'`.

**Interfaz** (`/accounting/periods`): el formulario sólo admite el mes/año en curso (inputs
deshabilitados); los errores de creación se muestran como `toast` y la lista se recarga.

### Permisos

- `GET /api/accounting-periods` **no requiere autenticación**.
- `POST` y `PATCH` pasan por `requireRole(...)`, que:
  1. exige la presencia de la cookie `auth-token` (el valor no se valida; el login guarda el
     literal `"dummy-token"`),
  2. consulta **siempre** el usuario con `id = 3` (valor fijo en el código),
  3. exige `roleId === 1` (`ADMIN_ROLE_ID`),
  4. devuelve el id de ese usuario como autor del cierre/creación.
- Cualquier fallo de este helper se captura en el `catch` de la ruta y responde **HTTP 500** con
  el mensaje del error (no se devuelven 401 ni 403).
- No existe middleware global de rutas (`middleware.ts`) y las tablas `Permission` /
  `RolePermission` del esquema **no se utilizan** en el código de la aplicación.
- El enlace "Periodos Contables" del sidebar (sección CONTABILIDAD) no aplica ningún filtro de rol.

### Relación con los asientos contables

- Modelo `JournalEntry.periodId: Int` **obligatorio**, relación con `AccountingPeriod`,
  índice `idx_journal_entry_period` y restricción `ON DELETE RESTRICT` (no se puede borrar un
  período con asientos asociados).
- Ambos puntos de creación de asientos resuelven el período con la misma expresión:
  `startDate <= fechaDelAsiento <= endDate`.
- Los productores de asientos sujetos a esta validación son: registro manual de asientos,
  ventas (`app/api/sales/route.ts`), webhook de MercadoPago y facturación de compras
  (`lib/services/purchases/invoices.ts`), todos ellos a través de
  `lib/services/accounting-posting.service.ts`.
- El listado de asientos (libro diario / libro mayor) filtra por rango de fechas, no por
  `periodId`; la pantalla de períodos enlaza al libro diario con `?from=`/`?to=`.

### Key Entities *(include if feature involves data)*

- **AccountingPeriod (Período contable)**: rango de fechas `startDate`–`endDate` que representa un
  mes natural completo; `status` (`OPEN`|`CLOSED`); metadatos de cierre `closedAt`, `closedById`;
  autor `userId`; marcas `createdAt`/`updatedAt`. Tabla `accounting_period`.
- **JournalEntry (Asiento contable)**: registro contable con `entryDate`, código único, glosa,
  diario y **`periodId` obligatorio** que lo vincula al período que lo ampara. Tabla
  `journal_entry`.
- **User (Usuario)**: puede ser autor del período (`userId`) y el que lo cierra (`closedById`);
  su `roleId` determina la autorización (rol `1` = `ADMIN`).
- **PeriodStatus (Estado)**: enumeración de dos valores `OPEN` y `CLOSED`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un período del mes en curso puede crearse desde la UI en una sola acción y queda
  visible en la lista con estado `OPEN`.
- **SC-002**: El 100 % de los intentos de crear un segundo período para un mes ya ocupado se
  rechazan con `400` y no producen registros duplicados.
- **SC-003**: El 100 % de los intentos de crear un asiento con fecha sin período o con período
  cerrado se rechazan (HTTP `400` en el registro manual; error transaccional revertido en la
  generación automática), sin dejar asiento persistido.
- **SC-004**: Tras cerrar un período, su registro muestra `status = CLOSED` con `closedAt` y
  `closedById` diligenciados; tras reabrirlo, ambos vuelven a `null` y el estado a `OPEN`.
- **SC-005**: El listado refleja el estado real de todos los períodos y admite filtrado por
  estado y por mes/año.
- **SC-006**: Las operaciones de creación, cierre y reapertura fallan con HTTP `500` cuando no
  hay cookie de sesión o el usuario `id = 3` no tiene rol `1` (comportamiento actual verificado).

---

## Assumptions

- Esta especificación describe **únicamente** comportamiento existente; no se infieren reglas de
  negocio no presentes en el código (p. ej., no hay cierre contable con arrastre de saldos,
  ni bloqueo de edición de asientos porque dichos flujos no existen).
- No existen pruebas automatizadas ni seed para esta funcionalidad: la verificación se hizo por
  lectura del código fuente (listado en la sección de Evidencia).
- El comportamiento documentado corresponde al esquema introducido por la migración
  `20261005191917` (`accounting_period`, `PeriodStatus`, `journal_entry.period_id`).
- La fecha de creación de la especificación es 2026-10-05, coincidente con la fecha de análisis.

---

## Inconsistencias detectadas

Registradas como hechos del código actual, sin proponer cambios:

1. **Asientos de "provisión" sin `periodId`**: `postSaleJournalEntries()` (asiento
   "Provisión de la venta") y `postPurchaseJournalEntries()` (asiento "Provisión de la compra")
   crean el asiento directamente con `journalEntry.create` **sin** incluir `periodId`, a
   diferencia de `createBalancedEntry()` y del `POST /api/journal-entries` que sí lo hacen.
   `periodId` es un campo obligatorio en `prisma/schema.prisma`.
2. **Autorización hardcodeada**: `requireRole()` ignora el contenido del token y consulta fijamente
   el usuario `id = 3`; el comentario del código indica `id 1`. Los errores de autorización se
   devuelven como HTTP 500.
3. **La UI no permite cerrar períodos**: la pantalla sólo lista y crea; el cierre existe únicamente
   en `PATCH /api/accounting-periods`.
4. **La UI sólo permite crear el mes actual**, mientras que el endpoint acepta cualquier `month`/`year`
   válido.
5. **El enlace "Ver Asientos" no preaplica filtros**: `/accounting/journal` no lee los parámetros
   `?from=`/`?to=` enviados desde la pantalla de períodos.
6. **Comentario desactualizado en `POST`**: la cabecera del endpoint menciona
   `{ startDate, endDate }`, pero el cuerpo real esperado es `{ month, year }`.
7. **Sin paginación ni orden** en `GET /api/accounting-periods` (`findMany` sin `orderBy`).

---

## Evidencia de verificación

| Afirmación | Archivo |
|---|---|
| Modelo, estados y relación con asientos | `prisma/schema.prisma` (líneas 561–612) |
| Migración de la tabla y `period_id NOT NULL` | `prisma/migrations/20261005191917/migration.sql` |
| `GET`/`POST`/`PATCH`, validaciones y autorización | `app/api/accounting-periods/route.ts` |
| Pantalla de listado y creación por mes/año | `app/accounting/periods/page.tsx` |
| Enlace en el sidebar | `components/personalized/Sidebar.tsx` (líneas 337–345) |
| Bloqueo de asientos manuales | `app/api/journal-entries/route.ts` (líneas 339–352, 366) |
| Bloqueo de asientos automáticos | `lib/services/accounting-posting.service.ts` (líneas 121–126, 137) |
| Asientos de provisión sin `periodId` | `lib/services/accounting-posting.service.ts` (líneas 221–255, 370–404) |
| Productores de asientos sujetos al bloqueo | `app/api/sales/route.ts`, `app/api/webhooks/mercadopago/route.ts`, `lib/services/purchases/invoices.ts` |
| Cookie `auth-token` de login | `app/api/auth/login/route.ts` |
| Sesión alternativa no usada por esta ruta | `lib/auth/session.ts`, `lib/auth/sesion-actual.ts` |
| Permisos granulares sin uso | `prisma/schema.prisma` (`Permission`, `RolePermission`) |
| Ausencia de tests y seeds de períodos | `test/`, `lib/services/*.test.ts`, `prisma/seed.ts` |
