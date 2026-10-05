# Feature Specification: Listado de Asientos Contables

**Feature Branch**: `005-listado-asientos-contables`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *listar asientos contables*, describiendo el comportamiento real implementado."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y por las pruebas automatizadas del endpoint
> (`app/api/journal-entries/route.test.ts`) y del servicio front-end
> (`lib/services/journal-entries.service.test.ts`), referenciadas en
> [Evidencia de verificación](#evidencia-de-verificación). No se describen funcionalidades
> futuras ni reglas ausentes en la implementación.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar el libro diario paginado (Priority: P1)

Como usuario de contabilidad, quiero abrir la pantalla "Asientos / Libro Diario" y ver la lista de
asientos con su fecha, número, concepto, diario, responsable, total y estado, para revisar el
contenido del libro sin cargar todo el histórico de una sola vez.

**Why this priority**: es el alcance central; sin el listado paginado no existe la consulta del
libro diario.

**Independent Test**: Ir a "Asientos / Libro Diario" sin aplicar filtros → la tabla muestra 10
asientos ordenados por fecha descendente y la barra indica "Mostrando 1–10 de N asientos".

**Acceptance Scenarios**:

1. **Given** existen asientos, **When** se llama `GET /api/journal-entries` sin parámetros,
   **Then** se responde `200` con `{ data, meta }`, `data` contiene 10 resúmenes y `meta` es
   `{ total, registrados, anulados, page: 1, pageSize: 10, totalPaginas, orden: "fecha", dir: "desc" }`.
2. **Given** la consulta devuelve resúmenes, **When** se inspecciona cada fila, **Then** cada
   elemento tiene `id`, `numero`, `fecha` (ISO `AAAA-MM-DD`), `diario`, `concepto`, `responsable`
   (`string | null`), `estado` (`"Registrado"` | `"Anulado"`) y `total` (suma del debe).
3. **Given** una base sin asientos, **When** se consulta, **Then** la respuesta es `200` con
   `data: []`, `meta.total = 0` y `meta.totalPaginas = 1` (mínimo 1 página).
4. **Given** la página pedida supera el total de páginas, **When** se procesa, **Then** `meta.page`
   se recorta a `totalPaginas` y el `offset` se calcula sobre la página efectiva (no se devuelven
   filas vacías por página fuera de rango).
5. **Given** la base de datos falla, **When** se ejecuta la consulta, **Then** se responde `500`
   con `{ "error": "No se pudo obtener el listado de asientos contables." }` y la UI muestra el
   estado de error con botón "Reintentar".

---

### User Story 2 - Filtrar y buscar asientos (Priority: P1)

Como contador, quiero filtrar por rango de fechas, diario, estado y un texto libre, para aislar
los asientos que me interesan.

**Why this priority**: los filtros son el motivo de existir de la consulta operativa del libro;
sin ellos el usuario tendría que recorrer todas las páginas.

**Independent Test**: Aplicar `desde=2025-05-01`, `hasta=2025-06-30`, diario "Banco / Caja",
estado "Anulado" y búsqueda `caja` → sólo se muestran asientos de ese rango, libro y estado cuyo
número, glosa o cuenta contengan "caja".

**Acceptance Scenarios**:

1. **Given** los parámetros `desde` y `hasta` con formato `AAAA-MM-DD`, **When** se consultan,
   **Then** el filtro es `entryDate >= desde AND entryDate <= hasta` interpretado en UTC.
2. **Given** `diario=<valor>`, **When** se consulta, **Then** sólo se devuelven asientos con
   `book` exactamente igual al valor.
3. **Given** `estado=registrado` o `estado=anulado`, **When** se consulta, **Then** el filtro es
   `status = true` o `status = false` respectivamente; cualquier otro valor no filtra por estado.
4. **Given** `q` con texto, **When** se consulta, **Then** se aplica un `OR` case-insensitive
   sobre: `code` del asiento, `description` (glosa) y, vía sus líneas, `code`/`name` de la cuenta
   contable asociada.
5. **Given** varios filtros a la vez, **When** se combinan, **Then** se aplican con `AND` y el
   mismo `where` se reutiliza para los tres conteos de `meta` y para la página de filas.
6. **Given** el usuario escribe en el buscador de la UI, **When** pasan 400 ms sin escribir,
   **Then** se dispara la búsqueda, se resetea a la página 1 y sólo la última petición en vuelo
   actualiza el estado (protección contra carreras por `requestRef`).

---

### User Story 3 - Ordenar y paginar el listado (Priority: P2)

Como usuario, quiero ordenar por fecha, número, concepto, diario, estado o total, y elegir el
tamaño de página, para recorrer el libro de forma eficiente.

**Why this priority**: sin orden/paginación el listado sería incorrecto a partir del primer
bloque de registros; se prioriza después de poder consultar y filtrar.

**Independent Test**: Pulsar la cabecera "Total" dos veces → el orden queda `orden=total&dir=asc`
y las filas se muestran de menor a mayor importe.

**Acceptance Scenarios**:

1. **Given** `orden` ∈ {fecha, numero, concepto, diario, estado, total} y `dir` ∈ {asc, desc},
   **When** se procesan, **Then** se aplican con desempate determinista `{ id: "desc" }`.
2. **Given** `orden` inválido o ausente, **When** se normaliza, **Then** se usa `fecha`.
3. **Given** `dir` distinto de `asc` exacto (por ejemplo `ASC` o ausente), **When** se normaliza,
   **Then** se usa `desc`.
4. **Given** `orden=total`, **When** se procesa, **Then** el orden se calcula en memoria sobre la
   suma del `debit` de cada asiento (no existe columna almacenada), con desempate `id` descendente,
   se pagina el resultado y luego se recuperan sólo los `pageSize` asientos de esa página.
5. **Given** `page` no numérico o `pageSize` fuera de rango, **When** se normalizan, **Then**
   `page` cae a su defecto `1` y `pageSize` se recorta al rango `1..100` (defecto `10`).
6. **Given** la UI, **When** se pulsa una cabecera ya activa, **Then** la dirección se alterna;
   al cambiar de campo, `fecha` y `total` empiezan en `desc` y el resto en `asc`.

---

### User Story 4 - Reconocer el estado y el total de cada asiento (Priority: P2)

Como contador, quiero ver en cada fila el estado ("Registrado"/"Anulado") y el total del asiento,
más los contadores globales, para evaluar rápidamente la salud del libro.

**Why this priority**: es la lectura numérica del libro; complementa el listado pero no bloquea
la consulta básica.

**Independent Test**: Con 36 asientos (30 registrados y 6 anulados) sin filtros →
`meta = { total: 36, registrados: 30, anulados: 6, … }`.

**Acceptance Scenarios**:

1. **Given** un asiento con `status = false`, **When** aparece en la lista, **Then** su `estado`
   es `"Anulado"`; con `status = true` es `"Registrado"`.
2. **Given** los tres conteos, **When** se responden, **Then** se calculan en paralelo sobre el
   mismo filtro: `total` (sin estado), `registrados` (filtro ∧ `status: true`) y `anulados`
   (filtro ∧ `status: false`).
3. **Given** un asiento con varias líneas, **When** se calcula `total`, **Then** es la suma de
   los `debit` de sus líneas (en un asiento cuadrado equivale a la suma del `haber`).
4. **Given** la selección de filas con checkbox en la UI, **When** se marcan filas, **Then** el
   pie de página muestra el contador de seleccionados (la selección es local; no dispara acciones
   masivas ni llamadas al servidor).

---

### Edge Cases

- **Fechas con formato distinto de `AAAA-MM-DD`**: se ignoran silenciosamente (no generan rango);
  nunca producen `400`.
- **`desde > hasta`**: el filtro se construye igual (`gte` y `lte` simultáneos) y devuelve `data: []`.
- **`q` sólo con espacios**: se aplica `.trim()`; si queda vacío no se agrega el `OR`.
- **`q` muy corto o con caracteres especiales**: no hay sanitización adicional; se usa `contains`
  con `mode: "insensitive"` (búsqueda por subcadena).
- **`pageSize` = 0 o negativo**: `parseInteger` lo recorta a `1`; `pageSize` > 100 → `100`.
- **Página inexistente** (`page=999` con 2 páginas): `meta.page` se reduce a `2` y se devuelven
  las filas de la última página.
- **Total exactamente múltiplo del tamaño de página**: `totalPaginas = total / pageSize` (techo).
- **Orden por `total` con datos grandes**: se cargan **todos** los `id` que cumplen el filtro y
  se agrupan los débitos antes de paginar; es el camino más costoso del endpoint.
- **`meta.registrados`/`meta.anulados` con filtro de estado activo**: se calculan sobre el mismo
  filtro, por lo que `estado=registrado` produce `registrados = total` y `anulados = 0`.
- **Error inesperado** (base de datos, etc.): `500` con `{ error }` y log
  `[api/journal-entries] error al listar asientos:` en consola del servidor.
- **Respuestas sin caché**: la ruta se exporta con `dynamic = "force-dynamic"` y el servicio usa
  `cache: "no-store"`, por lo que siempre se lee el estado actual.
- **Seleccionar todas las filas visuales**: sólo afecta a los `id` de la página actual; la
  selección no se conserva al cambiar de página ni se sincroniza con el servidor.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Exponer `GET /api/journal-entries` que devuelva `200` con `{ data, meta }`, donde
  `data` es la página de resúmenes de asientos y `meta` los metadatos de paginación y conteos.
- **FR-002**: Soportar filtros combinables con `AND`: `desde`, `hasta` (rango de fecha contable,
  formato `AAAA-MM-DD`, inclusivo y en UTC), `diario` (igualdad exacta sobre `book`), `estado`
  (`registrado` → `status: true`, `anulado` → `status: false`, otro valor sin efecto) y `q`
  (búsqueda case-insensitive por número, glosa o cuenta contable asociada).
- **FR-003**: Soportar paginación con `page` (defecto `1`, mínimo `1`) y `pageSize` (defecto
  `10`, rango `1..100`), normalizando valores no numéricos a los defectos.
- **FR-004**: Soportar ordenación con `orden` ∈ `fecha|numero|concepto|diario|estado|total`
  (defecto `fecha`) y `dir` ∈ `asc|desc` (defecto `desc`), con desempate por `id` descendente.
- **FR-005**: Ordenar por `total` calculando en memoria la suma del `debit` por asiento
  (`groupBy` sobre `journalEntryDetail`), paginando el resultado y reordenando la página final.
- **FR-006**: Devolver en `meta` los campos `total`, `registrados`, `anulados`, `page`
  (página efectiva ya recortada), `pageSize`, `totalPaginas` (mínimo 1), `orden` y `dir`.
- **FR-007**: Mapear cada registro a `{ id, numero, fecha, diario, concepto, responsable, estado,
  total }`, con `fecha` en formato ISO `AAAA-MM-DD`, `estado` como cadena `"Registrado"` /
  `"Anulado"` y `total` como número (suma del `debit`).
- **FR-008**: Responder `500` con `{ "error": "No se pudo obtener el listado de asientos
  contables." }` ante cualquier excepción, sin filtrar detalles internos.
- **FR-009**: La ruta debe ser dinámica (`export const dynamic = "force-dynamic"`) y no cachear
  resultados.
- **FR-010**: El listado no debe exigir autenticación ni rol: no hay control de acceso en esta
  ruta (ver **Permisos**).
- **FR-011**: El front-end debe serializar los filtros a query string omitiendo valores vacíos y
  forzando `orden`/`dir` válidos antes de llamar al endpoint (`buildQuery`).
- **FR-012**: La pantalla de consulta debe aplicar todos los filtros de forma simultánea,
  resetear a la página 1 ante cualquier cambio de filtro u orden, y mostrar estados de carga,
  vacío y error con reintento.
- **FR-013**: El buscador de la UI debe aplicarse con *debounce* de 400 ms y descartar
  respuestas de peticiones obsoletas (sólo la última en vuelo actualiza el estado).
- **FR-014**: La UI debe poblar las pestañas de diario y el selector de estado desde
  `GET /api/journal-entries/options` (contadores por diario y por estado) como apoyo al filtrado.

### Reglas de negocio

| # | Regla | Comportamiento observado |
|---|-------|--------------------------|
| RN-1 | Orden estable | Todo orden se desempata por `id` descendente para que la paginación sea determinista. |
| RN-2 | Filtros combinables | `desde`, `hasta`, `diario`, `estado` y `q` se unen con `AND`; `q` usa `OR` interno. |
| RN-3 | Página efectiva | `page` siempre se recorta a `totalPaginas`, evitando páginas vacías. |
| RN-4 | Total = Σ debe | El importe mostrado es la suma del `debit` de las líneas del asiento. |
| RN-5 | Estado como cadena | El booleano `status` se expone como `"Registrado"` / `"Anulado"`. |
| RN-6 | Sin paginación de filtros | Los conteos de `meta` se calculan sobre el filtro completo, no sobre la página. |
| RN-7 | Tolerancia a parámetros inválidos | Valores mal formados se normalizan a defectos; nunca producen `400`. |
| RN-8 | Orden por total es computado | No existe columna `total` almacenada; se deriva de `journalEntryDetail.debit`. |

### Contrato del endpoint

**Endpoint**: `GET /api/journal-entries`

#### Parámetros de consulta

| Parámetro | Tipo | Defecto | Rango / valores | Efecto |
|-----------|------|---------|-----------------|--------|
| `desde` | fecha `AAAA-MM-DD` | — | cualquier fecha válida | `entryDate >= desde` (UTC) |
| `hasta` | fecha `AAAA-MM-DD` | — | cualquier fecha válida | `entryDate <= hasta` (UTC) |
| `diario` | string | — | valor exacto de `book` | igualdad exacta |
| `estado` | string | — | `registrado` \| `anulado` | `status = true` / `status = false` |
| `q` | string | — | texto libre (se recorta) | `OR` sobre número, glosa y cuenta |
| `page` | entero | `1` | ≥ 1 | página solicitada (se recorta al total) |
| `pageSize` | entero | `10` | 1–100 | tamaño de página |
| `orden` | string | `fecha` | `fecha`,`numero`,`concepto`,`diario`,`estado`,`total` | campo de orden |
| `dir` | string | `desc` | `asc` \| cualquier otra cosa → `desc` | dirección |

#### Respuesta 200

```json
{
  "data": [
    {
      "id": 7,
      "numero": "MISC/2025/06/0007",
      "fecha": "2025-06-18",
      "diario": "Operaciones varias",
      "concepto": "Asiento 7",
      "responsable": "Leandro Mauricci",
      "estado": "Registrado",
      "total": 300.25
    }
  ],
  "meta": {
    "total": 36,
    "registrados": 30,
    "anulados": 6,
    "page": 1,
    "pageSize": 10,
    "totalPaginas": 4,
    "orden": "fecha",
    "dir": "desc"
  }
}
```

#### Errores

| Status | Condición | Cuerpo |
|--------|-----------|--------|
| 500 | Excepción no prevista (base de datos u otra) | `{ "error": "No se pudo obtener el listado de asientos contables." }` |

No existen respuestas `400` ni `404`: los parámetros inválidos se normalizan.

### Permisos

- `GET /api/journal-entries` **no aplica ninguna verificación de sesión ni de rol**: la ruta no
  usa `requireRole` ni ninguna otra comprobación de autorización.
- **No existe middleware de autorización activo** en el proyecto que cubra esta ruta: no hay
  `middleware.ts`; existe únicamente `proxy.ts.desactivado` (fuera de servicio).
- En consecuencia, el endpoint es accesible para cualquier cliente que alcance la aplicación.
- Sólo `POST`/`PATCH` de `/api/accounting-periods` exigen `requireRole` (rol `ADMIN`); ver spec
  `001-gestion-periodos-contables`.

### Relación con otras funcionalidades

- **Detalle**: al pulsar una fila, la UI llama a `GET /api/journal-entries/[id]` (fuera de este
  alcance; ver spec `002-journal-entries-manual-entry`, User Story 4).
- **Opciones de filtro**: `GET /api/journal-entries/options` devuelve los diarios existentes con
  su conteo y los estados `registrado`/`anulado` con su conteo (global, sin aplicar filtros).
- **Alta manual**: tras crear un asiento (`POST`), la UI vuelve a la página 1 y recarga el
  listado y las opciones (ver spec `002-journal-entries-manual-entry`).
- **Plan contable**: la búsqueda `q` cruza hacia `accountingAccount.code`/`name` a través de
  `journalEntryDetail` (ver spec `003-listado-cuentas-contables`).

### Key Entities *(include if feature involves data)*

- **JournalEntry (Asiento contable)**: `code` (número `MISC/YYYY/MM/NNNN`), `entryDate`
  (`@db.Date`, UTC), `description` (glosa), `book` (diario), `responsible`, `status` boolean,
  `periodId` obligatorio.
- **JournalEntryDetail (Línea del asiento)**: `accountId`, `debit` y `credit` (`Decimal(12,2}`);
  la suma de `debit` por `entryId` es el `total` expuesto y la base del orden por `total`.
- **AccountingAccount (Cuenta contable)**: `code` y `name` participan en la búsqueda `q`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las consultas válidas responden `200` con `data` y `meta` coherentes:
  `total = registrados + anulados` (cuando no hay filtro de estado) y `totalPaginas = max(1,
  ceil(total / pageSize))`.
- **SC-002**: La suma de `pageSize` (o el remanente en la última página) de páginas consecutivas
  reproduce exactamente el total de asientos filtrados, sin duplicados ni omisiones.
- **SC-003**: El 100 % de los parámetros mal formados (`page=abc`, `pageSize=9999`,
  `orden=inventado`, `dir=ASC`, fechas inválidas) produce una respuesta `200` normalizada, jamás
  un `400`.
- **SC-004**: El 100 % de los fallos de base de datos responde `500` con el mensaje público
  exacto y sin exponer el error interno.
- **SC-005**: El listado se mantiene estable ante consultas repetidas con los mismos parámetros
  (desempate por `id`), por lo que no se producen saltos ni registros repetidos entre páginas.
- **SC-006**: La pantalla de consulta nunca muestra datos de una petición obsoleta (sólo la
  última respuesta en vuelo actualiza la tabla) y refleja el estado vacío, de carga y de error
  en el 100 % de los casos.

---

## Assumptions

- Esta especificación cubre **sólo la consulta del listado** (`GET /api/journal-entries`); la
  creación, el detalle, las opciones y el próximo código se documentan en la spec
  `002-journal-entries-manual-entry`.
- Los asientos automáticos de ventas, compras y pagos se incluyen en el listado (mismo modelo),
  pero su generación no forma parte de este alcance.
- El endpoint no implementa exportación, agregados históricos ni filtros por cuenta; éstos
  pertenecen a "Libro Mayor" / "Balance" (`/api/general-ledger`, `/api/balance-sheet`).
- El orden por `total` carga todos los identificadores que cumplen el filtro en memoria: se
  asume volúmenes donde ese costo sea aceptable (ver NFR-003).
- El comportamiento corresponde al código vigente al 2026-10-05.
- La spec `003-listado-cuentas-contables` atribuye la autenticación a un "middleware de sesión";
  en el código actual **no existe** middleware activo, por lo que aquí se documenta el endpoint
  como sin control de acceso.

---

## Evidencia de verificación

| Afirmación | Archivo |
|---|---|
| Filtros (`desde`, `hasta`, `diario`, `estado`, `q`) | `app/api/journal-entries/route.ts` (líneas 26–64) |
| Normalización de `page`, `pageSize`, `orden`, `dir` | `app/api/journal-entries/route.ts` (líneas 15–20, 103–107) |
| Conteos en paralelo de `meta` | `app/api/journal-entries/route.ts` (líneas 111–119) |
| Orden por `total` con `groupBy` de débitos | `app/api/journal-entries/route.ts` (líneas 88–97, 121–136, 166–169) |
| Selección de campos y mapeo a la forma API | `app/api/journal-entries/route.ts` (líneas 138–169) |
| Respuesta `200` y error `500` | `app/api/journal-entries/route.ts` (líneas 171–190) |
| `dynamic = "force-dynamic"` | `app/api/journal-entries/route.ts` (línea 7) |
| Pruebas del listado (8 casos) | `app/api/journal-entries/route.test.ts` |
| Serialización de filtros y tipos del servicio | `lib/services/journal-entries.service.ts` (líneas 12–59, 141–165) |
| Pruebas de `buildQuery` | `lib/services/journal-entries.service.test.ts` |
| Manejo de errores (`ApiError`, `cache: "no-store"`) | `lib/services/http.ts` |
| Pantalla de consulta, debounce y protección de carreras | `app/accounting/entries/page.tsx` (líneas 67–137, 142–227) |
| Estados de la tabla (carga, vacío, error) y selección | `app/accounting/entries/components/JournalEntryTable.tsx` |
| Tamaños de página ofrecidos (10, 25, 50) | `app/accounting/entries/components/JournalEntryPagination.tsx` (línea 14) |
| Opciones de filtro (diarios y estados) | `app/api/journal-entries/options/route.ts` |
| Modelo de datos | `prisma/schema.prisma` (model JournalEntry / JournalEntryDetail) |
| Ausencia de middleware de autorización | `middleware.ts` (inexistente), `proxy.ts.desactivado` |

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
