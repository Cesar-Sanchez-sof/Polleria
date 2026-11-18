# -*- coding: utf-8 -*-
"""
Evaluador del agente de interpretación de reportes Text-to-SQL.

Envía cada pregunta del benchmark al agente configurado (Gemini o Groq),
compara la respuesta con el gold y genera un reporte Markdown.

Uso:
    python evaluate_report_agent.py --agent gemini
    python evaluate_report_agent.py --agent groq
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
AGENTS_SRC = PROJECT_ROOT / "agents-service" / "src"
sys.path.insert(0, str(AGENTS_SRC))

from agents_service.agent_sql.assembly import build_gemini_sql_agent, build_groq_sql_agent  # noqa: E402
from agents_service.config.settings import load_service_settings, read_dotenv_keys  # noqa: E402
from agents_service.http.schemas import QueryRequest, User  # noqa: E402
from agents_service.orchestrator.ports import AuthorizationContext  # noqa: E402

BENCHMARK_FILE = Path(__file__).with_name("benchmark_report_interpretation.json")
SERVICE_DOTENV_PATH = PROJECT_ROOT / "agents-service" / ".env"
REPORTS_DIR = PROJECT_ROOT / "eval" / "sql" / "reports"
RESULTS_DIR = Path(__file__).parent / "results"

AGENT_DISPLAY_NAMES = {
    "groq": "chatgpt oss 120 b",
    "gemini": "gemini flash 3.5 lite",
}
AGENT_FILE_SLUGS = {
    "groq": "chatgpt_oss_120_b",
    "gemini": "gemini_flash_3.5_lite",
}

ANSI_GREEN = "\033[32m"
ANSI_RED = "\033[31m"
ANSI_YELLOW = "\033[33m"
ANSI_RESET = "\033[0m"

GROQ_RPM = 30
GROQ_TPM = 8_000
GROQ_WINDOW = 60.0


def colorize(text: str, color: str) -> str:
    return f"{color}{text}{ANSI_RESET}"


def load_benchmark() -> list[dict]:
    with BENCHMARK_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
    return data["casos"]


def load_reports() -> dict[str, str]:
    """Carga el contenido de los dos reportes en memoria para incluirlos como contexto."""
    reports = {}
    for path in REPORTS_DIR.glob("report_*.md"):
        reports[path.name] = path.read_text(encoding="utf-8", errors="replace")
    return reports


def build_system_prompt(reports: dict[str, str]) -> str:
    """Construye el prompt de sistema con el contenido completo de los reportes."""
    # Solo incluimos la tabla de resumen y los sumarios para no exceder tokens.
    # Extraemos las primeras 300 líneas de cada reporte (cabecera + descripción de métricas).
    snippets = []
    for name, content in reports.items():
        lines = content.splitlines()
        # Cabecera (primeras 15 líneas) + lista de EX=False
        header = "\n".join(lines[:15])
        ex_false_lines = [l for l in lines if "EX=False" in l or "EX=True" in l]
        # Incluir todos los sumarios de casos para permitir consultas de detalle
        all_summaries = [l for l in lines if "<summary>" in l or "EX=" in l]
        snippet = f"### Reporte: {name}\n{header}\n\n#### Sumarios de casos:\n" + "\n".join(all_summaries[:500])
        snippets.append(snippet)

    return (
        "Eres un asistente experto en análisis de reportes de evaluación Text-to-SQL. "
        "Se te proporcionan los reportes de evaluación de dos agentes. "
        "Responde de forma concisa y precisa, usando solo la información de los reportes.\n\n"
        "## REPORTES DISPONIBLES\n\n" + "\n\n".join(snippets)
    )


def normalize_answer(answer: str) -> str:
    """Normaliza la respuesta para comparación: minúsculas, sin espacios extra."""
    return re.sub(r"\s+", " ", answer.strip().lower())


def score_answer(response: str, gold) -> tuple[bool, str]:
    """
    Compara la respuesta del agente con el gold.
    - Si gold es lista: verifica que todos los elementos estén en la respuesta.
    - Si gold es str: verifica que esté contenido en la respuesta (normalizado).
    - Si gold es None: retorna None (caso sin gold definido).
    """
    if gold is None:
        return None, "sin_gold"

    resp_norm = normalize_answer(response)

    if isinstance(gold, list):
        missing = [g for g in gold if normalize_answer(g) not in resp_norm]
        extra_ok = True  # No penalizamos por mencionar elementos extra
        if not missing:
            return True, "ok"
        return False, f"faltan: {missing}"

    gold_norm = normalize_answer(str(gold))
    if gold_norm in resp_norm:
        return True, "ok"
    return False, f"esperado '{gold}' no encontrado en respuesta"


def call_agent(agent, case_id: str, question: str, system_prompt: str) -> tuple[str, dict | None]:
    """Llama al agente con la pregunta y retorna (respuesta_texto, usage)."""
    # El agente SQL espera un QueryRequest; lo adaptamos para interpretación de reportes.
    # Usamos la pregunta como query y el system_prompt como contexto adicional.
    request = QueryRequest(
        query=question,
        user=User(id="eval-ri", name="Evaluador RI", roles=["admin"]),
        context=system_prompt,
    )
    auth = AuthorizationContext(user_id="eval-ri", roles=["admin"])

    start = time.monotonic()
    result = agent.handle(request, auth)
    elapsed = time.monotonic() - start

    # El agente puede devolver distintas formas; extraemos texto libre.
    response_text = ""
    usage = None
    if hasattr(result, "text"):
        response_text = result.text or ""
    elif hasattr(result, "answer"):
        response_text = result.answer or ""
    elif isinstance(result, dict):
        response_text = result.get("text") or result.get("answer") or str(result)
    else:
        response_text = str(result)

    if hasattr(result, "usage"):
        usage = result.usage
    elif isinstance(result, dict):
        usage = result.get("usage")

    return response_text.strip(), usage, elapsed


def run_evaluation(agent_key: str, cases: list[dict], reports: dict[str, str]) -> list[dict]:
    """Ejecuta todos los casos y retorna los resultados."""
    env = read_dotenv_keys(SERVICE_DOTENV_PATH)
    settings = load_service_settings(env)

    if agent_key == "gemini":
        agent = build_gemini_sql_agent(settings)
    else:
        agent = build_groq_sql_agent(settings)

    system_prompt = build_system_prompt(reports)
    results = []

    for case in cases:
        cid = case["id"]
        question = case["pregunta"]
        gold = case.get("respuesta_gold")
        categoria = case.get("categoria", "")
        dificultad = case.get("dificultad", "")

        print(f"[{agent_key}] {cid} ({dificultad}) ... ", end="", flush=True)

        try:
            response, usage, elapsed = call_agent(agent, cid, question, system_prompt)
            correct, reason = score_answer(response, gold)
        except Exception as exc:
            response = f"ERROR: {exc}"
            correct = False
            reason = f"excepcion: {exc}"
            elapsed = 0.0
            usage = None

        status = "OK" if correct else ("N/D" if correct is None else "X")
        color = ANSI_GREEN if correct else (ANSI_YELLOW if correct is None else ANSI_RED)
        print(colorize(status, color) + f" ({elapsed:.2f}s)")

        results.append({
            "id": cid,
            "categoria": categoria,
            "dificultad": dificultad,
            "pregunta": question,
            "gold": gold,
            "respuesta": response,
            "correcto": correct,
            "razon": reason,
            "tiempo": round(elapsed, 3),
            "usage": usage,
        })

    return results


def write_report(agent_key: str, results: list[dict]) -> Path:
    display = AGENT_DISPLAY_NAMES.get(agent_key, agent_key)
    slug = AGENT_FILE_SLUGS.get(agent_key, agent_key)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out = RESULTS_DIR / f"report_ri_{slug}.md"

    total = len(results)
    with_gold = [r for r in results if r["correcto"] is not None]
    correct = sum(1 for r in with_gold if r["correcto"])
    incorrect = sum(1 for r in with_gold if not r["correcto"])
    no_gold = total - len(with_gold)
    pct = f"{correct / len(with_gold) * 100:.2f}%" if with_gold else "N/D"

    # Por categoría
    cats: dict[str, dict] = {}
    for r in results:
        c = r["categoria"]
        if c not in cats:
            cats[c] = {"total": 0, "correct": 0}
        cats[c]["total"] += 1
        if r["correcto"]:
            cats[c]["correct"] += 1

    lines = [
        "# Reporte de evaluación — Interpretación de Reportes\n",
        f"| Agente | Casos | Accuracy | Correctas | Incorrectas | Sin gold |",
        f"|---|---:|---:|---:|---:|---:|",
        f"| {display} | {total} | {pct} | {correct} | {incorrect} | {no_gold} |\n",
        "## Por categoría\n",
        "| Categoría | Total | Correctas | Accuracy |",
        "|---|---:|---:|---:|",
    ]
    for cat, s in cats.items():
        cat_pct = f"{s['correct'] / s['total'] * 100:.0f}%" if s["total"] else "N/D"
        lines.append(f"| {cat} | {s['total']} | {s['correct']} | {cat_pct} |")

    lines.append("\n## Detalle de casos\n")
    for r in results:
        icon = "✅" if r["correcto"] else ("➖" if r["correcto"] is None else "❌")
        lines.append(f"<details><summary>{r['id']} [{r['dificultad']}] — {icon} {r['categoria']}</summary>\n")
        lines.append(f"**Pregunta:** {r['pregunta']}\n")
        gold_str = json.dumps(r["gold"], ensure_ascii=False) if isinstance(r["gold"], list) else str(r["gold"])
        lines.append(f"**Gold:** `{gold_str}`\n")
        lines.append(f"**Respuesta:**\n```\n{r['respuesta']}\n```\n")
        lines.append(f"**Resultado:** `{r['razon']}` — {r['tiempo']}s\n")
        lines.append("</details>\n")

    out.write_text("\n".join(lines), encoding="utf-8")
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--agent", choices=["gemini", "groq", "both"], default="both")
    args = parser.parse_args()

    cases = load_benchmark()
    reports = load_reports()
    agents = ["groq", "gemini"] if args.agent == "both" else [args.agent]

    for agent_key in agents:
        display = AGENT_DISPLAY_NAMES.get(agent_key, agent_key)
        print(f"\n{'='*60}")
        print(f"  Evaluando: {display}  ({len(cases)} casos)")
        print(f"{'='*60}\n")
        results = run_evaluation(agent_key, cases, reports)
        path = write_report(agent_key, results)
        total = len(results)
        with_gold = [r for r in results if r["correcto"] is not None]
        correct = sum(1 for r in with_gold if r["correcto"])
        pct = f"{correct / len(with_gold) * 100:.2f}%" if with_gold else "N/D"
        print(f"\n  → Accuracy: {pct} ({correct}/{len(with_gold)})")
        print(f"  → Reporte: {path}\n")


if __name__ == "__main__":
    main()
