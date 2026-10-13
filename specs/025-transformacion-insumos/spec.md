# Feature Specification: Transformación de Insumos

**Feature Branch**: `023-transformacion-insumos`

**Created**: 2026-10-12
**Status**: Implemented

**Input**: User description: "Especificación de Spec Kit para la feature 
*transformación de insumos*, que permite definir recetas de producción y 
ejecutarlas por lote para convertir materias primas en productos terminados. 
Alcance inicial: solo pollo entero → 8 presas de pollo."

> **Nota de procedencia**: especificación nueva. La migración de Prisma 
> ya está aplicada (`transformation_recipe`, `transformation`, 
> `transformation_item`, `inventory_movement.transformation_item_id`). 
> El módulo actual permite registrar transformaciones manuales pero no 
> define recetas reutilizables. Esta spec cubre ambos.

---

## Purpose

Permitir al equipo de cocina/almacén:

1. **Definir recetas de transformación** (una sola vez): "1 Pollo entero 
   → 8 Presas de pollo"
2. **Ejecutar recetas por lote**: "Ejecutar 5 veces la receta Presas de 
   Pollo" → consume 5 pollos enteros y produce 40 presas
3. **Ver historial** de todas las transformaciones ejecutadas
4. **Anular** una transformación con motivo (revierte stock)

**Alcance inicial:** solo la receta "Pollo entero → 8 Presas de pollo". 
En futuras iteraciones se agregarán otras recetas (papa, cebolla, ají, 
salsas) sin cambios de código.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar receta de transformación (Priority: P1)

Como administrador, quiero definir una receta de transformación una sola 
vez para no tener que ingresarla cada vez que produzco un lote.

**Acceptance Scenarios**:

1. **Given** no existe la receta "Presas de Pollo",
   **When** el usuario la crea con:
   - Producto terminado: "Presas de pollo" (unidad: unidad)
   - Insumo consumido: "Pollo entero" (unidad: unidad)
   - Cantidad producida: 8
   - Cantidad requerida: 1
   **Then** se crea `TransformationRecipe` con esos valores.

2. **Given** que ya existe una receta con el mismo par 
   (producido, consumido),
   **When** se intenta crear otra,
   **Then** se rechaza con error "Ya existe una receta para esta 
   combinación de insumos".

3. **Given** la receta creada,
   **When** se ve el listado de recetas,
   **Then** aparece con nombre "1 Pollo entero → 8 Presas de pollo".

4. **Given** el usuario quiere actualizar la receta,
   **When** edita las cantidades (ej: ahora son 10 presas),
   **Then** se guardan los nuevos valores pero NO se altera el 
   historial de transformaciones ya ejecutadas.

---

### User Story 2 - Ejecutar receta por lote (Priority: P1)

Como cocinero, quiero ejecutar una receta N veces para producir múltiples 
lotes de una sola operación.

**Acceptance Scenarios**:

1. **Given** la receta "1 Pollo entero → 8 Presas de pollo" y stock 
   actual de 48 pollos,
   **When** el usuario ejecuta la receta 5 veces,
   **Then** en una sola transacción:
   - Se crea `Transformation` con `notes` opcional
   - Se crea `TransformationItem` tipo "Salida": 5 pollos consumidos
   - Se crea `TransformationItem` tipo "Entrada": 40 presas producidas
   - Se crean 2 `InventoryMovement`:
     · `TransformationOut` con `transformationItemId` linkeado
     · `TransformationIn` con `transformationItemId` linkeado
   - Pollo entero: `currentStock` baja de 48 → 43
   - Presas de pollo: `currentStock` sube de X → X+40
   - Se recalcula `averageCost` de ambos insumos

2. **Given** stock actual de 3 pollos y el usuario intenta ejecutar la 
   receta 5 veces,
   **When** envía el formulario,
   **Then** se rechaza con error "Stock insuficiente. Disponibles: 3, 
   necesarios: 5".

3. **Given** el usuario ejecuta una transformación exitosa,
   **Then** aparece toast "Transformación ejecutada exitosamente" y el 
   historial se refresca.

---

### User Story 3 - Ver historial con KPIs y filtros (Priority: P2)

Como administrador, quiero ver todas las transformaciones registradas con 
su tipo, cantidades, costos y responsable, y filtrar por insumo o fecha.

**Acceptance Scenarios**:

