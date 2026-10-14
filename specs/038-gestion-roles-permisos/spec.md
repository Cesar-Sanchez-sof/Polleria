# Feature Specification: Gestión de Roles y Permisos (RBAC)

**Feature Branch**: `feature/gestion-roles-permisos`
**Created**: 2026-10-14
**Status**: Implemented
**Spec Number**: 038

---

## 1. Propósito y alcance

Cada usuario tiene un rol, y cada rol define **a qué ventanas entra** y **qué acciones puede ejecutar**
(ver, crear, editar, eliminar/anular) en cada módulo. Se gestionan desde la pantalla `/roles` y se
aplican en el menú, en las pantallas, en las APIs y en las server actions de compras.

Se alinea con ISO/IEC 27001:2022: A.5.15 (control de acceso), A.5.18 (derechos de acceso),
A.5.3 (segregación de funciones) y A.8.2 (derechos de acceso privilegiados).

## 2. Historias de usuario

- **HU-1 Gestionar roles**: como administrador puedo crear, editar y eliminar roles y asignarles permisos.
- **HU-2 Permisos por ventana y acción**: un usuario solo ve y ejecuta lo que su rol permite.

## 3. Reglas de negocio

1. Permiso = `modulo.accion` (ej. `usuarios.crear`). `ver` da acceso a la ventana.
2. Tener `crear`, `editar` o `eliminar` en un módulo implica `ver` en ese módulo.
3. El rol `ADMIN` es de **sistema**: tiene todos los permisos; no se renombra, desactiva ni elimina.
4. Un rol con usuarios asignados **no se puede eliminar ni desactivar** (HTTP 409).
5. Un rol desactivado no permite iniciar sesión ni conserva permisos.
6. Solo un administrador puede asignar un rol de sistema o modificar a un administrador.
7. Los permisos se leen de la BD en cada petición: un cambio de rol aplica de inmediato.
8. Toda alta, cambio o baja de rol queda en `audit_log` (módulo `Seguridad`).

## 4. Roles base (seed)

ADMIN, CAJERO, MESERO, COCINERO y CONTADOR (ver matriz en `docs/seguridad-iso-27001.md`).
El seed no sobrescribe los permisos de un rol base que el administrador ya haya editado.

## 5. Componentes

- BD: `role.is_system`; `permission.code/module/action` (migración `roles_permisos_catalogo`).
- Catálogo: `lib/auth/catalogo-permisos.ts`. Seed: `prisma/seed-roles.ts`.
- Autorización: `lib/auth/permisos.ts` (`autorizar` para APIs, `exigirPermiso` para server actions),
  `lib/auth/guard.ts` (`exigirPermisoServidor` para páginas de servidor).
- API: `GET/POST /api/roles`, `GET/PUT/DELETE /api/roles/{id}`; `/api/auth/me` devuelve los permisos.
- UI: `app/roles`, `components/personalized/{PermisosProvider,GuardaRuta,Sidebar}`.
- Tests: `lib/auth/permisos.test.ts`, `lib/services/roles.service.test.ts`, `test/seguridad-permisos.test.ts`.

## 6. Criterios de aceptación

- [x] Crear, editar y eliminar roles desde `/roles`; ADMIN protegido.
- [x] Eliminar un rol con usuarios es rechazado.
- [x] El menú solo muestra las ventanas permitidas y la URL directa muestra "Acceso denegado".
- [x] Las APIs responden 401 sin sesión y 403 sin permiso.
- [x] Ninguna API ni server action nueva puede omitir el control (test de regresión).