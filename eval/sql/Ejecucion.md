# Guía de ejecución de la evaluación SQL

Ejecuta estos comandos desde la raíz del proyecto (`Polleria`) en PowerShell.

## 1. Preparar el entorno

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r agents-service\requirements.txt
```

Si `.venv` ya existe, solo actívalo e instala las dependencias si aún no lo hiciste.

## 2. Revisar la configuración

El evaluador lee las variables admitidas desde `agents-service\.env` o desde el entorno de PowerShell (el entorno tiene prioridad). Configura:

- `AGENTS_SERVICE_INTERNAL_TOKEN` y `AI_ASSISTANT_IDENTITY_KEY`: secretos hexadecimales válidos y distintos.
- `DATABASE_URL_READONLY`: conexión PostgreSQL con permisos de solo lectura, configurada para el servicio en `agents-service\.env`.
- `GROQ_API_KEY` para evaluar Groq, `GEMINI_API_KEY` para Gemini, o ambas para comparar los dos proveedores.

No pegues claves API en la consola ni en el chat. Si una clave ya fue expuesta, revócala y reemplázala en `.env`.

El proyecto ofrece Gemini y Groq; no hay proveedor OpenAI/GPT configurado en este evaluador. Una clave de Groq debe guardarse como `GROQ_API_KEY`, no como `OPENAI_API_KEY`. El modelo de Groq se puede cambiar con `GROQ_MODEL`.

El evaluador no carga ni compara la `DATABASE_URL` de escritura del ERP: usa la configuración propia de `agents-service` para evitar mezclar las conexiones de ambos componentes. Mantén `DATABASE_URL_READONLY` asociada a un usuario PostgreSQL de solo lectura; la validación del servicio sigue rechazando una `DATABASE_URL` de escritura si se proporciona al propio servicio.

## 3. Verificar los casos

El archivo incluido `eval/sql/benchmark_cases_350.json` tiene 350 casos bajo la clave `casos`. El evaluador también acepta los campos de pregunta `pregunta`, `question` o `query`, y los campos SQL de referencia `sql_gold`, `gold_sql` o `expected_sql`.

El generador produce 35 formas de consulta × 10 meses completos recientes, equilibradas entre ventas, compras, caja, inventario y contabilidad. Antes de guardar, valida las 350 consultas con el `SqlValidator` y la allowlist efectiva del rol `contador_demo`; si una consulta no pasa, detiene la generación sin reemplazar el archivo.

Para validar el generador sin llamar a un proveedor ni a PostgreSQL y regenerar el conjunto desde la raíz:

```powershell
python -m unittest eval.sql.test_generate_benchmark_suite
python eval\sql\generate_benchmark_suite.py
# Alternativamente, si Node.js está instalado:
node eval\sql\generate_suite.js
```

La regeneración sobrescribe el JSON existente.

## 4. Ejecutar

```powershell
# Ejecutar todos los proveedores que tengan credenciales configuradas
python -m eval.sql.evaluate_agents

# Ejecutar solo Groq o solo Gemini
python -m eval.sql.evaluate_agents --provider groq
python -m eval.sql.evaluate_agents --provider gemini

# Groq: dividir la suite en tandas para no exceder el límite diario de tokens
python -m eval.sql.evaluate_agents --provider groq --start-at 1 --limit 60
python -m eval.sql.evaluate_agents --provider groq --start-at 61 --limit 60
```

El programa compara cada SQL generada con la SQL gold y ejecuta ambas en la misma base PostgreSQL de solo lectura. Por cada caso imprime:

- **EM (Exact Match):** SQL idéntica tras normalizar espacios y quitar el punto y coma final.
- **EX (Execution Accuracy):** resultados de ambas consultas iguales, sin importar el orden de filas ni los alias de columnas; se preservan duplicados.
- **VES (Valid Efficiency Score):** promedio de `sqrt(tiempo_gold / tiempo_generado)`, limitado a 1. Los casos con resultado incorrecto cuentan como 0.
- **TS (Test Suite Accuracy):** aparece como `N/D`. Se necesitan bases de prueba o estados alternativos; la configuración actual solo dispone de una base.

La SQL gold y la generada se muestran en la terminal y se incluyen en el JSON y el informe Markdown. La terminal también muestra las filas devueltas por ambas: gold en morado y generada en cyan; si una consulta no se ejecutó, aparece `[NO EJECUTADA]`. En la terminal las métricas correctas salen en verde y las incorrectas en rojo, `[groq]` en amarillo y los tiempos en azul; `N/D` aparece en amarillo. Cada caso también informa tokens del proveedor, duración total de la respuesta y duración de ejecución SQL. El tiempo de EX/VES corresponde a la consulta autorizada que ejecutó el agente; la gold se valida con el mismo `SqlValidator` y se ejecuta usando la conexión de solo lectura. Como cada consulta se ejecuta en una transacción independiente, evita escrituras concurrentes durante la evaluación para que EX compare el mismo estado de datos.

Al pulsar Ctrl+C, los casos completados se guardan en ambos informes y el proceso termina con código 130. Se puede reanudar usando `--start-at` y `--limit`, teniendo en cuenta que el evaluador no salta casos previamente completados automáticamente.

Groq aplica un limitador móvil de hasta 30 solicitudes y 8.000 tokens por minuto: estima el costo del prompt y ajusta la estimación con el uso real informado por la API. No hay pausas fijas de dos en dos. Según el uso observado de unos 2.700 tokens por consulta, el límite diario de 200.000 tokens permite alrededor de 70 consultas como máximo teórico; conviene dejar margen para variaciones y otros consumos. Gemini no usa este limitador.

## 5. Consultar resultados

- Informe Markdown, actualizado en cada corrida: `eval\sql\reports\report.md`
- Resultados completos JSON, uno por corrida: `eval\sql\results\report_YYYYMMDD_HHMMSS.json`

```powershell
Get-Content .\eval\sql\reports\report.md
```
