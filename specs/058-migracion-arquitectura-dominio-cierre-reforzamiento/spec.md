# Especificación Técnica: Migración a Arquitectura por Dominio (6/6) - Cierre y Reforzamiento

**Feature Branch**: `refactor/arquitectura-dominio-cierre-reforzamiento`  
**Base Branch**: `develop`  
**Created**: 2026-11-08  
**Status**: Implemented & Verified  
**Spec Number**: 058  
**Esfuerzo Estimado**: 0.5–1 día (8 horas ingeniería)  

---

## 1. Propósito y Resumen Ejecutivo

Esta especificación consolida la **sexta y última etapa del ciclo de migración hacia una Arquitectura por Dominio en 3 Capas** en el backend del ERP Pollería:
$$\text{Capa Presentación (app/api/**, Server Actions)} \longrightarrow \text{Capa Dominio (lib/services/**)} \longrightarrow \text{Capa Persistencia (@/lib/prisma)}$$

El objetivo primordial de esta etapa es la **institucionalización y reforzamiento obligatorio** de las reglas de diseño para evitar la degradación arquitectónica (*architectural drift*). Ningún desarrollador humano ni agente de inteligencia artificial (Antigravity, Cursor, GitHub Copilot) podrá eludir la capa de servicios ni introducir acoplamiento directo entre las rutas HTTP y la base de datos PostgreSQL.

Para ello se establecen tres mecanismos de control inmutable:
1. **Enforcement Automatizado en ESLint**: Elevación de la regla estática `no-restricted-imports` de `warn` a `error` sobre el cliente `@/lib/prisma` en la capa `app/`.
2. **Gobernanza para Asistentes y Agentes de IA (`AGENTS.md`)**: Inclusión de reglas explícitas de diseño, plantillas de referencia para endpoints/servicios y convenciones de control de acceso RBAC.
3. **Consolidación de la Documentación del Sistema (`README.md`)**: Publicación del diagrama oficial de arquitectura, resumen de las 6 etapas completadas y catálogo de responsabilidades por capa.
4. **Suite de Verificación Arquitectónica Automatizada (`test/architecture/layer-enforcement.test.ts`)**: Pruebas continuas en Vitest que aseguran la inviolabilidad del flujo de capas en el pipeline de Integración Continua (CI).

---

## 2. Historia de Usuario y Criterios de Aceptación

### Historia de Usuario
> **Como equipo de ingeniería y docente evaluador**, quiero que la regla de capas sea obligatoria y esté reforzada por herramientas automáticas, para que la arquitectura no se degrade con el tiempo ni con nuevos requerimientos.

### Criterios de Aceptación

| ID | Criterio de Aceptación | Estado | Evidencia / Implementación |
| :---: | :--- | :---: | :--- |
| **CA-01** | Subir la regla de ESLint de *warning* a *error* para `@/lib/prisma` en `app/`. | **CUMPLIDO** | `eslint.config.mjs` con regla `"error"`. Falla la compilación/linting si se detecta importación directa en rutas migradas o nuevas. |
| **CA-02** | Actualizar `AGENTS.md` con las reglas de arquitectura por dominio y convenciones de capas. | **CUMPLIDO** | Documento `AGENTS.md` preserva el bloque del motor de Next.js y estipula directrices no negociables para agentes de IA. |
| **CA-03** | Actualizar `README.md` con la convención, diagrama de arquitectura y estado final de las 6 fases. | **CUMPLIDO** | `README.md` actualizado con flujo unidireccional, badges de calidad, stack técnico y reglas de gobernanza. |
| **CA-04** | Suite de pruebas de arquitectura automatizada sin regresiones. | **CUMPLIDO** | `test/architecture/layer-enforcement.test.ts` con 13/13 pruebas aprobadas. Suite global: 1,094+ pruebas pasando. |

---

## 3. Matriz Consolidada del Ciclo de Migración (6/6 Fases)

El programa integral de refactorización hacia arquitectura por dominio se ejecutó en 6 fases sucesivas y controladas:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   CICLO DE MIGRACIÓN ARQUITECTÓNICA (ERP POLLERÍA)                     │
├─────────┬───────────────────────────┬─────────────┬────────────────────────────────────┤
│ Fase    │ Dominio / Alcance         │ Spec Oficial│ Logro Arquitectónico Clave         │
├─────────┼───────────────────────────┼─────────────┼────────────────────────────────────┤
│ (1/6)   │ Andamiaje y Convención    │ Spec 044    │ createApiHandler, DomainError, warn│
│ (2/6)   │ Ajustes y Mesas (Piloto)  │ Spec 045    │ settings, tables, payment-methods  │
│ (3/6)   │ Seguridad y Auditoría     │ Spec 047    │ users, roles, audit, RBAC          │
│ (4/6)   │ Compras e Inventario      │ Spec 049    │ products, suppliers, kardex, stock │
│ (5/6)   │ Ventas, Caja y Pagos      │ Spec 057    │ 14 handlers, Mercado Pago, Yape,   │
│         │                           │             │ characterization tests (23/23)     │
│ (6/6)   │ Cierre y Reforzamiento    │ Spec 058    │ ESLint en error, AGENTS.md, README │
└─────────┴───────────────────────────┴─────────────┴────────────────────────────────────┘
```

---

## 4. Diseño Técnico del Reforzamiento

### 4.1. Configuración de ESLint (`eslint.config.mjs`)
La regla estática `no-restricted-imports` se encuentra activada en nivel `"error"` para la raíz `app/**/*.{ts,tsx}`:

```javascript
// eslint.config.mjs
{
  files: ["app/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
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

Cualquier nuevo endpoint o modificación que intente saltar la capa de servicios genera un error de compilación inmediato:
```plaintext
error  '@/lib/prisma' import is restricted from being used. Convención de capas (route → service → Prisma): No importar '@/lib/prisma' directamente en app/. Debe invocarse a través de la capa de servicios  no-restricted-imports
✖ 1 problem (1 error, 0 warnings)
```

### 4.2. Directrices para Agentes Inteligentes (`AGENTS.md`)
Se estandarizan cinco reglas estrictas para inteligencias artificiales en el repositorio:
1. **Aislamiento de Prisma**: Prohibición de `@/lib/prisma` fuera de `lib/services/`.
2. **Contratos HTTP con `createApiHandler`**: Todo handler debe declarar RBAC (`permission: "modulo.accion"`).
3. **Servicios Agnósticos**: Funciones de servicio sin dependencias de `NextRequest` ni `NextResponse`.
4. **Excepciones Tipadas de Dominio**: Lanzamiento de `ValidationError` (400), `NotFoundError` (404), `ConflictError` (409).
5. **Pruebas Automatizadas**: Toda nueva lógica debe acompañarse de tests en `test/services/` o `test/api/`.

### 4.3. Suite Automatizada de Verificación (`test/architecture/layer-enforcement.test.ts`)
Para garantizar que la regla no sea desactivada accidentalmente en el futuro, se crearon pruebas automatizadas que verifican:
- Que `eslint.config.mjs` contenga la regla en `"error"`.
- Que `AGENTS.md` y `README.md` documenten la convención.
- Que el escaneo estático de los 10 dominios migrados (`orders`, `sales`, `cash-sessions`, `customers`, `payments`, `tables`, `settings`, `products`, `webhooks`, `realtime`) mantenga **0 importaciones de Prisma**.

---

## 5. Justificación Académica y Criterios ISO/IEC 25010

Esta etapa sustenta técnicamente la calidad del software ante el docente evaluador bajo el estándar internacional **ISO/IEC 25010**:

1. **Mantenibilidad (Maintainability - Subcaracterísticas: Modularidad y Reusabilidad)**:
   - Al prohibir el acceso directo a la base de datos desde los controladores HTTP, el código se desacopla. Si la estructura de la base de datos cambia (migraciones en PostgreSQL), solo se actualiza el servicio correspondiente (`lib/services/`), sin tocar las rutas de la API ni la interfaz de usuario.
2. **Capacidad de Prueba (Testability)**:
   - Los servicios de dominio pueden ser probados de forma 100% aislada en milisegundos mediante mocks de Vitest sin necesidad de levantar un servidor HTTP, configurar cookies de sesión ni mockear objetos `Request` / `Response`.
3. **Seguridad y Control de Acceso (Security - Subcaracterística: Confidencialidad e Integridad)**:
   - El uso sistemático de `createApiHandler` garantiza que ningún endpoint quede expuesto sin control de permisos RBAC ni validación de esquema, previniendo inyecciones de datos no saneados.
4. **Fiabilidad y Concurrencia (Reliability - Subcaracterística: Tolerancia a Fallos)**:
   - Las transacciones ACID (`prisma.$transaction`) se mantienen encapsuladas dentro de la capa de servicios, evitando inconsistencias en pagos, arqueos de caja o despacho de pedidos en momentos de alta concurrencia en el restaurante.

---

## 6. Resultados de Verificación y Calidad

| Suite de Pruebas | Archivos Evaluados | Tests Ejecutados | Resultado |
| :--- | :---: | :---: | :---: |
| **Pruebas de Arquitectura** (`test/architecture/`) | 1 | 13 | **13/13 Passed (100%)** |
| **Pruebas de Caracterización** (`test/characterization/`) | 3 | 23 | **23/23 Passed (100%)** |
| **Pruebas de Permisos RBAC** (`test/auth/security-permissions.test.ts`) | 1 | 109 | **109/109 Passed (100%)** |
| **Suite Global de Pruebas Vitest** | 79 | 1,094 | **1,094/1,094 Passed (100%)** |
| **Verificación de Tipos TypeScript** | Global | Todo el proyecto | **0 errores en servicios y handlers** |
| **Enforcement ESLint en Rutas Migradas** | 14 handlers | 14 archivos | **0 errores, 0 warnings** |
