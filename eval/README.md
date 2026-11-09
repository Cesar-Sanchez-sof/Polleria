# Evaluación de agentes SQL

Esta carpeta contiene los casos de evaluación, el evaluador y los reportes:

- `evaluate_agents.py`: evalúa Gemini y/o Groq con los proveedores habilitados.
- `benchmark_cases_350.json`: suite de 350 casos, con su lista en `casos`.
- `generate_benchmark_suite.py`: generador canónico, que valida cada caso contra la allowlist y el validador SQL del agente antes de guardar.
- `generate_suite.js`: lanzador de Node.js del generador canónico.
- `test_generate_benchmark_suite.py`: pruebas offline de alcance, balance y validez de los casos generados.
- `test_evaluate_agents.py`: pruebas offline de EM, comparación de resultados y VES.
- `reports/report.md`: resumen de la última corrida.
- `results/report_*.json`: resultados detallados por corrida.

## Ejecución rápida

Desde la raíz del proyecto y con el entorno virtual activado:

```powershell
python -m eval.evaluate_agents
```

También se puede seleccionar un solo proveedor:

```powershell
python -m eval.evaluate_agents --provider groq
python -m eval.evaluate_agents --provider gemini

# Ejecutar una tanda (para continuar, cambia --start-at al siguiente caso)
python -m eval.evaluate_agents --provider groq --start-at 1 --limit 60
```

Configura las credenciales en `agents-service/.env` o en el entorno: `GROQ_API_KEY` y/o `GEMINI_API_KEY`, `DATABASE_URL_READONLY`, `AGENTS_SERVICE_INTERNAL_TOKEN` y `AI_ASSISTANT_IDENTITY_KEY`. El evaluador usa la configuración del servicio y no carga la `DATABASE_URL` de escritura del ERP. Asegúrate de que `DATABASE_URL_READONLY` use un rol PostgreSQL de solo lectura. No introduzcas claves API en la consola; revoca cualquier clave que se haya expuesto y actualízala en `agents-service/.env`.

El benchmark reporta **EM** (coincidencia exacta de SQL), **EX** (comparación de resultados ejecutados) y **VES** (eficiencia relativa de ejecución). Muestra la SQL gold y la generada en consola y en ambos informes. **TS** se informa como `N/D` porque la configuración actual no contiene bases o estados alternativos para una suite de pruebas. Para definiciones, configuración y regeneración de casos, consulta [Ejecucion.md](Ejecucion.md).

La suite se distribuye por igual entre ventas, compras, caja, inventario y contabilidad. Generarla o probarla no hace llamadas a Groq/Gemini ni a PostgreSQL.

El límite de Groq de 200.000 tokens/día no permite correr los 350 casos de una vez: el consumo observado es de aproximadamente 2.700 tokens por consulta. Usa `--start-at` y `--limit` para ejecutar tandas de hasta 60 casos por día; por ejemplo, después de los casos 1–60, continúa con `--start-at 61 --limit 60`.

Las métricas pueden probarse sin credenciales ni conexión a la base:

```powershell
python -m unittest eval.test_evaluate_agents eval.test_generate_benchmark_suite
```
