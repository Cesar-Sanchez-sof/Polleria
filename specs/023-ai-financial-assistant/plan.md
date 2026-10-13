# Implementation Plan: Asistente Financiero con IA

**Branch**: `feature/ia-contable-lora` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-ai-financial-assistant/spec.md`

**Status**: Draft

> **Nota**: este plan se redactó **manualmente** siguiendo `plan-template.md` de GitHub Spec Kit
> y el modelo del plan del equipo (`specs/021-generar-estado-resultados/plan.md`, rama
> `origin/main`). Spec Kit no está instalado en esta copia de trabajo (`.specify/` no existe y está
> en `.gitignore`), así que no se ejecutó `/speckit.plan`. Los artefactos de las fases 0 y 1 de
> Spec Kit se listan como [pendientes](#artefactos-de-spec-kit-pendientes).

## Summary

Asistente financiero de **solo lectura** para las seis pantallas contables habilitadas (P-2), con
**dos modelos**:

- **Modelo 1** (interpretación y explicación): servido por una **API comercial de LLM** con pago
  por consumo y límite mensual (excepción presupuestaria, P-7b y P-22). Detrás de una interfaz
  `LlmProvider` desacoplada del proveedor.
- **Modelo 2**: XiYanSQL-QwenCoder-7B-2504 con **adaptador QLoRA obligatorio en el MVP** (P-15),
  con inferencia en recursos gratuitos (P-7a).

El resto se diseña con recursos gratuitos: RAG con embeddings en CPU e índice en memoria en la
Etapa 0 y Milvus evaluado después (P-8); SQL Validator con varias capas de control; SQL Executor de
solo lectura; motor financiero determinista en Python. El ERP solo recibe archivos nuevos: un
widget, un proxy `/api/assistant` y validaciones. El servicio vive aislado en `ai-service/`.

**Enfoque**: primero el núcleo determinista y los componentes simulados (fases F1 a F4), **sin GPU,
sin datos reales y sin servicios externos**. Los modelos reales y la integración vienen después,
condicionados por las [puertas del MVP](#puertas-que-bloquean-el-mvp).

## Technical Context

**Language/Version**: TypeScript 5 sobre Next.js 16.3.5 (App Router) y React 19 en el ERP.
Python 3.x en `ai-service/`: **NEEDS CLARIFICATION** (alinear con el entorno de entrenamiento,
R-02).

**Primary Dependencies**:
- ERP: **ninguna nueva**. Se usan `Intl` para `America/Lima`, `lib/services/http.ts` y Vitest.
- `ai-service/`: FastAPI, Pydantic, `sqlglot` (dialecto `postgres`), `psycopg` 3 y, en una fase
  posterior, `pymilvus`. Biblioteca de embeddings ligera en CPU: **NEEDS CLARIFICATION** (R-03).
- Adaptador del Modelo 1 detrás de `LlmProvider`. SDK o HTTP directo del proveedor:
  **NEEDS CLARIFICATION** (P-22, R-04).

**Storage**:
- Etapa 0: fixtures e índice en memoria.
- MVP: PostgreSQL con rol de solo lectura (DE-3, P-16); Zilliz Cloud Free (P-8, PROPUESTA).
- Auditoría: almacén propio (P-10).
- **Sin almacén de trabajos** (D-2 pendiente).

**Testing**:
- Vitest en entorno `node`, solo con lógica pura y mocks (D-6). Incluido en la CI existente.
- pytest para `ai-service/`, fuera de la CI del ERP (CS-4 no solicitado).

**Target Platform**:
- ERP en Vercel. El plan, *Fluid compute* y `maxDuration` están por verificar (R-01).
- `ai-service/` en un alojamiento gratuito por decidir (P-7a, P-13).
- Modelo 1 en una API comercial (P-22).

**Project Type**: aplicación web existente más un servicio Python aislado en el mismo
repositorio.

**Performance Goals**: latencia p95 **NEEDS CLARIFICATION** (P-11). Se mide en la prueba de
viabilidad (SC-017) y determina D-2.

**Constraints**:
- Presupuesto objetivo de US$0, salvo el Modelo 1 (API comercial con límite mensual, P-22). Sin GPU
  dedicada para el Modelo 1. Sin garantía 24/7 en los recursos gratuitos.
- BR-13 y P-21: no se envían preguntas reales, datos personales ni información contable sensible a
  proveedores externos.
- Sin `DATABASE_URL` ni `DATABASE_URL_READONLY` en la Etapa 0; fallo seguro (NFR-011).
- Sin pesos, *checkpoints* ni adaptadores en Git.
- No se modifican autenticación, roles, permisos, Prisma, migraciones, layouts, Sidebar, módulos
  ajenos, configuración compartida, dependencias ni CI.
- **Sin procesos que consuman GPU o mucha RAM** mientras el equipo entrena el adaptador.

**Scale/Scope**: una sola empresa; seis rutas contables; catálogo acotado de consultas (P-6).

## Constitution Check

*GATE: debe pasar antes de la fase 0 y revisarse tras la fase 1.*

`.specify/memory/constitution.md` **es una plantilla sin rellenar** en las ramas donde existe
(10 marcadores `PRINCIPLE_`). Como hizo el plan 021, se evalúan las convenciones reales del
repositorio y las reglas de la spec.

| Gate | Resultado | Evidencia |
|------|-----------|-----------|
| Aislamiento: solo archivos nuevos y propios | ✅ PASS | Límites de integración de la spec |
| Sin dependencias nuevas en el ERP (F1–F4) | ✅ PASS | `Intl` y helpers existentes |
| Pruebas `*.test.ts` junto al código y mocks con `vi.mock` | ✅ PASS | Patrón de `app/api/**/route.test.ts` |
| Lint: **0 problemas nuevos** en nuestros archivos | ✅ PASS como criterio | El plan 021 registró 100 problemas previos ajenos |
| BR-13, SEC-6, NFR-013 (datos hacia proveedores externos) | ✅ PASS en la Etapa 0 | Solo simulaciones y datos ficticios |
| Fallo seguro de la base de datos (NFR-011) | ✅ PASS como diseño | Guardas de configuración en `ai-service/` |
| Pesos y adaptadores fuera de Git | ✅ PASS | `.gitignore` local de `ai-service/` |
| Claves del Modelo 1 solo en el backend Python (SEC-4) | ✅ PASS como diseño | El proxy del ERP no las necesita |
| Lectura de la documentación de Next 16 (`AGENTS.md`) | ⛔ **BLOQUEADO** | `node_modules/` ausente; requiere autorizar `npm install` antes de F2 |
| Validación de interfaz y accesibilidad antes de integrar (D-6) | ⏳ PENDIENTE | Requiere herramientas de DOM no instaladas (CS-3) |

**Gate result**: PASS para F0 y F1. F2 está condicionada al gate de documentación de Next 16.

## Project Structure

### Documentation (this feature)

```text
specs/023-ai-financial-assistant/
├── spec.md              # Especificación (Draft)
├── plan.md              # Este archivo
├── research.md          # PENDIENTE — Fase 0
├── data-model.md        # PENDIENTE — Fase 1
├── quickstart.md        # PENDIENTE — Fase 1
├── contracts/           # PENDIENTE — Fase 1 (CT-A, CT-B y payloads de ejemplo)
└── tasks.md             # PENDIENTE — /speckit.tasks (no lo crea este plan)
```

### Source Code (repository root)

Todos los archivos son **nuevos**; los nombres concretos se confirmarán en `tasks.md`.

```text
components/ai-assistant/            # NUEVO — widget (sin montar: CS-1, P-19)
  AssistantProvider.tsx             # estado en memoria por pestaña (P-3)
  AssistantWidget.tsx
  AssistantPanel.tsx
  conversation-state.ts             # reducer puro: mensajes, nueva conversación, limpieza ante 401
  conversation-state.test.ts
