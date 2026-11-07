# 1. Entorno virtual (solo una vez)
python -m venv .venv
.\.venv\Scripts\activate
pip install psycopg2-binary

# 2. Generar el banco de casos
python generate_benchmark_suite.py   # o `node generate_suite.js`

# 3. Ejecutar el benchmark
python benchmark_sql_suite.py

# 4. Ver el informe
type eval\report.md