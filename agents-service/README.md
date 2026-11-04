# agents-service

Agentes de **solo lectura** del asistente financiero del ERP: **Gemini** y **GPT OSS 120B (Groq)**. Cada agente
recibe la pregunta y el esquema permitido al rol (nunca datos), propone **un** `SELECT`, y el servicio lo valida
(prefiltro, filtro P-4, SQL Validator con allowlist) y lo ejecuta con el rol `ai_readonly` en una transacción
`READ ONLY`. Las filas no vuelven al modelo.

Es un despliegue **independiente** de [`ai-service`](../ai-service) (que ahora solo sirve al Modelo R / LoRA):

| Servicio | Qué sirve | Despliegue | Lo llama el proxy con |
| --- | --- | --- | --- |
| `ai-service` | Modelo R (XiYanSQL + LoRA) | como antes (local + túnel) | `AI_SERVICE_URL` + `AI_SERVICE_INTERNAL_TOKEN` |
| `agents-service` | Gemini y Groq | Render (Python) | `AGENTS_SERVICE_URL` + `AGENTS_SERVICE_INTERNAL_TOKEN` |

Los contratos no cambiaron: `POST /v1/agent/queries` (Gemini), `POST /v1/agent/groq/queries` (Groq) y
`GET /v1/health`. La identidad firmada (P-9, `X-ERP-Identity`) se verifica igual que antes, con la misma
`AI_ASSISTANT_IDENTITY_KEY`.

## Variables de entorno

Ver [`.env.example.agents`](.env.example.agents). Obligatorias: `AGENTS_SERVICE_INTERNAL_TOKEN`,
`AI_ASSISTANT_IDENTITY_KEY`, `DATABASE_URL_READONLY` y al menos un agente: cada clave activa el suyo
(`GEMINI_API_KEY` para Gemini, `GROQ_API_KEY` para GPT OSS vía Groq). Si el servicio arranca con una configuración
inválida, termina con código 2 sin escuchar.

> Si solo quieres un agente, deja vacía la clave del otro: sin clave, ese agente no existe. Una clave presente pero
> mal formada impide arrancar.

## Desplegar en Render

1. **Secretos** (los mismos valores van en Vercel/Next.js):

   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```

   Genera uno para `AGENTS_SERVICE_INTERNAL_TOKEN` y, si aún no existe, otro distinto para `AI_ASSISTANT_IDENTITY_KEY`
   (reutiliza el que ya usa la web).

2. **Crear el servicio** (entorno nativo de Python, sin Docker), a elegir:
   - **Blueprint**: New → Blueprint → este repositorio → *Blueprint file path* = `agents-service/render.yaml`.
   - **Manual**: New → Web Service → *Language* = Python, *Root Directory* = `agents-service`,
     *Build Command* = `pip install -r requirements.txt`, *Start Command* = `python -m agents_service.main`,
     *Health Check Path* = `/v1/health`.

3. **Environment** del servicio en Render: las variables de [`.env.example.agents`](.env.example.agents) más
   `PYTHONPATH=src` y `PYTHON_VERSION=3.11.9` (el Blueprint ya las trae). `PORT` lo fija Render
   (el servicio escucha en `0.0.0.0:$PORT`). Opcional: `AGENTS_SERVICE_ALLOWED_HOSTS=<tu-servicio>.onrender.com`.

4. **Web (Vercel / Next.js)**:

   ```
   AGENTS_SERVICE_URL=https://<tu-servicio>.onrender.com     # sin puerto, ruta ni "/" final
   AGENTS_SERVICE_INTERNAL_TOKEN=<el mismo valor que en Render>
   AI_ASSISTANT_IDENTITY_KEY=<el mismo valor que en Render>
   ```

   Que cada agente aparezca en el selector se enciende en Configuración → Desarrollador («Agente Gemini» y
   «Agente GPT OSS»). Con eso los agentes funcionan **sin** `AI_SERVICE_URL`; el Modelo R aparece solo si además configuras `ai-service`.

Notas de Render:
- El plan *free* se suspende por inactividad; la primera consulta tras una pausa tarda cerca de un minuto y el proxy
  corta a los 55 s en evaluación. Usa un plan de pago si necesitas respuesta inmediata.
- El servicio es público en internet: lo protegen el token interno (comparación en tiempo constante) y la identidad
  firmada de corta vida que solo el servidor de Next.js sabe emitir. No hay CORS ni documentación expuesta.
- La base de datos debe aceptar conexiones desde Render (Neon lo permite por defecto).

## Desarrollo local

```bash
pip install -r requirements.txt pytest
cp .env.example.agents .env   # completa las claves
PYTHONPATH=src AGENTS_SERVICE_HOST=127.0.0.1 AGENTS_SERVICE_PORT=8002 python -m agents_service.main
```

En Windows: `.\scripts\start-local.ps1` genera el token y la clave de identidad, completa el `.env` de la raíz
(`AGENTS_SERVICE_URL=http://127.0.0.1:8002`, solo válido con el interruptor «Modo demostración local» encendido) y arranca el servicio.

## Pruebas

```bash
PYTHONPATH=src python -m pytest tests
```

Sin red ni base de datos: Gemini/Groq y PostgreSQL se simulan (`tests/guards.py` bloquea sockets y las variables
de conexión reales).

## Código compartido con ai-service

Para poder desplegarse solo con esta carpeta, `agents-service` lleva **copias** de los módulos de seguridad que
también usa `ai-service` (`validation/`, `policies/`, `execution/`, `auth/identity.py`, `orchestrator/prefilter.py`,
`orchestrator/ports.py`, `http/schemas.py`, `sqlgen/modules.py`…) con el paquete renombrado a `agents_service`, y
de `knowledge/allowlist.readonly_erp.json` y `knowledge/erp_modules_v1.json`. Si cambias una regla de validación,
la allowlist o los módulos del ERP en uno, aplica el mismo cambio en el otro.
`auth/identity.py` conserva `aud = "ai-service"`: es el valor que firma el proxy de Next.js.