lib/ai-assistant/                   # NUEVO
  allowed-routes.ts                 # lista explícita de P-2 (6 rutas)
  context-validation.ts             # C3: ruta, filtros e historial
  lima-dates.ts                     # BR-10 con Intl (America/Lima)
  contracts.ts                      # tipos CT-A y CT-B
  assistant.service.ts              # cliente del navegador vía lib/services/http.ts
  ai-service-client.ts              # cliente servidor de CT-B con configuración de fallo seguro
  *.test.ts
app/api/assistant/                  # NUEVO — proxy C2 (@openapi, force-dynamic)
  route.ts
  route.test.ts

ai-service/                         # NUEVO — servicio Python aislado (P-13)
  .gitignore                        # local: .venv, __pycache__, *.safetensors, *.gguf, *.bin,
                                    #        checkpoints/, adapters/, .env*
  README.md
  pyproject.toml                    # dependencias aisladas del package.json del ERP
  src/ai_service/
    main.py                         # aplicación FastAPI
    http/            routes.py, schemas.py        # CT-B (Pydantic)
    config/          settings.py, safety.py       # fallo seguro (NFR-011)
    orchestrator/    pipeline.py, states.py
    llm/             provider.py, mock.py, budget.py, usage.py   # LlmProvider + consumo (D-12, D-13)
    interpretation/  rules.py, llm.py             # Modelo 1: sustituto temporal y real (D-3)
    explanation/     markers.py, templates.py, llm.py
    retrieval/       embedder.py, memory_index.py, milvus_index.py
    sqlgen/          base.py, mock.py, remote.py  # Modelo 2
    validation/      validator.py, allowlist.py   # C8
    execution/       executor.py, guard.py        # C9
    finance/         indicators.py, money.py      # C10
    audit/           record.py, masking.py, sink.py  # C11
  knowledge/                        # metadatos, relaciones, reglas y ejemplos ficticios
  fixtures/                         # datasets ficticios y estados controlados
  eval/            gold/, metrics.py, reports/  # P-17 (sin pesos)
  training/        configs/, README.md          # configuración, procedencia, versiones (D-9)
  tests/           unit/, contract/, adversarial/, parity/

