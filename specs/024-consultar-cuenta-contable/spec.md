# Feature Specification: Consultar Cuenta Contable (detalle)

**Feature Branch**: `024-consultar-cuenta-contable`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "consultar cuentas contables"

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**, basada en
> `GET /api/accounts/{id}` y sus pruebas automatizadas. El alcance se limita a la **consulta del
> detalle de una cuenta individual**; el listado completo del plan contable ya está especificado en
> la spec `003-listado-cuentas-contables` y la creación de cuentas en la spec
> `004-crear-cuenta-contable`.

---

## Purpose

Permitir **consultar una cuenta contable individual** por su identificador, devolviendo sus datos
maestros (código, nombre, tipo, jerarquía, estado y uso actual) en el **mismo formato público** que
el listado del plan contable, para que la UI y otros servicios internos puedan obtener o refrescar
la información de una cuenta concreta sin recargar el plan completo.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar el detalle de una cuenta por su identificador (Priority: P1)

Como usuario de contabilidad (o como consumidor interno del sistema), quiero obtener la información
completa de una cuenta contable a partir de su identificador, para verificar sus datos maestros
(código, nombre, tipo, cuenta padre y estado) en un solo paso.

**Why this priority**: es la operación central de la funcionalidad y el cimiento de cualquier
consumidor que necesite una cuenta concreta (edición, validaciones, reportes); sin ella no existe la
funcionalidad.

**Independent Test**: Solicitar el detalle de una cuenta existente (por ejemplo, id `7`) → `200` con
el objeto `{ id, codigo, nombre, tipo, idPadre, activo, usos }` de esa cuenta.

**Acceptance Scenarios**:

1. **Given** existe una cuenta con el id solicitado, **When** se solicita `GET /api/accounts/7`,
   **Then** se responde `200` con la cuenta en formato público (`codigo`, `nombre`, `tipo`,
   `idPadre`, `activo`, `usos`).
2. **Given** la cuenta es una subcuenta, **When** se solicita, **Then** `idPadre` contiene el
   identificador de su cuenta padre; si es cuenta raíz, `idPadre` es `null`.
3. **Given** el identificador no corresponde a ninguna cuenta, **When** se solicita
   `GET /api/accounts/9999`, **Then** se responde `404` con
   `{ "error": "Cuenta contable no encontrada." }`.
4. **Given** el identificador no contiene dígitos (por ejemplo, `GET /api/accounts/abc`),
   **When** se procesa, **Then** se responde `400` con
   `{ "error": "Identificador de cuenta inválido." }` sin consultar la base de datos.
5. **Given** la base de datos falla, **When** se procesa, **Then** se responde `500` con
   `{ "error": "No se pudo obtener la cuenta contable." }` y el error se registra en la consola del
   servidor.
6. **Given** una petición **sin** cookie de sesión válida, **When** se solicita el detalle, **Then**
   se responde `401` con `{ "error": "No autenticado" }` (emitido por la capa global de sesión de
   la aplicación, antes de llegar al manejador); con cookie válida se responde igual que en los
   demás escenarios.

---

### User Story 2 - Consultar cuentas inactivas y medir su uso (Priority: P2)

Como usuario de contabilidad, quiero poder consultar también las cuentas **inactivas** y ver cuántas
líneas de asiento las usan (`usos`), para decidir con datos si conviene reactivarlas o dejarlas
inactivas.

**Why this priority**: complementa la consulta con la información de estado y uso que sostiene la
gestión del plan contable; depende de la P1.

**Independent Test**: Solicitar el detalle de una cuenta desactivada → `200` con `activo: false` y
`usos` igual al número de líneas de asiento que la referencian.

**Acceptance Scenarios**:

1. **Given** una cuenta desactivada, **When** se solicita su detalle, **Then** se responde `200`
   con `activo: false` (la consulta no filtra por estado).
2. **Given** una cuenta usada en 12 líneas de asiento, **When** se solicita, **Then** `usos` es
   `12`; para una cuenta nunca usada, `usos` es `0`.
3. **Given** una cuenta creada hace instantes sin movimientos, **When** se solicita, **Then** se
   responde `200` con `usos: 0` y `activo: true`.

---

### Edge Cases

- **Identificador con prefijo numérico**: la lectura del identificador es tolerante —
  `GET /api/accounts/01`, `GET /api/accounts/ 7` y `GET /api/accounts/7abc` resuelven a las cuentas
  `1` y `7` (sólo se rechaza si no hay dígitos iniciales). Un identificador no numérico puro
  (`abc`, vacío, `NaN`) produce `400`.
