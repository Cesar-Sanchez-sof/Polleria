# Despliegue para la evaluación académica del Asistente Financiero IA

Guía para una sesión de evaluación **coordinada y temporal** sobre el ERP en **Vercel Production**.
También funciona en un Preview. No es un servicio permanente: al terminar, el chatbot se deshabilita.

```text
Navegador (cuenta ADMIN del ERP)
  → Next.js en Vercel Production — /api/assistant
      sesionActual() (login del ERP) + rol ADMIN + identidad firmada P-9 + token interno
  → Cloudflare Tunnel HTTPS temporal (https://<aleatorio>.trycloudflare.com)
  → FastAPI en la laptop (127.0.0.1:8001, AI_SERVICE_EVAL_MODE=1)
      GPT-6 Luna (OpenAI) + embeddings ONNX + Milvus/Zilliz + XiYanSQL v17 (GPU en WSL, 127.0.0.1:8011)
  → SQL Validator → Executor FICTICIO → FinanceEngine
```

## Cuándo está habilitado el chatbot (`lib/ai-assistant/config.ts`)

| Entorno (`VERCEL_ENV`) | Condición del lado servidor | Resultado |
|---|---|---|
| Desarrollo local (`next dev`) | `AI_ASSISTANT_DEMO=1` y servicio en `http://127.0.0.1` | Igual que antes |
| `preview` | `AI_ASSISTANT_EVAL_ENABLED=1` | Habilitado |
| `production` | `AI_ASSISTANT_EVAL_ENABLED=1` **y** `AI_ASSISTANT_ALLOW_PRODUCTION_EVAL=1` | Habilitado |
| `production` | Falta cualquiera de las dos banderas (situación por defecto) | Deshabilitado (404) |
| Cualquiera | `AI_ASSISTANT_REAL_DATA=1`, falta P-9, o la URL no es `https://*.trycloudflare.com` | Deshabilitado (404) |

- Ambas banderas son privadas del servidor (sin `NEXT_PUBLIC_`) y deben valer exactamente `1`.
- Aun habilitado, cada solicitud pasa por `sesionActual()`. Sin sesión responde 401; un rol distinto
  de ADMIN responde 403. El widget solo aparece si el servidor confirma el acceso.
- El proxy corta a los 55 s y la ruta declara `maxDuration = 60`.
- FastAPI con `AI_SERVICE_EVAL_MODE=1` exige XiYanSQL, OpenAI, Milvus, `AI_SQL_EXECUTOR=ficticio`
  explícito y la clave P-9. No arranca con `postgres_readonly` ni con `DATABASE_URL_READONLY` en el
  entorno, y `assembly.py` rechaza además ensamblar el Executor real.

## 1. Variables de nuestro módulo (Vercel → Settings → Environment Variables → *Production*)

| Variable | Valor | Uso |
|---|---|---|
| `AI_ASSISTANT_EVAL_ENABLED` | `1` | Activa el modo evaluación |
| `AI_ASSISTANT_ALLOW_PRODUCTION_EVAL` | `1` | Segunda confirmación, solo para Production |
| `AI_SERVICE_URL` | `https://<aleatorio>.trycloudflare.com` (sin `/` final) | Túnel hacia FastAPI |
| `AI_SERVICE_INTERNAL_TOKEN` | Hex de 64 caracteres; el mismo que en FastAPI | Autentica el proxy ante FastAPI |
| `AI_ASSISTANT_IDENTITY_KEY` | Hex de 64 caracteres; la misma que en FastAPI y distinta del token | Firma la identidad P-9 |

**No definas** `AI_ASSISTANT_REAL_DATA` ni `AI_ASSISTANT_DEMO`. `VERCEL_ENV` lo fija Vercel. Ninguna
de estas variables llega al navegador.

## 2. Variables del ERP que NO debemos modificar

- **`SESSION_SECRET`.** Pertenece al login del ERP (`lib/auth/session.ts`, módulo de usuarios):
  firma y verifica la cookie `sesion`. El asistente **no la lee**; solo la usa de forma indirecta al
  llamar a `sesionActual()` → `verificarSesion()` para reutilizar el login. Para hablar con FastAPI
  usa sus propias credenciales, `AI_SERVICE_INTERNAL_TOKEN` y `AI_ASSISTANT_IDENTITY_KEY`.
  `ai-service` tampoco la lee.
- **`DATABASE_URL`** y demás variables de Prisma o de otros módulos.

## 3. Iniciar XiYanSQL v17 (GPU, WSL)