app/layout.tsx, components/personalized/Sidebar.tsx   # SIN CAMBIOS (CS-1 no autorizado)
lib/auth/, prisma/, .github/, package.json            # SIN CAMBIOS
```

**Structure Decision**: se mantiene el monolito Next.js para el widget, el proxy y las
validaciones del lado ERP, siempre con archivos nuevos. Se añade **un segundo proyecto aislado**
(`ai-service/`) para la orquestación, los modelos, el RAG, el SQL y el motor financiero. Ver
[Complexity Tracking](#complexity-tracking). La carpeta **no** se llama `api/` porque Vercel trata
ese directorio raíz como funciones *serverless*.

## Arquitectura y límites de confianza

```text
Navegador (no confiable)
  └─ Widget (C1) ── CT-A ──▶ Proxy ERP /api/assistant (C2)
                              ├─ sesionActual()               [solo consumo; DE-1, DE-2]
                              ├─ Revalidación y fechas de Lima (C3)
                              └─ CT-B (API interna autenticada, P-9) ──▶ ai-service (C4)
                                   ├─ Modelo 1: interpretar (C5) ──▶ LlmProvider ──▶ API comercial (P-22)
                                   ├─ Recuperación (C6) ──▶ índice en memoria │ Milvus/Zilliz (P-8)
                                   ├─ Modelo 2 (C7) ──▶ XiYanSQL + QLoRA (gratuito, P-7a)
                                   ├─ SQL Validator (C8)
                                   ├─ SQL Executor (C9) ──▶ PostgreSQL de solo lectura (DE-3, P-16)
                                   ├─ Motor financiero (C10)
                                   ├─ Modelo 1: explicar con marcadores (C5) + sustitución de cifras
                                   └─ Auditoría minimizada (C11)
```

| Límite | Regla |
|--------|-------|
| L1: navegador → proxy | Todo es no confiable. Se revalidan sesión, permiso, ruta, filtros y entidades en cada consulta (BR-12). |
| L2: proxy → `ai-service` | Identidad tomada del servidor y autenticación interna (P-9). El navegador nunca llama a `ai-service`. |
| L3: `ai-service` → proveedores de inferencia | BR-13 y P-21: sin preguntas reales, datos personales, resultados ni importes hasta resolver P-21. En la Etapa 0, cero llamadas reales. |
| L4: `ai-service` → índice vectorial | Solo metadatos y ejemplos ficticios. El embedding de la pregunta se calcula en local (CPU); su envío a un índice externo forma parte de P-21. |
| L5: `ai-service` → PostgreSQL | Solo SQL validado, con credencial de solo lectura. En la Etapa 0, fallo seguro si aparecen `DATABASE_URL` o `DATABASE_URL_READONLY`. |
| L6: modelos → cifras | Ningún modelo produce cifras. Las calculan el Executor y el motor y se insertan mediante marcadores validados. |

**Defensa en profundidad del SQL (D-7)**: el AST de `sqlglot` es **una capa más**, no la seguridad
completa. La cadena es: autorización efectiva, lista de objetos permitidos (P-14), AST, validación
semántica, credencial restringida (P-16) y límites de ejecución (SEC-2).

**Paridad del motor financiero (D-4)**: el motor Python se contrasta con
`lib/accounting/balance-sheet.ts` (`signedBalance`, `buildBalanceSheet`, `computePeriodResult`).
Ese archivo **solo se importa en pruebas** y no se modifica.

## Modelos

### Modelo 2: XiYanSQL + QLoRA (D-1)

- **Estado**: el adaptador está en entrenamiento, según información del equipo; aún pendiente de
  evaluación e integración.
- **Requisitos**: versión y hash del adaptador registrados; evaluación base frente a QLoRA sobre el
  conjunto Gold (SC-012); umbral de P-11 (SC-008).
- **Alojamiento (P-7a)**: recursos gratuitos, sujetos a una prueba de viabilidad (SC-017).
- **Si la viabilidad gratuita fracasa, el MVP queda bloqueado** (D-1). Las alternativas se
  documentan en `research.md` (R-05) **sin rebajar el requisito**: otro proveedor gratuito,
  inferencia en CPU con el modelo cuantizado y el adaptador fusionado, o ventanas de inferencia
  programadas.
- La prueba de viabilidad **no empieza mientras el equipo esté entrenando**.

### Modelo 1: interpretación y explicación (D-3, G9)

- **Etapa 0**: reglas y plantillas deterministas como **sustituto temporal**, más un
  `MockLlmProvider` con respuestas ficticias grabadas. **Cero llamadas reales.**
- **MVP**: Modelo 1 real **obligatorio**, mediante una API comercial con límite mensual (P-7b,
  P-22). Sin GPU dedicada. Se mantiene la arquitectura de dos modelos.
- **Evaluación**: exactitud de intención y entidades sobre el conjunto Gold; rúbrica de lenguaje
  claro (SC-013); **100 % de integridad de marcadores**.
- **Protección**: la clave solo vive en el backend Python (SEC-4). Hasta resolver P-21 no se envían
  preguntas reales.

### Interfaz `LlmProvider` (D-12, APROBADA)

```text
LlmProvider (Protocol)
  complete(req: LlmRequest) -> LlmResponse

