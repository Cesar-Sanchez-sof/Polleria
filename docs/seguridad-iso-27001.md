# Arquitectura de Seguridad Basada en el Estándar Internacional ISO/IEC 27001:2022

## 1. ¿Qué Norma ISO se ha Implementado?

Para la seguridad del sistema ERP gastronómico y contable, se ha adoptado e implementado el estándar internacional **ISO/IEC 27001:2022** (*Sistemas de Gestión de Seguridad de la Información — Requisitos*) en conjunto con su guía de controles **ISO/IEC 27002:2022** (*Controles de Seguridad de la Información*).

---

## 2. ¿Por Qué Elegimos la Norma ISO/IEC 27001:2022?

1. **Estándar de Oro Global**: Es la norma de mayor reconocimiento internacional para la gobernanza de la seguridad informática y la protección de datos empresariales.
2. **Protección Integral de la Tríada CID**:
   - **Confidencialidad**: Garantiza que únicamente personal autorizado (mozos, cajeros, administradores) tenga acceso a datos comerciales, ventas, comandas, costos y contabilidad.
   - **Integridad**: Previene alteraciones indebidas de registros de comandas, comprobantes fiscales (boletas/facturas SUNAT) y asientos contables en el libro diario.
   - **Disponibilidad**: Protege los servicios perimetrales evitando caídas por peticiones no autorizadas y optimizando el tiempo de respuesta.
3. **Cumplimiento y Alineación con OWASP Top 10 (A01:2021 — Broken Access Control)**:
   - La vulnerabilidad \#1 reportada en aplicaciones web es el control de acceso roto (cuando un usuario no autenticado puede ver pantallas o ejecutar endpoints). La norma ISO/IEC 27001 obliga a implementar el principio de **Denegación por Defecto (Deny by Default)** y el principio de **Mínimo Privilegio**.
4. **Protección de Datos Financieros y Tributarios**: Al ser un sistema que emite boletas, facturas, libro mayor y asientos contables, el estándar ISO 27001 blinda los balances ante accesos no autorizados.

---

## 3. Matriz de Controles ISO/IEC 27001:2022 Aplicados

