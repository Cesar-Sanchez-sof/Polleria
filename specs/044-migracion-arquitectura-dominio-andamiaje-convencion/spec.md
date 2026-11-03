# Feature Specification: Migración a Arquitectura por Dominio (1/6) - Andamiaje y Convención

**Feature Branch**: `refactor/migracion-arquitectura-dominio`  
**Created**: 2026-10-29  
**Status**: Implemented & Verified  
**Spec Number**: 044  

---

## 1. Propósito y Resumen

Establecer las bases arquitectónicas y la convención formal de capas para el sistema ERP Pollería, iniciando una migración estructurada en 6 fases hacia una **Arquitectura por Dominio**. 

Esta primera fase introduce una convención unidireccional estricta y verificable:
$$\text{Route (HTTP Transporte)} \longrightarrow \text{Service (Reglas de Negocio)} \longrightarrow \text{Prisma (Persistencia PostgreSQL)}$$

Con esta arquitectura se erradica el acoplamiento directo entre la capa de presentación HTTP (`app/api/**`) y la capa de persistencia (`@/lib/prisma`), evitando que endpoints futuros o nuevos desarrolladores salten la capa de servicios. Se implementa:
1. Documentación técnica de la convención de capas en esta especificación oficial.
2. Regla estática de verificación automatizada en ESLint (`no-restricted-imports`) configurada como *warning* sobre `@/lib/prisma` dentro del directorio `app/`.
3. Helper genérico y reutilizable `createApiHandler` en `lib/http/route-handler.ts` que centraliza la autorización basada en roles (RBAC), parseo/validación de esquemas (compatible con funciones y Zod) y mapeo estructurado de excepciones de dominio hacia códigos de respuesta HTTP.
4. Identificación y reporte exhaustivo de los 32 route handlers legados pendientes de refactorización en las fases posteriores.

---

## 2. Escenario y Criterios de Aceptación

### Historia de Usuario
> **Como desarrollador**, quiero una convención de capas verificable, para que el código nuevo no vuelva a saltarse los servicios.

### Criterios de Aceptación

1. **Criterio 1: Documentar la convención de capas**
   - El flujo unidireccional `route (HTTP) → service (reglas) → Prisma` queda formalizado y documentado en la especificación oficial numerada del proyecto (`specs/044-...`), detallando las responsabilidades y restricciones técnicas de cada capa.

2. **Criterio 2: Regla ESLint `no-restricted-imports` sobre `@/lib/prisma`**
   - Configurada en `eslint.config.mjs` afectando a todos los archivos dentro de `app/**/*.{ts,tsx}`.
   - Configurada como `"warn"` para visibilizar progresivamente la deuda técnica sin quebrar despliegues ni la ejecución del pipeline CI (`.github/workflows/ci.yml`).
   - Emite un mensaje descriptivo orientando al desarrollador a utilizar la capa de servicios.

3. **Criterio 3: Helper común para handlers (`createApiHandler`)**
   - Centraliza:
     - **Autorización y Autenticación**: Validación de permisos de usuario (`config.permission`) mediante RBAC (`authorize`) y chequeo de sesión obligatoria (`config.requireAuth`).
     - **Validación de Datos**: Soporte para parseo y validación de payloads `POST`, `PUT` y `PATCH` utilizando tanto funciones de validación como esquemas Zod (objetos con método `.parse()`).
     - **Mapeo de Errores Uniforme**: Jerarquía tipada de excepciones de dominio (`DomainError`, `NotFoundError`, `ConflictError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`) y mapeo automático de violaciones únicas de Prisma (`P2002` $\to$ HTTP 409).
     - **Sanitización de Errores Inesperados**: Registro en log (`console.error`) y retorno de HTTP 500 genérico sin filtrar detalles sensibles a los clientes.

4. **Criterio 4: Definición de Listo (Definition of Done)**
   - La regla ESLint lista con precisión los route handlers legados pendientes de migración.
   - La compilación del proyecto (`npm run build`) finaliza exitosamente con código 0.
   - La suite de pruebas unitarias asociadas a `createApiHandler` se ejecuta y pasa al 100%.

---