- **Identificador numérico inexistente o negativo**: se responde `404`, nunca `200` vacío ni `500`.
- **Cuenta inactiva**: se consulta igual que una activa, con `activo: false`.
- **Cuenta raíz**: se devuelve con `idPadre: null`.
- **Cuenta recién creada**: se devuelve con `usos: 0`.
- **Query string o cuerpo**: se ignoran por completo; la operación sólo lee el identificador de la
  ruta.
- **Formato de la respuesta**: el detalle se devuelve como **objeto plano** (sin envoltorio), a
  diferencia del listado del plan contable, que se envuelve en `{ data: [...] }`.
- **Fallo de base de datos**: `500` con el mensaje documentado y registro del error en consola del
  servidor; jamás una respuesta exitosa parcial.
- **Petición sin cookie de sesión válida**: `401` con `{ "error": "No autenticado" }`, respondido
  por la capa global de sesión **antes** de que la petición llegue al manejador (ver
  **Permissions**).

---

## Functional Requirements

- **FR-001**: Exponer la consulta de una cuenta contable individual mediante `GET /api/accounts/{id}`
  (identificador numérico en la ruta).
- **FR-002**: Devolver la cuenta en el formato público `{ id, codigo, nombre, tipo, idPadre, activo,
  usos }`, idéntico al de cada elemento del listado del plan contable, y **sin** envoltorio `data`.
- **FR-003**: Responder `400` con `{ "error": "Identificador de cuenta inválido." }` cuando el
  identificador no contiene dígitos, **sin** consultar la base de datos.
- **FR-004**: Responder `404` con `{ "error": "Cuenta contable no encontrada." }` cuando ninguna
  cuenta tiene ese identificador.
- **FR-005**: Incluir las cuentas **inactivas** en la respuesta (la consulta no filtra por estado).
- **FR-006**: Incluir `usos`, el número de líneas de asiento que usan la cuenta, calculado en la
  misma consulta (sin llamadas adicionales por cuenta).
- **FR-007**: El manejador de la consulta **no** realiza ninguna comprobación de sesión, cookie ni
  rol por sí mismo; sin embargo, la aplicación aplica una **capa global de sesión** que exige un
  cookie de sesión válido para casi todas las rutas: sin él, la consulta recibe `401` con
  `{ "error": "No autenticado" }` antes de llegar al manejador (ver **Permissions**).
- **FR-008**: Manejar fallos inesperados con `500` y `{ "error": "No se pudo obtener la cuenta
  contable." }`, registrando el error en la consola del servidor.
- **FR-009**: Ignorar query strings y cuerpo de la petición; la respuesta depende únicamente del
  identificador de la ruta.
- **FR-010**: Que la consulta siempre refleje el estado actual de la cuenta (nunca se sirve desde
  caché estática ni se precalcula en build).

### Reglas de negocio

| #  | Regla                    | Descripción                                                                                                                                     |
|----|--------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| BR-1 | **Formato público compartido** | El detalle usa exactamente los 7 campos del formato público del plan contable (`codigo`/`nombre`/`tipo`/`idPadre`/`activo`/`usos`), no nombres internos. |
| BR-2 | **Sin control en el manejador** | El handler no valida sesión ni rol; la autenticación la impone la capa global de sesión de la aplicación (`proxy.ts`), que responde `401 "No autenticado"` sin cookie válida. |
| BR-3 | **Visibilidad total**          | Se consultan también las cuentas inactivas, para poder evaluar su reactivación o su uso histórico.                                               |
| BR-4 | **Respuesta sin envoltorio**   | El detalle responde el objeto directamente; el listado del plan contable envuelve en `{ data: [...] }` (diferencia consciente entre ambos recursos). |
| BR-5 | **Identificador tolerante**    | Se acepta cualquier identificador cuyo prefijo sea numérico entero (`01`, ` 7`, `7abc`); sólo se rechaza si no hay dígitos iniciales.              |
| BR-6 | **La consulta no audita**      | Consultar una cuenta no genera registros de auditoría (la auditoría se reserva para modificaciones).                                              |

## Endpoint

| Method | Path               | Summary                                          |
|--------|--------------------|--------------------------------------------------|
| GET    | `/api/accounts/{id}` | Devuelve el detalle de una cuenta contable por su identificador. |

### Request

Sólo se lee el identificador de la ruta. No se requiere cuerpo; cualquier query string se ignora.

### Response (200)

```json
{
  "id": 7,
  "codigo": "104",
  "nombre": "Bancos",
  "tipo": "Activo",
  "idPadre": null,
  "activo": true,
  "usos": 4
}
```

### Errors

| Status | Condition                                                     | Body                                                   |
|--------|---------------------------------------------------------------|--------------------------------------------------------|
| 400    | El identificador no contiene dígitos (`abc`, vacío, `NaN`)    | `{ "error": "Identificador de cuenta inválido." }`     |
| 404    | Ninguna cuenta existe con ese identificador                   | `{ "error": "Cuenta contable no encontrada." }`        |
| 500    | Excepción inesperada al consultar la base de datos            | `{ "error": "No se pudo obtener la cuenta contable." }` |

