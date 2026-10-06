# Feature Specification: Crear Cuenta Contable

**Feature Branch**: `004-crear-cuenta-contable`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para crear una cuenta contable, describiendo el comportamiento real implementado."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y, cuando existe, por las pruebas automatizadas del
> propio endpoint (ver [Evidencia de verificación](#evidencia-de-verificación)). No se describen
> funcionalidades futuras ni reglas ausentes en la implementación.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar una cuenta raíz (Priority: P1)

Como usuario de contabilidad, quiero dar de alta una cuenta del plan contable sin cuenta padre
(cuenta raíz), indicando código, nombre y tipo, para poder utilizarla en asientos y como padre de
subcuentas.

**Why this priority**: es la operación base del plan contable; sin cuentas no pueden registrarse
líneas de asiento.

**Independent Test**: En "Cuentas contables" → "Nueva cuenta", completar código `10101`, nombre
"Caja chica" y tipo "Activo" → se responde `201` con la cuenta devuelta (con `id` y `usos: 0`) y
aparece en el listado.

**Acceptance Scenarios**:

1. **Given** un cuerpo válido `{ codigo, nombre, tipo }`, **When** se envía `POST /api/accounts`,
   **Then** se responde `201` con `{ id, codigo, nombre, tipo, idPadre: null, activo: true, usos: 0 }`.
2. **Given** el cuerpo no es JSON válido o es un arreglo, **When** se procesa, **Then** se responde
   `400` con `"El cuerpo de la petición no es un JSON válido."` (sin lista `errores`).
3. **Given** se envía `activo: false`, **When** se crea la cuenta, **Then** se responde `201` con
   `activo: false` (también es posible crear cuentas inactivas).
4. **Given** el cuerpo omite `activo`, **When** se crea, **Then** la cuenta nace `activo: true`
   (valor por defecto aplicado en el servidor).
5. **Given** una falla de base de datos no prevista, **When** se procesa, **Then** se responde `500`
   con `"No se pudo registrar la cuenta contable."`.

---

### User Story 2 - Registrar una subcuenta bajo una cuenta existente (Priority: P1)

Como usuario, quiero crear una cuenta hija de otra para construir la jerarquía del plan contable
(cuentas raíz → subcuentas), respetando el tipo de la padre.

**Why this priority**: la jerarquía es la estructura del plan contable y condiciona la
clasificación de los reportes contables.

**Independent Test**: Desde la fila de una cuenta activa, pulsar "Añadir subcuenta" → el diálogo se
abre con el padre preseleccionado y el tipo heredado; al guardar se responde `201` con
`idPadre` = id de la padre.

**Acceptance Scenarios**:

1. **Given** un `idPadre` que existe, está activo y comparte tipo con la nueva cuenta, **When** se
   envía la petición, **Then** se responde `201` con `idPadre` = ese id.
2. **Given** un `idPadre` inexistente, **When** se procesa, **Then** `400` con
   `"La cuenta padre indicada no existe."`.
3. **Given** una cuenta padre inactiva, **When** se procesa, **Then** `400` con
   `"La cuenta padre está inactiva: actívala antes de crear subcuentas."`.
4. **Given** un tipo distinto al de la padre, **When** se procesa, **Then** `400` con
   ``"La subcuenta debe tener el mismo tipo que su cuenta padre (<tipo del padre>)."``.
5. **Given** un `idPadre` que no es entero positivo, **When** se procesa, **Then** `400` con
   `"La cuenta padre indicada no es válida."`.

---

### User Story 3 - Rechazar datos inválidos y códigos duplicados (Priority: P2)

Como usuario, quiero que el sistema valide código, nombre y tipo, y que impida repetir códigos, para
mantener la integridad del plan contable.

**Why this priority**: protege datos maestros de los que dependen todos los asientos.

**Independent Test**: Crear una cuenta con un código ya existente → `409` con
`"Ya existe una cuenta contable con el código <codigo>."` y no se crea el registro.

**Acceptance Scenarios**:

1. **Given** un código vacío, **When** se valida, **Then** `400` con
   `"El código de la cuenta es obligatorio."`.
2. **Given** un código con caracteres fuera de `[A-Za-z0-9.-]` o más de 10 caracteres, **When** se
   valida, **Then** `400` con
   `"El código sólo puede tener hasta 10 caracteres con letras, números, punto o guion."`.
3. **Given** un nombre vacío o con más de 100 caracteres, **When** se valida, **Then** `400` con
   `"El nombre de la cuenta es obligatorio."` o
   `"El nombre de la cuenta no puede superar los 100 caracteres."`.
4. **Given** un `tipo` fuera de la lista PCGE, **When** se valida, **Then** `400` con
   `"El tipo de cuenta no es válido (valores admitidos: Activo, Pasivo, Patrimonio, Ingreso, Gasto, Costo)."`
5. **Given** un `activo` que no es booleano, **When** se valida, **Then** `400` con
   `"El estado de la cuenta debe ser activo o inactivo."`.
6. **Given** varias validaciones fallan a la vez, **When** se responde, **Then** `400` con
   `error` = primer mensaje y `errores` = lista completa, sin consultar la base de datos.
7. **Given** un código ya usado (detección previa), **When** se procesa, **Then** `409` con
   `"Ya existe una cuenta contable con el código <codigo>."`.
8. **Given** dos peticiones simultáneas con el mismo código (la detección previa no lo alcanza a
   ver), **When** el índice único rechaza la inserción (`P2002`), **Then** se responde `409` con el
   mismo mensaje de código duplicado.

---

### Edge Cases

- Cuerpo `null`, string no JSON o arreglo → `400` con mensaje único (sin `errores`).
- Código duplicado detectado **dos veces**: comprobación previa (`findUnique`) y, en carrera, el
  índice único de la base; ambas rutas responden `409` idéntico.
- `idPadre` enviado como cadena numérica → convertido a número; si no es entero positivo → `400`.
- `idPadre: 0`, negativo o no numérico → `"La cuenta padre indicada no es válida."`.
- Crear cuenta con `idPadre` que sí existe pero con tipo distinto → rechazo con el tipo esperado
  entre paréntesis.
- En creación **no** se validan ciclos de jerarquía ni autorreferencia, porque la cuenta aún no
  tiene `id` (la autociclo `parentId → id` sólo aplica a cuentas existentes y se controla en la
  edición, fuera del alcance de esta especificación).
- Campos desconocidos del cuerpo se ignoran sin error.
- Los sufijos en inglés y español son equivalentes: `codigo`/`code`, `nombre`/`name`, `tipo`/`type`,
  `idPadre`/`parentId`, `activo`/`active` (se lee primero el nombre en español).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema debe permitir crear cuentas contables mediante `POST /api/accounts` con
  cuerpo `{ codigo, nombre, tipo, idPadre?, activo? }` (aceptando también sus equivalentes en inglés).
- **FR-002**: El código es obligatorio, único en todo el plan contable y debe cumplir
  `^[A-Za-z0-9.-]{1,10}$`.
- **FR-003**: El nombre es obligatorio y admite como máximo 100 caracteres (se recorta con `trim`).
- **FR-004**: El tipo debe pertenecer al conjunto PCGE: `Activo`, `Pasivo`, `Patrimonio`, `Ingreso`,
  `Gasto`, `Costo`.
- **FR-005**: `idPadre` opcional: `null`/ausente crea una cuenta raíz; si se envía, debe ser un
  entero positivo que identifique una cuenta existente.
- **FR-006**: Al crear una subcuenta, la cuenta padre debe existir, estar activa y tener el mismo
  tipo que la nueva cuenta.
- **FR-007**: `activo` es booleano; si se omite al crear, la cuenta nace activa.
- **FR-008**: Las validaciones de campo se acumulan y se devuelven en una sola respuesta `400` con
  `error` (primer mensaje) y `errores` (lista), **antes** de consultar la base de datos.
- **FR-009**: La violación de unicidad del código responde `409` tanto por detección previa como
  por el índice único en tiempo de inserción.
- **FR-010**: La respuesta exitosa es `201` con la cuenta en formato público
  `{ id, codigo, nombre, tipo, idPadre, activo, usos }`, donde `usos` es el número de líneas de
  asiento que usan la cuenta (0 al crear).
- **FR-011**: El listado `GET /api/accounts` devuelve todas las cuentas (raíces, subcuentas **e
  inactivas**) ordenadas por código y sin paginación, porque el cliente construye el árbol completo.
- **FR-012**: El endpoint no aplica autenticación ni control de roles.
- **FR-013**: No existe operación de eliminación de cuentas (sólo `GET`, `POST`, `GET/PATCH /api/accounts/[id]`).
- **FR-014**: La interfaz ofrece dos accesos de creación: "Nueva cuenta" (raíz) y "Añadir
  subcuenta" desde una fila (padre preseleccionado y tipo heredado).
- **FR-015**: La interfaz valida en cliente (código, nombre y tipo) antes de enviar y muestra los
  errores devueltos por el servidor dentro del diálogo.

### Reglas de negocio

| # | Regla | Comportamiento observado |
|---|---|---|
| RN-1 | Un código, una cuenta | Único en toda la tabla; doble protección (previa + índice). |
| RN-2 | Tipos PCGE cerrados | Lista de 6 valores; la respuesta indica los admitidos. |
| RN-3 | Subcuenta = mismo tipo que la padre | Validado en el servidor; heredado automáticamente en la UI. |
| RN-4 | Sólo sobre padres activos | No se crean subcuentas de una cuenta inactiva. |
| RN-5 | Cuentas raíz sin padre | `idPadre` ausente o `null` ⇒ cuenta raíz. |
| RN-6 | Cuenta inactiva desde el alta | Permitida (`activo: false`), pero no ofrecida como padre. |
| RN-7 | Sin borrado | Las cuentas se desactivan, no se eliminan (la FK de líneas es `Restrict`). |
| RN-8 | Validar antes de tocar la BD | Errores de campo respondidos sin consultas. |

### Validaciones implementadas

Orden real de evaluación en `POST /api/accounts`:

1. **JSON válido** → `400` `{ error: "El cuerpo de la petición no es un JSON válido." }`.
2. **Campos** (`validateAccount(body, "create")`) → `400` `{ error, errores }`:

   | Campo | Regla | Mensaje |
   |-------|-------|---------|
   | `codigo` | obligatorio | `El código de la cuenta es obligatorio.` |
   | `codigo` | `^[A-Za-z0-9.-]{1,10}$` | `El código sólo puede tener hasta 10 caracteres con letras, números, punto o guion.` |
   | `nombre` | obligatorio | `El nombre de la cuenta es obligatorio.` |
   | `nombre` | ≤ 100 | `El nombre de la cuenta no puede superar los 100 caracteres.` |
   | `tipo` | lista PCGE | `El tipo de cuenta no es válido (valores admitidos: Activo, Pasivo, Patrimonio, Ingreso, Gasto, Costo).` |
   | `idPadre` | entero > 0 si se envía | `La cuenta padre indicada no es válida.` |
   | `activo` | booleano (defecto `true` en create) | `El estado de la cuenta debe ser activo o inactivo.` |

3. **Unicidad del código** → `409` `Ya existe una cuenta contable con el código <codigo>.`
4. **Jerarquía** (sólo si `idPadre ≠ null`) → `400` con la lista acumulada:
   - `La cuenta padre indicada no existe.`
   - `La cuenta padre está inactiva: actívala antes de crear subcuentas.`
   - ``La subcuenta debe tener el mismo tipo que su cuenta padre (<tipo>).``
5. **Inserción** → `201`; `P2002` ⇒ `409` (mismo mensaje del paso 3).
6. **Excepción no prevista** → `500` `{ error: "No se pudo registrar la cuenta contable." }`.

**Validación en cliente** (`AccountDialog`, previa al envío): `Escribe el código de la cuenta.`,
`El código sólo puede tener hasta 10 caracteres con letras, números, punto o guion.`,
`Escribe el nombre de la cuenta.`, `El nombre de la cuenta no puede superar los 100 caracteres.`,
`Selecciona el tipo de cuenta.` — si falla, **no** se realiza la petición.

### Permisos

- `POST /api/accounts`, `GET /api/accounts`, `GET/PATCH /api/accounts/[id]` **no exigen
  autenticación ni rol**: ninguna de estas rutas usa `requireRole` ni comprobación equivalente.
- No existe middleware de autorización activo en el proyecto (`middleware.ts` inexistente,
  `proxy.ts.desactivado`), por lo que no hay una capa oculta que restrinja el acceso.
- El enlace "Cuentas contables" del sidebar no aplica filtro de rol.
- Para comparar: `POST`/`PATCH` de `/api/accounting-periods` sí exigen rol `ADMIN` (spec `001`).

### Relación con los asientos contables

- `JournalEntryDetail.accountId` referencia `AccountingAccount.id` (los asientos consumen cuentas).
- El selector de cuentas del registro manual de asientos (`GET /api/journal-entries/accounts`)
  devuelve **sólo cuentas activas**; por tanto, una cuenta creada como inactiva no aparece para
  seleccionarla en un asiento nuevo.
- La validación del servidor al guardar ese asiento comprueba únicamente la **existencia** de las
  cuentas (no su estado activo).
- Los asientos automáticos (ventas/compras, `resolveAccountIds`) sólo resuelven cuentas con
  `active: true`; si falta una, el proceso falla pidiendo ejecutar el seed del plan contable.
- Cuenta padre con `onDelete: Restrict`: no se puede eliminar una cuenta que tenga subcuentas
  (refuerza la regla RN-7 de desactivación en lugar de borrado).
- El campo `usos` de la respuesta expone cuántas líneas de asiento usan la cuenta; es `0` al crear.

### Key Entities *(include if feature involves data)*

- **AccountingAccount (Cuenta contable)**: `code` único (`VarChar(10)`), `name` (`VarChar(100)`),
  `type` (`VarChar(20)`, texto libre restringido en la API a los 6 tipos PCGE), `active` (defecto
  `true`), autorreferencia `parentId` (relación jerárquica autocíclica, `onDelete: Restrict`),
  marcas `createdAt`/`updatedAt` y relación `entryDetails[]` (líneas de asiento que la usan).
- **AccountApi (Formato público)**: `{ id, codigo, nombre, tipo, idPadre, activo, usos }`.
- **JournalEntryDetail (Consumidor)**: línea de asiento que referencia a la cuenta mediante
  `accountId`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una cuenta raíz válida se crea en una sola petición y responde `201` con su `id` y
  `usos: 0`.
- **SC-002**: El 100 % de las cargas con errores de campo responden `400` con la lista completa de
  mensajes sin realizar escrituras en base de datos.
- **SC-003**: Ningún código de cuenta queda duplicado (detección previa + índice único), y todo
  intento de duplicado responde `409` con mensaje que incluye el código.
- **SC-004**: El 100 % de las subcuentas creadas cumplen: padre existente, padre activo y tipo
  coincidente con el padre.
- **SC-005**: Una cuenta creada como inactiva no aparece en el selector de cuentas para nuevos
  asientos, pero sí permanece visible en el listado del plan contable.
- **SC-006**: La UI refleja el resultado en menos de un ciclo de recarga: el diálogo se cierra y el
  listado se vuelve a consultar tras un `201`.

---

## Assumptions

- El alcance es **únicamente la creación** (`POST /api/accounts`); la edición
  (`PATCH /api/accounts/[id]`), la activación/desactivación y la consulta se mencionan sólo como
  contexto.
- No existe operación de borrado de cuentas en el sistema.
- La verificación combina lectura de código y las pruebas automatizadas existentes
  (`app/api/accounts/route.test.ts`, `app/api/accounts/[id]/route.test.ts`), que refuerzan los
  criterios de aceptación documentados.
- Comportamiento correspondiente al código vigente al 2026-10-05.

---

## Evidencia de verificación

| Afirmación | Archivo |
|---|---|
| Endpoint de creación (JSON, validación, unicidad, jerarquía, inserción) | `app/api/accounts/route.ts` (líneas 63–130) |
| Listado completo sin paginación | `app/api/accounts/route.ts` (líneas 43–55) |
| Validación de campos y mensajes | `lib/chart-of-accounts.ts` (`validateAccount`, líneas 45–113) |
| Respuestas `400`/`409`, formato público y tipos PCGE | `lib/chart-of-accounts.ts` (líneas 115–177) |
| Modelo, unicidad de `code` y jerarquía | `prisma/schema.prisma` (líneas 544–559) |
| Edición (contexto) y autociclo | `app/api/accounts/[id]/route.ts` (líneas 64–219) |
| Servicio front-end (`registerAccount`) | `lib/services/accounts.service.ts` |
| Diálogo de creación y validación en cliente | `app/accounting/accounts/components/AccountDialog.tsx` |
| Accesos "Nueva cuenta" y "Añadir subcuenta" | `app/accounting/accounts/page.tsx` (líneas 134–144), `components/AccountsToolbar.tsx`, `components/AccountTable.tsx` |
| Pruebas del endpoint (201, 400, 409, 500) | `app/api/accounts/route.test.ts` |
| Selector de cuentas sólo activas para asientos | `app/api/journal-entries/accounts/route.ts` |
| Resolución de cuentas activas en asientos automáticos | `lib/services/accounting-posting.service.ts` (`resolveAccountIds`) |
