# -*- coding: utf-8 -*-
"""
Evaluador del agente de interpretación de reportes Text-to-SQL.

Envía cada pregunta del benchmark directamente a Gemini o Groq (modo chat),
adjuntando los sumarios de los reportes como contexto, y compara la respuesta
con el gold answer.

Uso:
    python evaluate_report_agent.py --agent gemini
    python evaluate_report_agent.py --agent groq
    python evaluate_report_agent.py --agent both
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SERVICE_DOTENV_PATH = PROJECT_ROOT / "agents-service" / ".env"
BENCHMARK_FILE = Path(__file__).with_name("benchmark_report_interpretation.json")
REPORTS_DIR = PROJECT_ROOT / "eval" / "sql" / "reports"
RESULTS_DIR = Path(__file__).parent / "results"

AGENT_DISPLAY_NAMES = {"groq": "chatgpt oss 120 b", "gemini": "gemini flash 3.5 lite"}
AGENT_FILE_SLUGS   = {"groq": "chatgpt_oss_120_b",   "gemini": "gemini_flash_3.5_lite"}

ANSI_GREEN  = "\033[32m"
ANSI_RED    = "\033[31m"
ANSI_YELLOW = "\033[33m"
ANSI_RESET  = "\033[0m"


# ─── Env ──────────────────────────────────────────────────────────────────────

def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    if SERVICE_DOTENV_PATH.exists():
        for line in SERVICE_DOTENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    env.update({k: v for k, v in os.environ.items() if k not in env})
    return env


# ─── Contexto de reportes ─────────────────────────────────────────────────────

def build_context(reports_dir: Path, compact: bool = False) -> str:
    """
    Lee los reportes y extrae cabecera + sumarios de casos.
    compact=True: solo los EX=False para caber en cuota de Groq (~8k TPM).
    """
    parts = []
    for path in sorted(reports_dir.glob("report_*.md")):
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        header = "\n".join(lines[:15])
        if compact:
            summaries = [l.strip() for l in lines if "EX=False" in l or "EX=True" in l]
        else:
            summaries = [l.strip() for l in lines if "<summary>" in l]
        part = (
            f"### {path.name}\n"
            f"{header}\n\n"
            f"#### Sumarios de casos:\n"
            + "\n".join(summaries)
        )
        parts.append(part)
    return "\n\n".join(parts)


SYSTEM = (
    "Eres un asistente experto en análisis de reportes de evaluación Text-to-SQL. "
    "Se te entregan los reportes de evaluación de dos agentes. "
    "Responde de forma concisa y precisa usando SOLO la información de los reportes. "
    "Si la respuesta es una lista de IDs, devuélvela como lista separada por comas. "
    "No inventes datos.\n\n"
    "## REPORTES\n\n{context}"
)


# ─── Clientes LLM ─────────────────────────────────────────────────────────────

def call_gemini(question: str, system: str, env: dict) -> tuple[str, float]:
    import httpx
    api_key   = env["GEMINI_API_KEY"]
    model     = env.get("GEMINI_MODEL", "gemini-2.0-flash-lite")
    url       = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload   = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": question}]}],
        "generationConfig": {"maxOutputTokens": 512, "temperature": 0.0},
    }
    t0  = time.monotonic()
    r   = httpx.post(url, json=payload, timeout=60)
    t1  = time.monotonic()
    r.raise_for_status()
    data = r.json()
    candidates = data.get("candidates", [])
    if not candidates:
        raise ValueError(f"Gemini: sin candidatos. finish_reason={data.get('promptFeedback')}")
    text = candidates[0]["content"]["parts"][0]["text"]
    return text.strip(), round(t1 - t0, 3)


def call_groq(question: str, system: str, env: dict) -> tuple[str, float]:
    import httpx
    api_key = env["GROQ_API_KEY"]
    model   = env.get("GROQ_MODEL", "openai/gpt-oss-120b")
    url     = "https://api.groq.com/openai/v1/chat/completions"
    payload = {
        "model":    model,
        "messages": [
            {"role": "system",  "content": system},
            {"role": "user",    "content": question},
        ],
        "max_tokens":  512,
        "temperature": 0.0,
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    t0  = time.monotonic()
    r   = httpx.post(url, json=payload, headers=headers, timeout=60)
    t1  = time.monotonic()
    r.raise_for_status()
    data = r.json()
    text = data["choices"][0]["message"]["content"]
    if not text:
        raise ValueError("Groq devolvió respuesta vacía (posible límite de tokens superado).")
    return text.strip(), round(t1 - t0, 3)


# ─── Scoring ──────────────────────────────────────────────────────────────────

def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def score(response: str, gold) -> tuple[bool | None, str]:
    if gold is None:
        return None, "sin_gold"
    resp = norm(response)
    if isinstance(gold, list):
        missing = [g for g in gold if norm(str(g)) not in resp]
        return (True, "ok") if not missing else (False, f"faltan: {missing}")
    return (True, "ok") if norm(str(gold)) in resp else (False, f"esperado '{gold}'")


# ─── Evaluación ───────────────────────────────────────────────────────────────

def run(agent_key: str, cases: list[dict], system: str, env: dict) -> list[dict]:
    caller = call_gemini if agent_key == "gemini" else call_groq
    results = []

    for case in cases:
        cid   = case["id"]
        q     = case["pregunta"]
        gold  = case.get("respuesta_gold")
        cat   = case.get("categoria", "")
        diff  = case.get("dificultad", "")

        print(f"[{agent_key}] {cid} ({diff}) ... ", end="", flush=True)
        try:
            response, elapsed = caller(q, system, env)
            ok, reason = score(response, gold)
        except Exception as exc:
            response = f"ERROR: {type(exc).__name__}: {exc}"
            elapsed, ok, reason = 0.0, False, str(exc)
            # Pausa extra ante errores (rate limit, timeout)
            time.sleep(5)

        icon  = "OK" if ok else ("N/D" if ok is None else "X")
        color = ANSI_GREEN if ok else (ANSI_YELLOW if ok is None else ANSI_RED)
        print(f"{color}{icon}{ANSI_RESET} ({elapsed}s)")

        results.append({
            "id": cid, "categoria": cat, "dificultad": diff,
            "pregunta": q, "gold": gold, "respuesta": response,
            "correcto": ok, "razon": reason, "tiempo": elapsed,
        })

        # Rate-limit suave para Groq
        if agent_key == "groq":
            time.sleep(2)

    return results


# ─── Reporte Markdown ─────────────────────────────────────────────────────────

def write_report(agent_key: str, results: list[dict]) -> Path:
    display = AGENT_DISPLAY_NAMES.get(agent_key, agent_key)
    slug    = AGENT_FILE_SLUGS.get(agent_key, agent_key)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out     = RESULTS_DIR / f"report_ri_{slug}.md"

    with_gold = [r for r in results if r["correcto"] is not None]
    correct   = sum(1 for r in with_gold if r["correcto"])
    incorrect = len(with_gold) - correct
    no_gold   = len(results) - len(with_gold)
    pct       = f"{correct / len(with_gold) * 100:.2f}%" if with_gold else "N/D"

    # Por categoría
    cats: dict[str, dict] = {}
    for r in results:
        c = r["categoria"]
        cats.setdefault(c, {"total": 0, "correct": 0})
        cats[c]["total"] += 1
        if r["correcto"]:
            cats[c]["correct"] += 1

    lines = [
        "# Reporte — Interpretación de Reportes\n",
        "| Agente | Casos | Accuracy | Correctas | Incorrectas | Sin gold |",
        "|---|---:|---:|---:|---:|---:|",
        f"| {display} | {len(results)} | {pct} | {correct} | {incorrect} | {no_gold} |\n",
        "## Por categoría\n",
        "| Categoría | Total | Correctas | Accuracy |",
        "|---|---:|---:|---:|",
    ]
    for cat, s in cats.items():
        p = f"{s['correct'] / s['total'] * 100:.0f}%" if s["total"] else "N/D"
        lines.append(f"| {cat} | {s['total']} | {s['correct']} | {p} |")

    lines.append("\n## Detalle de casos\n")
    for r in results:
        icon = "✅" if r["correcto"] else ("➖" if r["correcto"] is None else "❌")
        lines.append(f"<details><summary>{r['id']} [{r['dificultad']}] {icon} — {r['categoria']}</summary>\n")
        lines.append(f"**Pregunta:** {r['pregunta']}\n")
        g = json.dumps(r["gold"], ensure_ascii=False) if isinstance(r["gold"], list) else str(r["gold"])
        lines.append(f"**Gold:** `{g}`\n")
        lines.append(f"**Respuesta:**\n```\n{r['respuesta']}\n```\n")
        lines.append(f"**Resultado:** `{r['razon']}` — {r['tiempo']}s\n")
        lines.append("</details>\n")

    out.write_text("\n".join(lines), encoding="utf-8")
    return out


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--agent", choices=["gemini", "groq", "both"], default="both")
    args = parser.parse_args()

    env     = load_env()
    cases   = json.loads(BENCHMARK_FILE.read_text(encoding="utf-8"))["casos"]
    agents  = ["groq", "gemini"] if args.agent == "both" else [args.agent]

    for agent_key in agents:
        # Groq tiene límite de 8k TPM; usamos contexto compacto para no excederlo
        compact = (agent_key == "groq")
        context = build_context(REPORTS_DIR, compact=compact)
        system  = SYSTEM.format(context=context)
        display = AGENT_DISPLAY_NAMES.get(agent_key, agent_key)
        print(f"\n{'='*60}\n  Evaluando: {display}  ({len(cases)} casos)\n{'='*60}\n")
        results = run(agent_key, cases, system, env)
        path    = write_report(agent_key, results)
        wg      = [r for r in results if r["correcto"] is not None]
        correct = sum(1 for r in wg if r["correcto"])
        pct     = f"{correct / len(wg) * 100:.2f}%" if wg else "N/D"
        print(f"\n  → Accuracy: {pct} ({correct}/{len(wg)})")
        print(f"  → Reporte:  {path}\n")


if __name__ == "__main__":
    main()
