# Despliegue para la evaluación académica del Asistente Financiero IA

Guía para una sesión de evaluación **coordinada y temporal** sobre el ERP en **Vercel Production**.
Se consultan **datos financieros reales** de PostgreSQL Neon con un usuario de **solo lectura**. No es
un servicio permanente: al terminar, el chatbot se deshabilita.

```text
Navegador (cuenta ADMIN evaluadora)
  → Next.js en Vercel Production — /api/assistant
      sesionActual() (login del ERP) + rol ADMIN + cuenta evaluadora + identidad firmada P-9 + token interno
  → Cloudflare Tunnel HTTPS temporal (https://<aleatorio>.trycloudflare.com)
  → FastAPI en la laptop (127.0.0.1:8001, AI_SERVICE_EVAL_MODE=1 + AI_SERVICE_EVAL_REAL_DATA=1)
      cuenta evaluadora (de nuevo) → GPT-6 Luna → RAG Milvus → XiYanSQL v17 (GPU WSL)
      → SQL Validator + allowlist → P-4 → PostgresReadOnlyExecutor (READ ONLY, 5 s, ≤ 50 filas)
  → PostgreSQL Neon (DATABASE_URL_READONLY) → FinanceEngine → respuesta con cifras verificadas
```

## Controles activos

| Capa | Control |
|---|---|
| Next.js `config.ts` | Production solo con `AI_ASSISTANT_EVAL_ENABLED=1` y `AI_ASSISTANT_ALLOW_PRODUCTION_EVAL=1`, y además `AI_ASSISTANT_EVAL_USER_IDS`. Sin esa lista queda deshabilitado (404): nunca se abre a todos los ADMIN. |
| Next.js `config.ts` | `AI_ASSISTANT_REAL_DATA=1` en evaluación solo es válido con `AI_ASSISTANT_EVAL_USER_IDS`. |
| Next.js `proxy.ts` | `sesionActual()` → 401 sin sesión; rol distinto de ADMIN → 403; ADMIN que no es cuenta evaluadora → 403. El widget no aparece en esos casos. |
| Next.js | Token interno y P-9 obligatorios. URL `https://*.trycloudflare.com`. El proxy corta a los 55 s (`maxDuration = 60`). |
| FastAPI `settings.py` | Datos reales solo con `AI_SERVICE_EVAL_REAL_DATA=1` **y** `AI_SQL_EXECUTOR=postgres_readonly` explícito **y** `AI_SERVICE_EVAL_ALLOWED_USER_IDS`. Cualquier combinación parcial impide arrancar. Sin la bandera sigue obligatorio el Executor ficticio. |
| FastAPI `settings.py` | Lee solo `DATABASE_URL_READONLY` (entorno o `ai-service/.env`), nunca `DATABASE_URL`; rechaza que ambas coincidan. Espera máxima: `AI_SQLGEN_TIMEOUT_S + 2 × AI_LLM_TIMEOUT_S + 5 ≤ 50`. |
| FastAPI `routes.py` | Token interno → identidad P-9 válida (401) → usuario en `AI_SERVICE_EVAL_ALLOWED_USER_IDS` (403). Hasta entonces no se invoca ningún modelo ni la base. |
| SQL | Validador con la allowlist financiera (`allowlist.readonly_erp.json`: 3 tablas y columnas explícitas). Una sola sentencia `SELECT`; sin escritura, DDL ni otras tablas. Forma `saldo_cuenta` verificada. P-4 añade `journal_entry.status = TRUE`. |
| Executor | Solo identidad `erp-session` (P-9). Revalida el SQL y exige el filtro P-4. Transacción `READ ONLY` comprobada con `SHOW transaction_read_only`, `statement_timeout` 5 s, `lock_timeout` 2 s, más de 50 filas → rechazo. Errores sin mensajes del controlador. |
| Respuesta y registros | Al navegador solo llegan las cifras c1–c3 calculadas por FinanceEngine y el detalle del cálculo, nunca filas ni columnas. La auditoría es en memoria: usuario seudonimizado (HMAC), plantilla SQL sin literales y número de filas. Uvicorn no registra accesos. |

