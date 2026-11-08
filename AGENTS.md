<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Reglas de Arquitectura por Dominio (Domain-Driven Layering)

Este repositorio implementa una **Arquitectura por Dominio en 3 Capas Unidireccionales**. Cualquier agente de IA (Antigravity, Cursor, Copilot) o desarrollador que modifique este código **DEBE** respetar taxativamente las siguientes directrices arquitectónicas:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CAPA DE TRANSPORTE HTTP (app/api/**/route.ts)             │
│    • Invocación obligatoria mediante createApiHandler       │
│    • Autenticación y Autorización RBAC (permission / auth)  │
│    • Parseo de Body / Query Params / URL Params             │
│    • 🚫 PROHIBIDO: Importar @/lib/prisma (Error en Linter)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Invoca función de servicio pura
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. CAPA DE SERVICIOS DE DOMINIO (lib/services/**)           │
│    • Reglas de negocio del restaurante, cálculos y estados  │
│    • Transacciones ACID con prisma.$transaction             │
│    • Lanzamiento de excepciones tipadas (DomainError)       │
│    • 🛡️ ÚNICO LUGAR AUTORIZADO para importar @/lib/prisma   │
│    • 🚫 PROHIBIDO: Dependencias HTTP (NextRequest/Response) │
└──────────────────────────────┬──────────────────────────────┘
                               │ Consultas relacionales tipadas
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CAPA DE PERSISTENCIA & EXTERNOS (@/lib/prisma)           │
│    • Cliente Prisma Singleton y PostgreSQL / Neon           │
│    • Integraciones: SUNAT UBL 2.1, AWS S3, Mercado Pago     │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Convenciones y Prohibiciones Estrictas

### Regla 1: Aislamiento Total de Prisma en Presentación
- **Queda estrictamente prohibido importar `@/lib/prisma` o cualquier cliente de base de datos en `app/**/*.{ts,tsx}`**.
- Esta regla está reforzada a nivel de linter con `"error"` en `eslint.config.mjs` (`no-restricted-imports`). Un pull request que viole esta regla romperá el pipeline de CI.

### Regla 2: Route Handlers con `createApiHandler`
- Todos los route handlers en `app/api/**/route.ts` deben usar el helper centralizado `createApiHandler` de `@/lib/http/route-handler`.
- Cada handler debe especificar su permiso granular RBAC (`permission: "modulo.accion"`) o `requireAuth: true`.
- Los parámetros del body se validan con funciones tipadas o schemas Zod.

### Regla 3: Servicios Agnósticos de Transporte
- Las funciones dentro de `lib/services/**` no deben aceptar `NextRequest`, `NextResponse` ni ninguna cabecera HTTP como parámetros.
- Deben recibir tipos planos (`string`, `number`, `object`) y devolver objetos tipados o promesas de TypeScript.
- Esto garantiza que las reglas de negocio puedan ser reutilizadas indistintamente por Route Handlers, Server Actions, comandos CLI, tareas en segundo plano o tests unitarios sin simular servidores web.

### Regla 4: Jerarquía de Errores Tipados
- Los servicios no retornan objetos con códigos de error HTTP. En su lugar, lanzan excepciones derivadas de `DomainError` (`@/lib/http/errors`):
  - `ValidationError`: Error 400 (Parámetros inválidos o formato no conforme).
  - `UnauthorizedError`: Error 401 (Sesión no encontrada o expirada).
  - `ForbiddenError`: Error 403 (Permiso insuficiente).
  - `NotFoundError`: Error 404 (Entidad inexistente).
  - `ConflictError`: Error 409 (Conflicto de estado de negocio o clave duplicada P2002).
- `createApiHandler` captura automáticamente estas excepciones y las transforma en respuestas HTTP consistentes.

### Regla 5: Testing y Regresión
- Todas las pruebas deben residir en el directorio `test/` (siguiendo las subcarpetas temáticas: `test/services/`, `test/api/`, `test/characterization/`, etc.).
- Ninguna prueba debe ubicarse dentro de `app/` ni `lib/`.
- Ante refactorizaciones de handlers existentes, primero deben crearse pruebas de caracterización para congelar los contratos de API y asegurar cero regresiones.

---

## 2. Plantilla de Referencia para Nuevos Endpoints

### Route Handler (`app/api/mi-dominio/route.ts`)
```typescript
import { NextResponse } from "next/server";
import { createApiHandler, ValidationError } from "@/lib/http/route-handler";
import { crearElementoService, listarElementosService } from "@/lib/services/mi-dominio.service";

export const dynamic = "force-dynamic";

export const GET = createApiHandler({
  permission: "mi_modulo.ver",
  handler: async ({ searchParams }) => {
    const estado = searchParams.get("estado") || undefined;
    const data = await listarElementosService({ estado });
    return NextResponse.json({ success: true, data });
  },
});

export const POST = createApiHandler({
  permission: "mi_modulo.crear",
  handler: async ({ body, req }) => {
    const raw = body !== undefined ? body : await req.json().catch(() => null);
    if (!raw?.nombre) {
      throw new ValidationError("El campo 'nombre' es obligatorio.");
    }
    const nuevo = await crearElementoService(raw);
    return NextResponse.json({ success: true, data: nuevo }, { status: 201 });
  },
});
```

### Domain Service (`lib/services/mi-dominio.service.ts`)
```typescript
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/http/errors";

export async function listarElementosService(filtros: { estado?: string }) {
  return prisma.miEntidad.findMany({
    where: filtros.estado ? { estado: filtros.estado } : undefined,
    orderBy: { id: "desc" },
  });
}

export async function crearElementoService(data: { nombre: string }) {
  if (data.nombre.trim().length === 0) {
    throw new ValidationError("El nombre no puede estar vacío.");
  }
  return prisma.miEntidad.create({
    data: { nombre: data.nombre.trim() },
  });
}
```
