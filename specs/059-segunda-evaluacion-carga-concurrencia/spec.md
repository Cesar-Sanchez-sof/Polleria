# Especificación Técnica 059: Segunda Evaluación de Carga, Estrés y Concurrencia

**Estado:** Implementado / Verificado en rama `test/segunda-evaluacion-carga-concurrencia`
**Historia de Usuario:** Segunda evaluación de carga, estrés y concurrencia
**Fecha:** 2026-11-10
**Rama Git:** `test/segunda-evaluacion-carga-concurrencia` (base `develop`)

---

## 1. Objetivo y Alcance

Validar de forma automatizada, reproducible y medible el comportamiento del ERP **Pollería** bajo alta concurrencia, carga sostenida y condiciones de estrés extremo ("¿Cuántos usuarios simultáneos soporta la aplicación?" y "¿En qué punto y componente se degrada o rompe?"), cubriendo los tres criterios de aceptación de la historia:

| ID | Criterio de Aceptación | Implementación Automatizada | Evidencia / Artefacto |
| :--- | :--- | :--- | :--- |
| **CA-01** | **Concurrencia de peticiones HTTP a todas las APIs.** | Inventario integral de los **91 Route Handlers** (`app/api/**/route.ts`), ráfagas multiusuario sobre `createApiHandler`, pruebas SSE (`/api/realtime`) y escalado progresivo de Usuarios Virtuales (`local-stress-suite.mjs` / `k6-full-stress.js`). | `test/concurrency/http-apis-concurrency.test.ts` + `scripts/load-tests/api-catalog.mjs` + `reports/load-evaluation-latest.md` |
| **CA-02** | **Concurrencia de operaciones asíncronas dentro del código TypeScript (`Promise`, `async/await`).** | Medición de Event Loop Lag (`monitorEventLoopDelay`), firma concurrente XML UBL 2.1 + XMLDSIG (`Promise.all`), control de concurrencia acotada (*backpressure*) con `PromiseSettledResult` y serialización de stock por llave para evitar *Race Conditions*. | `test/concurrency/typescript-async-concurrency.test.ts` + sonda *Auth Burst* en `local-stress-suite.mjs` |
| **CA-03** | **Concurrencia de accesos a base de datos y recursos externos (Neon, S3, Redis, RENIEC).** | Contención de pool Prisma (`P2024`) y recuperación, carga por lotes S3 (`uploadVouchersBatch`, `maxConcurrency = 20`), ráfaga RENIEC (`json.pe` con degradación controlada ante HTTP `429`), atomicidad/locks distribuidos en `@upstash/redis` y sondas reales contra credenciales `.env`. | `test/concurrency/external-resources-concurrency.test.ts` + sondas reales en `scripts/load-tests/local-stress-suite.mjs` |

---

## 2. Inventario Integral de Endpoints HTTP (`app/api/**`)

El catálogo maestro [`scripts/load-tests/api-catalog.mjs`](../../scripts/load-tests/api-catalog.mjs) mantiene indexadas las **91 rutas activas** en `app/api/**/route.ts` agrupadas por Bounded Context DDD (verificado automáticamente en CI contra el sistema de archivos mediante `http-apis-concurrency.test.ts`):

| Bounded Context (DDD) | Rutas | Perfil principal | Ejemplos críticos bajo carga |
| :--- | :---: | :--- | :--- |
| **Accounting** (`accounting`) | 18 | `read` / `external-heavy` | `/api/balance-sheet`, `/api/daily-book`, `/api/general-ledger`, `/api/ple/[book]`, `/api/accounting/interpreter` |
| **Sales** (`sales`) | 17 | `read` / `realtime-sse` / `write` | `/api/orders`, `/api/sales`, `/api/cash-sessions`, `/api/realtime`, `/api/payments/mercadopago/*` |
| **Inventory** (`inventory`) | 2 | `read` / `write` | `/api/products`, `/api/products/[id]` |
| **Purchases** (`purchases`) | 1 | `read` | `/api/purchases/without-voucher` |
| **HR** (`hr`) | 28 | `read` / `write` | `/api/employees`, `/api/attendance`, `/api/payroll`, `/api/schedules`, `/api/contracts` |
| **Security** (`security`) | 8 | `auth` / `read` / `write` | `/api/auth/login`, `/api/auth/me`, `/api/users`, `/api/roles`, `/api/audit-logs` |
| **Settings** (`settings`) | 9 | `read` / `write` | `/api/settings/restaurant`, `/api/settings/printers`, `/api/openapi`, `/api/branding/assets/[slot]` |
| **Integrations** (`integrations`) | 6 | `external-read` / `external-heavy` | `/api/document-lookup`, `/api/sunat/boleta`, `/api/sunat/liquidacion-compra`, `/api/sire/*` |
| **AI Assistant** (`ai`) | 2 | `read` / `external-heavy` | `/api/assistant`, `/api/assistant/transcribe` |
| **TOTAL** | **91** | — | **100% inventariadas y verificadas por test** |