LlmRequest : { tarea: "interpretar" | "explicar", instrucciones_versionadas,
               entrada_estructurada, esquema_salida, max_tokens_entrada,
               max_tokens_salida, timeout, idTraza }
LlmResponse: { salida_estructurada, tokens_entrada, tokens_salida,
               modelo, version, latencia, costo_estimado }

Adaptadores: MockLlmProvider (Etapa 0) | <Proveedor>Provider (P-22), elegido por configuración
```

- El orquestador depende solo de `Interpreter` y `Explainer`, que a su vez dependen de
  `LlmProvider`. **Cambiar de proveedor = nuevo adaptador + configuración**, sin tocar el
  orquestador.
- Contratos tipados y **respuestas estructuradas validadas con Pydantic**. Si una respuesta no
  cumple el esquema, el estado es `no_resoluble`, sin reintentos ilimitados.
- **Validación de marcadores contra los resultados autorizados**:
  - la explicación solo puede citar identificadores de marcador (`{{c1}}`) que existan en el
    conjunto de cifras autorizadas de esa consulta;
  - cada marcador se resuelve contra la evidencia del Executor o del motor;
  - se rechazan marcadores desconocidos, duplicados incoherentes o ausentes;
  - además, como capa adicional, se rechaza cualquier número literal que no sea un marcador o una
    fecha permitida. **No se depende solo de buscar números en el texto.**
- Pruebas de contrato comunes para todos los adaptadores.

### Controles de consumo del Modelo 1 (D-13 parcialmente aprobada, D-14 aprobada)

| Control | Diseño |
|---------|--------|
| Límite del proveedor | **Verificar** si existe un límite real de gasto, un saldo prepago o un mecanismo equivalente (R-04). **No se presupone.** |
| Contador interno y cortacircuitos | Lleva la cuenta del consumo estimado y deja de llamar al alcanzar el límite. **Persistencia y estrategia definitivas pendientes de investigación** (R-06). |
| Fallo seguro | Si no se puede verificar el presupuesto restante, **no** se hacen llamadas facturables. |
| Límites por solicitud | Como máximo 1 llamada de interpretación y 1 de explicación por consulta; como máximo 1 reintento, solo ante errores transitorios; *timeout* corto. |
| Límites de tokens | `max_tokens_entrada` y `max_tokens_salida` por tarea. El historial y los fragmentos se truncan antes de enviarlos (BR-11). |
| Límite por usuario | Tasa máxima que devuelve `429` (NFR-007, P-11). |
| Evitar llamadas innecesarias | Un prefiltro determinista resuelve sin LLM los mensajes vacíos o largos, las peticiones de escritura o fuera de dominio evidentes y las validaciones fallidas. Si el resultado es `sin_datos` o un error, se responde con plantilla. |
| Registro de uso | Por llamada: `idTraza`, tarea, modelo y versión, tokens, costo estimado, latencia y resultado. **Sin prompts ni respuestas** (SEC-8). |
| Presupuesto agotado (D-14) | **Ninguna llamada facturable nueva** y `503` controlado, sin detalles económicos para el usuario. La degradación a reglas y plantillas queda para una decisión futura. |
| Etapa 0 | Ningún mecanismo de pago ni servicio comercial configurado. Una prueba falla si se configura un adaptador real. |

## Contratos

> Detalle completo pendiente en `contracts/` (fase 1). Aquí se fija su forma conceptual.

**CT-A (widget → proxy)**: `POST /api/assistant` (ruta propuesta, D-5)

```text
Request : { mensaje, contextoPantalla: { ruta, filtros }, historial: [{ rol, texto }] (≤ N),
            idConversacion }
Response: 200 { estado, texto, idTraza }  |  4xx/5xx { error, errores? }
estado  : respondida | sin_datos | requiere_aclaracion | solo_lectura | fuera_de_dominio |
          no_resoluble
```

**CT-B (proxy → `ai-service`)**: `POST /v1/queries`, con autenticación interna (P-9)

```text
Request : { idTraza, usuario: { id, rol } (del servidor), mensaje, contexto (revalidado),
            historial (noConfiable), fechaReferenciaLima }
Response: { estado, texto, cifras[], evidencias[], versiones, idTraza }
          → el proxy reenvía al navegador solo estado, texto e idTraza