| Control ISO 27001:2022 | Nombre del Control | Implementación en la Arquitectura | Archivo / Componente |
| :--- | :--- | :--- | :--- |
| **A.5.15** | **Control de Acceso (Access Control)** | Denegación por defecto en todas las rutas de páginas y APIs. Redirección automática de visitantes no autenticados a `/login`. | [`proxy.ts`](../proxy.ts) |
| **A.8.3** | **Restricción de Acceso a la Información (Information Access Restriction)** | Modelo de Defensa en Profundidad: Verificación de sesión en Proxy perimetral, Guards en Server Components y validación activa en Client Shell. | [`lib/auth/guard.ts`](../lib/auth/guard.ts)<br>[`app/page.tsx`](../app/page.tsx)<br>[`components/personalized/Sidebar.tsx`](../components/personalized/Sidebar.tsx) |
| **A.8.5** | **Autenticación Segura (Secure Authentication)** | Tokens JWT firmados con algoritmo criptográfico **HS256** (clave secreta >= 32 caracteres) almacenados en cookies protegidas (`httpOnly`, `sameSite: "lax"`, `secure`). Purga forzosa de cookies en logout y ante tokens inválidos. | [`lib/auth/session.ts`](../lib/auth/session.ts)<br>[`app/api/auth/logout/route.ts`](../app/api/auth/logout/route.ts) |
| **A.8.20** | **Seguridad en Redes (Network Security)** | Endurecimiento perimetral mediante cabeceras HTTP de respuesta: `X-Frame-Options: DENY` (anti-Clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`. | [`proxy.ts`](../proxy.ts) |
| **A.8.24** | **Uso de Criptografía (Use of Cryptography)** | Hash unidireccional de contraseñas de usuarios mediante **bcrypt** con factor de costo 12 y firmas HMAC-SHA256 para tokens de sesión. | [`lib/auth/password.ts`](../lib/auth/password.ts)<br>[`lib/services/usuarios.service.ts`](../lib/services/usuarios.service.ts) |
| **A.8.26** | **Requisitos de Seguridad en Aplicaciones** | Validación de estado de usuario activo en base de datos (`usuarioActivo`) para evitar que tokens válidos matemáticamente sigan operando si el usuario fue desactivado o eliminado. | [`lib/auth/sesion-actual.ts`](../lib/auth/sesion-actual.ts) |
| **A.8.12** | **Prevención de Fuga de Datos y Auditoría** | Trazabilidad de login, logout, transferencias y movimientos con registro de actor, IP de origen y marca de tiempo. | [`lib/services/audit.service.ts`](../lib/services/audit.service.ts) |

---

## 4. Arquitectura de Defensa en Profundidad (Defense in Depth)

Para garantizar que **nadie pueda acceder a ninguna pantalla sin haber iniciado sesión**, la arquitectura implementa cuatro anillos concéntricos de seguridad:

```
[ Petición del Navegador ]
            │
            ▼
┌────────────────────────────────────────────────────────┐
│  ANILLO 1: Edge Proxy Perimetral (proxy.ts)            │
│  - Valida firma criptográfica JWT de cookie "sesion"   │
│  - Si no hay sesión -> Redirección 307 a /login        │
│  - Si es API sin sesión -> HTTP 401 Unauthorized       │
│  - Purga cookies malformadas o expiradas (Max-Age=0)   │
│  - Inyecta cabeceras HTTP de seguridad (ISO A.8.20)     │
└────────────────────────────────────────────────────────┘
            │  (Pasa solo si el token es válido)
            ▼
┌────────────────────────────────────────────────────────┐
│  ANILLO 2: Server Component Guards (lib/auth/guard.ts)  │
│  - Ejecuta exigirSesionServidor() en el servidor       │
│  - Valida en base de datos que el usuario esté activo  │
│  - Si no existe en BD o fue desactivado -> redirect    │
│  - Impide que se procesen o rendericen datos sensibles │
└────────────────────────────────────────────────────────┘
            │  (Pasa si el usuario existe y está activo)
            ▼
┌────────────────────────────────────────────────────────┐
│  ANILLO 3: Client Shell Guard (Sidebar.tsx)            │
│  - Consulta periódica a /api/auth/me en cliente        │
│  - Ante respuesta 401 o sesión nula -> Redirección     │
│    inmediata: window.location.href = "/login"          │
│  - Previene permanencia en caché cliente o navegador   │
└────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│  ANILLO 4: Capa de Base de Datos y Auditoría           │
│  - Control de acceso RBAC estricto                     │
│  - Registro de auditoría con IP y usuario responsable  │
└────────────────────────────────────────────────────────┘
```

---

## 5. Pruebas Automatizadas de Seguridad

La arquitectura cuenta con una suite completa de pruebas automatizadas en [`test/seguridad-control-acceso.test.ts`](../test/seguridad-control-acceso.test.ts) que verifican:

1. **Denegación de la ruta raíz (`/`)**: Confirma que una solicitud sin autenticación recibe `HTTP 307 Temporary Redirect` apuntando a `/login`.
2. **Presencia de cabeceras de endurecimiento**: Comprueba `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy`.
3. **Denegación de APIs protegidas**: Verifica que `/api/usuarios` y endpoints internos devuelven `HTTP 401` y código `UNAUTHORIZED_ACCESS`.
4. **Acceso legítimo con token**: Confirma que usuarios con JWT válido acceden normalmente.
5. **Redirección de `/login` para usuarios autenticados**: Evita que un usuario logueado vuelva a ver el formulario de login.
6. **Purga de cookies residuales**: Comprueba que un token inválido devuelve `Set-Cookie` con `Max-Age=0` para limpiar el navegador.
7. **Control de acceso por roles (RBAC)**: Valida que los roles operativos respetan sus permisos asignados.
