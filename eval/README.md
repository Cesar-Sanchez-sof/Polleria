# 📂 Carpeta `eval`

Esta carpeta contiene todo lo necesario para **ejecutar y revisar la evaluación de los agentes SQL** (LoRA, Gemini‑API y Groq‑API).  El objetivo es que, con un solo comando, obtengas un informe en Markdown y su versión JSON sin tener que modificar `PYTHONPATH` ni mover archivos.

---

## 📂 Estructura de la carpeta
```
/Polleria
└─ eval/
   ├─ README.md                # <-- este archivo (instrucciones)
   ├─ evaluate_agents.py       # script de evaluación (ejecutable con `python -m eval.evaluate_agents`)
   ├─ benchmark_cases_350.json               # opcional: lista de hasta 350 casos de prueba
   ├─ report.md                # último informe generado (Markdown)
   └─ report_*.json            # últimos datos de ejecución (JSON, nombre con timestamp)
```

- **`evaluate_agents.py`** – Copia del evaluador original que se sitúa en `agents-service/src/evaluation`.  Añade automáticamente la ruta `agents-service/src` al `sys.path` para poder importar los módulos internos.
- **`benchmark_cases_350.json`** – *(opcional)* Archivo JSON con los casos de prueba.  Cada elemento debe ser un objeto con al menos:
  ```json
  {
    "query": "texto en lenguaje natural",
    "expected_sql": "SELECT …"
  }
  ```
  Si no existe, el script usa una única consulta de prueba integrada.
- **`report.md`** – Informe legible con una tabla de resultados (✅/❌) que se sobrescribe en cada ejecución.
- **`report_*.json`** – Archivo JSON con la salida completa (incluye timestamps y respuestas de cada agente).  El nombre incluye la fecha/hora de generación, por ejemplo `report_20231107_173500.json`.

---

## 🚀 Cómo ejecutar la evaluación
1. **Activar el entorno virtual** (si aún no lo está):
   ```powershell
   .\.venv\Scripts\Activate.ps1   # PowerShell
   # o
   source .venv/bin/activate       # Git Bash / WSL
   ```
2. **Ejecutar el script** desde la raíz del proyecto (`Polleria`):
   ```powershell
   python -m eval.evaluate_agents
   ```
   - El script buscará `benchmark_cases_350.json` en la carpeta `eval`.
   - Si lo encuentra, ejecutará **todos** los casos; si no, usará la consulta de prueba integrada.
   - Al finalizar generará `report.md` y un archivo `report_*.json` en la misma carpeta.
3. **Revisar el informe**:
   ```powershell
   notepad .\eval\report.md   # o cualquier editor de tu preferencia
   ```
   La tabla mostrará una fila por agente con ✅ si todas las consultas pasaron y ❌ si alguna falló.

---

## 📄 Crear o actualizar `benchmark_cases_350.json`
Ejemplo mínimo (3 casos):
```json
[
  {
    "query": "¿Cuántas filas hay en journal_entry?",
    "expected_sql": "SELECT COUNT(*) FROM journal_entry"
  },
  {
    "query": "¿Cuál es el total de ventas del mes actual?",
    "expected_sql": "SELECT SUM(total) FROM sales WHERE date_part('month', sale_date) = date_part('month', CURRENT_DATE)"
  },
  {
    "query": "Lista los clientes con más de 5 órdenes",
    "expected_sql": "SELECT client_id FROM orders GROUP BY client_id HAVING COUNT(*) > 5"
  }
]
```
Guarda este contenido en `eval/benchmark_cases_350.json`.  El script lo leerá automáticamente la próxima vez que lo ejecutes.

---

## 🛠️ Depuración rápida
- **Error de configuración**: si el script muestra *“Error al cargar la configuración”*, revisa que el archivo `.env` exista en `agents-service/src/agents_service/.env` y contenga las variables `GEMINI_API_KEY`, `GROQ_API_KEY` y, opcionalmente, `QLORA_CHECKPOINT_PATH` (para el agente LoRA).
- **Falta el checkpoint LoRA**: si no dispones del modelo LoRA y deseas ejecutar solo los agentes en la nube, comenta la línea correspondiente en `evaluate_agents.py` dentro de la lista `AGENTS`:
  ```python
  # ("LoRA", build_gemini_sql_agent, {"settings": None}),
  ```
- **Problemas de importación**: el script añade la ruta `agents-service/src` al `sys.path`.  Si cambias la ubicación del proyecto, verifica que la línea `AGENTS_SRC = PROJECT_ROOT / "agents-service" / "src"` siga apuntando al directorio correcto.

---

## 📦 Limpieza
- Para borrar los informes anteriores, simplemente elimina los archivos `report.md` y `report_*.json`:
  ```powershell
  Remove-Item .\eval\report.md
  Remove-Item .\eval\report_*.json
  ```
- Si deseas volver al evaluador original dentro de `agents-service/src/evaluation`, puedes mantener ambos archivos; ninguno interfiere con el otro.

---

Con este `README.md` deberías poder **entender la estructura**, **añadir casos de prueba**, **ejecutar la evaluación** y **consultar los resultados** sin complicaciones.  Si necesitas cualquier ajuste adicional (por ejemplo, cambiar la consulta de prueba predeterminada), edita `eval/evaluate_agents.py` directamente.
