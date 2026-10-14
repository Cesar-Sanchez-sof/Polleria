# Feature Specification: Kardex de Movimientos de Inventario

**Feature Branch**: `038-kardex-movimientos`

**Created**: 2026-10-13
**Status**: Implemented

**Input**: User description: "Especificación de Spec Kit para la feature 
*kardex de movimientos*, que permite visualizar el historial completo de 
entradas, salidas y ajustes de inventario con filtros, paginación dinámica 
y saldo acumulado por insumo."

> **Nota de procedencia**: funcionalidad implementada. Se accede desde el 
> módulo Inventario/Insumos mediante el botón "Ver Kardex", que abre un 
> modal con filtros y tabla de movimientos.

---

## Purpose

Ofrecer una herramienta de auditoría y consulta que muestre **todos los 
movimientos de inventario** (compra, transformación, venta, ajuste, merma, 
compra informal) con su origen, cantidades, costos unitarios y —cuando 
se filtra por un insumo específico— el **stock acumulado después de cada 
movimiento**.

A diferencia de la tabla de Inventario/Insumos (que muestra el estado 
*actual*), el Kardex muestra la *película completa* de cómo evolucionó 
el stock.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar el Kardex general (Priority: P1)

Como administrador, quiero ver todos los movimientos de inventario 
ordenados por fecha para auditar la actividad del almacén.

**Independent Test**: abrir el modal desde Inventario → ver la lista 
completa de movimientos de todos los insumos, ordenados del más reciente 
al más antiguo.

**Acceptance Scenarios**:

1. **Given** el usuario está en `/purchases/inventory`,
   **When** hace clic en "Ver Kardex",
   **Then** se abre un modal con la tabla completa de movimientos 
   paginada.

2. **Given** el modal abierto,
   **When** se carga la tabla,
   **Then** cada fila muestra: Fecha, Insumo, Tipo, Referencia, Cantidad, 
   Unidad, Costo Unit., Motivo.

3. **Given** hay más movimientos que el tamaño de página,
   **Then** la paginación muestra la cantidad correcta y permite 
   navegar entre páginas.

---

### User Story 2 - Filtrar movimientos (Priority: P1)

Como usuario, quiero filtrar el Kardex por insumo, tipo de movimiento 
o rango de fechas para encontrar movimientos específicos.

**Acceptance Scenarios**:

1. **Given** el usuario filtra por insumo "Pollo entero",
   **Then** la tabla muestra solo movimientos de ese insumo.

2. **Given** el usuario filtra por tipo "Compra",
   **Then** solo muestra movimientos de tipo Compra.

3. **Given** el usuario elige un rango de fechas,
   **Then** solo muestra movimientos dentro de ese rango.

4. **Given** el usuario escribe en el buscador,
   **Then** filtra por nombre de insumo.

5. **Given** los filtros combinados (insumo + tipo + fecha),
   **Then** se aplican todos con AND lógico.

6. **Given** el usuario pulsa "Limpiar",
   **Then** se resetean todos los filtros a su valor por defecto.

---

### User Story 3 - Ver el saldo acumulado por insumo (Priority: P1)

Como administrador, quiero ver el stock acumulado después de cada 
movimiento de un insumo específico para auditar la evolución del stock.

**Acceptance Scenarios**:

1. **Given** el filtro tiene un INSUMO ESPECÍFICO seleccionado,
   **When** la tabla se renderiza,
   **Then** aparece la columna "Stock después" con el saldo acumulado 
   del insumo hasta cada movimiento.

2. **Given** el filtro está en "Todos los insumos",
   **When** la tabla se renderiza,
   **Then** la columna "Stock después" NO se muestra (o aparece en gris).

3. **Given** la columna "Stock después" está visible,
   **Then** su header tiene un ícono de información (ℹ) con tooltip: 
   "Stock del insumo después de aplicar este movimiento. El registro 
   más reciente (arriba) refleja el stock actual."

4. **Given** el usuario suma y resta las cantidades manualmente desde 
   el movimiento más antiguo hasta el más reciente,
   **Then** el resultado coincide con el "Stock después" del movimiento 
   más reciente.

---

### User Story 4 - Navegar al documento origen (Priority: P2)

Como auditor, quiero hacer clic en la referencia del movimiento para 
ir al documento que lo originó.

**Acceptance Scenarios**:

1. **Given** un movimiento de tipo Compra,
   **When** el usuario hace clic en la referencia "F001-12345",
   **Then** navega a Listar Compras con ese comprobante filtrado.

2. **Given** un movimiento de tipo Transformación,
   **When** el usuario hace clic en "TR-001",
   **Then** navega al módulo de Transformación con ese lote filtrado.

3. **Given** un movimiento de tipo Compra Menor,
   **When** el usuario hace clic en "CM-001",
   **Then** navega a Compra Menor sin Comprobante.