### Clasificación de Seguridad para Carga Local Real

- `read`: Endpoints `GET` idempotentes ejecutados masivamente contra PostgreSQL/Neon en barridos y escalones de VUs (con parámetros reales como `desde`, `hasta`, `codigo`, `year`, `month`, `mode=preview` y autodescubrimiento de IDs existentes).
- `auth`: `POST /api/auth/login` y `POST /api/auth/logout`, aislados en un escenario específico de contención CPU (`authBurst`) por el costo computacional de `bcryptjs`.
- `realtime-sse`: `/api/realtime`, evaluado con conexiones SSE abiertas en paralelo y ráfagas de broadcasts HTTP `POST`.
- `external-read` / `external-heavy` / `write`: Evaluados en modo determinístico en Vitest y, en ejecución local contra servicios reales externos, habilitados únicamente mediante banderas explícitas (`--with-reniec`, `--with-s3-write`) para evitar consumo accidental de cuota paga (`json.pe`) o escrituras sucias.

---

## 3. Cuellos de Botella Reales Identificados en el Código (Vector de Degradación / "Cómo Destruir la App")

El análisis estático del código fuente explica exactamente en qué puntos se fractura el rendimiento cuando se supera la capacidad saludable:

1. **Contención CPU por `bcryptjs` (`lib/auth/password.ts`, `ROUNDS = 12`):**
   - `bcryptjs` ejecuta hashing en JavaScript puro sobre el hilo único del *Event Loop* de Node.js.
   - Una ráfaga simultánea de decenas de logins concurrentes bloquea temporalmente el *Event Loop*, elevando las colas de latencia de todas las rutas HTTP concurrentes.
2. **Logging SQL y Pool de Conexiones Prisma -> Neon (`lib/prisma.ts`):**
   - El singleton inicializa `log: ["query", "info", "warn", "error"]` en todo entorno y depende del tamaño del pool de conexiones contra Neon PostgreSQL.
   - Bajo alta concurrencia transaccional o lecturas pesadas simultáneas, las conexiones pendientes vencen con código Prisma **`P2024`** (*Timed out fetching a new connection from the connection pool*).
3. **Almacenamiento S3 y E/S síncrona (`lib/services/integrations/s3-storage.service.ts`):**
   - `uploadVoucherToS3` construye una nueva instancia `new S3Client(...)` por cada invocación (en lugar de reutilizar *keep-alive* HTTP/TLS) y emplea `fs.mkdirSync` / `fs.writeFileSync` para respaldo local. Además, `uploadVouchersBatch` atrapa excepciones en el bucle devolviendo `"guardado"` en lugar de `"error"`, enmascarando degradaciones parciales del almacenamiento externo.
4. **Consultas externas sin timeout explícito ni caché (`lib/services/integrations/document-lookup.service.ts`):**
   - `lookupIdentityDocument` invoca `fetch("https://api.json.pe/api/...")` sin `AbortController` ni capa de caché previa en Redis; si el proveedor externo entra en `429` o latencia alta, los manejadores HTTP esperan indefinidamente el socket.
5. **Realtime en memoria de proceso único (`lib/realtime/event-emitter.ts`) y Redis subutilizado:**
   - Aunque `@upstash/redis` e `ioredis` están instalados en `package.json` y configurados en `.env`, `RealtimeHub` mantiene un `Set` de controladores SSE estrictamente en memoria RAM local (sin Redis Pub/Sub). En despliegue multi-instancia o serverless los broadcasts no cruzan procesos, y en proceso único el límite lo marcan los descriptores abiertos y memoria de streams activos.

---

## 4. Arquitectura de Pruebas Implementadas

### 4.1. Suite Automatizada en Vitest (`npm test` / `npm run test:concurrency`)

Ubicación conforme a `AGENTS.md`: `test/concurrency/` (`16` pruebas automatizadas distribuidas en `4` archivos):