## 3. Diseño Técnico y Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CAPA ROUTE (app/api/**/route.ts)                         │
│    • Transporte HTTP (Request / Response)                   │
│    • Invocación mediante createApiHandler                   │
│    • Autenticación y Autorización RBAC                      │
│    • Parseo de Body / Query Params / URL Params             │
│    • 🚫 PROHIBIDO: Importar @/lib/prisma o ejecutar queries  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Invoca función de servicio agnóstica de HTTP
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. CAPA SERVICE (lib/services/** o src/modules/**/services) │
│    • Encapsula las Reglas de Negocio del Restaurante        │
│    • Invariantes de dominio (estados, cálculos, arqueos)    │
│    • Transacciones ACID y Outbox Events                     │
│    • Lanza excepciones de dominio tipadas                   │
│    • 🛡️ ÚNICO LUGAR AUTORIZADO para importar @/lib/prisma   │
│    • 🚫 PROHIBIDO: Objetos HTTP (NextRequest, NextResponse) │
└──────────────────────────────┬──────────────────────────────┘
                               │ Consultas relacionales tipadas
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CAPA PRISMA (@/lib/prisma)                               │
│    • Gestión del cliente Prisma y conexión a PostgreSQL     │
│    • Ejecución de queries optimizadas a la base de datos    │
└─────────────────────────────────────────────────────────────┘
```

### 3.1. Responsabilidades por Capa

#### 3.1.1. Capa `Route` (`app/api/**/route.ts`)
- **Responsabilidad principal**: Transporte y protocolo HTTP.
- **Directrices**:
  - Extraer parámetros tipados de la URL (`params`), query string (`searchParams`) y cuerpo (`body`).
  - Utilizar el helper estándar `createApiHandler()`.
  - Comprobar permisos RBAC vía `permission: "modulo.accion"`.
  - Transformar el resultado del servicio en `NextResponse.json()` con los códigos HTTP adecuados (`200 OK`, `201 Created`, `204 No Content`).
  - **Restricción estricta**: No importar `@/lib/prisma` bajo ninguna circunstancia.

#### 3.1.2. Capa `Service` (`lib/services/**` o `src/modules/**/services`)
- **Responsabilidad principal**: Lógica de Negocio y reglas operativas del restaurante.
- **Directrices**:
  - Validar condiciones previas e invariantes del negocio (ej. mesas ocupadas, stock disponible, turnos de empleados, arqueo de caja previo a cierre).
  - Orquestar transacciones complejas mediante `prisma.$transaction()`.
  - Lanzar errores tipados derivados de `DomainError`.
  - Mantenerse totalmente desacoplada del protocolo HTTP; un servicio debe poder ser consumido idénticamente por un Route Handler, una tarea programada, una prueba unitaria o un script de migración.

#### 3.1.3. Capa `Prisma` (`@/lib/prisma.ts`)
- **Responsabilidad principal**: Persistencia y acceso a datos relacionales.
- **Directrices**:
  - Instancia singleton del cliente de Prisma para evitar agotar el pool de conexiones en PostgreSQL.
  - Consumida exclusivamente por servicios de dominio.

---

### 3.2. Configuración del Linter (`eslint.config.mjs`)

Se encuentra activa la siguiente configuración en la raíz del proyecto:

```javascript
// eslint.config.mjs
{
  files: ["app/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "warn",
      {
        paths: [
          {
            name: "@/lib/prisma",
            message:
              "Convención de capas (route → service → Prisma): No importar '@/lib/prisma' directamente en app/. Debe invocarse a través de la capa de servicios.",
          },
        ],
      },
    ],
  },
}
```

---

### 3.3. Helper Común de Handlers (`lib/http/route-handler.ts`)

Proporciona una interfaz unificada para los route handlers de Next.js App Router:

```typescript
export interface RouteHandlerConfig<TBody = unknown, TParams = Record<string, string | string[]>> {
  permission?: string | string[];
  requireAuth?: boolean;
  schema?: ((raw: unknown) => TBody) | { parse: (raw: unknown) => TBody };
  successStatus?: number;
  handler: (ctx: HandlerContext<TBody, TParams>) => Promise<unknown>;
}
```

#### Jerarquía de Excepciones Mapeadas

| Excepción | Código HTTP | Caso de Uso Típico |
| :--- | :---: | :--- |
| `ValidationError` | **400 Bad Request** | Body malformado o violación de formato de entrada |
| `UnauthorizedError` | **401 Unauthorized** | Petición sin token de sesión activo |
| `ForbiddenError` | **403 Forbidden** | Usuario no posee el permiso RBAC requerido |
| `NotFoundError` | **404 Not Found** | Pedido, mesa, producto o entidad inexistente |
| `ConflictError` | **409 Conflict** | Transición de estado inválida (ej. pedido ya cobrado) |
| Prisma `P2002` | **409 Conflict** | Clave única o constraint duplicada en PostgreSQL |
| `Error` no controlado | **500 Internal Server Error** | Fallo imprevisto, sanitizado en el payload de respuesta |

---

## 4. Estado de la Deuda Técnica: Handlers Pendientes de Migración

La regla ESLint detecta con precisión los **32 route handlers** que actualmente contienen importaciones directas de `@/lib/prisma` y que serán abordados progresivamente en las fases 2 a 6:

| # | Archivo de Ruta | Módulo / Dominio |
| :---: | :--- | :--- |
| 1 | `app/api/accounting-periods/route.ts` | Contabilidad (Periodos) |
| 2 | `app/api/accounting/dashboard/route.ts` | Contabilidad (Dashboard) |
| 3 | `app/api/accounts/[id]/route.ts` | Contabilidad (Plan Contable) |
| 4 | `app/api/accounts/route.ts` | Contabilidad (Plan Contable) |
| 5 | `app/api/balance-sheet/route.ts` | Reportes Contables |
| 6 | `app/api/cash-flow-statement/route.ts` | Reportes Contables |
| 7 | `app/api/cash-sessions/[id]/close/route.ts` | Caja y Turnos |
| 8 | `app/api/cash-sessions/movements/route.ts` | Caja y Turnos |
| 9 | `app/api/cash-sessions/route.ts` | Caja y Turnos |
| 10 | `app/api/customers/route.ts` | Clientes |
| 11 | `app/api/daily-book/route.ts` | Reportes Contables |
| 12 | `app/api/executive-summary/route.ts` | Reportes Ejecutivos |
| 13 | `app/api/general-ledger/route.ts` | Reportes Contables |
| 14 | `app/api/journal-entries/[id]/route.ts` | Contabilidad (Asientos) |
| 15 | `app/api/journal-entries/accounts/route.ts` | Contabilidad (Asientos) |
| 16 | `app/api/journal-entries/options/route.ts` | Contabilidad (Asientos) |
| 17 | `app/api/journal-entries/route.ts` | Contabilidad (Asientos) |
| 18 | `app/api/orders/[id]/route.ts` | Salón y Pedidos |
| 19 | `app/api/orders/drinks/route.ts` | Salón y Pedidos |
| 20 | `app/api/orders/route.ts` | Salón y Pedidos |
| 21 | `app/api/payment-methods/route.ts` | Configuración Pagos |
| 22 | `app/api/payments/mercadopago/preference/route.ts` | Pasarela Mercado Pago |
| 23 | `app/api/payments/mercadopago/status/route.ts` | Pasarela Mercado Pago |
| 24 | `app/api/payments/mercadopago/yape/route.ts` | Pagos Yape |
| 25 | `app/api/products/[id]/route.ts` | Productos y Menú |
| 26 | `app/api/products/route.ts` | Productos y Menú |
| 27 | `app/api/sales/route.ts` | Ventas y Facturación |
| 28 | `app/api/sales/voucher/[id]/route.ts` | Ventas y Facturación |
| 29 | `app/api/settings/areas/route.ts` | Salones y Áreas |
| 30 | `app/api/tables/[id]/route.ts` | Mesas |
| 31 | `app/api/tables/route.ts` | Mesas |
| 32 | `app/api/trial-balance/route.ts` | Reportes Contables |

---

## 5. Verificación y Resultados de Pruebas

1. **Pruebas Unitarias del Helper (`test/route-handler.test.ts`)**:
   - 12 pruebas automatizadas con Vitest cubriendo respuestas 200, 201 en POST, rechazo 403 por falta de permiso, inyección de sesión activa, autenticación requerida 401, mapeo de `NotFoundError` (404), `ConflictError` (409), esquemas de validación con funciones y con Zod (400), conflicto `P2002` (409), `ForbiddenError` (403), `ValidationError` (400) y captura sanitizada de errores internos (500).
   - Estado: **12/12 passing**.
2. **Cumplimiento de Estilo y Tipado (`npx eslint test/route-handler.test.ts`)**:
   - 0 errores, 0 warnings.
3. **Compilación de Producción (`npm run build`)**:
   - Generación de cliente Prisma v6.12.0 exitosa.
   - Compilación con Next.js 16.4.3 exitosa (todas las 53 rutas estáticas y dinámicas compiladas con éxito, código de salida 0).