## 1. Variables de nuestro módulo

### Vercel → Settings → Environment Variables → **Production**

| Variable | Valor |
|---|---|
| `AI_ASSISTANT_EVAL_ENABLED` | `1` |
| `AI_ASSISTANT_ALLOW_PRODUCTION_EVAL` | `1` |
| `AI_ASSISTANT_EVAL_USER_IDS` | Id de la cuenta ADMIN evaluadora, p. ej. `7` (varios: `7,12`) |
| `AI_ASSISTANT_REAL_DATA` | `1` |
| `AI_SERVICE_URL` | `https://<aleatorio>.trycloudflare.com` (sin `/` final) |
| `AI_SERVICE_INTERNAL_TOKEN` | Hex de 64 caracteres; el mismo que en FastAPI |
| `AI_ASSISTANT_IDENTITY_KEY` | Hex de 64 caracteres; la misma que en FastAPI y distinta del token |

No definas `AI_ASSISTANT_DEMO`. Ninguna de estas variables llega al navegador.

**Cómo obtener el id de la cuenta evaluadora** (sin consultar la base): inicia sesión en Production con
esa cuenta y abre `https://<dominio-del-erp>/api/auth/me`. El valor `idUsuario` es el id. Usa el mismo
valor en Vercel y en FastAPI.

### FastAPI (sesión de PowerShell; ver sección 4)

`AI_SERVICE_EVAL_MODE=1`, `AI_SERVICE_EVAL_REAL_DATA=1`, `AI_SERVICE_EVAL_ALLOWED_USER_IDS=<id>` y
`AI_SQL_EXECUTOR=postgres_readonly`. `DATABASE_URL_READONLY` ya está en `ai-service/.env`.

## 2. Variables del ERP que NO debemos modificar

- **`SESSION_SECRET`**: login del ERP (`lib/auth/session.ts`). El asistente no la lee; reutiliza la
  sesión mediante `sesionActual()`.
- **`DATABASE_URL`** (conexión de escritura del ERP y Prisma). FastAPI nunca la lee; no la definas en
  su sesión.
- Credenciales, roles y permisos de Neon: no se cambian.

## 3. Iniciar XiYanSQL v17 (GPU, WSL)

Si ya está en ejecución con el adaptador v17, no lo reinicies. Comprobación, dentro de
`wsl -d Ubuntu-24.04`:

```bash
T=$(cat ~/.config/xiyan-inference/token)
curl -s -H "X-Inference-Token: $T" http://127.0.0.1:8011/v1/health; unset T
# Esperado: "status":"ready" y "adapter":"xiyansql_v17_json_v10_balanced_full"
```

Para iniciarlo desde cero:

```bash
S=~/.local/state/xiyan-inference; EXPECTED=xiyansql_v17_json_v10_balanced_full
PATTERN="^$HOME/proyectos/modeloQLoRA/venvQLoRA/bin/python -m inference_server[.]main([[:space:]]|\$)"
pgrep -f "$PATTERN" >/dev/null && { echo "Ya hay un servidor activo"; exit 1; }
ss -ltn | grep -q "127.0.0.1:8011 " && { echo "Puerto 8011 ocupado"; exit 1; }
cd "/mnt/d/Study/Taller Integrador I/ERP_with_LoRA/ai-service"
XIYAN_SERVER_ENV=development XIYAN_SERVER_TOKEN="$(cat ~/.config/xiyan-inference/token)" \
XIYAN_ADAPTER_ID=$EXPECTED XIYAN_ADAPTER_DIR=$HOME/proyectos/modeloQLoRA/outputs/adapters/$EXPECTED \
HF_HUB_CACHE=$HOME/modelos/huggingface-hub PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src:. \
setsid nohup $HOME/proyectos/modeloQLoRA/venvQLoRA/bin/python -m inference_server.main > $S/server.log 2>&1 < /dev/null &
echo $! > $S/server.pid
```

## 4. Iniciar FastAPI con PostgreSQL de solo lectura (PowerShell, Windows)

