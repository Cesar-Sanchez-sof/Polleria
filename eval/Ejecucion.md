# 📚 Guía de ejecución paso a paso

Esta hoja describe el flujo completo para preparar el entorno, generar los casos de prueba y ejecutar el benchmark de los agentes SQL.

---

## 1️⃣ Crear y activar el entorno virtual (solo la primera vez)
```powershell
# Crear el entorno virtual en la raíz del proyecto
python -m venv .venv

# Activarlo (PowerShell) – en *bash* usar `source .venv/bin/activate`
.\.venv\Scripts\activate
```
> **Nota:** Si ya tienes el entorno creado, solo ejecuta la línea de activación.

---

## 2️⃣ Instalar dependencias del proyecto
```powershell
# Instalar todo lo necesario (incluye psycopg2‑binary y demás libs)
pip install -r requirements.txt
```
> Si el proyecto no dispone de `requirements.txt`, instala al menos la librería de PostgreSQL:
```powershell
pip install psycopg2-binary
```

---

## 3️⃣ Generar o actualizar los casos de prueba (opcional)
- El archivo **`benchmark_cases_350.json`** ya está incluido en la carpeta `eval` y contiene los 350 casos que se usarán por defecto.
- Si necesitas **regenerarlos** o crear nuevos casos, puedes ejecutar uno de los scripts siguientes:
```powershell
# Generar los casos con Python (recrea benchmark_cases_350.json)
python generate_benchmark_suite.py

# O con Node.js (equivalente)
node eval\generate_suite.js
```
> Puedes editar `benchmark_cases_350.json` manualmente si deseas añadir o eliminar casos específicos.

---

## 4️⃣ Ejecutar el benchmark (evaluación)
```powershell
# Se ejecuta el script que evalúa los tres agentes (LoRA, Gemini‑API y Groq‑API)
python -m eval.evaluate_agents
```
- El reporte en **Markdown** se guardará automáticamente en `eval/reports/report.md`.
- Los resultados en formato **JSON** se guardarán en `eval/results/` con un nombre que incluye la fecha y hora, por ejemplo `report_20231107_182300.json`.

---

## 5️⃣ Visualizar el informe
```powershell
# Mostrar el reporte generado en la consola (Windows)
type eval\reports\report.md
```
En otros sistemas operativos usa `cat` o abre el archivo con tu editor favorito.

---

## 📂 Estructura resultante en `eval/`
```
/eval
├─ README.md                # Instrucciones de uso (este archivo)
├─ evaluate_agents.py       # Script de evaluación (usa benchmark_cases_350.json)
├─ benchmark_cases_350.json # Casos de prueba predefinidos
├─ reports/
│   └─ report.md            # Último reporte en Markdown
└─ results/
    └─ report_YYYYMMDD_HHMMSS.json   # Resultado crudo por ejecución
```

---

### 💡 Tips rápidos
- **Re‑ejecutar** el benchmark sin cambiar nada simplemente vuelve a lanzar `python -m eval.evaluate_agents`.
- **Depurar** un agente específico puedes comentar temporalmente los demás en la lista `AGENTS` dentro de `evaluate_agents.py`.
- **Mantener el historial**: los archivos en `results/` no se sobrescriben; cada ejecución crea uno nuevo con timestamp.

---

¡Listo! Con estos pasos tienes todo lo necesario para ejecutar y revisar los benchmarks de los agentes SQL de forma ordenada y reproducible.