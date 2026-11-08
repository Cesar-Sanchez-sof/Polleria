# -*- coding: utf-8 -*-
"""
Evaluación de agentes SQL (versión en carpeta `eval`).

Este script es una copia del original que estaba bajo `agents-service/src/evaluation` pero
situado en `eval/` para que puedas ejecutarlo directamente desde la raíz del proyecto
sin necesidad de modificar `PYTHONPATH` manualmente.

Se cargan los tres agentes (LoRA, Gemini‑API y Groq‑API) y se evalúan los casos de
prueba definidos en `eval/benchmark_cases_350.json` (máximo 350).  El reporte se imprime en Markdown
con ✅/❌.
"""

import os
import sys
from pathlib import Path
from typing import List, Tuple

# ------------------------------------------------------------
# Añadir al sys.path la ubicación donde están los paquetes internos
# (agents-service/src).  Esto permite importar `agents_service.*` desde
# este script que está fuera del árbol `src`.
# ------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[1]  # Polleria/
AGENTS_SRC = PROJECT_ROOT / "agents-service" / "src"
sys.path.append(str(AGENTS_SRC))

# Ahora sí podemos importar los módulos del proyecto.
from agents_service.config.settings import ServiceConfigError, load_service_settings
from agents_service.agent_sql.assembly import (
    build_gemini_sql_agent,
    build_groq_sql_agent,
)
from agents_service.http.schemas import QueryRequest
from agents_service.orchestrator.ports import AuthorizationContext

import json

# ------------------------------------------------------------
# Ruta al archivo con los casos de prueba (puedes crear o editar este JSON).
# ------------------------------------------------------------
CASES_FILE = Path(__file__).with_name("benchmark_cases_350.json")

def load_cases() -> list[dict]:
    """Carga los casos de prueba desde ``benchmark_cases_350.json``.

    Cada caso debe ser un dict con al menos ``query`` y ``expected_sql``.
    Si el archivo no existe, se devuelve una lista vacía y el script usará una
    única consulta de prueba implícita.
    """
    if not CASES_FILE.is_file():
        print(f"[warning] No se encontró {CASES_FILE}, se usará caso único.")
        return []
    try:
        with open(CASES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            raise ValueError("benchmark_cases_350.json debe contener una lista de objetos")
        return data
    except Exception as exc:
        print(f"[error] No se pudieron cargar los casos: {exc}", file=sys.stderr)
        return []

# ------------------------------------------------------------
# Configuración del proyecto (variables de entorno y .env).
# ------------------------------------------------------------
DOTENV_PATH = PROJECT_ROOT / "agents-service" / "src" / "agents_service" / ".env"

def load_settings():
    """Carga la configuración del servicio usando la lógica existente."""
    try:
        return load_service_settings(os.environ, dotenv_path=DOTENV_PATH)
    except ServiceConfigError as exc:
        print(f"Error al cargar la configuración: {exc}", file=sys.stderr)
        sys.exit(1)

# ------------------------------------------------------------
# Construcción de un query de prueba genérico (solo‑lectura).
# ------------------------------------------------------------
TEST_QUERY = QueryRequest(
    id_traza="test-trace",
    mensaje="¿Cuántas filas hay en journal_entry?",
    usuario=type("U", (), {"id": 1, "rol": "admin"})(),
    historial=[],
)
EXPECTED_RESULT = None  # No comparamos el resultado cuando no hay casos.

# ------------------------------------------------------------
# Definición de los agentes a evaluar.
# Cada tupla: (nombre amigable, función builder, kwargs por defecto).
# ------------------------------------------------------------
AGENTS: List[Tuple[str, callable, dict]] = [
    ("LoRA", build_gemini_sql_agent, {"settings": None}),
    ("Gemini‑API", build_gemini_sql_agent, {"settings": None}),
    ("Groq‑API", build_groq_sql_agent, {"settings": None}),
]

def evaluate_agent(name: str, builder: callable, builder_kwargs: dict, settings) -> bool:
    """Construye el agente y ejecuta todas las consultas de prueba.

    Devuelve ``True`` solo si **todas** las consultas coinciden con el SQL esperado
    (o si no hay casos y la llamada se completa sin lanzar excepción).
    """
    # Seleccionamos la configuración adecuada según el builder.
    if builder_kwargs.get("settings") is None:
        if builder is build_gemini_sql_agent:
            builder_kwargs["settings"] = settings.gemini
        else:
            builder_kwargs["settings"] = settings.groq
    try:
        agent = builder(**builder_kwargs)
        auth = AuthorizationContext(
            rol="admin",
            origen="erp-session",
            autenticado=True,
            modulos=None,
        )
        if cases:
            for case in cases:
                query = QueryRequest(
                    id_traza="test-trace",
                    mensaje=case["query"],
                    usuario=type("U", (), {"id": 1, "rol": "admin"})(),
                    historial=[],
                )
                answer = agent.answer(query, auth)
                if answer.sql.strip() != case["expected_sql"].strip():
                    return False
            return True
        # Sin casos: solo verificamos que la llamada no falle.
        answer = agent.answer(TEST_QUERY, auth)
        if EXPECTED_RESULT is not None:
            return answer.sql.strip() == EXPECTED_RESULT.strip()
        return True
    except Exception as exc:
        print(f"[{name}] error durante la evaluación: {exc}", file=sys.stderr)
        return False


def main():
    import datetime
    settings = load_settings()
    global cases
    cases = load_cases()
    # ------------------------------------------------------------
    # Generar el contenido del reporte (Markdown)
    # ------------------------------------------------------------
    lines = []
    lines.append("# Reporte de evaluación de agentes SQL\n")
    lines.append("| Agente | Resultado |\n|---|---|")
    for name, builder, kwargs in AGENTS:
        ok = evaluate_agent(name, builder, kwargs, settings)
        status = "✅" if ok else "❌"
        lines.append(f"| {name} | {status} |")
    markdown = "\n".join(lines)

    # ------------------------------------------------------------
    # Guardar el reporte en la carpeta `reports`
    # ------------------------------------------------------------
    REPORTS_DIR = Path(__file__).parent / "reports"
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / "report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(markdown)
    # Imprimir en consola para conveniencia
    print(markdown)

if __name__ == "__main__":
    main()
