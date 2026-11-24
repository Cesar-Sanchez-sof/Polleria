# Feature Specification: Manual de Usuario y Manual de Despliegue en Documentación

**Created**: 2026-11-24
**Status**: Implemented
**Spec Number**: 066

---

## 1. Propósito y alcance

El apartado **DOCUMENTACIÓN** del menú lateral (`app/docs/`) contaba con vistas técnicas (`Endpoints`, `Diagrama DB`, `Arquitectura` y `Guía de Estilos`), pero carecía de:
1. Un **Manual de Usuario** operativo integrado dentro del sistema (`/docs/user-manual`) accesible para **todos los roles** y filtrado dinámicamente según los permisos reales de cada usuario.
2. Un **Manual de Despliegue e Infraestructura** (`/docs/deployment`) con las variables de entorno, comandos de base de datos, servicios cloud (Vercel, Neon, S3, Upstash, Render `agents-service`), pipeline CI/CD y diagnóstico de fallas.

---

## 2. Qué se hizo

| Pieza | Archivo |
|---|---|
| Catálogo RBAC (`manual.ver` y `despliegue.ver`) | `lib/auth/permissions-catalog.ts` |
| Reglas de enlaces y rutas protegidas | `lib/auth/route-permissions.ts` |
| Asignación de `manual.ver` a todos los roles base y existentes | `prisma/seed-roles.ts` |
| Enlaces en el grupo `DOCUMENTACIÓN` | `components/personalized/Sidebar.tsx` |
| Contenido estructurado y filtrado por permisos del Manual de Usuario | `app/docs/user-manual/manual-data.ts` |
| Vista interactiva del Manual de Usuario | `app/docs/user-manual/page.tsx` |
| Datos de topología, variables `.env`, comandos y troubleshooting | `app/docs/deployment/deployment-data.ts` |
| Vista interactiva del Manual de Despliegue | `app/docs/deployment/page.tsx` |
| Barra de impresión/PDF exclusiva para Admin y estilos A4 | `components/docs/ManualPrintToolbar.tsx`, `app/globals.css` |
| Pruebas de regresión RBAC e integridad documental | `test/architecture/manuals-doc.test.ts` |

---

## 3. Modelo de Acceso y Filtrado por Permisos

### 3.1 Acceso a las pantallas
- **`/docs/user-manual`** exige `manual.ver` (hijo de `documentacion`).
  - Todos los roles base en `prisma/seed-roles.ts` (`CAJERO`, `MESERO`, `COCINERO`, `CONTADOR`, `RRHH`, además de `ADMIN`) incluyen `manual.ver`.
  - Cuando `manual.ver` se incorpora por primera vez en una base de datos existente (`!known.has("manual.ver")`), `seedRolesPermissions` lo asigna automáticamente a todos los roles existentes.
- **`/docs/deployment`** exige `despliegue.ver` (hijo de `documentacion`), reservado por defecto para administradores y personal técnico autorizado.

### 3.2 Contenido dinámico en `/docs/user-manual`
La función pura `filterManualSections()` filtra `USER_MANUAL_SECTIONS` de la siguiente forma:
1. Las secciones generales con `requiredPermissions: []` (como **Acceso al Sistema, Asistencia y Autoservicio** `/hr/me`) son visibles para **cualquier usuario autenticado**.
2. Cada módulo operativo (Salón/Mesas, Cocina KDS, Caja/SUNAT, Compras/Inventario, Contabilidad/PLE/SIRE, RRHH/Planilla, Tableros/IA, Seguridad/Configuración) se muestra únicamente si el usuario posee al menos uno de sus `requiredPermissions` (o si es `superuser`).
3. Cada paso dentro de una sección indica su `actionPermission` (ej. `pedidos.crear`, `caja.editar`), diferenciando visualmente entre acciones habilitadas para el usuario y pasos de referencia en modo solo lectura.
4. Los usuarios con rol `ADMIN` (`superuser`) disponen de un selector de **Previsualización por Rol** (`MESERO`, `CAJERO`, `COCINERO`, `CONTADOR`, `RRHH`) para verificar qué instructivo visualiza cada perfil.

### 3.3 Impresión / Exportación a PDF (solo Admin) e Índice Estático
- El botón **Imprimir / PDF** (`ManualPrintButton`) se renderiza únicamente cuando `superuser === true` en ambas vistas (`/docs/user-manual` y `/docs/deployment`).
- `ManualPrintPageStyle` y las reglas `.manual-doc-print` en `app/globals.css` anulan temporalmente el perfil global de ticketera térmica de `80mm` para exportar en **A4 vertical**, ocultando el menú lateral (`md:pl-64`) y widgets flotantes, mostrando `ManualPrintHeader` con fecha de emisión y evitando cortes de bloque (`break-inside: avoid`).
- En `/docs/user-manual` (escritorio `lg+`), el índice lateral izquierdo permanece estático mientras el panel de contenido derecho se desplaza de forma independiente con resaltado automático de la sección activa.

---

## 4. Cumplimiento de Arquitectura (AGENTS.md)
- **Aislamiento de Prisma**: Ningún archivo en `app/docs/user-manual/` ni `app/docs/deployment/` importa `@/lib/prisma`.
- **Catálogo único de permisos**: Todos los códigos usados en `manual-data.ts` y `route-permissions.ts` pertenecen a `VALID_CODES` de `lib/auth/permissions-catalog.ts` y cumplen el patrón `^[a-z]+\.(ver|crear|editar|eliminar)$`.
- **Testing centralizado**: Todas las pruebas residen en `test/architecture/manuals-doc.test.ts`.

---

## 5. Verificación
- `npx vitest run test/architecture test/auth`
- `npm run lint`
- `npm run build`
- Para aplicar los nuevos permisos en base de datos local/remota: `npm run db:seed`.