1. **Given** transformaciones registradas,
   **When** se carga la página,
   **Then** se muestran:
   - KPIs arriba: Total transformaciones, Insumos consumidos (count), 
     Productos producidos (count), Anuladas (count)
   - Tabla con: Lote (TR-XXXX), Fecha, Responsable, Consumo (badge), 
     Producción (badge), Estado (badge), Acciones

2. **Given** el filtro por insumo,
   **When** se elige "Pollo entero",
   **Then** solo muestra transformaciones que lo consumieron.

3. **Given** el filtro por rango de fechas,
   **When** se aplica,
   **Then** filtra por `date` dentro del rango.

4. **Given** el buscador,
   **When** se escribe "TR-001",
   **Then** filtra por número de lote.

5. **Given** una transformación anulada,
   **Then** muestra badge gris "Anulada" y el stock ya fue revertido.

---

### User Story 4 - Ver detalle de una transformación (Priority: P2)

Como auditor, quiero ver el detalle completo de una transformación: qué 
insumos se consumieron, qué se produjo, a qué costo y quién lo hizo.

**Acceptance Scenarios**:

1. **Given** la fila de una transformación,
   **When** se pulsa "Ver detalle",
   **Then** se abre un diálogo con:
   - Número de lote
   - Fecha y hora
   - Responsable
   - Tabla de consumo (insumo, cantidad, costo unitario, costo total)
   - Tabla de producción (insumo, cantidad, costo unitario, costo total)
   - Observaciones
   - Valor total consumido vs. valor total producido

---

### User Story 5 - Anular una transformación (Priority: P1) [Implementada]

> **Estado**: Implementada (servicio `annulTransformation` y diálogo UI integrados).

Como administrador, quiero anular una transformación registrada por error, 
revirtiendo el stock y dejando constancia del motivo.

**Acceptance Scenarios**:

1. **Given** una transformación que consumió 5 pollos y produjo 40 presas,
   **When** se anula con motivo "Error de cantidad",
   **Then** en una transacción:
   - Se crea `InventoryMovement` inverso para pollo (quantity: +5)
   - Se crea `InventoryMovement` inverso para presas (quantity: -40)
   - Pollo: `currentStock` sube 5
   - Presas: `currentStock` baja 40
   - La transformación queda con `anulado: true`, `anuladoAt`, 
     `anuladoPor`, `motivoAnulacion`

2. **Given** que las presas producidas ya se vendieron (stock actual de 
   presas es 10 y se intenta revertir 40),
   **When** se intenta anular,
   **Then** se rechaza con "Stock insuficiente para revertir el producto 
   terminado. Stock actual: 10, necesario: 40".

3. **Given** una transformación ya anulada,
   **When** se intenta anular de nuevo,
   **Then** error "Esta transformación ya está anulada".

4. **Given** sin motivo,
   **When** se intenta anular,
   **Then** error "El motivo de anulación es obligatorio".

---

### Edge Cases

- **Sin stock suficiente**: se bloquea la ejecución si no hay stock del 
  insumo consumido.
- **Producto terminado aún no existe**: si el usuario intenta crear una 
  receta con un producto terminado que no existe, se le sugiere crearlo 
  desde el diálogo (reutiliza `SupplyDialog` con `type: FinishedProduct`).
- **Insumo consumido y producido son el mismo**: se rechaza (no tiene 
  sentido transformar un insumo en sí mismo).
- **Múltiples recetas activas**: solo puede haber 1 receta activa por 
  par (producido, consumido). Se puede desactivar y crear otra.
- **Cantidad producida = 0**: se rechaza.
- **Cantidad requerida = 0**: se rechaza.
- **Receta desactivada**: no aparece en el dropdown de "ejecutar".
- **Transformación sin items de salida o entrada**: se rechaza.
- **Fecha futura en transformación**: no aplica; siempre es `now()`.
- **Sin control de acceso**: Server Actions sin autenticación.

---

## Functionalidades / Functionalities

- **Página `/purchases/transformation`** (Server Component, 
  `force-dynamic`): "Transformación de Insumos"
- **Tabs**: "Ejecutar transformación" | "Recetas" | "Historial"
- **Server Actions** en `lib/services/purchases/transformation.ts`:
  - `getTransformationRecipes()` — lista recetas activas
  - `createTransformationRecipe(data)` — crear receta
  - `updateTransformationRecipe(id, data)` — editar
  - `toggleTransformationRecipe(id, active)` — activar/desactivar
  - `executeTransformation(recipeId, times, notes)` — ejecutar N veces
  - `annulTransformation(id, motivo, employeeId)` — anular
  - `getTransformations()` — historial con KPIs
