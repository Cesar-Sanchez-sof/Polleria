# Tasks: Asistente Financiero con IA

**Input**: [spec.md](./spec.md) y [plan.md](./plan.md) de `specs/023-ai-financial-assistant/`

**Branch**: `feature/ia-contable-lora` | **Status**: Draft

**Leyenda**: `[P]` = paralelizable · ✅ = ejecutable ya · ⚠️ = requiere autorizar una instalación
local · ⛔ = bloqueada por una dependencia externa.

**Reglas comunes**:

- Solo archivos **nuevos** bajo `ai-service/`, `lib/ai-assistant/`, `components/ai-assistant/` y
  `app/api/assistant/`. No se modifican módulos ajenos, autenticación, Prisma, layouts, Sidebar ni
  configuración compartida.
- Sin red, sin bases de datos reales, sin GPU ni pesos. Las pruebas fallan si intentan abrir una
  conexión o leer `DATABASE_URL` o `DATABASE_URL_READONLY` (NFR-011, SC-014).
- Comandos de pruebas de `ai-service`:
  - B1 (biblioteca estándar, Python del sistema):
    `PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=ai-service/tests python -m unittest test_money test_balances test_indicators test_safety test_budget`
  - B2 (entorno `ai-service/.venv`):
    `PYTHONDONTWRITEBYTECODE=1 ai-service/.venv/Scripts/python.exe -m pytest ai-service/tests/test_allowlist.py ai-service/tests/test_validator.py ai-service/tests/test_contracts.py ai-service/tests/test_audit.py -p no:cacheprovider`

---

## B1: Base y núcleo determinista (✅, solo biblioteca estándar)

> **Estado (2026-10-12)**: completado. 59 pruebas con `unittest`, todas en verde, sin red ni
> bases de datos. Divergencias de redondeo con JavaScript declaradas en
> `ai-service/tests/fixtures/parity/balances.json` (`binario-1.005`, `empate-negativo`).

- [x] **T001** Esqueleto de `ai-service/`, `.gitignore` local y `pyproject.toml` que declara
  dependencias futuras sin instalarlas.
  - Archivos: `ai-service/.gitignore`, `ai-service/pyproject.toml`, `ai-service/src/ai_service/__init__.py`
  - Acepta: ignora `.venv`, `__pycache__`, `*.safetensors`, `*.gguf`, `*.bin`, `checkpoints/`,
    `adapters/`, `.env*`; `git status` solo muestra archivos nuevos.
- [x] **T002** Barreras de pruebas: sin red y sin variables de base de datos. *Depende de T001.*
  - Archivos: `ai-service/tests/guards.py`
  - Acepta: abrir un *socket* o resolver un nombre durante una prueba falla; leer `DATABASE_URL` o
    `DATABASE_URL_READONLY` falla.
- [x] **T003** [P] Dinero con `Decimal`: conversión estricta, redondeo a 2 decimales, formato
  `S/ 1,234.56` y porcentajes. *Depende de T001.*
  - Archivos: `ai-service/src/ai_service/finance/__init__.py`, `finance/money.py`, `tests/test_money.py`
  - Acepta: rechaza `float`, `bool`, `NaN` e infinitos; formato de BR-4; diferencias de redondeo
    frente a JavaScript documentadas.
- [x] **T004** [P] Saldo según la naturaleza de la cuenta, en paridad con `signedBalance` de
  `lib/accounting/balance-sheet.ts` (solo lectura). *Depende de T003.*
  - Archivos: `finance/balances.py`, `tests/test_balances.py`, `tests/fixtures/parity/balances.json`
  - Acepta: coincidencia **exacta** en los casos sin empate de redondeo; las divergencias de
    redondeo entre JavaScript y Python se listan explícitamente, sin tolerancias.
- [x] **T005** [P] Primitivas del motor: ratio, porcentaje de un total y variación porcentual con
  `NoCalculable`. *Depende de T003.*
  - Archivos: `finance/indicators.py`, `tests/test_indicators.py`
  - Acepta: división por cero → `NoCalculable`, nunca `inf` ni `NaN`. **Sin indicadores con nombre
    propio** hasta resolver P-6; sin criterio de anulados hasta resolver P-4.
- [x] **T006** [P] Configuración de base de datos de pruebas con fallo seguro. *Depende de T002.*
  - Archivos: `ai-service/src/ai_service/config/__init__.py`, `config/safety.py`, `tests/test_safety.py`
  - Acepta: rechaza sin conectar si la variable propia falta, si se intenta usar `DATABASE_URL` o
    `DATABASE_URL_READONLY`, si el host no es desechable o si la base no lleva el prefijo de pruebas.
- [x] **T007** [P] `BudgetGuard` y `UsageLog` del Modelo 1 con consumos simulados. *Depende de T003.*
  - Archivos: `ai-service/src/ai_service/llm/__init__.py`, `llm/budget.py`, `tests/test_budget.py`
  - Acepta: presupuesto agotado o no verificable → **0 llamadas** y `503` sin detalles económicos
    (D-13, D-14, SC-018); límites de llamadas, reintentos y tokens; el registro no guarda prompts ni
    respuestas. El contador en memoria **no** es un límite garantizado para producción (R-06).