```

En la **Etapa 0** ambos contratos son **síncronos y simulados**. El contrato definitivo depende de
D-2.

**Interfaces internas de `ai-service`** (cada una con implementación simulada y real):

| Interfaz | Responsabilidad | Implementación en la Etapa 0 |
|----------|-----------------|------------------------------|
| `Interpreter` | Intención y entidades | Reglas + `MockLlmProvider` |
| `Retriever` | Fragmentos top-k | Índice en memoria con embeddings en CPU |
| `SqlGenerator` | SQL candidato | Simulado: SQL predefinido por caso del conjunto Gold |
| `SqlValidator` | Veredicto con motivos | Real (AST de `sqlglot` + lista permitida + semántica) |
| `SqlExecutor` | Filas tipadas | Fixtures en memoria; PostgreSQL desechable tras P-18 |
| `FinanceEngine` | Indicadores deterministas | Real |
| `Explainer` | Texto con marcadores | Plantillas + `MockLlmProvider` |
| `LlmProvider` | Llamadas al Modelo 1 | `MockLlmProvider` |
| `BudgetGuard` / `UsageLog` | Consumo del Modelo 1 | Reales, con reloj y costos simulados |
| `AuditSink` | Trazas minimizadas | En memoria |

## Modelo de ejecución (D-2, PENDIENTE)

**Límites a verificar (R-01)**: según la documentación de Vercel conocida antes de este plan, el
plan Hobby sin *Fluid compute* tenía una duración por defecto de unos 10 s y un máximo de 60 s, y
*Fluid compute* amplía ese máximo a varios minutos. **Deben confirmarse en el proyecto real**: el
plan contratado, si *Fluid compute* está activo y el `maxDuration` permitido. También hay que
revisar los términos del plan Hobby, pensado para uso personal y no comercial.

| Opción | Estado de los trabajos | Ante la suspensión de un servicio gratuito | Valoración |
|--------|------------------------|--------------------------------------------|------------|
| A. Síncrona, con `maxDuration` y *timeout* de CT-B inferior al límite | Ninguno | `503`/`504` controlado; no se pierden datos, solo la respuesta; el usuario reintenta | La más simple. Viable si la latencia p95 con arranque en frío cabe en el límite |
| B. *Streaming* (SSE o `ReadableStream`) | Ninguno | Igual que A | Mejora la espera, **no** amplía el límite |
| C. Asíncrona (`POST` + `GET` por `idTraza`) | Requiere un almacén externo y duradero | Ver controles | Solo si A no cabe |

**Almacenes posibles para C**:
- memoria de `ai-service`: descartada, se pierde al suspenderse;
- Neon del ERP: prohibido, requiere cambios de esquema;
- disco del alojamiento gratuito: suele ser efímero;
- **Upstash Redis del ERP**: registrado como **CS-5, identificado y no autorizado**. No se usa ni se
  modifica.

**Controles obligatorios si se adoptara C**:
- identificador aleatorio de 128 bits vinculado en el servidor a `idUsuario` y a la sesión;
- el `GET` revalida sesión y permiso y comprueba que el trabajo pertenece al usuario;
- caducidad corta y borrado del resultado tras entregarlo o al expirar;
- el almacén guarda solo `estado` y `texto` mínimos, cifrados si contienen cifras, y nunca SQL,
  filas ni historial;
- estados terminales `expirado` y `fallido`, sin resultados parciales;
- idempotencia por `idTraza`.

**Regla de decisión**: Etapa 0 síncrona simulada. Tras F6 se elige A si la latencia p95 medida,
con margen, cabe en el límite verificado. Si no, se presenta la opción C para aprobación. **No se
implementa ninguna cola ni almacén de trabajos hasta entonces.**

## Fases de implementación

| Fase | Contenido | ¿Se puede empezar ya? | Bloqueos |
|------|-----------|-----------------------|----------|
| **F0: Documentación** | `research.md`, `data-model.md`, `contracts/`, `quickstart.md` | ✅ con aprobación de cada artefacto | — |
| **F1: Núcleo determinista** | C8 Validator, C10 motor con paridad, C11 enmascaramiento, `BudgetGuard`/`UsageLog`, modelos Pydantic de los contratos | ✅ solo CPU | — |
| **F2: ERP aislado** | C3 (contexto y fechas de Lima), reducer y lista de rutas del widget, C2 proxy con `sesionActual()` y cliente CT-B simulados | ⚠️ tras autorizar `npm install` | Gate de documentación de Next 16; renderizado (D-6, CS-3) |
| **F3: Orquestador simulado** | C4 de extremo a extremo con todas las interfaces simuladas; batería adversarial; inspección de peticiones salientes (SC-016); controles de consumo (SC-018) | ✅ | — |
| **F4: Conocimiento y conjunto Gold** | Metadatos derivados de `schema.prisma` (solo lectura), reglas, ejemplos ficticios, embeddings en CPU, índice en memoria, métricas RAG | ✅ | Zilliz real: P-8 |
| **F5: Executor real** | PostgreSQL desechable, fallo seguro, credencial que deniega escrituras | ⛔ | P-18 |
| **F6: Modelos reales** | Viabilidad del Modelo 2 (SC-017); evaluación base frente a QLoRA (SC-012); adaptador del Modelo 1 real con datos ficticios; medición de latencias para D-2 | ⛔ | Entrenamiento en curso, P-7, P-21, P-22 |
| **F7: Integración MVP** | Montaje del widget, autenticación interna, rol de solo lectura, objetos permitidos, auditoría definitiva, validación de interfaz y accesibilidad | ⛔ | Puertas G1 a G19 |

**Orden**: F0 → F1 → (F2 ∥ F3) → F4 → F5 → F6 → F7. **F0 a F4 no requieren GPU, datos reales,
Neon, servicios externos ni autorización de otros módulos** (F2 sí requiere autorizar
`npm install`).

## Estrategia de pruebas y evaluación

- **ERP (Vitest, CI existente)**:
  - funciones puras: lista de rutas, reducer (incluida "Nueva conversación"), validación de
    contexto y fechas de Lima con reloj simulado en la franja de 19:00 a 24:00 y en los límites de
    mes (SC-015);
  - proxy con `vi.mock("@/lib/auth/sesion-actual")` y cliente CT-B simulado;
  - **ninguna** prueba usa variables de base de datos ni claves.
- **`ai-service` (pytest, fuera de la CI del ERP)**:
  - Validator con casos permitidos, prohibidos y de evasión (SC-003);
  - motor financiero con valores conocidos y división por cero;
  - enmascaramiento de auditoría (SC-011);
  - contratos contra los payloads JSON compartidos;
  - orquestador simulado y validación de marcadores contra los resultados autorizados (FR-020);
  - `MockLlmProvider` que **hace fallar la prueba** si detecta importes, datos personales o
    preguntas no ficticias (SC-016);
  - controles de consumo: presupuesto agotado o imposible de verificar → 0 llamadas facturables y
    `503` (SC-018);
  - fallo seguro de la configuración de base de datos (SC-014).
- **Paridad (SC-004)**: fixtures JSON compartidas. Vitest calcula la referencia con
  `lib/accounting/balance-sheet.ts` y pytest comprueba el motor Python.
- **Evaluación (F4, F6)**: conjunto Gold versionado, con control de fuga respecto al dataset de
  entrenamiento (hashes), varias ejecuciones y registro de la variación. **Sin umbrales ni
  resultados predefinidos** (P-11, P-17).
- **Antes de la integración (D-6)**: pruebas de interfaz y accesibilidad (renderizado, foco,
  `Esc`, `aria-label`, lectores de pantalla). Requieren herramientas de DOM que se autorizarán
  aparte (CS-3).

## Puertas que bloquean el MVP

| Puerta | Condición | Referencia |
|--------|-----------|------------|
| G1 | Sesión JWT real emitida por el login | DE-1 |
| G2 | Permiso "usar asistente" y roles definidos | DE-2, P-1 |
| G3 | Rol `xiyansql_readonly` auditado y objetos permitidos definidos | DE-3, P-16, P-14 |
| G4 | Montaje del widget autorizado | CS-1, P-19, DE-5 |
| G5 | Autenticación interna ERP ↔ `ai-service` | P-9 |
| G6 | Política de datos e inferencia externa, incluidos los embeddings de preguntas y el proveedor del Modelo 1 | P-21 |
| G7 | Adaptador QLoRA entrenado, con versión y hash, evaluado en el conjunto Gold y con el umbral alcanzado | P-15, SC-008, SC-012, P-11 |
| G8 | Viabilidad gratuita de la inferencia del Modelo 2 demostrada; **si falla, el MVP queda bloqueado** | P-7a, SC-017, D-1 |
| G9 | **Modelo 1 real mediante API comercial**, evaluado (intención, entidades, lenguaje claro, integridad de marcadores) y protegido | D-3, FR-014, P-22 |
| G10 | D-2 resuelta con latencias medidas y límites de Vercel verificados | D-2, R-01 |
| G11 | Criterio contable de asientos anulados | P-4, DE-6 |
| G12 | Catálogo de indicadores del MVP | P-6 |
| G13 | Política definitiva de auditoría | P-10 |
| G14 | Almacén vectorial validado (Zilliz o alternativa gratuita) | P-8, DE-4 |
| G15 | Validación de interfaz y accesibilidad | D-6, CS-3 |
| G16 | NFR-012 verificado (build y CI sin variables nuevas) | NFR-012 |
| G17 | Variables de despliegue configuradas por la plataforma | DE-7 |
| G18 | Riesgo de integración `main` ↔ `develop` resuelto por el equipo | RSK-INT |
| G19 | Proveedor y presupuesto del Modelo 1 definidos, y controles de consumo probados (incluido verificar el límite real del proveedor) | P-22, D-13, D-14, SC-018 |

## Riesgos y dependencias

| # | Riesgo | Mitigación |
|---|--------|------------|
| RSK-01 | P-15 + infraestructura gratuita + sin GPU local + P-7a sin validar: el MVP podría ser inviable | D-1: el MVP queda bloqueado y se documentan alternativas sin rebajar el requisito |
| RSK-02 | Límite de duración de las funciones de Vercel frente a una inferencia lenta o con arranque en frío | D-2 pendiente con la regla de decisión; R-01 |
| RSK-03 | Fuga de información por los embeddings de preguntas enviados a un índice externo | Embedding local; incluido en P-21 (G6) |
| RSK-04 | Divergencia entre las reglas PCGE de TypeScript y el motor Python | Pruebas de paridad (SC-004) |
| RSK-05 | La exclusión de `income-statement` (P-2) cambia cuando `main` se integre en `develop` | Decisión explícita en ese momento |
| RSK-06 | Sin herramientas de DOM: no se puede renderizar el widget en pruebas | D-6: lógica pura ahora; validación de interfaz antes de integrar (G15) |
| RSK-07 | Contaminación del conjunto Gold con datos de entrenamiento | Hashes del dataset y control de fuga |
| RSK-08 | Soporte de Milvus Lite en Windows sin verificar | Índice propio en memoria detrás de `Retriever` |
| RSK-09 | Desfase de esquema entre ramas | Metadatos versionados con el hash de `schema.prisma` |
| RSK-10 | Sin CI para Python | Comando local documentado en `quickstart.md` |
| RSK-11 | Lint de base con 100 problemas | Criterio de 0 problemas nuevos |
| RSK-INT | `main` tiene 10 commits que no están en `develop` (Estado de Resultados implementado, cambios en `package.json`) y **dos carpetas `021`** | Registrado como riesgo de integración, **sin modificar ni fusionar ramas** (G18) |
| RSK-ENV | `node_modules/` ausente: no se puede leer la documentación de Next 16 | Autorizar `npm install` antes de F2 |
| RSK-RES | GPU y RAM ocupadas por el entrenamiento | Sin procesos pesados; F6 después del entrenamiento |
| RSK-TOS | Términos del plan Hobby de Vercel | Revisión en R-01 |
| RSK-ECO1 | Gasto excesivo del Modelo 1 por bucles, reintentos o abuso | Cortacircuitos, límites de solicitud, tokens y usuario; fallo seguro (D-13) |
| RSK-ECO2 | El proveedor podría no ofrecer un límite estricto de gasto, o el contador interno podría perderse si el servicio se suspende | Verificación en R-04; persistencia en R-06; fallo seguro si no se puede verificar el saldo |
| RSK-ECO3 | Cambios de precio o de modelo del proveedor | Interfaz `LlmProvider`; tabla de precios versionada en configuración |
| RSK-PRIV | Retención de datos o uso para entrenamiento por parte del proveedor del Modelo 1 | P-21 y P-22; solo pregunta mínima y marcadores |
| RSK-DEP | Dependencia de un proveedor comercial | Pruebas de contrato que permiten cambiarlo |

**Dependencias externas**: DE-1 a DE-7 de la spec, más los cambios compartidos CS-1 a CS-5, todos
**no autorizados**.

## Registro de decisiones del plan

| # | Estado | Decisión |
|---|--------|----------|
| D-1 | APROBADA | El MVP requiere inferencia real con QLoRA. Si la viabilidad gratuita fracasa, el MVP queda bloqueado y se documentan alternativas sin rebajar el requisito. |
| D-2 | **PENDIENTE** | Modelo de ejecución síncrono o asíncrono. Etapa 0 síncrona simulada; decisión tras medir latencias y verificar los límites (R-01). Sin cola ni almacén de trabajos. |
| D-3 | APROBADA | Dos modelos. Reglas y plantillas solo como sustituto temporal en la Etapa 0. El Modelo 1 real es obligatorio en el MVP (G9). |
| D-4 | APROBADA | Motor financiero en Python con pruebas de paridad, sin modificar las reglas existentes. |
| D-5 | APROBADA | Carpeta `ai-service/` y ruta propuesta `/api/assistant`. |
| D-6 | APROBADA | Lógica pura del widget con las herramientas existentes; validación de interfaz y accesibilidad obligatoria antes de integrar. |
| D-7 | APROBADA | `sqlglot` (postgres) y `psycopg` 3. El AST no sustituye los demás controles. |
| D-8 | APROBADA | Embeddings ligeros en CPU e índice en memoria en la Etapa 0; Milvus evaluado después. |
| D-9 | APROBADA | Pesos y adaptadores fuera de Git; se documentan configuración, procedencia, versiones y reproducibilidad. |
| D-10 | APROBADA | Documentos redactados a mano según las convenciones de Spec Kit, sin instalar herramientas. |
| D-11 | APROBADA | P-21 cubre los embeddings de preguntas enviados a servicios externos. |
| D-12 | APROBADA | Interfaz `LlmProvider` desacoplada, contratos tipados y salidas validadas con Pydantic. |
| D-13 | **PARCIALMENTE APROBADA** | Doble control de gasto: verificar el límite real del proveedor sin presuponerlo; contador interno y cortacircuitos; límites de tokens, solicitudes y reintentos; fallo seguro. Persistencia y estrategia definitivas pendientes (R-06). Sin mecanismos de pago ni servicios comerciales configurados. |
| D-14 | APROBADA | Presupuesto agotado → ninguna llamada facturable y `503` sin detalles económicos. La degradación a reglas queda para una decisión futura. |

**Decisiones de la spec que siguen PENDIENTES**: P-1, P-4, P-6, P-9, P-10, P-11, P-14, P-16, P-18,
P-19, P-20, P-21 y P-22. Ver el [Registro de decisiones](./spec.md#registro-de-decisiones) de la
spec.

**Investigaciones previstas para `research.md`**:

| # | Tema |
|---|------|
| R-01 | Límites reales de Vercel (plan, *Fluid compute*, `maxDuration`) y términos del plan Hobby |
| R-02 | Versión de Python alineada con el entorno de entrenamiento |
| R-03 | Biblioteca de embeddings ligera en CPU y su calidad en español |
| R-04 | Candidatos de proveedor del Modelo 1: salida estructurada, retención de datos y uso para entrenamiento, límite de gasto o saldo prepago, costo y calidad en español (insumo de P-22) |
| R-05 | Opciones gratuitas de inferencia para XiYanSQL + QLoRA y alternativas en caso de fracaso |
| R-06 | Persistencia del contador de consumo y estrategia definitiva de control de gasto |

## Artefactos de Spec Kit pendientes

| Artefacto | Contenido previsto | Estado |
|-----------|--------------------|--------|
| `research.md` | R-01 a R-06 y alternativas de D-1 y D-2 | PENDIENTE |
| `data-model.md` | Entidades lógicas: consulta, intención, fragmento, SQL candidato, veredicto, resultado, cifra, marcador, traza, registro de consumo | PENDIENTE |
| `contracts/` | CT-A, CT-B, `LlmProvider` y payloads JSON de ejemplo compartidos | PENDIENTE |
| `quickstart.md` | Cómo ejecutar las pruebas de la Etapa 0 sin GPU, sin datos reales y sin servicios externos | PENDIENTE |
| `tasks.md` | Desglose de tareas (`/speckit.tasks`) | PENDIENTE |

Cada artefacto requiere aprobación antes de crearse.

## Trazabilidad

| Requisito | Fase | Componente | Puerta |
|-----------|------|------------|--------|
| FR-001, FR-002, FR-003, FR-025 | F2, F7 | C1 | G4, G15 |
| FR-006 (sin SQL visible) | F2 | C1 | G15 |
| FR-007, FR-008, FR-023 | F2, F3 | C2, C3 | G1, G2 |
| FR-009, FR-017 | F1, F3 | C8 | G3 |
| FR-010, FR-019 | F1 | C10 | G11, G12 |
| FR-011, FR-022 | F1, F3 | C11 | G13 |
| FR-012, FR-021 | F2, F3 | C2, C4 | G5, G10 |
| FR-013 | F2 | C2 | G1, G5 |
| FR-014, FR-020, FR-024 | F3, F6 | C5 | G6, G9, G19 |
| FR-015 | F4 | C6 | G6, G14 |
| FR-016 | F6 | C7 | G7, G8 |
| FR-018 | F5 | C9 | G3 |
| FR-026 | F2 | C3 | — |
| NFR-006, NFR-008 | F4, F6 | C6, C7 | G7 |
| NFR-011 | F1–F5 | Todos | — |
| NFR-012 | F7 | C1, C2 | G16 |
| NFR-013 | F3, F6 | C4, C5 | G6 |
| NFR-014 | F3, F6 | C4, C5, C7 | G8, G19 |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Segundo proyecto en Python dentro del repositorio | La inferencia, `sqlglot`, `psycopg` y el RAG viven en el ecosistema Python. Lo exigen AR-1 y P-13. | Implementarlo todo en TypeScript: sin el ecosistema de QLoRA y mezclado con el ERP |
| Motor financiero en Python además de las reglas en TypeScript | Separación de AR-1 (D-4) | Llamar al ERP rompería el aislamiento. Se mitiga con pruebas de paridad |
| Dos implementaciones del Modelo 1 (sustituto y real) | Sustituto temporal de la Etapa 0 (D-3) | Esperar al modelo real bloquearía F3 |
| Capa de proveedor `LlmProvider` | Cambiar de proveedor sin tocar el orquestador (D-12) | Acoplarse a un SDK concreto antes de resolver P-22 |

---

## Implementation Notes

*Sección vacía. Se completará durante la implementación, siguiendo la convención del plan 021.*
