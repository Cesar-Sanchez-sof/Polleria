# Especificación Técnica 065: Medición de Calidad de Software y Seguridad ISO/IEC 25023

**Estado:** Implementado / Verificado  
**Fecha:** 2026-11-14  
**Rama Git:** `fix/iso-25023-estabilizacion`  
**Estándar de Referencia:** ISO/IEC 25023:2016 (SQuaRE - Measurement of system and software product quality)  
**Spec Number:** 065  

---

## 1. Propósito y Alcance

Establecer la línea base formal de medición cuantitativa y aseguramiento de calidad del ERP gastronómico **Pollería**, aplicando el estándar internacional **ISO/IEC 25023:2016** derivado del modelo de calidad de producto **ISO/IEC 25010**.

Esta especificación cubre:
1. La estabilización técnica integral de la plataforma (resolución de inconsistencias de tipos en TypeScript, sincronización de modelos Prisma v6.12.0 y normalización multiplataforma de pruebas unitarias).
2. El saneamiento radical de la cadena de suministro de dependencias (SCA - Software Composition Analysis), eliminando dependencias legacy vulnerables (`swagger-ui-react`, `swagger-jsdoc`, `patch-package`, `deepmerge`, `tmp`).
3. La medición cuantitativa de las 8 características de calidad de producto software.

---

## 2. Acciones Técnicas Realizadas para Estabilización y Seguridad

| Categoría | Problema Detectado | Solución Técnica Implementada | Archivos Afectados |
| :--- | :--- | :--- | :--- |
| **Desacoplamiento de Swagger Legacy** | Vulnerabilidades heredadas en `deepmerge`, `glob`, `minimatch` y `tmp` por librerías desactualizadas de Swagger. | Desacoplamiento total: generación OpenAPI nativa con `js-yaml` en `app/api/openapi/route.ts` y renderizado de Swagger UI mediante bundle standalone en `app/docs/swagger/page.tsx`. | `app/api/openapi/route.ts`, `app/docs/swagger/page.tsx`, `package.json` |
| **Saneamiento de Dependencias (SCA)** | Vulnerabilidades críticas y altas en librerías de terceros (`dompurify`, `adm-zip`, `xlsx`, `zod`). | Actualización a `adm-zip@^0.6.1`, integración de SheetJS parcheado (`0.20.3`) y fijación estricta de `zod@^4.6.7`. | `package.json`, `package-lock.json` |
| **Entorno Linter Next.js 16** | Desalineación de versión de `eslint-config-next` con Next.js 16.4.3. | Fijación de `eslint-config-next@^16.4.0` y adición de tipados `@types/js-yaml`. | `package.json` |
| **Integridad de Tipos (TypeScript)** | Desincronización del cliente Prisma con esquemas de Asistencia y Planilla de RR. HH. | Regeneración limpia de Prisma Client (`v6.12.0`) y eliminación de caché residual obsoleta de rutas en `.next`. | `.next/types/`, `prisma/schema.prisma` |
| **Entorno de Pruebas UI** | Falta de `@testing-library/dom` y versión incompatible de `jsdom` con Node.js v24. | Actualización de `jsdom` a `^26.0.0` e instalación explícita de `@testing-library/dom` en `devDependencies`. | `package.json`, `package-lock.json` |
| **Multiplataforma (Windows CRLF)** | Fallo de regex en test de diagrama de base de datos debido a saltos de línea `\r\n`. | Adaptación de la expresión regular para soportar saltos de línea universales `[\r\n]+`. | `test/architecture/db-diagram-hr.test.ts` |
| **Hermeticidad de Red** | Fallo por política de loopback (`EACCES 127.0.0.1`) en prueba unitaria de gaveta de efectivo. | Implementación de mock hermético con `EventEmitter` sobre `net.createConnection`, garantizando aislamiento determinista. | `test/services/integrations/cash-drawer.service.test.ts` |
| **Arquitectura de Pruebas DDD** | La carpeta `test/services/` contenía archivos sueltos sin organizar por dominio. | Reorganización estricta en 8 subcarpetas temáticas por Bounded Context (`accounting`, `sales`, `inventory`, `purchases`, `security`, `hr`, `settings`, `integrations`), alineada 1:1 con `lib/services/`. | `test/services/**` |

---

## 3. Matriz de Medición Cuantitativa ISO/IEC 25023