**Antes, una vez:** verifica la credencial sin leer datos de negocio. La comprobación consulta solo el
catálogo: `SELECT 1`, el modo de solo lectura, los privilegios SELECT de la allowlist y la
**ausencia de privilegios de escritura** del rol.

```powershell
cd "D:\Study\Taller Integrador I\ERP_with_LoRA\ai-service"
$env:PYTHONPATH = "src"; .venv\Scripts\python.exe -m ai_service.execution.check_connection
# Esperado: SELECT 1: OK | sesión de solo lectura: sí / Privilegios SELECT … completos /
#           Privilegios de escritura del rol: ninguno (solo lectura). Si algo falla, no continúes.
```

**Arranque definitivo** (`.env` aporta `OPENAI_API_KEY`, `ZILLIZ_CLOUD_URI`, `ZILLIZ_CLOUD_TOKEN`,
`AI_ASSISTANT_IDENTITY_KEY` y `DATABASE_URL_READONLY`; las variables del entorno tienen prioridad):

```powershell
cd "D:\Study\Taller Integrador I\ERP_with_LoRA\ai-service"
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue   # FastAPI nunca usa la conexión del ERP
$env:AI_SERVICE_ENV = "development"
$env:AI_SERVICE_EVAL_MODE = "1"
$env:AI_SERVICE_EVAL_REAL_DATA = "1"
$env:AI_SERVICE_EVAL_ALLOWED_USER_IDS = "<id de la cuenta evaluadora>"
$env:AI_SERVICE_INTERNAL_TOKEN = "<el MISMO valor que en Vercel>"
$env:AI_ASSISTANT_AUDIT_HMAC_KEY = "<otro hex de 64 caracteres, distinto de los demás>"
$env:AI_SQL_GENERATOR = "xiyansql"
$env:AI_SQLGEN_URL = "http://127.0.0.1:8011"
$env:AI_SQLGEN_TOKEN = (wsl.exe -d Ubuntu-24.04 --exec bash -c 'cat ~/.config/xiyan-inference/token').Trim()
$env:AI_SQLGEN_TIMEOUT_S = "20"
$env:AI_SQL_EXECUTOR = "postgres_readonly"
$env:AI_LLM_PROVIDER = "openai"
$env:AI_LLM_PRICE_INPUT_PER_1K_USD = "0.0001"
$env:AI_LLM_PRICE_OUTPUT_PER_1K_USD = "0.0005"
$env:AI_LLM_MONTHLY_LIMIT_USD = "1.00"
$env:AI_LLM_TIMEOUT_S = "12"
$env:AI_RAG_MODE = "milvus"
$env:AI_RAG_REMOTE_CORPUS_SHA256 = "ed2d957455e55e50b4109390736e4e6355b18884fcebb85f8e0dd3beec360fb9"
$env:HF_HUB_OFFLINE = "1"
$env:PYTHONPATH = "src"
.venv\Scripts\python.exe -m ai_service.main
```

- Hex nuevo: `.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"`.
- Si falta algo, o la combinación no es coherente (por ejemplo, datos reales sin cuentas evaluadoras
  o con el Executor ficticio), el proceso termina con `Configuración inválida: …` sin escuchar y sin
  mostrar valores.
- `AI_ASSISTANT_IDENTITY_KEY` debe coincidir con la de Vercel.

## 5. Iniciar el túnel HTTPS temporal (otra terminal)

```powershell
cloudflared tunnel --url http://127.0.0.1:8001 --http-host-header 127.0.0.1
```

- Copia la URL `https://<aleatorio>.trycloudflare.com`; **cambia en cada ejecución**.
- `--http-host-header 127.0.0.1` es necesario porque FastAPI solo acepta ese `Host`.
- Si `cloudflared` no está instalado: `winget install --id Cloudflare.cloudflared`.

## 6. Configurar `AI_SERVICE_URL` y habilitar temporalmente el chatbot en Production

1. Coordina el momento con el equipo: Production es compartido.
2. En Vercel → Settings → Environment Variables → **Production**, crea o actualiza las 7 variables de
   la sección 1. `AI_SERVICE_URL` es la URL del paso 5.
