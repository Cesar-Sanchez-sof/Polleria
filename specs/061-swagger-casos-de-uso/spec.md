# Feature Specification: Documentación Swagger con casos de uso

**Created**: 2026-11-11
**Status**: Implemented
**Spec Number**: 061

---

## 1. Propósito y alcance

La documentación OpenAPI (`/api/openapi`, vista en `/docs/swagger`) estaba incompleta: 27 de los 95 `route.ts`
no tenían `@openapi`, muchos solo traían un resumen, faltaban tags de Recursos Humanos y no se indicaba
**qué permiso** pedía cada endpoint ni **para qué situación real del restaurante** sirve.

Ahora **todas las operaciones** (≈190 combinaciones método + ruta) publican en Swagger:
- **Casos de uso** concretos de una pollería (tomar pedido en mesa, cerrar caja, calcular CTS…).
- **Permiso RBAC requerido**, extraído automáticamente del código del handler.
- Respuestas de error comunes (400, 401, 403, 500) cuando faltan.
- Tag y resumen para los endpoints que no tenían `@openapi`.

## 2. Qué se hizo

| Pieza | Archivo |
|---|---|
| Catálogo de casos de uso (fuente única) | `app/api/openapi/use-cases.ts` |
| Extracción de permisos + enriquecimiento del spec | `app/api/openapi/enrich.ts` |
| Integración al generador | `app/api/openapi/route.ts` |
| Tags nuevos (RR. HH., Caja, Auditoría, SIRE, General…) | `app/api/openapi/swaggerConfig.ts` |
| Pruebas de cobertura | `test/api/openapi-use-cases.test.ts` |

### Cómo funciona
1. `swagger-jsdoc` lee los `@openapi` de cada handler (si existen) y `addDiscoveredPaths` crea una
   operación mínima para los que no tienen.
2. `enrichOperations` recorre todas las operaciones y compone la descripción:
   `descripción propia` + `**Permiso requerido:** \`x.ver\` o \`y.ver\`` + `**Casos de uso:**` (lista).
3. Si la operación no trae `summary` o `tags`, toma el resumen del primer caso de uso y el tag por prefijo de ruta.
4. Agrega las respuestas 400/500 (y 401/403 si el endpoint exige permiso) cuando no estaban declaradas.

Los permisos se leen del código (`permission: "x.ver"`, `authorize("x.ver")`, `requireAuth: true`),
por lo que **no pueden desactualizarse** respecto al RBAC real.

## 3. Cómo documentar un endpoint nuevo
1. Escribe el handler como siempre (con `permission` o `authorize`).
2. Agrega su entrada en `USE_CASES` con la clave `"MÉTODO /api/ruta"` (`{id}` en segmentos dinámicos).
3. Opcional: `@openapi` en el `route.ts` para parámetros, body y esquemas detallados.

Si olvidas el paso 2, `npx vitest run test/api/openapi-use-cases.test.ts` **falla** listando las operaciones sin casos de uso.
También falla si el catálogo conserva entradas de endpoints eliminados.

## 4. Ejemplos de lo que ve el usuario en Swagger

**POST /api/cash-sessions** — *Abrir caja al iniciar el turno con el efectivo inicial (sencillo).*
Permiso requerido: `caja.crear`. Respuestas: 200, 400, 401, 403, 500.

**GET /api/payroll/social-benefits** — Casos de uso: provisionar gratificaciones de julio/diciembre;
conocer el monto de CTS a depositar el 15 de mayo y 15 de noviembre.

## 5. Verificación
- `npx vitest run test/api test/auth test/architecture` → 378 pruebas pasan (5 nuevas de documentación).
- `npx tsc --noEmit` y ESLint sin errores.
- La prueba descarga el spec real (`GET /api/openapi`) y comprueba que **ninguna** operación carece de
  casos de uso ni de tag.

## 6. Limitaciones
- Los esquemas de request/response detallados (body y campos) siguen solo en los endpoints que ya los
  tenían en su `@openapi`; esta historia añade contexto de negocio, permisos y errores, no esquemas nuevos.
- Los casos de uso son texto curado: hay que mantenerlos al cambiar el comportamiento de un endpoint.