Dentro de Ubuntu-24.04 (`wsl -d Ubuntu-24.04`):

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
# Tras unos 30 s debe responder "ready" con el adaptador v17:
T=$(cat ~/.config/xiyan-inference/token)
curl -s -H "X-Inference-Token: $T" http://127.0.0.1:8011/v1/health; unset T
```

## 4. Iniciar FastAPI en modo evaluación (PowerShell, Windows)

`ai-service/.env` ya aporta `OPENAI_API_KEY`, `ZILLIZ_CLOUD_URI`, `ZILLIZ_CLOUD_TOKEN` y
`AI_ASSISTANT_IDENTITY_KEY`. Las variables del entorno tienen prioridad sobre `.env`.

```powershell
cd "D:\Study\Taller Integrador I\ERP_with_LoRA\ai-service"
Remove-Item Env:DATABASE_URL_READONLY -ErrorAction SilentlyContinue   # el modo evaluación no arranca si existe
$env:AI_SERVICE_ENV = "development"
$env:AI_SERVICE_EVAL_MODE = "1"
$env:AI_SERVICE_INTERNAL_TOKEN = "<el MISMO valor que en Vercel>"
$env:AI_ASSISTANT_AUDIT_HMAC_KEY = "<otro hex de 64 caracteres, distinto de los demás>"
$env:AI_SQL_GENERATOR = "xiyansql"
$env:AI_SQLGEN_URL = "http://127.0.0.1:8011"
$env:AI_SQLGEN_TOKEN = (wsl.exe -d Ubuntu-24.04 --exec bash -c 'cat ~/.config/xiyan-inference/token').Trim()
$env:AI_SQLGEN_TIMEOUT_S = "20"
$env:AI_SQL_EXECUTOR = "ficticio"
$env:AI_LLM_PROVIDER = "openai"
$env:AI_LLM_PRICE_INPUT_PER_1K_USD = "0.0001"
$env:AI_LLM_PRICE_OUTPUT_PER_1K_USD = "0.0005"
$env:AI_LLM_MONTHLY_LIMIT_USD = "1.00"
$env:AI_LLM_TIMEOUT_S = "15"
$env:AI_RAG_MODE = "milvus"
$env:AI_RAG_REMOTE_CORPUS_SHA256 = "ed2d957455e55e50b4109390736e4e6355b18884fcebb85f8e0dd3beec360fb9"
$env:HF_HUB_OFFLINE = "1"
$env:PYTHONPATH = "src"
.venv\Scripts\python.exe -m ai_service.main
```

- Para generar un valor hexadecimal: `.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"`.
- Si falta algo, o alguien intenta usar el Executor real, el proceso termina con
  `Configuración inválida: …` sin escuchar y sin mostrar valores.
- Si `AI_ASSISTANT_IDENTITY_KEY` de `.env` no coincide con la de Vercel, fija la misma en ambos lados.

## 5. Iniciar el túnel HTTPS temporal (otra terminal de PowerShell)

```powershell
cloudflared tunnel --url http://127.0.0.1:8001 --http-host-header 127.0.0.1
```

- `cloudflared` muestra una URL `https://<aleatorio>.trycloudflare.com` que **cambia en cada
  ejecución**. Si aún no está instalado: `winget install --id Cloudflare.cloudflared`.
- `--http-host-header 127.0.0.1` es necesario porque FastAPI solo acepta ese `Host`.
- `/v1/health` queda visible mientras el túnel esté abierto; `/v1/queries` exige el token interno y
  la identidad firmada.

## 6. Configurar `AI_SERVICE_URL` y habilitar temporalmente el chatbot en Production

1. Vercel → Project → Settings → Environment Variables → entorno **Production**.
2. Crea o actualiza las 5 variables de la sección 1. `AI_SERVICE_URL` es la URL del paso 5.
3. Vercel solo aplica las variables a despliegues nuevos: Deployments → último despliegue de
   Production → … → **Redeploy**. No hace falta ningún commit.
4. Coordina el momento con el equipo, porque Production es compartido.

## 7. Comprobar el acceso

1. Local: `curl.exe http://127.0.0.1:8001/v1/health` responde `{"estado":"ok"}`.
2. Túnel: `curl.exe https://<aleatorio>.trycloudflare.com/v1/health` da la misma respuesta.
3. Sin credenciales: `curl.exe -X POST https://<aleatorio>.trycloudflare.com/v1/queries` responde `401`.
4. En Production, inicia sesión con una cuenta **ADMIN**. Debe aparecer el botón flotante con la
   etiqueta *Datos ficticios*.
5. Pregunta: «¿Cuál fue el saldo de caja en septiembre?». La respuesta esperada con datos ficticios
   es saldo neto de S/ 1,149.60, debe de S/ 1,800.00 y haber de S/ 650.40.
6. Con una cuenta no ADMIN el botón no aparece y `GET /api/assistant` responde `403`.

## 8. Deshabilitar al finalizar

1. En Vercel (Production), **elimina** `AI_ASSISTANT_ALLOW_PRODUCTION_EVAL` y
   `AI_ASSISTANT_EVAL_ENABLED`, y haz **Redeploy**. El chatbot vuelve a responder 404; basta con
   quitar una de las dos para que quede deshabilitado.
2. Cierra el túnel (`Ctrl+C` en `cloudflared`). La URL deja de existir.
3. Detén FastAPI (`Ctrl+C`).
4. Detén XiYanSQL y libera la GPU (dentro de WSL; solo SIGTERM al PID verificado):

   ```bash
   S=~/.local/state/xiyan-inference; P=$(cat $S/server.pid)
   if [ -d /proc/$P ] && [[ "$(tr "\0" " " < /proc/$P/cmdline)" == "$HOME/proyectos/modeloQLoRA/venvQLoRA/bin/python -m inference_server.main "* ]]; then
     kill -TERM "$P"; for i in $(seq 1 30); do [ -d /proc/$P ] || break; sleep 1; done
     [ -d /proc/$P ] && echo "Sigue activo: revisar (sin kill -9)" || { echo "Detenido"; rm -f $S/server.pid; }
   else echo "El PID no corresponde al servidor XiYanSQL"; fi
   nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader
   ```

5. Si creaste un token interno solo para la evaluación, retíralo de Vercel.