- **Componentes**:
  - `<TransformationForm />` (ejecutar receta)
  - `<RecipesTable />` (listar/editar recetas)
  - `<TransformationsTable />` (historial con KPIs)
  - `<RecipeDialog />` (crear/editar receta)
  - `<TransformationDetailDialog />` (ver detalle)
  - `<AnnulTransformationDialog />` (anular con motivo)

### Estructura de la página (con tabs)

**Tab 1: Ejecutar**
- Selector de receta (dropdown con las recetas activas)
- Preview: "Esta receta consume X y produce Y"
- Input: "¿Cuántas veces ejecutar?" (default 1)
- Preview: "Consumirá N × X pollos, producirá N × Y presas"
- Observaciones opcional
- Botón "Ejecutar Transformación"
- Validación de stock antes de enviar

**Tab 2: Recetas**
- Tabla con recetas activas
- Cada fila: producto terminado, insumo consumido, ratio, estado, acciones
- Botón "+ Nueva Receta"
- Botón "Editar" por fila
- Botón toggle activar/desactivar

**Tab 3: Historial**
- KPIs arriba
- Filtros (insumo, fecha, estado)
- Tabla con lote, fecha, responsable, consumo, producción, estado
- Acciones: "Ver detalle", "Anular"

---

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Receta única** | Solo puede existir una receta activa por par (producido, consumido). |
| BR-2 | **Consumido ≠ Producido** | El insumo producido no puede ser el mismo que el consumido. |
| BR-3 | **Cantidades positivas** | `cantidadProducida > 0` y `cantidadRequerida > 0`. |
| BR-4 | **Ejecución transaccional** | Compra + movimientos + actualización de stock en un solo `$transaction`. |
| BR-5 | **Validación de stock** | Antes de ejecutar, verifica que `currentStock(consumido) >= cantidadRequerida × veces`. |
| BR-6 | **Movimientos linkeados** | Cada `InventoryMovement` (in/out) apunta a su `TransformationItem` vía `transformation_item_id`. |
| BR-7 | **Promedio ponderado** | `averageCost` del insumo producido se recalcula con promedio ponderado móvil. |
| BR-8 | **Costo del consumido** | Los items de salida usan el `averageCost` del insumo consumido al momento de la ejecución. |
| BR-9 | **Anulación con motivo** | Requiere motivo no vacío. Marca `anulado: true` + metadatos. |
| BR-10 | **Reversión al anular** | Crea movimientos inversos para ambos insumos. Bloquea si stock insuficiente en alguno. |
| BR-11 | **Sin eliminación física** | Las transformaciones y recetas no se eliminan; se anulan o desactivan. |
| BR-12 | **Sin control de acceso** | Server Actions sin autenticación. |

---

## Endpoint / Transporte

**Server Actions** en `lib/services/purchases/transformation.ts`:

| Acción | Firma | Efecto |
|--------|-------|--------|
| Listar recetas | `getTransformationRecipes()` | Lista activas con insumos relacionados. |
| Crear receta | `createTransformationRecipe(data)` | Inserta `TransformationRecipe`. |
| Editar receta | `updateTransformationRecipe(id, data)` | Actualiza cantidades y estado. |
| Toggle receta | `toggleTransformationRecipe(id, active)` | Activa/desactiva. |
| Ejecutar | `executeTransformation(recipeId, times, notes, employeeId?)` | Transacción completa. |
| Anular | `annulTransformation(id, motivo, employeeId?)` | Marca anulado + reversión de stock. |
| Historial | `getTransformations()` | Lista con insumos, empleado, estado, KPIs. |

### Campos de `TransformationRecipeInput`

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `producedSupplyId` | number | Sí | Debe ser tipo `FinishedProduct`. |
| `consumedSupplyId` | number | Sí | Debe ser tipo `RawMaterial`. |
| `producedQuantity` | number | Sí | > 0. Ej: 8. |
| `requiredQuantity` | number | Sí | > 0. Ej: 1. |

### Campos de `ExecuteTransformationInput`

| Campo | Tipo | Requerido |
|-------|------|-----------|
| `recipeId` | number | Sí |
| `times` | number | Sí (> 0) |
| `notes` | string | No |
| `employeeId` | number | No (auto-resuelto) |

---

## Permissions

- **Requerido**: ninguno. Sin middleware de autorización activo.

---

