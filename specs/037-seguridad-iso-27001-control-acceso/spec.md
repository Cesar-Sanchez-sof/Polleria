# Feature Specification: Arquitectura de Seguridad y Control de Acceso ISO/IEC 27001:2022

**Feature Branch**: `feature/config-mesas-cobro-mozo-e2e`  
**Created**: 2026-10-13  
**Status**: Approved  
**Spec Number**: 037  

---

## 1. Propósito y Alcance

Garantizar la protección perimetral, la autenticación estricta y el control de acceso en toda la plataforma del ERP gastronómico, asegurando que **ningún usuario no autenticado pueda acceder al panel principal, módulos de negocio (Ventas, KDS, Caja, Compras, Contabilidad, Configuración) o endpoints de API**.

Se alinea la arquitectura del sistema al estándar internacional **ISO/IEC 27001:2022** (Sistemas de Gestión de Seguridad de la Información - SGSI) y su código de buenas prácticas **ISO/IEC 27002:2022**, aplicando un modelo de **Defensa en Profundidad (Defense in Depth)** y el principio de **Denegación por Defecto (Deny by Default)** contra las vulnerabilidades de OWASP A01:2021 (Broken Access Control).

---

## 2. Requerimientos y Controles ISO Implementados

### 2.1. Control A.5.15 — Control de Acceso (Access Control)
- **Denegación por Defecto**: Todas las rutas de páginas y APIs están bloqueadas por defecto excepto las expresamente públicas (`/login`, `/api/auth/login`, `/api/auth/recuperar`, `/api/webhooks`).
- **Purga de Credenciales**: Si una petición entrante presenta un token malformado, vencido o revocado, el sistema elimina inmediatamente la cookie en la respuesta de redirección con `Max-Age=0` y `expires` en el pasado.

### 2.2. Control A.8.3 — Restricción de Acceso a la Información (Information Access Restriction)
- **Defensa Multicapa**:
  - **Capa 1 (Perímetro / Edge Proxy)**: `proxy.ts` intercepta la solicitud antes del renderizado y redirige a `/login` (307) para rutas web o devuelve `401 Unauthorized` para rutas API.
  - **Capa 2 (Server Components)**: Los componentes de servidor (`app/page.tsx`, `app/purchases/page.tsx`, `app/accounting/guide/page.tsx`) ejecutan `exigirSesionServidor()`, validando en base de datos el estado activo del usuario antes de consultar o renderizar información de negocio.
  - **Capa 3 (Cliente / Shell Navigation)**: `Sidebar.tsx` verifica activamente la sesión ante `/api/auth/me`. Ante cualquier fallo o falta de sesión, fuerza la redirección inmediata a `/login`, impidiendo permanencia pasiva en la interfaz.

### 2.3. Control A.8.5 — Autenticación Segura (Secure Authentication)
- Tokens JWT firmados criptográficamente mediante algoritmo **HS256** con clave secreta mínima de 256 bits (32 caracteres).
- Almacenamiento seguro en cookies con banderas obligatorias:
  - `httpOnly: true` (inmune a ataques XSS).
  - `sameSite: "lax"` (mitiga CSRF).
  - `secure: true` en entornos de producción.
  - Tiempo de vida limitado a 8 horas con renovación controlada.

### 2.4. Control A.8.20 — Seguridad en Redes y Endurecimiento HTTP (Network Security)
- Inyección automática de cabeceras de endurecimiento en cada respuesta:
  - `X-Frame-Options: DENY` (prevención de Clickjacking).
  - `X-Content-Type-Options: nosniff` (mitigación de MIME type confusion).
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `X-XSS-Protection: 1; mode=block`.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

---

## 3. Archivos Modificados y Creados

- [`proxy.ts`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/proxy.ts): Control de acceso perimetral con inyección de cabeceras de seguridad y purga de cookies inválidas.
- [`lib/auth/guard.ts`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/lib/auth/guard.ts): Guard de servidor (`exigirSesionServidor`) y utilidades de RBAC (`tienePermisoRol`).
- [`app/page.tsx`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/page.tsx): Protección en servidor mediante `exigirSesionServidor()`.
- [`app/purchases/page.tsx`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/purchases/page.tsx): Protección en servidor de dashboard de compras e inventario.
- [`app/accounting/guide/page.tsx`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/accounting/guide/page.tsx): Protección en servidor de guía contable.
- [`components/personalized/Sidebar.tsx`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/components/personalized/Sidebar.tsx): Redirección client-side inmediata a `/login` al detectar 401 o falta de sesión activa.
- [`app/api/auth/logout/route.ts`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/api/auth/logout/route.ts): Cierre de sesión seguro con revocación y purga exhaustiva de cookie.
- [`test/seguridad-control-acceso.test.ts`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/test/seguridad-control-acceso.test.ts): Pruebas automatizadas de integración y seguridad perimetral.
- [`docs/seguridad-iso-27001.md`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/docs/seguridad-iso-27001.md): Documentación técnica exhaustiva del estándar de seguridad ISO/IEC 27001:2022 adoptado.
