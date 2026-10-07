# Feature Specification: Auditoría (registrar y listar logs)

**Feature Branch**: `022-auditoria`
**Created**: 2026-10-07
**Status**: Implemented
**Responsable**: Andy Lee Fernandez Muguerza

## User Story 1 - Registrar logs de cambios para auditoría (0.5 pt)

Como administrador, quiero que el sistema registre automáticamente cada movimiento
(fecha, hora, acción, módulo/entidad, usuario y detalles) para poder auditar quién hizo qué.

**Acceptance Scenarios**
1. **Given** un usuario autenticado, **When** crea/modifica/cambia estado de un registro auditado, **Then** se inserta una fila en `audit_log` con fecha-hora, usuario, acción, módulo, entidad, id y detalle antes/después.
2. **Given** un intento de login fallido, **Then** se registra `LOGIN_FAILED` con el usuario intentado e IP.
3. **Given** un fallo al escribir el log, **Then** la operación de negocio no falla.
4. **Given** datos sensibles (contraseña, token), **Then** se guardan como `[oculto]`.

## User Story 2 - Listar logs de auditoría (0.5 pt)

Como administrador, quiero listar y filtrar los logs de auditoría para revisar la actividad.

**Acceptance Scenarios**
1. **Given** rol ADMIN, **When** abre `/audit`, **Then** ve los registros más recientes primero con fecha, hora, usuario, acción, módulo, entidad y detalle, paginados.
2. **When** filtra por rango de fechas, usuario, acción, módulo o texto, **Then** solo ve los coincidentes.
3. **Given** un usuario sin rol ADMIN, **Then** la API responde 403; sin sesión, 401.
4. **Given** ningún registro coincide, **Then** se muestra "No hay registros de auditoría para los filtros indicados."

## Requisitos
- FR-001 Tabla `audit_log` solo de inserción.
- FR-002 `GET /api/audit-logs` con filtros y paginación.
- FR-003 Pantalla `/audit` enlazada en el menú SEGURIDAD.

Documentación técnica: `docs/auditoria.md`.