---

### Edge Cases

- **Sin movimientos**: la tabla muestra un empty state con ícono + 
  mensaje.
- **Filtro sin resultados**: empty state "No se encontraron movimientos 
  con esos filtros".
- **Motivo truncado**: el texto largo se corta visualmente con `...` 
  pero al hacer hover muestra un tooltip con el texto completo.
- **Saldo con filtro "Todos"**: la columna se oculta o muestra "—".
- **Paginación dinámica**: opciones 15 / 30 / 60 filas por página.
- **Rendimiento**: el modal debe cargar sin bloquear la UI (skeleton 
  mientras se consultan los datos).
- **Movimientos muy antiguos**: se pueden consultar sin límite temporal.
- **Fechas invertidas**: si `startDate > endDate`, la validación 
  rechaza o auto-corrige.

---

## Functionalidades / Functionalities

- **Botón "Ver Kardex"** en el header de `/purchases/inventory`.
- **Modal** (dialog de shadcn) con:
  - 4 filtros: Insumo, Buscar, Tipo de Movimiento, Rango de Fechas
  - Botón "Limpiar" y botón "Refrescar"
  - Tabla con 9 columnas dinámicas
  - Paginación dinámica (15/30/60)
- **Server Action** `getInventoryMovementsPaginated(filters, pagination)`:
  - Devuelve items + metadata de paginación
  - Calcula la referencia derivada (compra, transformación, venta, 
    compra informal)
  - Calcula el saldo corrido cuando hay `supplyId` en el filtro

### Columnas de la tabla

| # | Columna | Visible siempre | Notas |
|---|---------|-----------------|-------|
| 1 | Fecha/Hora | ✅ | Formato `dd MMM yyyy HH:mm` |
| 2 | Insumo | ✅ | Nombre del insumo |
| 3 | Tipo | ✅ | Badge con color según tipo |
| 4 | Referencia | ✅ | Link al origen (si aplica) |
| 5 | Cantidad | ✅ | Con signo (+ verde / − rojo) |
| 6 | Stock después | Condicional | Solo con filtro por insumo |
| 7 | Unidad | ✅ | |
| 8 | Costo Unit. | ✅ | En S/ con 2 decimales |
| 9 | Motivo | ✅ | Tooltip si está truncado |

### Colores de los badges por tipo

| Tipo | Color |
|---|---|
| Compra | Verde |
| Compra Menor | Verde claro |
| Transformación (Entrada) | Azul |
| Transformación (Salida) | Naranja |
| Venta | Rojo |
| Ajuste | Gris |
| Merma | Ámbar |

---

## Business Rules

| # | Regla | Descripción |
|---|-------|-------------|
| BR-1 | **Solo lectura** | El Kardex nunca modifica datos; es una vista de consulta. |
| BR-2 | **Orden descendente** | Los movimientos se ordenan por `movedAt DESC`. |
| BR-3 | **Saldo corrido** | Se calcula acumulando cantidades desde el primer movimiento del insumo. Solo se muestra cuando hay filtro por insumo específico. |
| BR-4 | **Referencia derivada** | El campo "Referencia" se construye a partir de la FK activa (compra, transformación, venta, compra menor). |
| BR-5 | **Paginación dinámica** | El usuario elige entre 15, 30 o 60 filas por página. |
| BR-6 | **Sin eliminación** | No hay endpoints de borrado; el Kardex es bitácora inmutable. |
| BR-7 | **Aislamiento por tipo** | Un movimiento tiene UNA sola FK de origen (regla ya impuesta en `chk_inventory_movement_origin`). |
| BR-8 | **Filtros combinables** | Los filtros se aplican con AND lógico. |
| BR-9 | **Tooltip del motivo** | Los motivos largos se muestran completos al hacer hover. |
| BR-10 | **Saldo = stock actual** | El "Stock después" del movimiento más reciente debe coincidir con `Supply.currentStock`. |

---

## Endpoint / Transporte

**Server Action** en `lib/services/purchases/inventory-movement.ts`:

| Acción | Firma | Efecto |
|--------|-------|--------|
| Listar movimientos | `getInventoryMovementsPaginated(filters, pagination)` | Consulta con filtros + paginación + saldo corrido |

### Firma esperada

```typescript
interface MovementFilters {
  search?: string;
  supplyId?: number;
  movementType?: InventoryMovementType;
  startDate?: Date;
  endDate?: Date;
}

interface PaginationInput {
  page: number;
  pageSize: number; // 15 | 30 | 60
}

interface PaginatedMovements {
  items: InventoryMovementWithDetails[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getInventoryMovementsPaginated(
  filters: MovementFilters,
  pagination: PaginationInput
): Promise<PaginatedMovements>;