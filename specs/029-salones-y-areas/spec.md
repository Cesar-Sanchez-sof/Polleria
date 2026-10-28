# Feature Specification: Gestión de Salones y Áreas del Restaurante

**Feature Branch**: `refactor/persist-areas-printers-db`  
**Updated**: 2026-10-27  
**Status**: Approved  
**Spec Number**: 029  

---

## 1. Purpose & Overview

Proveer un módulo interactivo y persistente en base de datos para estructurar los distintos ambientes físicos del restaurante (**Salón Principal**, **Terraza**, **2do Piso**, **Barra / Lounge**), permitiendo organizar la distribución de mesas, aforo por salón y facilitar la visualización del salón para mozos y administradores con persistencia transaccional en PostgreSQL mediante Prisma ORM.

---

## 2. User Scenarios & Requirements

### User Story 1 - Creación y Edición de Salones / Ambientes (Priority: P1)
Como administrador, quiero crear y gestionar los salones del restaurante definiendo:
- Nombre del salón (ej. "Terraza Exterior", "Salón Principal").
- Piso o nivel (ej. "Piso 1", "Piso 2", "Mezanine").
- Descripción operativa (ej. "Área para fumadores y mesas al aire libre").
- Color distintivo o badge temático.
- Estado activo/inactivo.

### User Story 2 - Asignación de Mesas a Áreas (Priority: P1)
Como administrador, quiero asignar mesas existentes a cada salón para que:
- El aforo total del salón se calcule sumando la capacidad de sus mesas.
- En la vista de salón de ventas y mesas se pueda filtrar por área (ej. "Ver solo mesas de Terraza").

### User Story 3 - Consulta Rápida y Aforo por Área (Priority: P2)
Como supervisor de sala, quiero consultar el aforo consolidado de cada área:
- Cantidad de mesas asignadas.
- Capacidad máxima de comensales.
- Estado de disponibilidad en tiempo real.

---

## 3. Technical Design

- **Almacenamiento y Persistencia**:
  - Modelo Prisma `DiningArea` (`dining_area` en PostgreSQL):
    - `id` (String, PK)
    - `name` (VarChar 100)
    - `level` (VarChar 50, default "Piso 1")
    - `description` (VarChar 255, opcional)
    - `tableNumbers` (`Int[]`, mapeado a `table_numbers`)
    - `active` (Boolean, default true)
    - `color` (VarChar 30, default "emerald")
    - `createdAt`, `updatedAt` (Timestamp 6)
  - Capa de servicio asíncrona en `restaurant-config.service.ts`:
    - `async listDiningAreas(): Promise<DiningArea[]>`
    - `async saveDiningArea(area: DiningArea): Promise<DiningArea[]>`
    - `async deleteDiningArea(areaId: string): Promise<DiningArea[]>`
    - Fallback y auto-seeding con `DEFAULT_CONFIG.areas` si la tabla en base de datos está vacía.
- **Endpoints REST**:
  - `GET /api/settings/areas`: Lista las áreas con mesas asignadas y aforo consolidado (asíncrono, con autorización de lectura).
  - `POST /api/settings/areas`: Registra una nueva área en BD (asíncrono con `saveDiningArea`).
  - `PUT /api/settings/areas`: Actualiza datos o asignación de mesas de un área (asíncrono con `saveDiningArea`).
  - `DELETE /api/settings/areas?id=...`: Elimina un área de la BD (asíncrono con `deleteDiningArea`).
- **Frontend**: Vista responsive en `/settings/areas` y `/settings/tables` con tarjetas de área, contadores de aforo y modal interactivo.