1. [`test/concurrency/http-apis-concurrency.test.ts`](../../test/concurrency/http-apis-concurrency.test.ts) (**5 tests**):
   - Auditoría automática que garantiza que `API_CATALOG` cubre el 100% de los `route.ts` en `app/api/` y sus métodos exportados.
   - Resolución válida de URLs de lectura sin placeholders `[param]`.
   - `90` invocaciones HTTP paralelas multiusuario sobre `createApiHandler` con `AsyncLocalStorage` verificando cero mezcla de sesiones o payloads.
   - Mapeo concurrente determinístico de `100` peticiones con códigos `200`, `400`, `403`, `404` y `409`.
   - `200` clientes SSE conectados simultáneamente sobre `realtimeHub` recibiendo `50` broadcasts paralelos (`10,000` entregas) y desconexión limpia por `AbortSignal`.
2. [`test/concurrency/typescript-async-concurrency.test.ts`](../../test/concurrency/typescript-async-concurrency.test.ts) (**4 tests**):
   - Captura de *Event Loop Lag* (`monitorEventLoopDelay`) bajo verificación paralela de hashes `bcrypt`.
   - Construcción y firma concurrente XMLDSIG de `30` boletas UBL 2.1 con unicidad de `DigestValue` SHA-256.
   - Pool de concurrencia acotada (*backpressure*, `maxConcurrency = 5`) sobre `45` tareas asíncronas con fallos parciales.
   - Serialización por llave sobre stock crítico (`stock = 5`, `25` intentos concurrentes vía `Promise.allSettled`) previniendo condiciones de carrera.
3. [`test/concurrency/external-resources-concurrency.test.ts`](../../test/concurrency/external-resources-concurrency.test.ts) (**4 tests**):
   - Simulación de saturación de pool Neon/Prisma (`POOL_LIMIT = 5`, `20` transacciones simultáneas -> `15` errores `P2024` y recuperación total posterior).
   - Carga concurrente S3 por lotes (`uploadVouchersBatch`, `50` XMLs con `maxConcurrency = 20`) verificando unicidad de rutas.
   - Ráfaga de `40` consultas DNI/RUC paralelas hacia `lookupIdentityDocument` con inyección de `25%` de errores `429` activando fallback `"simulado"` sin rechazos no controlados.
   - Validación de atomicidad (`incr` x100) y exclusión mutua distribuida (`set NX` x50 -> exactamente `1` ganador) con `@upstash/redis` y *auto-pipelining* HTTP.

4. [`test/concurrency/auth-cache.test.ts`](../../test/concurrency/auth-cache.test.ts) (**3 tests**):
   - Deduplicación *singleflight* de `50` verificaciones simultáneas por usuario sin duplicar consultas a BD.
   - Invalidación inmediata por `userId` o globalmente cuando se actualizan usuarios/roles y expiración por TTL.

### 4.2. Optimizaciones Aplicadas Tras la Primera Medición Real (Salto 10 -> >= 50 VUs)

La primera ejecución real contra Neon (`npm run test:load:local`) determinó un techo de **~10 RPS** (quiebre en `25 VUs`, `p95 = 3636.5 ms`; `50 VUs`, `p95 = 6650.1 ms`), aunque la sonda directa `Neon Pool x30` respondió con `0` errores `P2024` y `p95 = 323.5 ms`. Se aplicaron tres mejoras puntuales sin alterar contratos de negocio ni mocks de pruebas:

1. **Pool Prisma + Eliminación de Logs SQL Síncronos ([`lib/prisma.ts`](../../lib/prisma.ts)):**
   - Inyección automática de `connection_limit` (`80` en endpoints `-pooler`, `40` en conexión directa, o `PRISMA_CONNECTION_LIMIT`) y `pool_timeout=20` cuando no vienen en `DATABASE_URL`.
   - En `production` solo se registran errores (`["error"]`, reactivable con `PRISMA_LOG_QUERIES=1`), eliminando la sobrecarga I/O de imprimir todas las SQL bajo concurrencia.
2. **Caché TTL Corto + Singleflight de Autorización ([`lib/auth/auth-cache.ts`](../../lib/auth/auth-cache.ts)):**
   - Caché de `15 s` + *singleflight* para `activeUser` y `permissionsForUser` (`~550 ms` ahorrados por request al evitar dos rondas secuenciales a Neon en `us-east-2`), con invalidación inmediata en `users.service.ts` y `roles.service.ts`.
3. **Caché Singleton para Especificación OpenAPI ([`app/api/openapi/route.ts`](../../app/api/openapi/route.ts)):**
   - En `production`, evita re-escanear con `swaggerJSDoc` y `fs.readFile` las 91 rutas del disco en cada `GET /api/openapi`.