## Validations

**Servidor** — al crear receta:
- Producido ≠ Consumido
- Cantidades > 0
- Producto producido existe y es `FinishedProduct`
- Insumo consumido existe y es `RawMaterial`
- No existe receta activa con mismo par

**Servidor** — al ejecutar:
- Receta existe y está activa
- `times > 0`
- Stock suficiente del insumo consumido
- Insumos existen

**Servidor** — al anular:
- Motivo no vacío
- Transformación existe
- No está anulada
- Stock suficiente del producto producido (para poder revertir)

**Cliente** — mismos mensajes antes de invocar.

---

## Acceptance Criteria

1. **When** se ejecuta una receta válida, **Then** se crean `Transformation` + 2 `TransformationItem` + 2 `InventoryMovement` linkeados + se actualizan stocks y `averageCost`.
2. **When** el stock es insuficiente, **Then** se rechaza con mensaje claro sin alterar la BD.
3. **When** se anula una transformación, **Then** se revierten ambos stocks y se marca como anulada.
4. **When** se intenta anular con stock insuficiente en alguno de los productos, **Then** se rechaza.
5. **When** hay recetas configuradas, **Then** aparecen en el dropdown de "ejecutar".
6. **When** no hay transformaciones, **Then** empty state.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: CRUD de recetas de transformación (crear, editar, activar/desactivar).
- **FR-002**: Ejecutar receta N veces en una sola transacción.
- **FR-003**: Validar stock suficiente antes de ejecutar.
- **FR-004**: Crear `InventoryMovement` linkeados a `TransformationItem`.
- **FR-005**: Actualizar `currentStock` y `averageCost` de ambos insumos.
- **FR-006**: Listar transformaciones con KPIs, filtros y búsqueda.
- **FR-007**: Ver detalle de una transformación.
- **FR-008**: Anular transformación con motivo + reversión de stock. *(Implementado)*
- **FR-009**: Bloquear anulación si stock insuficiente. *(Implementado)*
- **FR-010**: Refrescar página tras cada operación.

### Non-Functional Requirements

- **NFR-001**: Server Actions; página `force-dynamic`.
- **NFR-002**: Escritura transaccional.
- **NFR-003**: Sin autenticación ni autorización.
- **NFR-004**: Consistencia visual con módulos previos (KPIs, badges, filtros).

---

## Success Criteria *(mandatory)*

- **SC-001**: Toda ejecución crea exactamente 1 `Transformation`, 2 
  `TransformationItem` y 2 `InventoryMovement` linkeados.
- **SC-002**: El stock del insumo consumido baja exactamente en 
  `cantidadRequerida × veces`.
- **SC-003**: El stock del producto producido sube exactamente en 
  `cantidadProducida × veces`.
- **SC-004**: El `averageCost` del producto producido se recalcula por 
  promedio ponderado móvil.
- **SC-005**: Ninguna ejecución deja stock negativo.
- **SC-006**: Toda anulación deja registro con motivo, fecha y empleado.

---

## Evidencia de verificación

| Afirmación | Fuente |
|------------|--------|
| CRUD de recetas | lib/services/purchases/transformation.ts |
| Ejecución por lote | lib/services/purchases/transformation.ts (executeTransformation) |
| Validación de stock | Mismo archivo |
| Movimientos linkeados a TransformationItem | InventoryMovement.transformationItemId |
| Promedio ponderado móvil del producido | executeTransformation |
| Anulación con reversión de stock | annulTransformation |
| Diálogo de anulación con motivo | components/purchases/transformation/AnnulTransformationDialog.tsx |
| Badge "Anulada" en historial | components/purchases/transformation/TransformationsTable.tsx |
| Detalle con motivo de anulación | components/purchases/transformation/TransformationDetailDialog.tsx |
| Tests | purchases.service.test.ts (bloque Módulo 8) |

Fuera de alcance:
- Transformaciones de productos distintos al pollo (futuras iteraciones)
- Planificación de producción según demanda
- Reportes de rentabilidad por producto
- Autorización por rol

---

## Dudas abiertas

- [NECESITA ACLARACIÓN] ¿Se permite transformar productos de distintos 
  días o solo del día? (Decisión actual: cualquier fecha)
- [NECESITA ACLARACIÓN] ¿El costo de la transformación debe ir a un 
  asiento contable? (Decisión actual: queda en el Kardex, Contabilidad 
  decide si lo asienta)

---

*Última actualización: 2026-10-13*