## B2: SQL Validator y contratos (entorno `ai-service/.venv`)

> **Estado (2026-10-12)**: completado. 49 pruebas (196 subpruebas) con pytest, todas en verde;
> 0 fallidas, 0 omitidas. B1 sigue con 59 pruebas en verde. Sin red ni bases de datos.
>
> - Instalado **solo** en `ai-service/.venv`: `sqlglot==30.22.0`, `pydantic==2.14.1`
>   (`pydantic_core==2.50.1`), `pytest==9.1.1` y sus dependencias transitivas.
> - Smart App Control bloqueó una vez la DLL sin firma de `pydantic_core` en su primera carga
>   (eventos Code Integrity 3077/3033); después cargó sin cambiar la configuración de seguridad.
>   Mantener `pydantic-core` 2.50.1 para no repetir la evaluación.
> - Decisiones conservadoras del validador: se rechazan `SELECT *` (salvo `COUNT(*)`),
>   `UNION`/`INTERSECT`/`EXCEPT`, cadenas `$$…$$`, `current_date`/`now()` y funciones no listadas;
>   si falta `LIMIT` se añade el máximo provisional (200); el Executor recibirá el SQL regenerado.

- [x] **T010** Lista de objetos permitidos por rol con esquema ficticio (BR-8; objetos reales: P-14).
- [x] **T011** Validación estructural con AST de `sqlglot`. *Depende de T010.*
- [x] **T012** Validación semántica y por rol. *Depende de T011.*
- [x] **T013** Batería de SQL permitido, prohibido y de evasión (SC-003). *Depende de T011, T012.*
- [x] **T014** [P] Esquemas CT-B, `LlmRequest` y `LlmResponse` con Pydantic (D-12).
- [x] **T015** [P] Enmascaramiento de auditoría: plantilla SQL y parámetros protegidos (SC-011). *Depende de T011.*

## B3: Orquestador simulado (entorno `ai-service/.venv`)

> **Estado (2026-10-12)**: completado con simulaciones. 42 pruebas (117 subpruebas) con pytest, todas
> en verde; 0 fallidas, 0 omitidas. Suite completa B1+B2+B3: 150 pruebas en verde. Sin red, sin
> bases de datos, sin modelos ni APIs comerciales. Sin dependencias nuevas.
>
> - Componentes **reales** reutilizados: SQL Validator (B2), motor financiero (B1, vía
>   `finance/engine.py`), `BudgetGuard`/`UsageLog` (B1) y auditoría (B2).
> - Componentes **simulados**: `MockLlmProvider` (falla si recibe datos sensibles, BR-13),
>   `KeywordRetriever`, `TemplateSqlGenerator`, `FixtureExecutor` (solo veredictos aprobados) e
>   `InMemoryAuditSink`.
> - Los turnos del asistente nunca se reenvían al Modelo 1 (pueden contener cifras reales).
> - Los períodos se resuelven en el backend con la fecha civil de Lima, no por el modelo.
> - Comando: `PYTHONDONTWRITEBYTECODE=1 ai-service/.venv/Scripts/python.exe -m pytest ai-service/tests/test_prefilter.py ai-service/tests/test_markers.py ai-service/tests/test_pipeline_budget.py ai-service/tests/test_pipeline_e2e.py -p no:cacheprovider`

- [x] **T020** Interfaces `Protocol` y simulaciones; `MockLlmProvider` que falla ante datos reales (SC-016). *Depende de T014.*
- [x] **T021** Prefiltro determinista sin llamadas al LLM. *Depende de T020.*
- [x] **T022** Pipeline y estados; ningún SQL sin Validator (AR-1). *Depende de T005, T011–T013, T020, T021.*
- [x] **T023** Marcadores validados contra resultados autorizados (FR-020). *Depende de T022.*
- [x] **T024** Integración del presupuesto y `503` (SC-018). *Depende de T007, T022.*
- [x] **T025** Batería de extremo a extremo y adversarial (SC-002, BR-5). *Depende de T022–T024.*

### B3 · Capa HTTP de desarrollo (C4, CT-B `POST /v1/queries`, según `plan.md`)

> **Estado (2026-10-12)**: implementada y verificada con simulaciones (27 pruebas nuevas, todas en
> verde). **Solo desarrollo**: no es un servicio de producción. Dependencias instaladas en
> `ai-service/.venv`: `fastapi` 0.143.0 (`starlette` 1.7.0, `anyio` 4.15.1), `httpx` 0.28.1,
> `uvicorn` 0.54.0 (sin extras), sin binarios nativos nuevos.
>
> - El token interno (`AI_SERVICE_INTERNAL_TOKEN`) es **provisional**: identifica al proxy, no a
>   los usuarios; no sustituye a P-9 ni a DE-1/DE-2. Roles y usuarios de CT-B siguen simulados.
> - Barreras de pruebas: excepción acotada para `socket.socketpair()` (bucle `asyncio` en Windows);
>   cualquier otra conexión, también loopback, sigue bloqueada y hace fallar la prueba.
> - Starlette 1.7 marca como obsoleto usar `httpx` en `TestClient` (recomienda `httpx2`); funciona,
>   pero queda pendiente de decidir.
> - Comando: `PYTHONDONTWRITEBYTECODE=1 ai-service/.venv/Scripts/python.exe -m pytest ai-service/tests/test_settings.py ai-service/tests/test_http_api.py -p no:cacheprovider`

