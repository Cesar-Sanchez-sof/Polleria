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

---

## 6. Control de Acceso por Roles y Permisos (RBAC) — Spec 038

Complementa la autenticación (secciones 3 y 4) con **autorización**: ISO/IEC 27001:2022 A.5.15
(control de acceso), A.5.18 (derechos de acceso), A.5.3 (segregación de funciones) y A.8.2
(derechos de acceso privilegiados). Principio aplicado: **mínimo privilegio y denegación por defecto**.

### 6.1 Modelo

- Cada usuario tiene **un rol**; cada rol tiene un conjunto de **permisos** `modulo.accion`.
- `ver` abre la ventana; `crear`, `editar` y `eliminar` (incluye anular) habilitan acciones.
- El rol `ADMIN` es de sistema (todos los permisos, no se puede renombrar, desactivar ni eliminar).
- Los permisos se consultan en la BD en cada petición (no viajan en el token): revocar un permiso
  o desactivar un rol surte efecto de inmediato.

### 6.2 Capas de aplicación

| Capa | Mecanismo | Archivo |
|---|---|---|
| Menú | Los enlaces sin permiso `ver` no se muestran | `components/personalized/Sidebar.tsx` |
| Pantallas | "Acceso denegado" si el rol no incluye la ventana | `components/personalized/GuardaRuta.tsx` |
| Páginas de servidor | `exigirPermisoServidor` antes de leer datos | `lib/auth/guard.ts` |
| APIs | `autorizar(permiso)` → 401 sin sesión, 403 sin permiso | `lib/auth/permisos.ts` |
| Server actions de compras | `exigirPermiso(permiso)` | `lib/services/purchases/*` |

Las capas de menú y pantalla son comodidad de uso; **el control real está en las APIs y acciones**.

### 6.3 Matriz de accesos de los roles base

V = ver (ventana) · C = crear · E = editar · X = eliminar/anular · – = sin acceso

| Módulo / ventana | ADMIN | CAJERO | MESERO | COCINERO | CONTADOR |
|---|:-:|:-:|:-:|:-:|:-:|
| Ventas y comprobantes | VCEX | VC | – | – | V |
| Caja (apertura, cierre, movimientos) | VCE | VCE | – | – | – |
| Clientes | VCE | VCE | V | – | – |
| Pedidos de mesa | VCEX | V | VCE | V | – |
| Cocina | VE | – | – | VE | – |
| Platos y recetas | VCEX | – | V | V | – |
| Mesas | VCEX | V | VE | – | – |
| Configuración del restaurante | VE | – | – | – | – |
| Compras | VCEX | – | – | – | V |
| Proveedores | VCEX | – | – | – | V |
| Inventario | VCE | – | – | V | V |
| Transformación de insumos | VCX | – | – | VC | – |
| Asientos contables | VCE | – | – | – | VCE |
| Plan de cuentas | VCE | – | – | – | VCE |
| Periodos contables | VCE | – | – | – | VCE |
| Reportes contables | V | – | – | – | V |
| Usuarios | VCE | – | – | – | – |
| Roles y permisos | VCEX | – | – | – | – |
| Auditoría | V | – | – | – | V |
| Documentación técnica | V | – | – | – | – |

**Segregación de funciones (A.5.3):** quien toma pedidos (MESERO) no cobra; quien cobra y maneja caja
(CAJERO) no registra asientos; quien registra asientos (CONTADOR) no mueve caja ni administra usuarios.

### 6.4 Controles contra escalada de privilegios

- Solo un administrador puede asignar un rol de sistema o modificar a un administrador.
- Un rol con usuarios no se elimina ni se desactiva; un rol desactivado no permite iniciar sesión.
- `roles.*` equivale a poder concederse cualquier permiso: debe reservarse al administrador.
- Toda alta, cambio o baja de rol y de usuario queda en `audit_log` (módulo `Seguridad`/`Usuarios`)
  con actor, IP y valores antes/después (A.8.15).

### 6.5 Excepciones documentadas (sin permiso por rol)

`/api/auth/login`, `/api/auth/logout` (públicos por diseño), `/api/webhooks/mercadopago` (firma HMAC),
`/api/openapi` (especificación; exige sesión), `/api/realtime` (eventos) y `/api/payment-methods`
(catálogo de solo lectura). El test `test/seguridad-permisos.test.ts` falla si se agrega una API
o server action de compras sin control de acceso y no está en esta lista.