Las respuestas anteriores provienen del **manejador** de la ruta. Además, la **capa global de
sesión** de la aplicación puede responder `401` con `{ "error": "No autenticado" }` **antes** de
que la petición llegue al manejador (ver **Permissions**). No existen respuestas `403`: la
consulta no distingue roles.

## Permissions

- **Capa global de sesión (obligatoria)**: la aplicación cuenta con un middleware de sesión activo
  (`proxy.ts`, en la raíz del proyecto) que exige un cookie de sesión **válido** para todas las
  rutas, salvo el login, la API de autenticación y los webhooks externos. Cualquier petición
  anónima a `GET /api/accounts/{id}` recibe `401` con `{ "error": "No autenticado" }` y **nunca
  llega al manejador**.
- **Manejador de la ruta (sin control propio)**: una vez autenticada la petición, la consulta no
  exige ningún rol ni aplica comprobaciones adicionales (no usa `requireRole` ni equivalente): una
  sesión válida de cualquier rol puede consultar cualquier cuenta por su identificador, activa o
  inactiva.
- Las pruebas unitarias invocan el manejador directamente (sin pasar por el middleware), por lo
  que validan el comportamiento del handler con sesión "efectiva".
- Para comparar: `POST`/`PATCH` de `/api/accounting-periods` exigen rol `ADMIN` en el propio
  endpoint (spec `001`).

## Validations

- Única validación de entrada: el identificador debe producir un número; en caso contrario `400`
  con `"Identificador de cuenta inválido."`, sin tocar la base de datos.
- Cualquier excepción no prevista produce `500` con el mensaje documentado y un registro del error
  en consola del servidor.

## Acceptance Criteria

1. **When** se solicita el detalle de una cuenta existente **Then** se recibe `200` con los 7 campos
   del formato público, sin envoltorio.
2. **When** el identificador no contiene dígitos **Then** se recibe `400` y no se consulta la base
   de datos.
3. **When** el identificador no corresponde a ninguna cuenta **Then** se recibe `404`.
4. **When** la cuenta está inactiva **Then** se recibe `200` con `activo: false` (misma respuesta
   que para una cuenta activa, salvo el estado).
5. **When** `usos` se devuelve **Then** coincide con el número de líneas de asiento que usan la
   cuenta (incluido `0`).
6. **When** la base de datos falla **Then** se recibe `500` con el mensaje documentado y el error
   queda registrado en el servidor.
7. **When** un cliente posee ya los datos de una cuenta del listado **Then** puede sustituirlos por
   los del detalle sin transformación alguna (mismo formato público).

---

## Requirements *(mandatory)*

### Functional Requirements