- [x] **T026** Configuración del servicio con fallo seguro: solo `AI_SERVICE_ENV=development`, solo `127.0.0.1`, token interno ≥ 32 bytes, clave HMAC independiente, sin mostrar valores. *Depende de T015.*
- [x] **T027** Composición del orquestador de desarrollo: componentes reales de B1–B4 + simuladores y dataset ficticio `ai-service/fixtures/dev_dataset.json`. *Depende de T026, T022, T032.*
- [x] **T028** Aplicación FastAPI: `GET /v1/health`, `POST /v1/queries` (CT-B); token en tiempo constante, `415`/`413`, `400` para errores de contrato, errores genéricos, sin `/docs` ni `/openapi.json`, `TrustedHostMiddleware`, cabeceras `no-store`/`nosniff`; arranque local `python -m ai_service.main`. *Depende de T027.*
- [x] **T029** Pruebas HTTP de integración y seguridad (401 sin invocar el orquestador, 403, 413, 415, 503, 500, hosts no permitidos, ausencia de filtraciones, compatibilidad con las barreras). *Depende de T028.*

## B4: Conocimiento y conjunto Gold

> **Estado (2026-10-12)**: T030–T032 implementadas y verificadas (22 pruebas con pytest, todas en
> verde). Sin dependencias nuevas, sin red, sin modelos ni Milvus.
>
> - **Metadatos**: 4 tablas contables (`accounting_account`, `accounting_period`, `journal_entry`,
>   `journal_entry_detail`) en `ai-service/knowledge/erp_schema_metadata.json`, con el SHA-256 del
>   esquema (una prueba detecta si queda desactualizado). Sin valores, comentarios ni credenciales.
> - **Gold `gold-v1`**: 16 preguntas ficticias (14 evaluables en RAG), con hash de integridad.
>   **Contaminación con el dataset QLoRA: verificación PENDIENTE** (dataset no disponible aquí).
> - **Recuperador en memoria** (coseno) sobre 12 fragmentos (esquema, relaciones y 4 reglas
>   confirmadas): Recall@1 = 0,357 · Recall@3 = 0,619 · Recall@5 = 0,786 · MRR = 0,786 (k=1) /
>   0,833 (k=3 y k=5).
> - **Limitación**: usa representaciones **léxicas** deterministas (*feature hashing*), **no
>   embeddings semánticos reales**; por ejemplo, "vendimos" no se asocia con "ventas". Las cifras
>   miden la mecánica, no la calidad. Sin umbrales de aceptación (P-11).
> - Comando: `PYTHONDONTWRITEBYTECODE=1 ai-service/.venv/Scripts/python.exe -m pytest ai-service/tests/test_schema_metadata.py ai-service/tests/test_gold_set.py ai-service/tests/test_retrieval.py -p no:cacheprovider`

- [x] **T030** Metadatos de `prisma/schema.prisma` en solo lectura, versionados con hash.
- [x] **T031** Conjunto Gold mínimo ficticio con control de fuga (verificación de contaminación pendiente).
- [x] **T032** Índice en memoria con similitud coseno detrás de `Retriever`; Recall@k y MRR.
- [ ] **T033** ⚠️ PENDIENTE: embeddings ligeros en CPU (biblioteca y modelo por elegir, R-03; requiere autorización de instalación y verificar Smart App Control).

## ERP, F2 (⚠️ requiere autorizar `npm install`, exigido también por `AGENTS.md`)

- [ ] **T040** [P] Lista de rutas de P-2: `lib/ai-assistant/allowed-routes.ts` + test.
- [ ] **T041** [P] Fechas de Lima (BR-10, SC-015): `lib/ai-assistant/lima-dates.ts` + test.
- [ ] **T042** [P] Reducer de conversación (P-3, FR-025): `components/ai-assistant/conversation-state.ts` + test.
- [ ] **T043** Validación de contexto e historial (BR-12): `lib/ai-assistant/context-validation.ts` + test.
- [ ] **T044** Proxy `/api/assistant` con `sesionActual()` y CT-B simulados: `app/api/assistant/route.ts` + test.

## Bloqueadas (⛔)

- **F5**: Executor contra PostgreSQL desechable (P-18).
- **F6**: inferencia real de los modelos (entrenamiento en curso, P-7, P-21, P-22), latencias para
  D-2 y comparativa base frente a QLoRA.
- **F7**: montaje del widget (CS-1, P-19), autenticación (DE-1, DE-2, P-9), rol de solo lectura
  (P-16, P-14), auditoría definitiva (P-10), validación de interfaz y accesibilidad (CS-3), puertas
  G1 a G19 del plan.