### 4.3. Suite Real Local contra Servicios Externos (`.env`)

1. **Runner Integrado Node.js (`scripts/load-tests/local-stress-suite.mjs`):**
   - No requiere binarios externos como `k6`.
   - Lee variables del archivo `.env` local (sin imprimir valores sensibles) y ejecuta 5 fases contra el servidor de producción local (`http://localhost:3000`):
     1. Autenticación inicial (`/api/auth/login`) y autodescubrimiento de IDs existentes.
     2. Barrido funcional de todas las APIs de lectura seguras (`read`).
     3. Escalado progresivo de Usuarios Virtuales (`VUs`):
        - Modo `safe` (`npm run test:load:local`): `[10, 25, 50, 100]` VUs (`7s`/escalón, think-time `40ms`).
        - Modo `stress` (`npm run test:load:break`): `[10, 25, 50, 100, 150, 200, 300]` VUs (`10s`/escalón, sin think-time).
     4. Estrés SSE (`/api/realtime` con `40` clientes + `5` broadcasts) y ráfaga CPU de login (`6` o `12` `POST /api/auth/login` simultáneos).
     5. Sondas directas a servicios reales externos de `.env`: Neon PostgreSQL (`prisma.role.count()` x5, x15, x30 [, x50]), Upstash Redis (`redis.incr` x10, x30 [, x60]), AWS S3 (`HeadBucket` x15, y `PutObject`+`DeleteObject` x10 con `--with-s3-write`), y RENIEC `json.pe` (opt-in `--with-reniec`, x3).
   - Emite evidencia lista para documentación en `reports/load-evaluation-latest.md` y `reports/load-evaluation-latest.json`.
2. **Script Complementario Grafana k6 (`scripts/load-tests/k6-full-stress.js`):**
   - Permite ejecutar los perfiles `load`, `stress` y `spike` mediante `k6 run` cuando el usuario cuente con `k6` instalado en su entorno.

---

## 5. Criterio de Veredicto: "¿Cuántos Usuarios Simultáneos Soporta?"

Para reportar la capacidad de forma objetiva en el informe académico o técnico, cada escalón de VUs evalúa el siguiente SLA:

- **Capacidad Máxima Saludable:** Mayor nivel de `VUs` que cumple simultáneamente:
  - Latencia **p95 <= 3,000 ms**, y
  - Tasa de error de servidor o red (`HTTP >= 500` o timeout/reset) **< 5%**.
- **Punto de Quiebre (Breakpoint):** Primer escalón donde `p95 > 3,000 ms` o `errorRatePct >= 5%` (o aparición sostenida de `P2024` / bloqueos prolongados de Event Loop por `bcrypt`).

> **Nota sobre cuota externa RENIEC / S3:** Los reportes en `reports/` están ignorados en Git (`.gitignore` incluye `/reports/`) para que el desarrollador ejecute múltiples iteraciones localmente y adjunte las tablas/capturas resultantes como evidencia sin ensuciar el repositorio con archivos binarios o métricas locales cambiantes.

---

## 6. Protocolo de Ejecución Local y Documentación de Evidencias

1. **Verificación de pruebas automatizadas (CI / local sin servidor levantado):**
   ```powershell
   npm run test:concurrency
   npm test
   npm run lint
   npx tsc --noEmit
   ```
2. **Medición real en local contra servicios externos (`.env`):**
   - **Terminal 1 (Compilar y levantar servidor en modo producción — obligatorio, no medir contra `next dev`):**
     ```powershell
     npm run build
     npm run start
     ```
   - **Terminal 2 (Ejecutar evaluación progresiva + reporte automático):**
     ```powershell
     # Prueba de carga estándar (10 -> 100 VUs + Neon + Redis + S3 HeadBucket)
     npm run test:load:local

     # Búsqueda del punto de quiebre (10 -> 300 VUs agresivo)
     npm run test:load:break

     # Opcional: incluir sonda real RENIEC (3 req) y escritura temporal S3 (10 Put+Delete)
     node scripts/load-tests/local-stress-suite.mjs --mode=stress --with-reniec --with-s3-write
     ```
3. **Documentar evidencia:** Revisar la salida generada en `reports/load-evaluation-latest.md` y capturar pantallas de la terminal mostrando las tablas de latencias (`p50`, `p95`, `p99`), RPS, tasa de error, métricas de Neon (`P2024`), Redis, S3 y el veredicto final de capacidad y punto de quiebre.
