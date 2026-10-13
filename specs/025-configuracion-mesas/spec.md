# Feature Specification: Módulo Configuración en Sidebar & Gestión de Mesas

**Feature Branch**: `feature/config-mesas-cobro-mozo-e2e`  
**Created**: 2026-10-13  
**Status**: Approved  
**Spec Number**: 025  

---

## 1. Purpose & Overview

Habilitar un módulo dedicado de **CONFIGURACIÓN** en el menú lateral de navegación (`Sidebar`) del sistema ERP Restaurante, desacoplándolo de la sección operativa de cocina. Este módulo centraliza la administración física y operativa de las mesas del restaurante e introduce accesos directos estructurados para la parametrización global del negocio.

---

## 2. User Scenarios & Requirements

### User Story 1 - Acceso a Configuración de Mesas desde el Sidebar (Priority: P1)
Como administrador o supervisor del restaurante, quiero tener un menú de **CONFIGURACIÓN** visible en el Sidebar para acceder directamente a la gestión de mesas (crear, editar aforo y activar/desactivar mesas) sin tener que buscarlo en la pestaña de cocina.

**Acceptance Criteria**:
1. El `Sidebar` cuenta con la sección claramente diferenciada `CONFIGURACIÓN`.
2. Incluye el enlace `Registrar y Gestionar Mesas` apuntando a `/restaurant/tables`.
3. Muestra estado visual activo según la ruta actual.
4. Mantiene la coherencia de diseño UI/UX y soporte responsive (móvil y escritorio).

### User Story 2 - Sugerencias de Parametrización en el Módulo Configuración (Priority: P2)
Como dueño de negocio, quiero ver opciones adicionales recomendadas en el menú de configuración para la futura parametrización del restaurante:
- **Salones y Áreas**: Gestión de ambientes (Salón Principal, Terraza, 2do Piso, Barra).
- **Datos del Restaurante**: Razón Social, RUC, Dirección fiscal, Teléfono, Logotipo para comprobantes.
- **Comprobantes e Impresoras**: Configuración de comanderas térmicas (Cocina / Bar / Caja) y series de facturación electrónica.

---

## 3. UI/UX Specifications

- Ubicación en el Sidebar: posterior a `CONTABILIDAD` y `SEGURIDAD`.
- Iconografía consistente con Lucide React (`Settings`, `Armchair`, `Building`, `Printer`, `Layers`).
- Estilos de enlace acordes al tema activo (Dark/Light mode).

---

## 4. Verification & Testing

- Carga correcta del Sidebar en resoluciones móviles y de escritorio.
- Navegación fluida hacia `/restaurant/tables`.
