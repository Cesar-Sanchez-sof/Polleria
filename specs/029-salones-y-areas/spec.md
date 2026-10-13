# Feature Specification: Gestión de Salones y Áreas del Restaurante

**Feature Branch**: `feature/config-mesas-cobro-mozo-e2e`  
**Created**: 2026-10-13  
**Status**: Approved  
**Spec Number**: 029  

---

## 1. Purpose & Overview

Proveer un módulo interactivo para estructurar los distintos ambientes físicos del restaurante (**Salón Principal**, **Terraza**, **2do Piso**, **Barra / Lounge**), permitiendo organizar la distribución de mesas, aforo por salón y facilitar la visualización del salón para mozos y administradores.

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

- **Almacenamiento**: Persistencia mediante `restaurant-config.service.ts` con API REST (`/api/settings/areas`).
- **Endpoints**:
  - `GET /api/settings/areas`: Lista las áreas con mesas asignadas y aforo consolidado.
  - `POST /api/settings/areas`: Registra una nueva área.
  - `PUT /api/settings/areas`: Actualiza datos o asignación de mesas de un área.
  - `DELETE /api/settings/areas?id=...`: Desactiva o elimina un área.
- **Frontend**: Vista responsive en `/restaurant/areas` con tarjetas de área, contadores de aforo y modal interactivo.