Ver sección [Functional Requirements](#functional-requirements) (FR-001 a FR-010), redactadas con
los mismos identificadores.

### Key Entities *(include if feature involves data)*

- **Cuenta contable (AccountingAccount)**: entidad maestra del plan contable; identificador
  numérico único, código único y breve, nombre, tipo (valores del catálogo PCGE: Activo, Pasivo,
  Patrimonio, Ingreso, Gasto, Costo), autorreferencia a la cuenta padre (jerarquía; `null` en
  cuentas raíz) y estado activo/inactivo.
- **Formato público de la cuenta (AccountApi)**: representación expuesta en la consulta
  (`id`, `codigo`, `nombre`, `tipo`, `idPadre`, `activo`, `usos`), compartida con el listado del
  plan contable.
- **Línea de asiento (JournalEntryDetail)**: registro contable que referencia a una cuenta; el
  número de líneas que la referencian es lo que la consulta expone como `usos`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una sola consulta por identificador devuelve los 7 datos de la cuenta, sin llamadas
  adicionales ni recargas del plan contable completo.
- **SC-002**: El 100 % de los identificadores sin dígitos iniciales se rechaza con `400` y sin
  consultar la base de datos.
- **SC-003**: El 100 % de los identificadores inexistentes responde `404` (nunca un `200` vacío ni
  un `500`).
- **SC-004**: Ante cualquier fallo de base de datos la consulta responde `500` con el mensaje
  documentado y deja constancia del error en el servidor.
- **SC-005**: Las cuentas inactivas se consultan con la misma facilidad y el mismo formato que las
  activas (ninguna consulta se "pierde" por estado).
- **SC-006**: El detalle usa el mismo formato público que el listado: un cliente puede reemplazar en
  memoria los datos de una cuenta del listado por los del detalle sin transformaciones.
- **SC-007**: El 100 % de las respuestas exitosas incluye `usos` consistente con el número real de
  líneas de asiento de la cuenta.

---

## Assumptions

- La descripción "consultar cuentas contables" se interpreta como **la consulta del detalle de una
  cuenta individual**, porque el **listado completo** del plan contable ya está especificado en la
  spec `003-listado-cuentas-contables` y la creación en la spec `004-crear-cuenta-contable`; esta
  especificación cubre el recurso de consulta individual que aún no tenía spec propia.
- Esta funcionalidad se describe a nivel de **servicio de consulta (API)**: hoy no existe pantalla
  ni botón propio que consuma el detalle (la página "Cuentas contables" construye su vista con el
  listado y la edición usa el objeto de la fila); se documenta el comportamiento del servicio tal
  como está implementado y probado.
- La **edición** de cuentas (`PATCH`) y el **cambio de estado** quedan **fuera de alcance** (son
  operaciones distintas con sus propias reglas y validaciones).
- La autenticación la impone la **capa global de sesión** de la aplicación (`proxy.ts`), activa y
  verificada el 2026-10-12: exige cookie de sesión para casi todas las rutas (excepciones: login,
  API de autenticación y webhooks). El propio manejador de la consulta no valida sesión ni rol.
- El comportamiento descrito corresponde al código vigente al 2026-10-12.

---

## Evidencia de verificación

| Afirmación                                                        | Archivo |
|-------------------------------------------------------------------|---------|
| Consulta individual, manejo de `400`/`404`/`500` y lectura del id | `app/api/accounts/[id]/route.ts` (función `GET`, líneas 61–90) |
| Formato público y contador de usos                                | `ACCOUNT_SELECT` y `toAccountApi` en `lib/chart-of-accounts.ts` |
| Pruebas del detalle (200 con formato, 404, 400 sin tocar la BD, 500 en fallo de BD) | `app/api/accounts/[id]/route.test.ts` (`describe("GET /api/accounts/[id]")`, 4 escenarios) |
| Modelo, jerarquía autocíclica y tipos de cuenta                   | `prisma/schema.prisma` (modelo `AccountingAccount`) |
| Formato compartido con el listado                                 | `specs/003-listado-cuentas-contables/spec.md` |
| Capa global de sesión activa (`401` sin cookie)                   | `proxy.ts` (matcher: todas las rutas salvo login, `api/auth` y `api/webhooks`) |
| Documentación OpenAPI corregida (esquema `Account` + errores)      | `app/api/openapi/swaggerConfig.ts` y anotación `@openapi` del `GET` en `app/api/accounts/[id]/route.ts` |
| Sin consumidor front-end del detalle hoy                          | `lib/services/accounts.service.ts` (sólo `listAccounts`, `registerAccount`, `updateAccount`) |

---

## Correcciones aplicadas (2026-10-12, durante la implementación)

1. **Autenticación (US1 escenario 6, FR-007, BR-2, Permissions, Edge Cases, Assumptions)**: se
   afirmaba que no existía middleware de autorización y que la consulta era anónima. **Realidad
   verificada**: `proxy.ts` (middleware de Next.js 16) está **activo** y exige cookie de sesión
   para casi todas las rutas; una petición anónima recibe `401 "No autenticado"` antes de llegar
   al manejador. El manejador, en efecto, no valida sesión ni rol (por eso las pruebas unitarias
   pasan sin sesión), pero el sistema completo sí autentica. Todas las secciones afectadas fueron
   corregidas. *(Nota: las specs `003` y `004` contienen la misma afirmación desactualizada; su
   corrección queda fuera del alcance de esta feature.)*
2. **Prueba del `500` añadida**: el escenario "fallo de base de datos → `500`" (FR-008/SC-004) no
   tenía cobertura automatizada; se añadió al bloque `describe("GET /api/accounts/[id]")` de
   `app/api/accounts/[id]/route.test.ts`.
3. **Documentación OpenAPI corregida**: la anotación `@openapi` del `GET` referenciaba un esquema
   `#/components/schemas/Account` **inexistente** (`$ref` colgante) y no vinculaba los errores al
   esquema `Error`. Se añadió el esquema `Account` en `app/api/openapi/swaggerConfig.ts` y se
   enlazaron las respuestas `400`/`404`/`500` a `Error` con sus ejemplos exactos.
4. **Observación fuera de alcance**: `requireRole` en `app/api/accounting-periods/route.ts` espera
   una cookie `auth-token` (inexistente en la aplicación) y un usuario con id fijo `3`; en la
   práctica `POST`/`PATCH` de períodos responden `500 "Unauthorized: user not found"` (pertenenece
   al dominio de la spec `001`). Para la verificación de `usos` se creó el período contable de
   octubre 2026 como **fixture de base de datos**.
