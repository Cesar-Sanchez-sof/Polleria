# Feature Specification: Registro de Asiento Contable Manual

**Feature Branch**: `002-journal-entries-manual-entry`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit del registro de asientos contables manuales (POST /api/journal-entries), basada en `journal-entries-manual-entry.md` y verificada contra el código."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. El documento de
> origen `journal-entries-manual-entry.md` fue contrastado línea por línea con el código; las
> discrepancias encontradas se corrigen en
> [Correcciones al documento de origen](#correcciones-al-documento-de-origen). Toda afirmación está
> respaldada en [Evidencia de verificación](#evidencia-de-verificación).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar un asiento contable manual (Priority: P1)

Como usuario de contabilidad, quiero registrar manualmente un asiento con su fecha contable, glosa,
diario, responsable y sus líneas de debe/haber, para reflejar operaciones que no genera el sistema
de forma automática.

**Why this priority**: es el único flujo de escritura de esta funcionalidad; sin él no existe la
característica.

**Independent Test**: Desde "Asientos / Libro Diario" → "Nuevo asiento contable", completar cabecera
y dos líneas cuadradas con cuentas existentes y fecha cubierta por un período abierto → el diálogo
se cierra y la lista muestra el asiento nuevo con su número `MISC/YYYY/MM/NNNN`.

**Acceptance Scenarios**:

1. **Given** una carga útil válida (fecha con período abierto, glosa, ≥ 2 líneas cuadradas, cuentas
   existentes), **When** se envía `POST /api/journal-entries`, **Then** se responde `201` con
   `{ id, numero, fecha, diario, concepto, responsable, estado, total }`, donde `estado` es
   `"Registrado"` (o `"Anulado"` si se envió `estado: false`) y `total` es la suma del debe.
2. **Given** el cuerpo no es JSON válido, **When** se procesa, **Then** se responde `400` con
   `"El cuerpo de la petición no es un JSON válido."`.
3. **Given** una fecha cuyo mes no está cerrado, **When** se registra el asiento, **Then** el
   asiento persiste con `periodId` = id del período que cubre la fecha.
4. **Given** dos peticiones concurrentes que proponen el mismo número, **When** se produce el
   conflicto de unicidad (`P2002`), **Then** el endpoint reintenta la generación de código hasta
   3 intentos antes de responder `500`.

---

### User Story 2 - Rechazar cargas inválidas con mensajes accionables (Priority: P2)

Como usuario, quiero que el sistema valide la estructura del asiento (campos, líneas y cuadre) y
me devuelva todos los errores detectados, para poder corregir el formulario de una sola vez.

**Why this priority**: protege la integridad del libro diario; sin validación el asiento quedaría
desbalanceado o con importes inválidos.

**Independent Test**: Enviar un asiento con una línea que tenga importe en debe y en haber a la vez
→ `400` con `error` = primer mensaje y `errores` = lista completa; el diálogo muestra la lista.

**Acceptance Scenarios**:

1. **Given** falta la glosa, **When** se envía la petición, **Then** se responde `400` con
   `"El concepto (glosa) del asiento es obligatorio."`.
2. **Given** un asiento con una sola línea, **When** se envía, **Then** se responde `400` con
   `"El asiento debe registrar al menos dos líneas (debe y haber)."`; con más de 100 líneas →
   `"El asiento no puede superar las 100 líneas."`.
3. **Given** una línea con `debe` y `haber` ambos mayores que cero, **When** se valida,
   **Then** se responde `400` con `"Línea N: no puede tener importe en debe y en haber al mismo tiempo."`.
4. **Given** una línea con ambos importes en cero, **When** se valida, **Then** se responde `400`
   con `"Línea N: debe tener un importe en debe o en haber."`.
5. **Given** importes negativos o no numéricos, **When** se valida, **Then** se responde `400` con
   `"Línea N: los importes no pueden ser negativos."` o
   `"Línea N: los importes deben ser números válidos."` según el caso.
6. **Given** líneas cuadradas pero con diferencia entre totales ≥ 0.005, **When** se valida el
   cuadre, **Then** se responde `400` con
   `"El asiento no cuadra: el debe (X) no coincide con el haber (Y)."` (importes con 2 decimales).
7. **Given** alguna línea referencia una cuenta inexistente, **When** se consulta el plan contable,
   **Then** se responde `400` con
   `"Una o más cuentas contables del asiento no existen en el plan contable."`.
8. **Given** el cliente detecta errores antes de enviar (fecha vacía, glosa vacía, diario sin
   seleccionar, menos de dos líneas, cuenta sin seleccionar, debe/haber inválidos o desbalance),
   **When** se pulsa guardar en el diálogo, **Then** no se realiza la petición y los mensajes se
   muestran en el diálogo.

---

### User Story 3 - Respetar el período contable al registrar (Priority: P3)

Como contable, quiero que el sistema sólo acepte asientos con fecha dentro de un período abierto,
para no escribir en rangos ya cerrados o inexistentes.

**Why this priority**: es una dependencia de la feature `001-gestion-periodos-contables`; sólo es
observable si existen períodos creados.

**Independent Test**: Con un período cerrado para el mes X, enviar un asiento con fecha en mes X →
`400` con `"Cannot register entries in a closed accounting period."`.

**Acceptance Scenarios**:

1. **Given** no existe período que cubra la fecha enviada, **When** se procesa, **Then** se responde
   `400` con `"No accounting period found for the given date."`.
2. **Given** el período que cubre la fecha está en `CLOSED`, **When** se procesa, **Then** se
   responde `400` con `"Cannot register entries in a closed accounting period."` y no se persiste.
3. **Given** un período `OPEN` que cubre la fecha, **When** se crea el asiento, **Then** el registro
   incluye `periodId` (clave foránea obligatoria a `accounting_period`).

---

### User Story 4 - Consultar los asientos registrados (Priority: P3)

Como usuario, quiero listar y ver el detalle de los asientos (incluidos los manuales recién
creados) con filtros por fecha, diario, estado y texto libre.

**Why this priority**: es la comprobación visible del registro; el listado en sí no es el alcance
central de esta especificación.

**Independent Test**: `GET /api/journal-entries?desde=…&hasta=…&pageSize=10` → `200` con
`{ data, meta }` donde `meta` incluye `total`, `registrados`, `anulados`, `page`, `pageSize`,
`totalPaginas`, `orden`, `dir`.

**Acceptance Scenarios**:

1. **Given** existen asientos, **When** se consulta el listado, **Then** se devuelven resúmenes con
   `numero`, `fecha`, `diario`, `concepto`, `responsable`, `estado` y `total` (suma del debe).
2. **Given** se ordena por `orden=total`, **When** se procesa, **Then** el orden se calcula sobre
   la suma del debe de cada asiento (no sobre una columna almacenada).
3. **Given** se solicita un asiento por id, **When** existe, **Then** `GET /api/journal-entries/[id]`
   devuelve el detalle con sus líneas y `totales` de debe/haber.

---

### Edge Cases

- Fecha con formato incorrecto o ausente → `400` con el mensaje de formato (`AAAA-MM-DD`).
- Valores de importe `undefined`, `null` o cadena vacía → se interpretan como `0` antes de validar.
- Importe no numérico → `400` "los importes deben ser números válidos".
- Diferencia de cuadre exactamente en el límite: `≥ 0.005` ya se rechaza (tolerancia estrictamente
  menor que 0.005).
- Cuentas inexistentes se detectan **después** de las validaciones de campo y **antes** de buscar
  el período.
- Colisión simultánea de número de asiento → hasta 3 intentos de creación; si todos chocan por
  `P2002` → `500` `"No se pudo asignar un número de asiento, intente nuevamente."`.
- Error no previsto (base de datos, etc.) → `500` `"No se pudo registrar el asiento contable."`,
  con log en consola del servidor.
- Un asiento se puede crear directamente con `estado: false` (ya "Anulado") porque la API acepta el
  campo `estado` en la carga útil; el diálogo de la UI no lo envía, por lo que siempre nace
  `"Registrado"`.
- La fecha se interpreta y almacena en **UTC** (`entryDate` es columna `@db.Date`), evitando
  desplazamientos de día por zona horaria.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema debe permitir crear un asiento contable manual mediante
  `POST /api/journal-entries` con cabecera (`fecha`, `glosa`, `diario`, `responsable`, `observacion`,
  `estado`) y una lista de líneas (`idCuenta`, `descripcion`, `debe`, `haber`).
- **FR-002**: La fecha contable es obligatoria y debe tener formato `AAAA-MM-DD`; se convierte a
  medianoche UTC (`parseUtcDate`).
- **FR-003**: La glosa es obligatoria y admite como máximo 200 caracteres; el diario admite 60
  caracteres y por defecto es `"Operaciones varias"`; el responsable 100 y la observación 200
  caracteres (ambos opcionales).
- **FR-004**: El asiento debe tener entre 2 y 100 líneas.
- **FR-005**: Cada línea debe indicar una cuenta (`idCuenta` entero positivo), descripción opcional
  de máximo 200 caracteres, y un importe en debe **o** en haber: no ambos, ninguno negativo, y al
  menos uno mayor que cero.
- **FR-006**: La suma del debe debe coincidir con la suma del haber con una tolerancia estricta
  menor a 0.005; a partir de 0.005 de diferencia se rechaza.
- **FR-007**: Todas las cuentas referenciadas deben existir en el plan contable.
- **FR-008**: El sistema debe resolver el período contable por la fecha del asiento
  (`startDate ≤ fecha ≤ endDate`) y rechazar si no existe o está cerrado.
- **FR-009**: El asiento persistido debe quedar asociado al período (`periodId` obligatorio).
- **FR-010**: El número de asiento se asigna automáticamente con formato `MISC/YYYY/MM/NNNN`,
  reinicia en `0001` cada mes, es único en base de datos y no supera los 20 caracteres.
- **FR-011**: Ante un conflicto de unicidad de número (`P2002`), el sistema debe reintentar la
  creación hasta 3 veces; si agota los intentos, responder `500`.
- **FR-012**: Las validaciones de campo se acumulan y se devuelven juntas (mensaje principal +
  lista `errores`), para que el cliente pueda mostrarlas todas.
- **FR-013**: El sistema debe devolver `201` con el resumen del asiento creado
  (`id`, `numero`, `fecha`, `diario`, `concepto`, `responsable`, `estado`, `total`).
- **FR-014**: El campo `estado` de la carga útil es booleano con defecto `true`
  (`Registrado`/`Anulado`).
- **FR-015**: El endpoint no debe exigir autenticación ni rol: no hay control de acceso en esta
  ruta (ver **Permisos**).
- **FR-016**: No existen operaciones de modificación ni eliminación de asientos: sólo `GET`
  (listado, detalle, opciones, cuentas, próximo código) y `POST` de creación.
- **FR-017**: El listado (`GET`) debe soportar filtros (`desde`, `hasta`, `diario`, `estado`, `q`),
  paginación (`page`, `pageSize` ≤ 100) y ordenación (`orden` ∈ fecha|numero|concepto|diario|estado|total,
  `dir` ∈ asc|desc), devolviendo metadatos con conteos de registrados y anulados.

### Reglas de negocio

| # | Regla | Comportamiento observado |
|---|---|---|
| RN-1 | Un asiento manual siempre cuadra | Debe ≈ haber con tolerancia < 0.005. |
| RN-2 | Una línea tiene debe **o** haber | Exclusividad mutua y al menos uno > 0. |
| RN-3 | Sólo se escribe en períodos abiertos | Bloqueo en `POST` antes de crear; ver spec `001`. |
| RN-4 | Sin período no hay asiento | Error explícito cuando la fecha no está cubierta. |
| RN-5 | Numeración mensual y correlativa | Prefijo `MISC/YYYY/MM/`, secuencia propia por mes. |
| RN-6 | Integridad del plan contable | Toda cuenta referenciada debe existir. |
| RN-7 | Errores agrupados | Validaciones de campo devueltas en una sola respuesta `400`. |
| RN-8 | Asientos sin anular ni editar | Sólo se crean; no hay endpoints de modificación. |

### Estados del asiento

| Estado | Valor interno | Significado |
|--------|---------------|-------------|
| **Registrado** | `status: true` | Asiento activo; es el valor por defecto. |
| **Anulado** | `status: false` | Asiento marcado como anulado. |

La respuesta y el listado exponen el estado como la cadena `"Registrado"` / `"Anulado"`. La API
acepta `estado` en la carga útil de creación; no existe endpoint para cambiarlo después.

### Validaciones implementadas

Orden real de evaluación en `POST /api/journal-entries`:

1. **JSON válido** → `400` `"El cuerpo de la petición no es un JSON válido."`.
2. **Campos de cabecera y líneas** (se acumulan) → `400` `{ error: <primer mensaje>, errores: [...] }`:

   | Campo | Regla | Mensaje |
   |-------|-------|---------|
   | `fecha` | obligatoria, `AAAA-MM-DD` | `La fecha contable es obligatoria y debe tener el formato AAAA-MM-DD.` |
   | `glosa` | obligatoria, ≤ 200 | `El concepto (glosa) del asiento es obligatorio.` / `El concepto no puede superar los 200 caracteres.` |
   | `diario` | ≤ 60, defecto `Operaciones varias` | `El diario no puede superar los 60 caracteres.` |
   | `responsable` | ≤ 100 | `El responsable no puede superar los 100 caracteres.` |
   | `observacion` | ≤ 200 | `La observación no puede superar los 200 caracteres.` |
   | `lineas` | 2 – 100 | `El asiento debe registrar al menos dos líneas (debe y haber).` / `El asiento no puede superar las 100 líneas.` |
   | línea: formato | objeto válido | `Línea N: el formato de la línea no es válido.` |
   | línea: `idCuenta` | entero > 0 | `Línea N: falta la cuenta contable.` |
   | línea: `descripcion` | ≤ 200 | `Línea N: la descripción no puede superar 200 caracteres.` |
   | línea: importes | numéricos, ≥ 0, exclusivos, alguno > 0 | `Línea N: los importes deben ser números válidos.` · `Línea N: los importes no pueden ser negativos.` · `Línea N: no puede tener importe en debe y en haber al mismo tiempo.` · `Línea N: debe tener un importe en debe o en haber.` |
   | cuadre | \|Σ debe − Σ haber\| < 0.005 | `El asiento no cuadra: el debe (X) no coincide con el haber (Y).` |

3. **Existencia de cuentas** → `400`
   `"Una o más cuentas contables del asiento no existen en el plan contable."`.
4. **Período contable** → `400` `"No accounting period found for the given date."` o
   `"Cannot register entries in a closed accounting period."`.
5. **Creación con reintentos de código** → `201` o `500`.
6. **Cualquier excepción no prevista** → `500` `"No se pudo registrar el asiento contable."`.

### Permisos

- `POST /api/journal-entries` **no aplica ninguna verificación de sesión ni de rol**: no usa
  `requireRole` ni ninguna otra comprobación de autorización.
- **No existe middleware de autorización** en el proyecto que cubra esta ruta: no hay
  `middleware.ts` activo (existe únicamente `proxy.ts.desactivado`, archivo fuera de servicio).
  Corregido respecto al documento de origen, que atribuía la autorización a "la capa de middleware".
- En consecuencia, el endpoint es accesible para cualquier cliente que alcance la aplicación.
- Las demás rutas del recurso (`GET` listado, `[id]`, `options`, `accounts`, `next-code`) tampoco
  exigen autenticación.
- Para comparar: `POST`/`PATCH` de `/api/accounting-periods` sí exigen `requireRole` (rol `ADMIN`);
  ver spec `001-gestion-periodos-contables`.

### Relación con los asientos contables y los períodos

- `JournalEntry.periodId` es obligatorio (FK a `accounting_period`, `ON DELETE RESTRICT`), por lo
  que un asiento siempre queda amparado por un período.
- Las líneas (`JournalEntryDetail`) referencian `accountingAccount.accountId`; cada línea almacena
  `debit`/`credit` con precisión `Decimal(12,2)`.
- Los campos `salesInvoiceId`, `purchaseInvoiceId` y `payrollId` del asiento **no** se envían en el
  registro manual (quedan en `null`); se usan en los asientos automáticos.
- El bloqueo de períodos cerrados descrito aquí es la cara de usuario de la regla RN-5 de la
  spec `001`.

### Key Entities *(include if feature involves data)*

- **JournalEntry (Asiento contable)**: `entryDate` (`@db.Date`, UTC), `code` único
  `MISC/YYYY/MM/NNNN`, `description` (glosa ≤ 200), `book` (diario, defecto `Operaciones varias`),
  `responsible`, `observation`, `status` boolean, `periodId` obligatorio, marcas de creación/
  actualización y relaciones a factura de venta/compra y planilla (no usadas en el registro manual).
- **JournalEntryDetail (Línea del asiento)**: `accountId`, descripción opcional, `debit` y
  `credit` `Decimal(12,2)`; el `total` expuesto en respuestas es la suma del `debit`.
- **AccountingAccount (Cuenta contable)**: plan contable cuyos `id` deben existir para cada línea.
- **AccountingPeriod (Período contable)**: rango `startDate`–`endDate` y estado `OPEN`/`CLOSED` que
  condicionan la creación (definido en spec `001`).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una carga válida genera un asiento persistido con número único, `periodId` correcto y
  respuesta `201` en un solo intento.
- **SC-002**: El 100 % de las cargas con errores de campo responden `400` con la lista completa de
  mensajes y sin crear registro.
- **SC-003**: El 100 % de los asientos con fecha sin período o con período cerrado se rechazan
  (`400`) y no dejan rastro en base de datos.
- **SC-004**: El 100 % de los asientos persistidos cumplen Σ debe = Σ haber con diferencia
  menor a 0.005.
- **SC-005**: Bajo conflicto concurrente de numeración, el sistema resuelve el número en hasta
  3 intentos sin responder error al cliente en el caso normal.
- **SC-006**: El número de asiento se incrementa correlativamente por mes y ningún número se repite
  (restricción única de base de datos).

---

## Assumptions

- Esta especificación cubre el **registro manual** (`POST /api/journal-entries`); el listado y el
  detalle se describen sólo como contexto de verificación.
- Los asientos automáticos de ventas, compras y pagos no forman parte de este alcance (se rigen por
  `lib/services/accounting-posting.service.ts`).
- No existen pruebas automatizadas que cubran este endpoint; la verificación es por lectura de
  código.
- El comportamiento corresponde al código vigente al 2026-10-05.

---

## Correcciones al documento de origen

Frente a `journal-entries-manual-entry.md` se verificó y corrigió lo siguiente:

1. **Permisos (sección 8)**: el documento afirma que "la autorización se delega a la capa de
   middleware (no visible en el código)". **No existe** middleware activo en el proyecto
   (`middleware.ts` ausente, `proxy.ts.desactivado`); el endpoint no tiene ningún control de acceso.
2. **Añadidos faltantes**: formas concretas de error (`{ error, errores }` frente a `{ error }`),
   interpretación de `undefined`/`null`/`""` como `0` en importes, almacenamiento de fechas en UTC,
   campos `salesInvoiceId`/`purchaseInvoiceId`/`payrollId` no usados en el registro manual,
   límite de `pageSize` (100) y comportamiento de la ordenación por `total`, validaciones
   previas del diálogo de la UI y estado inicial anulable vía campo `estado`.
3. **Precisión en el cuadre**: la condición real es `Math.abs(diferencia) >= 0.005` (rechazo en el
   límite exacto), válida cuando hay 2 o más líneas validadas.
4. **Numeración**: el reintento por `P2002` es de hasta 3 intentos de `create`; la generación del
   código propone hasta 50 candidatos consecutivos antes de fallar
   (`lib/journal-entry-code.ts`).
5. **Sección 4 del origen ("Creación mediante mes/año")**: se reformula para dejar claro que el
   cliente envía `fecha`, no mes/año; el mes/año se deriva de la fecha al buscar el período.

*(Todo lo demás del documento de origen coincide con el código.)*

---

## Evidencia de verificación

| Afirmación | Archivo |
|---|---|
| Validaciones de cabecera y líneas | `app/api/journal-entries/route.ts` (líneas 222–312) |
| Cuadre debe/haber | `app/api/journal-entries/route.ts` (líneas 314–321) |
| Existencia de cuentas | `app/api/journal-entries/route.ts` (líneas 326–337) |
| Período contable y bloqueo de cierre | `app/api/journal-entries/route.ts` (líneas 339–352) |
| Creación con reintentos y respuesta 201 | `app/api/journal-entries/route.ts` (líneas 354–401) |
| Errores no previstos (500) | `app/api/journal-entries/route.ts` (líneas 402–408) |
| Listado, filtros, paginación y orden | `app/api/journal-entries/route.ts` (líneas 26–191) |
| Utilidades (`parseAmount`, `trimString`, `isDuplicateCode`) | `app/api/journal-entries/route.ts` (líneas 197–220) |
| Numeración `MISC/YYYY/MM/NNNN` | `lib/journal-entry-code.ts` |
| Fechas en UTC | `lib/dates.ts` |
| Modelo y relaciones | `prisma/schema.prisma` (líneas 583–612) |
| Servicio front-end y formas de error | `lib/services/journal-entries.service.ts`, `lib/services/http.ts` |
| Validaciones previas del diálogo | `app/accounting/entries/components/NewJournalEntryDialog.tsx` (líneas 181–251) |
| Ausencia de middleware de autorización | `middleware.ts` (inexistente), `proxy.ts.desactivado` |
