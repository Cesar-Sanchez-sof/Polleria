# Feature Specification: Listado de Cuentas Contables

**Feature Branch**: `003-listado-cuentas-contables`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Endpoint público que devuelva el plan contable completo (todas las cuentas, jerarquizadas) para su consumo en la UI y en otros servicios internos."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**, corregida el
> 2026-10-05 contra el código fuente. Las correcciones realizadas respecto de la versión anterior
> se listan en [Correcciones aplicadas](#correcciones-aplicadas). Toda afirmación está respaldada
> en [Evidence of Implementation](#evidence-of-implementation).

---

## Purpose

Proveer un endpoint público que devuelva el **plan contable completo** (todas las cuentas, con su
jerarquía y su uso actual) para que la UI construya el árbol de cuentas y otros servicios internos
consulten el plan contable sin llamadas adicionales.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar el plan contable completo (Priority: P1)

Como frontend de contabilidad, quiero obtener de una sola vez todas las cuentas (raíces y
subcuentas, activas e inactivas) ordenadas por código, para construir el árbol jerárquico y filtrar
en cliente.

**Why this priority**: es la única operación de esta funcionalidad y es dependencia de otros
módulos (selector de cuentas del diálogo de cuentas, panel de árbol).

**Independent Test**: `GET /api/accounts` sin parámetros → `200` con `{ data: [...] }` y cada
elemento con `{ id, codigo, nombre, tipo, idPadre, activo, usos }`.

**Acceptance Scenarios**:

1. **Given** existen cuentas en la base, **When** se solicita `GET /api/accounts`, **Then** se
   responde `200` con `{ data: [ … ] }` ordenado por código ascendente.
2. **Given** el plan contable contiene cuentas inactivas, **When** se solicita, **Then** aparecen
   incluidas con `activo: false` (el cliente decide si mostrarlas).
3. **Given** una subcuenta, **When** se solicita, **Then** su elemento incluye `idPadre` con el id
   de la cuenta raíz/padre; las cuentas raíz tienen `idPadre: null`.
4. **Given** la base de datos falla, **When** se solicita, **Then** se responde `500` con
   `{ "error": "No se pudo obtener el plan contable." }` y se registra el error en consola del
   servidor.
5. **Given** que no hay autenticación en la ruta, **When** se solicita sin cookie de sesión,
   **Then** se responde `200` igual que con sesión.

---

### User Story 2 - Consumir el listado desde la UI (Priority: P2)

Como usuario de contabilidad, quiero ver el árbol de cuentas con su uso (`usos`), para saber
cuántas líneas de asiento usa cada cuenta y decidir si puede desactivarse.

**Why this priority**: es el valor visible del listado; depende de la P1.

**Independent Test**: Abrir "Cuentas contables" → la tabla muestra las cuentas agrupadas por
jerarquía con el número de usos, y los filtros de búsqueda/tipo/estado se aplican en el navegador.

**Acceptance Scenarios**:

1. **Given** el listado cargado, **When** el usuario filtra por tipo o estado, **Then** el filtrado
  ocurre en cliente sin nuevas peticiones (la API no expone filtros).
2. **Given** una cuenta con 12 líneas de asiento, **When** se muestra, **Then** su `usos` es `12`
   (calculado como `_count.entryDetails`).

---

### Edge Cases

- **Base de datos vacía**: la respuesta contiene `"data": []` (no es un error).
- **Cuenta raíz sin `parentId`**: se expone como `idPadre: null` y el cliente la trata como nodo
  raíz.
- **Cuentas inactivas**: se incluyen con `activo: false`; la UI las muestra etiquetadas y no las
  ofrece como cuenta padre al crear subcuentas.
- **Orden de códigos**: el orden se calcula sobre la columna de texto `code` (`VarChar(10)`), es
  decir, orden lexicográfico, no numérico; el árbol se reconstruye en cliente a partir de `idPadre`.
- **Sin parámetros**: cualquier query string ignorada; la ruta no lee `request`.

---

## Functionalities

- **GET `/api/accounts`** devuelve la lista completa de cuentas contables ordenada por código.
- Cada cuenta incluye `id`, `codigo`, `nombre`, `tipo`, `idPadre`, `activo` y `usos`.
- La respuesta tiene la forma `{ data: AccountApi[] }` (`toAccountApi` en `lib/chart-of-accounts`).
- La ruta está marcada `export const dynamic = "force-dynamic"` (nunca se genera en build ni se
  sirve desde caché estática).

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Ordenamiento** | Las cuentas se retornan ordenadas por `code` ascendente (orden lexicográfico de la columna de texto) para que el cliente reconstruya el árbol. |
| BR-2 | **Selección mínima** | Sólo se seleccionan los campos de `ACCOUNT_SELECT` (incluye el contador `_count.entryDetails`), evitando datos innecesarios. |
| BR-3 | **Sin control de acceso** | El endpoint es público: no valida sesión, cookie ni rol (ver **Permissions**). |
| BR-4 | **Sin paginación** | El listado no está paginado ni filtrado en el servidor; el cliente filtra localmente, para que una subcuenta nunca se separe de su padre. |
| BR-5 | **Visibilidad total** | Se devuelven también las cuentas inactivas, para poder reactivarlas desde la UI. |
| BR-6 | **Formato público en español** | La respuesta usa `codigo`/`nombre`/`tipo`/`idPadre`/`activo`/`usos`, no los nombres de columna en inglés. |

## Endpoint

| Method | Path | Summary |
|--------|------|---------|
| GET | `/api/accounts` | Lista todas las cuentas contables del plan de cuentas. |

### Request

No se requiere cuerpo ni parámetros. La función del manejador no recibe la petición (`GET()` sin
argumentos), por lo que los query strings no tienen efecto.

### Response (200)

```json
{
  "data": [
    {
      "id": 1,
      "codigo": "1",
      "nombre": "Activo",
      "tipo": "Activo",
      "idPadre": null,
      "activo": true,
      "usos": 0
    },
    {
      "id": 2,
      "codigo": "101",
      "nombre": "Caja",
      "tipo": "Activo",
      "idPadre": 1,
      "activo": true,
      "usos": 12
    }
  ]
}
```

### Errors

| Status | Condition | Body |
|--------|-----------|------|
| 500 | Excepción inesperada al consultar la base de datos | `{ "error": "No se pudo obtener el plan contable." }` |

No existen respuestas `400`/`404`: la operación no acepta entradas.

## Permissions

- **Requerido**: ninguno. El endpoint no comprueba sesión, cookie ni rol (no usa `requireRole` ni
  ninguna otra verificación) y **no existe middleware de autorización activo** en el proyecto
  (`middleware.ts` inexistente, `proxy.ts.desactivado`).
- En la práctica, cualquier cliente que alcance la aplicación puede leer el plan contable.
- El enlace "Cuentas contables" del sidebar no aplica filtro de rol.
- Para comparar: `POST`/`PATCH` de `/api/accounting-periods` sí exigen rol `ADMIN` (spec `001`).

## Validations

- No hay validaciones de entrada (endpoint sin parámetros ni cuerpo).
- Se captura cualquier excepción y se responde `500` con el mensaje
  `"No se pudo obtener el plan contable."`, registrándola con `console.error`.

## Acceptance Criteria

1. **When** se accede a `GET /api/accounts` **Then** se recibe `200` con la lista completa en
   `data`, ordenada por `code` ascendente y con los campos
   `id`, `codigo`, `nombre`, `tipo`, `idPadre`, `activo`, `usos`.
2. **When** el plan contiene cuentas inactivas **Then** aparecen en la respuesta con
   `activo: false`.
3. **When** la base de datos produce un error **Then** la API responde `500` con
   `{ "error": "No se pudo obtener el plan contable." }`.
4. **When** se llama sin cookie de sesión **Then** la respuesta es idéntica (no hay autenticación).
5. **When** el cliente filtra la lista localmente por `idPadre` o `activo` **Then** puede construir
   el árbol jerárquico sin llamadas adicionales.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Exponer un endpoint `GET /api/accounts` que devuelva todas las cuentas contables.
- **FR-002**: Ordenar el listado por `code` ascendente.
- **FR-003**: Devolver cada cuenta en el formato público `{ id, codigo, nombre, tipo, idPadre,
  activo, usos }` (`usos` = número de líneas de asiento que usan la cuenta).
- **FR-004**: No requerir paginación, filtros ni autenticación.
- **FR-005**: Incluir las cuentas inactivas en la respuesta.
- **FR-006**: Manejar errores de base de datos con respuesta `500` y log en consola.
- **FR-007**: Mantener la ruta dinámica (`force-dynamic`), sin renderizado/caché estático.

### Non-Functional Requirements

- **NFR-001**: La respuesta no se sirve desde caché estática (`export const dynamic = "force-dynamic"`).
- **NFR-002**: El listado se sirve en una sola consulta (`findMany` única), sin consultas N+1: el
  contador de usos se obtiene con `_count` en la misma consulta.
- **NFR-003**: La anotación OpenAPI (`@openapi` en la ruta) documenta un esquema desactualizado
  (array plano con `id`/`code`/`name`) que no coincide con la respuesta real (ver
  [Correcciones aplicadas](#correcciones-aplicadas)).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una sola petición `GET /api/accounts` devuelve el plan contable completo (raíces,
  subcuentas e inactivas) sin paginación ni llamadas adicionales.
- **SC-002**: El 100 % de los elementos de la respuesta contiene los 7 campos del formato público,
  incluido `usos`.
- **SC-003**: Ante cualquier fallo de base de datos la API responde `500` con el mensaje
  documentado, nunca con una respuesta exitosa parcial.
- **SC-004**: La UI puede reconstruir el árbol jerárquico y aplicar filtros de tipo/estado en
  cliente sin volver a llamar a la API.

---

## Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | Consultar el plan contable completo (US1) | `GET` en `app/api/accounts/route.ts` |
| FR-002 | Ordenamiento | `orderBy: { code: "asc" }` |
| FR-003 | Formato público | `ACCOUNT_SELECT` + `toAccountApi` en `lib/chart-of-accounts.ts` |
| FR-004 | Sin paginación ni auth | No existen parámetros `limit`/`offset` ni verificación de sesión |
| FR-005 | Cuentas inactivas incluidas | `findMany` sin filtro `where` (cubierto por test) |
| FR-006 | Manejo de errores | `catch` devuelve `500` con mensaje |
| FR-007 | Ruta dinámica | `export const dynamic = "force-dynamic"` |

---

## Evidence of Implementation

- Ruta: `app/api/accounts/route.ts` — `GET()` sin argumentos, `findMany({ orderBy: { code: "asc" }, select: ACCOUNT_SELECT })` y `Response.json({ data: accounts.map(toAccountApi) })`; `catch` → `500`.
- Constantes auxiliares: `ACCOUNT_SELECT`, `toAccountApi`, `AccountApi` en `lib/chart-of-accounts.ts`.
- Modelo: `prisma/schema.prisma` → `AccountingAccount` (`code String @unique @db.VarChar(10)`, `parentId`, `active`, relación `entryDetails[]`).
- Consumidor front-end: `listAccounts()` en `lib/services/accounts.service.ts` (`getJson` sin caché; lee `response.data`).
- Pruebas automatizadas: `app/api/accounts/route.test.ts` (describe "GET /api/accounts") — verifica orden, inclusión de inactivas, formato con `usos` y el `500`.
- Documentación Swagger mediante bloque `@openapi` en la misma ruta (esquema desactualizado, ver NFR-003).
- Endpoint relacionado (distinto alcance): `GET /api/journal-entries/accounts` devuelve **sólo** cuentas activas para el selector de asientos manuales.

---

## Correcciones aplicadas

Frente a la versión anterior de este documento:

1. **Permisos (BR-3 / Permissions / AC-4)**: se afirmaba "usuario autenticado (middleware de
   sesión)". **No hay autenticación**: la ruta no valida nada y no existe middleware activo en el
   proyecto.
2. **Ejemplo de respuesta**: usaba `code`, `name`, `type`, `parentId` y `"type": "ASSET"`. La API
   real devuelve `codigo`, `nombre`, `tipo`, `idPadre`, `activo`, `usos` con tipos en español
   (`Activo`, `Pasivo`, `Patrimonio`, `Ingreso`, `Gasto`, `Costo`).
3. **Campo `usos`**: no estaba documentado; es el conteo de líneas de asiento
   (`_count.entryDetails`) y forma parte de la respuesta pública.
4. **Orden**: se precisó que el orden por `code` es lexicográfico (columna de texto), no numérico.
5. **NFR-001 "< 200 ms"**: era un objetivo no verificable en el código; se sustituyó por
   requisitos observables (`force-dynamic`, consulta única con `_count`).
6. **Secciones obligatorias de Spec Kit**: se añadieron *User Scenarios & Testing* y
   *Success Criteria*, que faltaban en la versión anterior.
7. **Nueva NFR-003**: se documenta que la anotación `@openapi` describe un array plano con campos
   en inglés, cuando la respuesta real es `{ data: [...] }` con campos en español.

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