### 3.1. Adecuación Funcional (Functional Suitability)
- **Corrección Funcional (Functional Correctness):**
  $$\text{Tasa de Éxito de Pruebas} = \frac{\text{Pruebas Aprobadas (1343)}}{\text{Pruebas Totales (1343)}} \times 100\% = 100.0\%$$
- **Completitud Funcional:** 100% de los 93 Route Handlers DDD verificados con pruebas de casos de uso y catálogo de endpoints OpenAPI (`/api/openapi`).

### 3.2. Eficiencia de Desempeño (Performance Efficiency)
- **Comportamiento Temporal:** Tiempo de generación de OpenAPI reducido de 2,288 ms a 157 ms (14x más rápido) tras erradicar `swagger-jsdoc`.
- **Capacidad:** Concurrencia de 30 comprobantes XML UBL 2.1 + firma digital XMLDSIG en paralelo sin colisiones (`Promise.all`).
- **Resiliencia de Concurrencia:** Cero condiciones de carrera (*Race Conditions*) en deducción de stock y cobros mediante serialización atómica por llave.

### 3.3. Compatibilidad (Compatibility)
- **Interoperabilidad:** Cumplimiento de contratos REST JSON, interoperabilidad con SUNAT (UBL 2.1 estándar de facturación electrónica) y especificación OpenAPI 3.0.3 interactiva.
- **Coexistencia:** Pruebas herméticas de servicios sin colisiones de puertos ni procesos residuales.

### 3.4. Usabilidad (Usability)
- **Protección contra errores de usuario:** Validación en dos capas (validación en cliente con tipado estricto y en servidor mediante esquemas Zod en handlers HTTP).
- **Consistencia UI:** Sistema de diseño unificado con Tailwind CSS, Sonner y retroalimentación reactiva de estados de carga y error.

### 3.5. Fiabilidad (Reliability)
- **Tolerancia a fallos:** Manejo defensivo en integraciones externas (Mercado Pago, RENIEC y SUNAT operan con modos de degradación controlada y fallback automático).
- **Recuperabilidad:** Atomicidad garantizada con transacciones ACID de PostgreSQL (`prisma.$transaction`) ante interrupciones de red.

### 3.6. Seguridad (Security)
- **Confidencialidad:** Tokens JWT firmados con algoritmo HS256 almacenados exclusivamente en cookies con banderas `httpOnly: true` y `sameSite: "lax"`.
- **Integridad:** Contraseñas hasheadas con bcrypt (factor de coste seguro).
- **Control de Acceso:** RBAC granular implementado en la totalidad de los endpoints mediante `createApiHandler({ permission })`.
- **SCA Limpio:** Erradicación de dependencias transitivas con problemas de seguridad.

### 3.7. Mantenibilidad (Maintainability)
- **Modularidad:** Separación estricta en 3 capas DDD (*Transporte HTTP* $\rightarrow$ *Servicios de Dominio* $\rightarrow$ *Persistencia*).
- **Aislamiento de Persistencia:** Cero importaciones directas de `@/lib/prisma` en la capa de presentación (`app/**`), validado por `test/architecture/layer-enforcement.test.ts`.
- **Analizabilidad:** 0 errores y 0 advertencias en análisis estático ESLint.
- **Modificabilidad:** 0 errores de compilación estricta con TypeScript Compiler (`tsc --noEmit`).

### 3.8. Portabilidad (Portability)
- **Adaptabilidad Ambiental:** Configuración desacoplada y gobernada por variables de entorno (`.env`).
- **Instalabilidad:** Inicialización de base de datos determinista mediante `prisma migrate` y scripts de inicialización (`db:seed`).

---

## 4. Criterios de Aceptación y Veredicto

| Criterio | Meta | Resultado Obtenido | Estado |
| :--- | :---: | :---: | :---: |
| Linting y reglas DDD | 0 errores | 0 errores | **CUMPLIDO** |
| Compilación TypeScript | 0 errores | 0 errores | **CUMPLIDO** |
| Batería de Pruebas Unitarias/Integración | 100% aprobadas | 1,343 / 1,343 (100%) | **CUMPLIDO** |
| Batería de Concurrencia | 100% aprobadas | 16 / 16 (100%) | **CUMPLIDO** |
| Generación de OpenAPI (`/api/openapi`) | < 300 ms | 157 ms | **CUMPLIDO** |
