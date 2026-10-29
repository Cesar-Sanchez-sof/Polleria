# 🏛️ Convención de Capas Arquitectónicas: Route (HTTP) → Service (Reglas) → Prisma

> **Pollería ERP — Guía de Arquitectura por Dominios (Fase 1/6)**  
> **Objetivo:** Garantizar la separación estricta de responsabilidades, la verificabilidad mediante ESLint y la resiliencia en la evolución del sistema.

---

## 1. Principio Fundamental: Flujo Unidireccional Estricto

En toda la aplicación, el flujo de ejecución debe seguir obligatoriamente un camino unidireccional y predecible:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CAPA ROUTE (app/api/**/route.ts)                         │
│    Transporte HTTP · Autorización · Parseo y Validación     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Invoca función de servicio
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. CAPA SERVICE (lib/services/** o src/modules/**/services) │
│    Lógica de Negocio · Invariantes · Transacciones y Outbox │
└──────────────────────────────┬──────────────────────────────┘
                               │ Operaciones de base de datos
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CAPA PRISMA (@/lib/prisma)                               │
│    Persistencia Relacional PostgreSQL (Acceso a Datos)      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Responsabilidades por Capa

### 2.1 Capa `Route` (`app/api/**/route.ts` o componentes de página)
La capa de rutas es **exclusiva de transporte y entrega HTTP**.

* **Responsabilidades:**
  - Leer parámetros de URL (`params`), query strings (`searchParams`) y cuerpo (`body`).
  - Utilizar el helper común `createApiHandler()` para control unificado.
  - Verificar permisos de usuario (RBAC) mediante `authorize("modulo.accion")`.
  - Validar tipos y estructura de datos de entrada.
  - Invocar la función de servicio adecuada.
  - Devolver la respuesta HTTP con el código de estado correspondiente (`200 OK`, `201 Created`, `204 No Content`).
* **Reglas y Restricciones:**
  - 🚫 **ESTRICTAMENTE PROHIBIDO:** Importar `@/lib/prisma` o instanciar PrismaClient.
  - 🚫 **PROHIBIDO:** Ejecutar consultas directas `findMany`, `create`, `update`, etc.
  - 🚫 **PROHIBIDO:** Realizar transacciones de base de datos (`prisma.$transaction`) dentro del route.

---

### 2.2 Capa `Service` (`lib/services/**` o `src/modules/*/services/**`)
La capa de servicios encapsula el **núcleo de las reglas de negocio del restaurante**.

* **Responsabilidades:**
  - Validar reglas e invariantes de negocio (ej. "No cobrar un pedido cancelado", "Monto entregado no puede ser menor al total", "Arqueo de caja obligatorio").
  - Coordinar transacciones de base de datos (`prisma.$transaction`).
  - Gestionar la persistencia atómica en la tabla `outbox_events` para eventos de dominio.
  - Lanzar errores tipados de dominio (`DomainError`, `NotFoundError`, `ConflictError`, `ValidationError`).
* **Reglas y Restricciones:**
  - 🛡️ **ÚNICO LUGAR AUTORIZADO** para importar `@/lib/prisma`.
  - 🚫 **PROHIBIDO:** Manejar objetos específicos de HTTP como `NextRequest`, `NextResponse`, cookies o cabeceras dentro del servicio. Un servicio debe ser agnóstico del transporte (puede ser invocado por un HTTP Route, un Cron Job, un Worker de consola o una prueba unitaria).

---

### 2.3 Capa `Prisma` (`@/lib/prisma.ts`)
La capa de persistencia administra el ciclo de vida de la conexión con PostgreSQL.

* **Responsabilidades:**
  - Conexión con PostgreSQL mediante el cliente tipado de Prisma.
  - Ejecutar consultas ACID generadas por los servicios.

---

## 3. Verificación Automática con ESLint

Para evitar regresiones y asegurar que ningún desarrollador vuelva a importar Prisma en la capa de rutas, se encuentra activa la regla en `eslint.config.mjs`:

```javascript
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

> **Nota:** La regla está configurada como `"warn"` para permitir la migración progresiva de los 32 handlers existentes sin bloquear los builds de CI/CD.

---

## 4. Uso del Helper Común `createApiHandler`

Todo endpoint nuevo debe estructurarse utilizando el helper estándar ubicado en `@/lib/http/route-handler`:

```typescript
// app/api/dining/tables/route.ts
import { createApiHandler } from "@/lib/http/route-handler";
import { getDiningTablesService } from "@/lib/services/tables.service";

export const dynamic = "force-dynamic";

export const GET = createApiHandler({
  permission: "mesas.ver",
  handler: async ({ searchParams }) => {
    const areaId = searchParams.get("areaId") ? Number(searchParams.get("areaId")) : undefined;
    return await getDiningTablesService(areaId);
  },
});
```
  