3. Haz **Redeploy** del último despliegue de Production. Las variables solo se aplican a
   despliegues nuevos y no hace falta ningún commit.

## 7. Comprobar el acceso

1. `curl.exe http://127.0.0.1:8001/v1/health` y `curl.exe https://<aleatorio>.trycloudflare.com/v1/health`
   deben responder `{"estado":"ok"}`.
2. `curl.exe -X POST https://<aleatorio>.trycloudflare.com/v1/queries` debe responder `401`.
3. Con la **cuenta evaluadora** (ADMIN) debe aparecer el botón flotante con la etiqueta *Datos reales
   (prueba)*.
4. Con **otro ADMIN** o con un usuario sin rol ADMIN no aparece el botón y `/api/assistant`
   responde `403`.
5. Pregunta de prueba, por ejemplo «¿Cuál fue el movimiento neto de la cuenta 101 (Caja) durante
   septiembre de 2026?». La respuesta muestra el saldo neto de los movimientos del período, el debe y
   el haber; o «sin datos» si la cuenta no tiene movimientos registrados en ese período (ver riesgos).

## 8. Deshabilitar al finalizar

1. En Vercel (Production) **elimina** `AI_ASSISTANT_ALLOW_PRODUCTION_EVAL`, `AI_ASSISTANT_EVAL_ENABLED`,
   `AI_ASSISTANT_REAL_DATA` y `AI_ASSISTANT_EVAL_USER_IDS`, y haz **Redeploy**. El chatbot vuelve a
   responder 404.
2. Cierra el túnel (`Ctrl+C` en `cloudflared`) y detén FastAPI (`Ctrl+C`).
3. Si corresponde, detén XiYanSQL y libera la GPU (dentro de WSL; solo SIGTERM al PID verificado):

   ```bash
   S=~/.local/state/xiyan-inference; P=$(cat $S/server.pid)
   if [ -d /proc/$P ] && [[ "$(tr "\0" " " < /proc/$P/cmdline)" == "$HOME/proyectos/modeloQLoRA/venvQLoRA/bin/python -m inference_server.main "* ]]; then
     kill -TERM "$P"; for i in $(seq 1 30); do [ -d /proc/$P ] || break; sleep 1; done
     [ -d /proc/$P ] && echo "Sigue activo: revisar (sin kill -9)" || { echo "Detenido"; rm -f $S/server.pid; }
   else echo "El PID no corresponde al servidor XiYanSQL"; fi
   ```

4. Retira de Vercel el token interno si lo creaste solo para la evaluación.

## Riesgos y limitaciones conocidas

- **Cuentas padre sin movimientos.** La única consulta real previa (cuenta 101, septiembre de 2026)
  devolvió 0 filas. Hipótesis no confirmada: los asientos se registran en subcuentas, como 1011. El
  asistente no agrega la jerarquía de cuentas, así que conviene probar con códigos que tengan
  movimientos directos.
- **Solo consultas de saldo de una cuenta en un período** (`saldo_cuenta`). Otras preguntas se
  responden como no resolubles.
- **Nombre visible de la cuenta.** `cuenta_nombre` sale de un catálogo local de demostración
  (`fixtures/dev_dataset_erp.json`), no de Neon; puede no coincidir con el nombre real.
- **Allowlist y roles provisionales (P-14).** `allowlist.readonly_erp.json` declara la allowlist y
  los nombres de rol como provisionales, aunque las columnas las verificó el equipo el 2026-10-13.
- **Primera consulta lenta.** Neon puede suspender el cómputo; la primera conexión puede superar el
  tiempo de conexión de 5 s y responder «no disponible». Reintenta.
- **Reloj.** La identidad P-9 vive 60 s: el reloj de la laptop debe estar sincronizado.
- **Presupuesto y auditoría solo en memoria.** Se reinician al reiniciar FastAPI. El límite mensual
  de OpenAI no persiste.
- **Exposición del túnel.** Mientras el túnel está abierto, `/v1/health` es público. `/v1/queries`
  exige token, P-9 y cuenta evaluadora.
