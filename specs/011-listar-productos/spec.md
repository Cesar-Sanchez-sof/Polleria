# Feature Specification: Listar Productos (Carta)

**Feature Branch**: `011-listar-productos`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la feature ya creada *listar
productos* (carta de platos con categoría, precio y stock para la comanda), describiendo el
comportamiento real implementado."

> **Nota de procedencia**: especificación de un **comportamiento ya implementado**. Todo lo
> afirmado fue verificado por lectura de código y por las pruebas del servicio de stock
> (`test/redis-stock.test.ts`), referenciadas en
> [Evidencia de verificación](#evidencia-de-verificación). No se describen funcionalidades
> futuras ni reglas ausentes en la implementación. Alta/edición de platos **no existe** en el
> código (sólo hay `GET`), y la toma de comanda es la spec `008`.

---

## Purpose

Devolver la carta de productos activos (nombre, descripción, precio, categoría inferida y stock)
para que la UI de comanda permita elegir platos y armar el pedido.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar la carta de productos (Priority: P1)

Como usuario del módulo de ventas, quiero obtener la lista de platos disponibles con su precio
para agregarlos a una comanda.

**Why this priority**: la carta es insumo del modal de comanda (spec `008`); sin ella no se puede
tomar un pedido.

**Independent Test**: `GET /api/dishes` → `200` con `{ data: [...], total }` y cada plato con
`id`, `name`, `description`, `price`, `category`, `active`, `stock`, `available`.

**Acceptance Scenarios**:

1. **Given** hay platos activos en la base, **When** se solicita `GET /api/dishes`, **Then** se
   responde `200` con `data` ordenado por `id` ascendente y `total = data.length`.
2. **Given** un plato inactivo, **When** se solicita, **Then** no aparece en la respuesta (sólo
   `active: true`).
3. **Given** `?q=pollo`, **When** se solicita, **Then** sólo se devuelven los platos cuyo nombre
   contiene "pollo" (búsqueda insensible a mayúsculas).
4. **Given** `?category=bebidas`, **When** se solicita, **Then** sólo se devuelven los platos
   clasificados como bebidas.
5. **Given** un plato sin stock fijado, **When** se solicita, **Then** `stock: 999` y
   `available: true` (valor por defecto).
6. **Given** la base de datos falla, **When** se solicita, **Then** `500` con
   `{ "error": "No se pudo obtener la carta de productos." }`.

---

### User Story 2 - Elegir platos desde el modal de comanda (Priority: P1)

Como mozo, quiero ver la carta agrupada por categorías y tocar un plato para añadirlo a la
comanda.

**Why this priority**: es el único consumidor actual de la carta.

**Independent Test**: abrir el modal de comanda → aparecen los botones de categoría y el grid de
platos; tocar un plato incrementa su cantidad si ya estaba.

**Acceptance Scenarios**:

1. **Given** el modal abierto, **When** se pulsa la categoría "Bebidas", **Then** sólo se muestran
   los platos con `category: "bebidas"`.
2. **Given** un plato ya agregado, **When** se vuelve a tocar, **Then** su cantidad aumenta en 1
   (no se duplica la línea).
3. **Given** los datos cargados, **When** se agrega un plato sin stock, **Then** la UI lo permite
   y el rechazo ocurre sólo al guardar la comanda (spec `008`, `400` de stock).

---

### Edge Cases

- **Categoría inferida del nombre, no de la base**: `determineCategory()` evalúa el nombre en
  orden (`pollo`/`mostrito` → `pollos`; `papas`/`tequeño`/`chaufa`/`ensalada`/`porción` →
  `adicionales`; `inka`/`chicha`/`gaseosa`/`bebida`/`agua` → `bebidas`; resto → `otros`).
  Renombrar un plato cambia su categoría sin tocar la BD.
- **Prioridad de la regla**: "Porción de Arroz Chaufa de Pollo" contiene "pollo" y cae en
  `pollos` (no en `adicionales`), porque el primer `if` gana.
- **Bebidas sin palabras clave**: con la semilla actual, "Coca Cola 1.5L" y "Jarra de Maracuyá
  1L" no contienen ninguna palabra clave y caen en `otros`.
- **Filtro de categoría en memoria**: el `where` de Prisma no filtra categoría (no es columna);
  se infiere y filtra después de traer todos los platos activos.
- **`stock`/`available` no se usan en la UI**: la API los calcula (una consulta Redis por plato)
  pero el modal sólo pinta nombre, descripción y precio.
- **`image` calculado pero no renderizado**: `listDishes()` adjunta una URL de imagen
  (`DISH_IMAGES` con fallback genérico) que ninguna pantalla muestra.
- **Búsqueda local muerta**: existe el estado `dishSearch` y el filtro `filteredDishes`, pero no
  hay ningún input que lo escriba (sólo se reinicia al abrir el modal) → siempre vacío.
- **`q` del servidor no se usa**: la UI llama `listDishes()` sin parámetros.
- **Sin refresco automático**: la carta se carga en `loadData()` (montaje, refrescar, acciones);
  un cambio de stock no se refleja hasta recargar.
- **N+1 en Redis**: `Promise.all` con una llamada `getDishStock` por plato.

---

## Functionalities

- **`GET /api/dishes`**: lista la carta activa con categoría inferida, stock y disponibilidad.
- **`listDishes()`** (`lib/services/tables.service.ts`): fetch sin caché que agrega `image` y
  propaga errores de la API.
- **Modal de comanda**: botones de categoría, grid de platos y agregado a la comanda con
  incremento de cantidad.

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Sólo activos** | Nunca se devuelven platos con `active: false`. |
| BR-2 | **Categoría por nombre** | Se infiere con `determineCategory()`; no existe columna de categoría. |
| BR-3 | **Búsqueda** | `q` se compara contra `name` con `contains` insensible a mayúsculas. |
| BR-4 | **Orden** | Por `id` ascendente (orden de inserción, no alfabético). |
| BR-5 | **Stock en tiempo real** | `stock = getDishStock(id)`; `available = stock > 0`; default `999` si nunca se fijó stock. |
| BR-6 | **Precio** | `price` es `Decimal(7,2)` expuesto como número. |
| BR-7 | **Sin control de acceso** | No se valida sesión, cookie ni rol (no hay middleware activo). |

## Endpoint

| Method | Path | Summary |
|--------|------|---------|
| GET | `/api/dishes` | Lista la carta de productos activos. |

### Request

| Parámetro | Alias | Tipo | Descripción |
|-----------|-------|------|-------------|
| `q` | — | string | Búsqueda por nombre (insensible a mayúsculas). |
| `category` | `categoria` | string | Filtra por categoría inferida; `"todos"` o vacío = sin filtro. |

Sin cuerpo.

### Response (200)

```json
{
  "data": [
    {
      "id": 1,
      "name": "1/4 Pollo a la Brasa",
      "description": "",
      "price": 18,
      "category": "pollos",
      "active": true,
      "stock": 999,
      "available": true
    },
    {
      "id": 11,
      "name": "Inca Kola 1.5L",
      "description": "",
      "price": 8,
      "category": "bebidas",
      "active": true,
      "stock": 12,
      "available": true
    }
  ],
  "total": 2
}
```

### Errors

| Status | Condition | Body |
|--------|-----------|------|
| 500 | Excepción inesperada | `{ "error": "No se pudo obtener la carta de productos." }` |

No existen `400`/`401`/`403`/`404`: la operación no valida entradas.

## Permissions

- **Requerido**: ninguno. `GET /api/dishes` no usa `requireRole` ni verifica sesión/cookie, y no
  existe middleware de autorización activo (`middleware.ts` inexistente, `proxy.ts.desactivado`).
- Cualquier cliente que alcance la aplicación puede leer la carta y sus precios.
- El modal de comanda no aplica filtro de rol.

## Validations

- No hay validaciones de entrada: `q` y `category` desconocidos simplemente no filtran (o no
  coinciden) sin error.
- Cualquier excepción se captura y responde `500` con el mensaje documentado y
  `console.error("[api/dishes] Error al listar platos:", error)`.

## Acceptance Criteria

1. **When** se llama el endpoint **Then** la respuesta es `200` con `{ data, total }`, platos
   activos ordenados por `id` y con los 8 campos documentados.
2. **When** se envía `q` o `category` **Then** el resultado queda filtrado (búsqueda en BD,
   categoría en memoria).
3. **When** un plato no tiene stock fijado **Then** responde `stock: 999` y `available: true`.
4. **When** la UI carga la carta **Then** muestra los botones de categoría y el grid, y tocar un
   plato lo agrega (o incrementa) en la comanda.
5. **When** la base de datos falla **Then** la API responde `500` con el mensaje documentado y la
   UI muestra el error en un toast.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Exponer `GET /api/dishes` con los parámetros `q` y `category`/`categoria`.
- **FR-002**: Filtrar por `active: true` y ordenar por `id` ascendente.
- **FR-003**: Inferir la categoría a partir del nombre del plato (`determineCategory`).
- **FR-004**: Adjuntar `stock` y `available` desde Redis con default `999`.
- **FR-005**: Devolver `total` igual a la longitud de `data`.
- **FR-006**: Servir la carta a la UI de comanda con filtro por categoría y agregado incremental
  de cantidades.
- **FR-007**: Manejar errores con respuesta `500` y log en consola.

### Non-Functional Requirements

- **NFR-001**: `export const dynamic = "force-dynamic"` y `fetch(..., { cache: "no-store" })`;
  la carta no se sirve de caché.
- **NFR-002**: El stock requiere **una consulta Redis por plato** dentro de un `Promise.all`
  (patrón N+1 sobre Redis, mitigado por ser llamadas paralelas).
- **NFR-003**: Sin autenticación y sin paginación: se devuelve la carta completa en una sola
  respuesta.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una sola llamada a `GET /api/dishes` devuelve toda la carta activa con precio y
  stock, lista para pintar el modal de comanda.
- **SC-002**: El 100 % de los elementos de `data` contiene los 8 campos documentados y
  `total === data.length`.
- **SC-003**: Ningún plato inactivo aparece en la carta (ni en la UI).
- **SC-004**: El usuario puede armar una comanda completa sin recargas adicionales de la carta.
- **SC-005**: Ante un fallo de base de datos se informa el mensaje documentado (500), nunca una
  carta vacía aparentemente válida.

---

## Traceability Matrix

| Requirement | Scenario | Implementation |
|-------------|----------|----------------|
| FR-001 | US1 escenarios 3-4 | `searchParams.get("q"/"category"/"categoria")` |
| FR-002 | US1 escenarios 1-2 | `where: { active: true }` + `orderBy: { id: "asc" }` |
| FR-003 | Edge cases de categoría | `determineCategory()` |
| FR-004 | US1 escenario 5 | `Promise.all(filteredDishes.map(getDishStock))` |
| FR-005 | US1 escenario 1 | `{ data, total }` |
| FR-006 | US2 escenarios 1-3 | `filteredDishes`, botones de categoría y `addOrderItem` |
| FR-007 | US1 escenario 6 | `catch` → 500 con `console.error` |

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| `GET` completo: parámetros, `where` activo, orden, inferencia de categoría y filtro en memoria | `app/api/dishes/route.ts` líneas 16-42 |
| Heurística `determineCategory()` y su orden de condiciones | `app/api/dishes/route.ts` líneas 8-14 |
| `stock`/`available` por plato con `getDishStock` y respuesta `{ data, total }` | `app/api/dishes/route.ts` líneas 44-56 |
| Error `500` y log `[api/dishes] Error al listar platos:` | `app/api/dishes/route.ts` líneas 57-63 |
| `dynamic = "force-dynamic"` y ausencia de autenticación | `app/api/dishes/route.ts` líneas 1-5 |
| `getDishStock` devuelve 999 si nunca se fijó stock | `lib/services/redis-stock.service.ts` líneas 114-130 |
| Servicio `listDishes()` (sin caché, `image`, propagación de error) | `lib/services/tables.service.ts` líneas 182-194 |
| Mapa `DISH_IMAGES`, `getDishImage()` con fallback y no uso en la UI | `lib/services/tables.service.ts` líneas 137-158; `app/sales/page.tsx` líneas 2577-2603 |
| Carga de la carta dentro de `loadData()` (sin parámetros) | `app/sales/page.tsx` líneas 150-161 |
| Categorías de la UI y `filteredDishes` (búsqueda sin input) | `app/sales/page.tsx` líneas 193, 322-331 y 2554-2575 |
| Agregado incremental de cantidades (`addOrderItem`) | `app/sales/page.tsx` líneas 510-529 |
| Nombres de la semilla usados por la heurística | `prisma/seed.ts` líneas 114-186 |

**No existen pruebas automatizadas de la ruta `GET /api/dishes`**; el comportamiento del stock
está cubierto por `test/redis-stock.test.ts` (fijar/consultar stock, reserva y rollback).

**Fuera de alcance**: alta/edición/baja de platos (no existen esas rutas), recetas e inventario,
y la toma de comanda (spec `008`).

---

*Esta especificación refleja el comportamiento **real** actualmente implementado en el código.*
