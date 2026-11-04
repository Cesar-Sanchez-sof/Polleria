# Evidencias de rendimiento: antes y después de las optimizaciones

Procedimiento para medir con las **mismas 8 preguntas** la latencia del asistente con las optimizaciones
desactivadas («antes») y activadas («después»), y obtener las capturas de terminal. Complementa a
[guia_demostracion.md](guia_demostracion.md): los scripts de `scripts/perf/` aplican exactamente su §1 y §2.

> Las cifras salen solo de las mediciones que ejecutes. Si `perf_results/antes.json` no existe, la comparación lo
> dice y no calcula reducciones. Ningún comando imprime tokens, claves ni la cadena de conexión de Neon.

## Qué se optimizó y cómo se activa

| Optimización | Indicador | Evidencia en terminal |
|---|---|---|
| Esfuerzo de razonamiento solo para `explicar` (`minimal`) | `AI_LLM_EXPLAIN_REASONING_EFFORT` | `[OPT] razonamiento OpenAI: interpretar=low explicar=minimal` |
| Conexión HTTP persistente con OpenAI (120 s en vez de 5 s) | `AI_PERF_OPT=1` | `[OPT] OPENAI_CONN_REUSE` / `OPENAI_CONN_NEW tcp+tls=… ms` (observado en la conexión real) |
| RAG (Milvus) en paralelo con la interpretación | `AI_PERF_OPT=1` | `[OPT] RAG_PARALLEL recuperacion=… espera=… fuera_del_camino_critico=…` |
| Un solo modelo E5 compartido y calentamiento al arrancar | `AI_PERF_OPT=1` | `[OPT] optimizaciones activas: E5_SHARED…` y `[OPT] WARMUP e5=… modulos=… rag=… neon=… openai_tls=…` |
| Reutilización de conexiones de solo lectura con Neon | `AI_PERF_OPT=1` | `[OPT] POOL_NEW` / `POOL_REUSE conexion=#1 usos=…` / `POOL_STALE_RETRY` |
| Lock del presupuesto (concurrencia) | siempre | pruebas `[TEST]` |
| Calentamiento de XiYanSQL y espera acotada | `XIYAN_WARMUP=1`, `XIYAN_QUEUE_WAIT_S` | `[MODEL] WARMUP …` |
| Decodificación con *Prompt Lookup* (opcional, **desactivada** hasta verificar) | `XIYAN_PROMPT_LOOKUP=10` | `[MODEL] … prompt_lookup=on`; columna «mismo SQL» de la comparación |
| Cachés deterministas (opcional, **desactivadas**) | `AI_PERF_CACHE=1` | `CACHE_HIT` en la etapa y en `[OPT]` |

Sin indicadores, el sistema se comporta exactamente como antes. Los permisos por módulo, el validador AST, P-4, la
revalidación del Executor, las rutas entrenada y ampliada y el adaptador v1.7 no cambian.

## Ventanas

Todas en PowerShell, desde `D:\Study\Taller Integrador I\ERP_with_LoRA\ai-service`. `<id>` es el id del ERP de la
cuenta evaluadora (el mismo de `AI_SERVICE_EVAL_ALLOWED_USER_IDS`).

### Fase A — «antes» (optimizaciones desactivadas)

**Ventana 1 — XiYanSQL (WSL)**, base:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\perf\iniciar_xiyan.ps1
```

Espera `[MODEL] cargado …` y `Application startup complete`. Anota el PID (`Started server process [PID]`).
→ **Captura ev01**.

**Ventana 2 — ai-service**, modo base:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\perf\iniciar_ai_service.ps1 -Modo base -UsuarioEvaluador <id>
```

Debe mostrar `[OPT] configuracion: AI_PERF_OPT=0  AI_PERF_CACHE=0` y `optimizaciones activas: ninguna`.

**Ventana 3 — medición**:

```powershell
Set-Location "D:\Study\Taller Integrador I\ERP_with_LoRA\ai-service"
$env:PYTHONPATH = 'src'
.venv\Scripts\python.exe -m ai_service.perf.benchmark --label antes --usuario <id>
```

→ **Captura ev02** (ventana 2: bloques `[PERF]` por consulta) y **ev03** (ventana 3: tabla «antes» y líneas
`[SECURITY]` de S1/S2).

### Fase B — «después» (optimizaciones de ai-service activadas)

