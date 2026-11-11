# Evaluación de agentes SQL

Esta carpeta contiene los casos de evaluación, el evaluador y los reportes:

- `evaluate_agents.py`: evalúa Gemini y/o Groq con los proveedores habilitados.
- `benchmark_cases_350.json`: suite de 350 casos, con su lista en `casos`.
- `generate_benchmark_suite.py`: generador canónico, que valida cada caso contra la allowlist y el validador SQL del agente antes de guardar.
- `generate_suite.js`: lanzador de Node.js del generador canónico.
- `test_generate_benchmark_suite.py`: pruebas offline de alcance, balance y validez de los casos generados.
- `test_evaluate_agents.py`: pruebas offline de EM, comparación de resultados y VES.
- `reports/report_gemini.md` y `reports/report_groq.md`: reportes acumulados por proveedor.
- `results/report_gemini.json` y `results/report_groq.json`: datos acumulados por proveedor.
- `results/report_*.json`: resultados detallados de cada corrida.

## Ejecución rápida

Desde la raíz del proyecto y con el entorno virtual activado:

```powershell
python -m eval.sql.evaluate_agents
```

También se puede seleccionar un solo proveedor:

```powershell
python -m eval.sql.evaluate_agents --provider groq
python -m eval.sql.evaluate_agents --provider gemini

# Ejecutar los casos 1-20 y luego continuar con los casos 21-40.
# El reporte del proveedor conserva las tandas anteriores y reemplaza IDs repetidos.
python -m eval.sql.evaluate_agents --provider groq --start-at 1 --limit 20
python -m eval.sql.evaluate_agents --provider groq --start-at 21 --limit 20
```

Configura las credenciales en `agents-service/.env` o en el entorno: `GROQ_API_KEY` y/o `GEMINI_API_KEY`, `DATABASE_URL_READONLY`, `AGENTS_SERVICE_INTERNAL_TOKEN` y `AI_ASSISTANT_IDENTITY_KEY`. El evaluador usa la configuración del servicio y no carga la `DATABASE_URL` de escritura del ERP. Asegúrate de que `DATABASE_URL_READONLY` use un rol PostgreSQL de solo lectura. No introduzcas claves API en la consola; revoca cualquier clave que se haya expuesto y actualízala en `agents-service/.env`.

El benchmark reporta **EM** (coincidencia exacta de SQL), **EX** (comparación de resultados ejecutados) y **VES** (eficiencia relativa de ejecución). Muestra la SQL gold y la generada, junto con las respuestas (filas devueltas), en consola y en los informes acumulados y detallados. **TS** se informa como `N/D` porque la configuración actual no contiene bases o estados alternativos para una suite de pruebas. Para definiciones, configuración y regeneración de casos, consulta [Ejecucion.md](Ejecucion.md).

La suite se distribuye por igual entre ventas, compras, caja, inventario y contabilidad. Generarla o probarla no hace llamadas a Groq/Gemini ni a PostgreSQL.

El límite de Groq de 200.000 tokens/día no permite correr los 350 casos de una vez: el consumo observado es de aproximadamente 2.700 tokens por consulta. Usa `--start-at` y `--limit` para ejecutar tandas de hasta 60 casos por día; por ejemplo, después de los casos 1–60, continúa con `--start-at 61 --limit 60`.

`--start-at` usa numeración desde 1: para evaluar los casos 0-19 por índice, se usa `--start-at 1 --limit 20`; la tanda siguiente se inicia con `--start-at 21 --limit 20`.

Las métricas pueden probarse sin credenciales ni conexión a la base:

```powershell
python -m unittest eval.sql.test_evaluate_agents eval.sql.test_generate_benchmark_suite
```