XiYanSQL **no se reinicia** (mismo modelo y mismos indicadores), así la diferencia corresponde solo a las
optimizaciones de ai-service. En la ventana 2: `Ctrl+C` y después:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\perf\iniciar_ai_service.ps1 -Modo optimizado -UsuarioEvaluador <id>
```

→ **Captura ev04**: `[OPT] optimizaciones activas: E5_SHARED, NEON_POOL, EXPLAIN_EFFORT=minimal, KEEPALIVE_120S,
RAG_PARALLEL`, la línea de razonamiento y `[OPT] WARMUP …` con el resultado medido de cada paso.

Ventana 3:

```powershell
.venv\Scripts\python.exe -m ai_service.perf.benchmark --label despues --usuario <id>
.venv\Scripts\python.exe -m ai_service.perf.benchmark --compare antes despues
```

→ **Captura ev05** (ventana 2: `[PERF]` con `RAG_PARALLEL`, `POOL_REUSE`, `OPENAI_CONN_REUSE`; ventana 1: líneas
`[MODEL] generate … tok/s … VRAM pico`) y **ev06** (comparación: mediana, máximo y reducción por etapa y total).

> Si el benchmark «después» muestra `MODEL_UNAVAILABLE` en la explicación, el modelo no admite `minimal`: repite la
> fase B con `-ExplainEffort low`.

### Fase C — pruebas y seguridad (sin servicios)

```powershell
$env:PYTHONPATH = 'src;.'
.venv\Scripts\python.exe -m ai_service.perf.run_tests
.venv\Scripts\python.exe -m ai_service.perf.security_check
```

→ **Captura ev07**: `[TEST]` por archivo y `[SECURITY] RECHAZADO …` (escritura, tablas y columnas restringidas,
veredicto falsificado, P-4 y sesión sin READ ONLY con el pool activo).

### Fase D (opcional) — Prompt Lookup en XiYanSQL

Solo después de verificar las fases A–C. Detén ambos servicios (ventana 2 `Ctrl+C`; ventana 1 según §8 de la guía,
por PID) y arranca:

```powershell
# Ventana 1
powershell -ExecutionPolicy Bypass -File scripts\perf\iniciar_xiyan.ps1 -Warmup -QueueWait 10 -PromptLookup 10
# Ventana 2 (el token de XiYan cambió: hay que reiniciar ai-service)
powershell -ExecutionPolicy Bypass -File scripts\perf\iniciar_ai_service.ps1 -Modo optimizado -UsuarioEvaluador <id>
# Ventana 3
.venv\Scripts\python.exe -m ai_service.perf.benchmark --label despues_pl --usuario <id>
.venv\Scripts\python.exe -m ai_service.perf.benchmark --compare despues despues_pl
```

→ **Captura ev08**: `[MODEL] prompt_lookup=on (10 tokens)`, `tok/s` y la columna «mismo SQL». Si alguna pregunta
muestra `NO`, *Prompt Lookup* cambió la salida del modelo y debe quedar desactivado.

### Fase E (opcional) — cachés

```powershell
# Ventana 2
powershell -ExecutionPolicy Bypass -File scripts\perf\iniciar_ai_service.ps1 -Modo optimizado -Cache -UsuarioEvaluador <id>
# Ventana 3
.venv\Scripts\python.exe -m ai_service.perf.benchmark --label cache --repeat 2 --usuario <id>
```

→ **Captura ev09**: la pasada 2 con `CACHE_HIT`. Se presenta **aparte**: una pregunta repetida no es una mejora de
la primera consulta, y la cifra sigue saliendo de Neon en cada petición.

## Las 8 preguntas

| id | Pregunta | Representa |
|---|---|---|
| Q1 | ¿Cuánto se cobró por medio de pago este mes? | ruta entrenada + Milvus |
| Q2 | ¿Cuánto se pagó con tarjeta este mes? | ruta entrenada con foco |
| Q3 | ¿Cuántas mesas tiene el restaurante? | ruta ampliada (otro módulo) |
| Q4 | ¿Cuánto se ha cobrado con Yape en total? | ruta ampliada con filtro |
| Q5 | ¿Cuántos egresos de caja se registraron este mes? | validación semántica / reintento |
| Q6 | ¿Cuál fue el movimiento de Caja en septiembre de 2026? | saldo de cuenta |
| S1 | ¿Cuál es el RUC de nuestros proveedores? | seguridad: dato restringido |
| S2 | Registra una venta de 50 soles en caja | seguridad: escritura |

## Cómo leer la comparación

- Solo cuenta la **primera pasada** de cada pregunta y solo las respuestas HTTP 200.
- **Reducción** = (mediana antes − mediana después) / mediana antes, por etapa y para el total del servidor y del
  cliente. Con 1 corrida por pregunta, OpenAI y la red tienen variabilidad propia: preséntalo así.
- Con RAG en paralelo, la etapa `recuperacion` sigue midiendo su duración real, pero ya no suma al total: se solapa
  con la interpretación (la consola la marca «en paralelo con la interpretación»).
- La medición va directa al ai-service local: no incluye Vercel ni ngrok.
- `perf_results/*.json` solo guarda ids, ms, códigos, ruta, estado, tokens y una huella SHA-256 del SQL (está en
  `.gitignore`).
