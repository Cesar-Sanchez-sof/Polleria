# -*- coding: utf-8 -*-
"""Run SQL-generation evaluations against the configured Gemini and/or Groq agent."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections import deque
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from math import ceil
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
AGENTS_SRC = PROJECT_ROOT / "agents-service" / "src"
sys.path.insert(0, str(AGENTS_SRC))

from agents_service.agent_sql.assembly import (  # noqa: E402
    build_gemini_sql_agent,
    build_groq_sql_agent,
)
from agents_service.agent_sql.config import GeminiSqlConfigError  # noqa: E402
from agents_service.agent_sql.agent import ACCEPTED_ORIGIN, SYSTEM_PROMPT  # noqa: E402
from agents_service.config.settings import (  # noqa: E402
    ServiceConfigError,
    load_service_settings,
    read_dotenv_keys,
)
from agents_service.execution.postgres_readonly import (  # noqa: E402
    PostgresReadOnlyExecutor,
    psycopg_connection_factory,
)
from agents_service.http.schemas import QueryRequest, User  # noqa: E402
from agents_service.orchestrator.ports import AuthorizationContext  # noqa: E402
from agents_service.validation.allowlist import load_allowlist  # noqa: E402
from agents_service.validation.validator import SqlValidator  # noqa: E402

CASES_FILE = Path(__file__).with_name("benchmark_cases_350.json")
SERVICE_DOTENV_PATH = PROJECT_ROOT / "agents-service" / ".env"
ALLOWLIST_FILE = PROJECT_ROOT / "agents-service" / "knowledge" / "allowlist.readonly_erp.json"
GROQ_REQUESTS_PER_MINUTE = 30
GROQ_TOKENS_PER_MINUTE = 8_000
GROQ_RATE_WINDOW_SECONDS = 60.0
GROQ_INITIAL_TOKENS_PER_BYTE = 0.30
GROQ_INITIAL_COMPLETION_RESERVE = 256
ANSI_GREEN = "\033[32m"
ANSI_RED = "\033[31m"
ANSI_YELLOW = "\033[33m"
ANSI_BLUE = "\033[34m"
ANSI_PURPLE = "\033[35m"
ANSI_CYAN = "\033[36m"
ANSI_RESET = "\033[0m"


def colorize(text: str, color: str) -> str:
    return f"{color}{text}{ANSI_RESET}"


def metric_color(is_correct: bool | None) -> str:
    if is_correct is None:
        return ANSI_YELLOW
    return ANSI_GREEN if is_correct else ANSI_RED


def format_result_rows(rows: list[dict[str, Any]] | None) -> str:
    if rows is None:
        return "[NO EJECUTADA]"
    return json.dumps(rows, ensure_ascii=False, indent=2, default=str)


class GroqQuotaLimiter:
    """Rolling-window limiter using provider usage to improve estimates for later prompts."""

    def __init__(self) -> None:
        self._events: deque[list[float]] = deque()
        self._tokens_per_byte = GROQ_INITIAL_TOKENS_PER_BYTE
        self._completion_reserve = GROQ_INITIAL_COMPLETION_RESERVE
        self._has_prompt_measurement = False

    def estimate(self, prompt: str) -> tuple[int, int]:
        prompt_bytes = len(prompt.encode("utf-8"))
        estimated_tokens = ceil(prompt_bytes * self._tokens_per_byte) + self._completion_reserve
        if estimated_tokens > GROQ_TOKENS_PER_MINUTE:
            raise ValueError("El prompt estimado excede el presupuesto de 8.000 tokens por minuto.")
        return prompt_bytes, estimated_tokens

    def acquire(self, estimated_tokens: int) -> list[float]:
        while True:
            now = time.monotonic()
            while self._events and now - self._events[0][0] >= GROQ_RATE_WINDOW_SECONDS:
                self._events.popleft()

            wait_seconds = 0.0
            if len(self._events) >= GROQ_REQUESTS_PER_MINUTE:
                wait_seconds = max(
                    wait_seconds,
                    self._events[0][0] + GROQ_RATE_WINDOW_SECONDS - now,
                )
            if sum(event[1] for event in self._events) + estimated_tokens > GROQ_TOKENS_PER_MINUTE:
                wait_seconds = max(
                    wait_seconds,
                    self._events[0][0] + GROQ_RATE_WINDOW_SECONDS - now,
                )
            if wait_seconds <= 0:
                event = [now, float(estimated_tokens)]
                self._events.append(event)
                return event

            print(
                f"[groq] Cuota TPM/RPM: esperando {wait_seconds:.1f} s "
                f"(estimado {estimated_tokens} tokens por solicitud).",
                flush=True,
            )
            time.sleep(wait_seconds)

    def record_usage(
        self,
        event: list[float],
        prompt_bytes: int,
        usage: dict[str, int] | None,
    ) -> None:
        if not usage:
            return
        total_tokens = usage.get("total_tokens")
        if isinstance(total_tokens, int) and total_tokens >= 0:
            event[1] = float(total_tokens)

        prompt_tokens = usage.get("prompt_tokens")
        completion_tokens = usage.get("completion_tokens")
        if isinstance(prompt_tokens, int) and prompt_tokens >= 0 and prompt_bytes:
            measured_ratio = prompt_tokens / prompt_bytes
            adjusted_ratio = measured_ratio * 1.05
            if self._has_prompt_measurement:
                self._tokens_per_byte = max(self._tokens_per_byte, adjusted_ratio)
            else:
                self._tokens_per_byte = adjusted_ratio
                self._has_prompt_measurement = True
        if isinstance(completion_tokens, int) and completion_tokens >= 0:
            self._completion_reserve = max(
                GROQ_INITIAL_COMPLETION_RESERVE,
                ceil(completion_tokens * 1.25),
            )


def load_cases(path: Path = CASES_FILE) -> list[dict[str, Any]]:
    """Load cases from the generated suite or a simple list-based JSON file."""
    with path.open(encoding="utf-8") as file:
        data = json.load(file)

    cases = data.get("casos") if isinstance(data, dict) else data
    if not isinstance(cases, list) or not cases:
        raise ValueError(f"{path} debe contener una lista no vacía de casos o una clave 'casos'.")

    normalized = []
    for index, case in enumerate(cases, start=1):
        if not isinstance(case, dict):
            raise ValueError(f"El caso {index} no es un objeto JSON.")
        question = case.get("pregunta") or case.get("question") or case.get("query")
        expected_sql = case.get("sql_gold") or case.get("gold_sql") or case.get("expected_sql")
        if not isinstance(question, str) or not question.strip():
            raise ValueError(f"El caso {index} no tiene pregunta/query válida.")
        if not isinstance(expected_sql, str) or not expected_sql.strip():
            raise ValueError(f"El caso {index} no tiene SQL de referencia válido.")
        normalized.append(
            {
                "id": case.get("id", f"case-{index:03d}"),
                "question": question.strip(),
                "expected_sql": expected_sql.strip(),
            }
        )
    return normalized


def normalize_sql(sql: str) -> str:
    """Normalize whitespace and optional trailing semicolons for exact-match scoring."""
    return re.sub(r"\s+", " ", sql).strip().rstrip(";").strip()


def canonical_rows(rows: list[dict[str, Any]]) -> tuple[tuple[str, ...], ...]:
    """Canonicalize SQL denotations, ignoring row order and column labels."""
    normalized = []
    for row in rows:
        normalized.append(tuple(_canonical_value(value) for value in row.values()))
    return tuple(sorted(normalized, key=repr))


def _canonical_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return str(value.normalize())
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(Decimal(str(value)).normalize())
    if isinstance(value, str):
        try:
            return str(Decimal(value).normalize())
        except InvalidOperation:
            return value
    return str(value)


def valid_efficiency_score(
    gold_seconds: float | None,
    generated_seconds: float,
    execution_correct: bool,
) -> float | None:
    if gold_seconds is None or gold_seconds <= 0:
        return None
    if not execution_correct:
        return 0.0
    if generated_seconds <= 0:
        return None
    return min(1.0, (gold_seconds / generated_seconds) ** 0.5)


def _build_gold_executor(agent_settings: Any) -> tuple[SqlValidator, PostgresReadOnlyExecutor]:
    allowlist = load_allowlist(ALLOWLIST_FILE)
    validator = SqlValidator(allowlist)
    executor = PostgresReadOnlyExecutor(
        psycopg_connection_factory(agent_settings.readonly_dsn),
        validator,
        accepted_origins=frozenset({ACCEPTED_ORIGIN}),
    )
    return validator, executor


def evaluate_agent(name: str, builder: Any, agent_settings: Any, cases: list[dict[str, Any]]) -> dict[str, Any]:
    agent = builder(settings=agent_settings)
    gold_validator, gold_executor = _build_gold_executor(agent_settings)
    quota_limiter = GroqQuotaLimiter() if name == "groq" else None
    auth = AuthorizationContext(
        rol="contador_demo",
        origen=ACCEPTED_ORIGIN,
        autenticado=True,
        modulos=None,
    )
    case_results = []
    interrupted = False

    try:
        for case in cases:
            quota_event = None
            prompt_bytes = 0
            if quota_limiter is not None:
                tables = agent.permitted_tables("contador_demo", auth)
                prompt = agent.build_prompt("contador_demo", case["question"], tables)
                prompt_bytes, estimated_tokens = quota_limiter.estimate(f"{SYSTEM_PROMPT}\n{prompt}")
                quota_event = quota_limiter.acquire(estimated_tokens)

            started_at = time.perf_counter()
            generated_sql = None
            generated_rows = None
            answer_error = None
            try:
                answer = agent.answer(
                    QueryRequest(
                        id_traza=f"eval-{case['id']}",
                        mensaje=case["question"],
                        usuario=User(id=1, rol="admin"),
                        historial=[],
                        fecha_referencia_lima=datetime.now().date(),
                    ),
                    auth,
                )
                generated_sql = answer.sql
                generated_rows = [
                    dict(zip(answer.columnas, row, strict=True))
                    for row in answer.filas
                ]
            except Exception as exc:
                answer_error = str(exc).replace(agent_settings.api_key, "[REDACTED]")
                answer_error = answer_error.replace(agent_settings.readonly_dsn, "[REDACTED]")
                print(f"[{name}] Falló el caso {case['id']}: {answer_error}", file=sys.stderr)

            elapsed_seconds = round(time.perf_counter() - started_at, 3)
            sql_execution_seconds = round(agent.last_sql_execution_seconds, 6)
            token_usage = getattr(agent, "last_token_usage", None)
            if quota_limiter is not None and quota_event is not None:
                quota_limiter.record_usage(quota_event, prompt_bytes, token_usage)

            gold_rows = None
            gold_execution_seconds = None
            gold_error = None
            try:
                verdict = gold_validator.validate(case["expected_sql"], "contador_demo")
                if not verdict.approved or not verdict.normalized_sql:
                    raise ValueError("SQL gold rechazada por el validador: " + ",".join(verdict.reasons))
                gold_started = time.perf_counter()
                gold_rows = gold_executor.execute_authorized(verdict, auth)
                gold_execution_seconds = time.perf_counter() - gold_started
            except Exception as exc:
                gold_error = str(exc).replace(agent_settings.readonly_dsn, "[REDACTED]")
                print(f"[{name}] SQL gold inválida para {case['id']}: {gold_error}", file=sys.stderr)

            exact_match = (
                generated_sql is not None
                and normalize_sql(generated_sql) == normalize_sql(case["expected_sql"])
            )
            execution_accuracy = (
                canonical_rows(generated_rows) == canonical_rows(gold_rows)
                if gold_rows is not None and generated_rows is not None
                else False if gold_rows is not None else None
            )
            ves = (
                valid_efficiency_score(
                    gold_execution_seconds,
                    sql_execution_seconds,
                    execution_accuracy is True,
                )
                if gold_rows is not None else None
            )
            result = {
                **case,
                "generated_sql": generated_sql,
                "exact_match": exact_match,
                "execution_succeeded": generated_rows is not None,
                "execution_accuracy": execution_accuracy,
                "ves": round(ves, 6) if ves is not None else None,
                "elapsed_seconds": elapsed_seconds,
                "sql_execution_seconds": sql_execution_seconds,
                "gold_execution_seconds": round(gold_execution_seconds, 6)
                if gold_execution_seconds is not None else None,
                "token_usage": token_usage,
            }
            if answer_error:
                result["error"] = answer_error
            if gold_error:
                result["gold_error"] = gold_error
            case_results.append(result)

            total_tokens = token_usage.get("total_tokens") if token_usage else None
            tokens_text = (
                f"{total_tokens} (entrada={token_usage.get('prompt_tokens', '?')}, "
                f"salida={token_usage.get('completion_tokens', '?')})"
                if total_tokens is not None else "N/D"
            )
            ex_text = "N/D" if execution_accuracy is None else ("OK" if execution_accuracy else "X")
            ves_text = "N/D" if ves is None else f"{ves:.3f}"
            provider_tag = f"[{name}]"
            if name == "groq":
                provider_tag = colorize(provider_tag, ANSI_YELLOW)
            em_metric = colorize(
                f"EM={'OK' if exact_match else 'X'}",
                metric_color(exact_match),
            )
            ex_metric = colorize(
                f"EX={ex_text}",
                metric_color(execution_accuracy),
            )
            ves_metric = colorize(
                f"VES={ves_text}",
                ANSI_YELLOW if ves is None else ANSI_GREEN if ves > 0 else ANSI_RED,
            )
            ts_metric = colorize("TS=N/D", ANSI_YELLOW)
            timing = colorize(
                f"tiempo={elapsed_seconds:.3f}s SQL={sql_execution_seconds:.6f}s",
                ANSI_BLUE,
            )
            print(
                f"{provider_tag} {case['id']} {em_metric} {ex_metric} "
                f"{ves_metric} {ts_metric} tokens={tokens_text} {timing}",
                flush=True,
            )
            print(colorize(f"  SQL gold:\n{case['expected_sql']}", ANSI_PURPLE), flush=True)
            print(colorize(f"  Respuesta SQL gold:\n{format_result_rows(gold_rows)}", ANSI_PURPLE), flush=True)
            print(colorize(f"  SQL generada:\n{generated_sql or '[SIN SQL]'}", ANSI_CYAN), flush=True)
            print(
                colorize(f"  Respuesta SQL generada:\n{format_result_rows(generated_rows)}", ANSI_CYAN),
                flush=True,
            )
    except KeyboardInterrupt:
        interrupted = True
        print(f"\n[{name}] Interrumpido; se guardarán los {len(case_results)} casos completados.", flush=True)

    passed = sum(result["exact_match"] for result in case_results)
    gold_valid = [result for result in case_results if result.get("gold_error") is None]
    ex_passed = sum(result["execution_accuracy"] is True for result in gold_valid)
    ves_values = [result["ves"] for result in gold_valid if result["ves"] is not None]
    executed = sum(result["execution_succeeded"] for result in case_results)
    ves_summary = f"{sum(ves_values) / len(ves_values):.4f}" if ves_values else "N/D"
    provider_tag = f"[{name}]"
    if name == "groq":
        provider_tag = colorize(provider_tag, ANSI_YELLOW)
    em_summary = colorize(
        f"EM={passed}/{len(case_results)}",
        metric_color(passed == len(case_results) if case_results else None),
    )
    ex_summary = colorize(
        f"EX={ex_passed}/{len(gold_valid)}",
        metric_color(ex_passed == len(gold_valid) if gold_valid else None),
    )
    ves_summary_metric = colorize(
        f"VES={ves_summary}",
        ANSI_YELLOW if not ves_values else ANSI_GREEN if float(ves_summary) > 0 else ANSI_RED,
    )
    print(
        f"{provider_tag} Resumen: ejecutadas={executed}/{len(case_results)}, "
        f"{em_summary}, {ex_summary}, {ves_summary_metric}, "
        f"{colorize('TS=N/D', ANSI_YELLOW)}.",
        flush=True,
    )
    return {
        "agent": name,
        "total_cases": len(case_results),
        "exact_match_count": passed,
        "exact_match_rate": round(passed / len(case_results), 4) if case_results else 0.0,
        "execution_success_count": executed,
        "execution_error_count": len(case_results) - executed,
        "execution_accuracy_count": ex_passed,
        "execution_accuracy_denominator": len(gold_valid),
        "execution_accuracy_rate": round(ex_passed / len(gold_valid), 4) if gold_valid else None,
        "ves": round(sum(ves_values) / len(ves_values), 6) if ves_values else None,
        "test_suite_accuracy": None,
        "interrupted": interrupted,
        "cases": case_results,
    }


def write_reports(results: list[dict[str, Any]]) -> tuple[Path, Path]:
    reports_dir = Path(__file__).parent / "reports"
    results_dir = Path(__file__).parent / "results"
    reports_dir.mkdir(parents=True, exist_ok=True)
    results_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().astimezone().strftime("%Y%m%d_%H%M%S_%f")
    json_path = results_dir / f"report_{timestamp}.json"
    markdown_path = reports_dir / "report.md"
    json_path.write_text(
        json.dumps({"generated_at": datetime.now().astimezone().isoformat(), "agents": results}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    lines = [
        "# Reporte de evaluación Text-to-SQL",
        "",
        "| Agente | Casos | EM | EX | VES | TS | Ejecutadas | Errores |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for result in results:
        ex_rate = result["execution_accuracy_rate"]
        ves = result["ves"]
        ex_text = f"{ex_rate:.2%}" if ex_rate is not None else "N/D"
        ves_text = f"{ves:.4f}" if ves is not None else "N/D"
        lines.append(
            f"| {result['agent']} | {result['total_cases']} | {result['exact_match_rate']:.2%} | "
            f"{ex_text} | {ves_text} | N/D | {result['execution_success_count']} | "
            f"{result['execution_error_count']} |"
        )
        lines.extend(
            [
                "",
                f"**{result['agent']}**: EM compara SQL normalizado. EX compara los resultados gold/generado "
                "ignorando el orden de filas y las etiquetas de columnas. VES es la media de "
                "`sqrt(tiempo_gold / tiempo_generado)`, limitada a 1; las respuestas incorrectas valen 0.",
                "",
                "TS = N/D: no se configuraron bases/estados alternativos para ejecutar una suite de pruebas.",
            ]
        )
        for case in result["cases"]:
            lines.extend(
                [
                    "",
                    f"<details><summary>{case['id']} — EM={'OK' if case['exact_match'] else 'X'}, "
                    f"EX={case['execution_accuracy'] if case['execution_accuracy'] is not None else 'N/D'}, "
                    f"VES={case['ves'] if case['ves'] is not None else 'N/D'}</summary>",
                    "",
                    "**SQL gold**",
                    "",
                    "```sql",
                    case["expected_sql"],
                    "```",
                    "",
                    "**SQL generada**",
                    "",
                    "```sql",
                    case["generated_sql"] or "[SIN SQL]",
                    "```",
                    "",
                    "</details>",
                ]
            )
    markdown_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return markdown_path, json_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Evalúa casos SQL con los agentes configurados.")
    parser.add_argument(
        "--provider",
        choices=("all", "gemini", "groq"),
        default="all",
        help="Proveedor a evaluar (por defecto, todos los configurados).",
    )
    parser.add_argument(
        "--start-at",
        type=int,
        default=1,
        help="Número de caso desde el que empezar (base 1; sirve para dividir la suite en tandas).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Máximo de casos de esta tanda.",
    )
    args = parser.parse_args()
    if args.start_at < 1:
        parser.error("--start-at debe ser un entero positivo.")
    if args.limit is not None and args.limit < 1:
        parser.error("--limit debe ser un entero positivo.")

    try:
        cases = load_cases()
        if args.start_at > len(cases):
            parser.error(f"--start-at no puede superar el total de casos ({len(cases)}).")
        end_at = min(len(cases), args.start_at - 1 + args.limit) if args.limit else len(cases)
        cases = cases[args.start_at - 1 : end_at]
        dotenv_values = read_dotenv_keys(SERVICE_DOTENV_PATH)
        validation_env = dict(os.environ)
        # The evaluator runs with the agents-service's read-only database settings, not the ERP
        # application's write connection inherited from the project environment.
        validation_env.pop("DATABASE_URL", None)
        if args.provider == "groq":
            validation_env.pop("GEMINI_API_KEY", None)
            validation_env.pop("GEMINI_MODEL", None)
            dotenv_values.pop("GEMINI_API_KEY", None)
            dotenv_values.pop("GEMINI_MODEL", None)
        elif args.provider == "gemini":
            validation_env.pop("GROQ_API_KEY", None)
            validation_env.pop("GROQ_MODEL", None)
            dotenv_values.pop("GROQ_API_KEY", None)
            dotenv_values.pop("GROQ_MODEL", None)
        for key, value in dotenv_values.items():
            validation_env.setdefault(key, value)
        settings = load_service_settings(
            validation_env,
            dotenv_path=None,
        )
    except (OSError, json.JSONDecodeError, ValueError, ServiceConfigError, GeminiSqlConfigError) as exc:
        parser.exit(2, f"Error de configuración o de casos: {exc}\n")

    available = {
        "gemini": (build_gemini_sql_agent, settings.gemini),
        "groq": (build_groq_sql_agent, settings.groq),
    }
    selected = [
        (name, *available[name])
        for name in ("gemini", "groq")
        if available[name][1] is not None and args.provider in ("all", name)
    ]
    if not selected:
        parser.error(f"No hay credenciales configuradas para el proveedor '{args.provider}'.")

    print(
        f"Se evaluarán los casos {args.start_at}-{end_at} ({len(cases)} en esta tanda) "
        f"con: {', '.join(name for name, _, _ in selected)}."
    )
    results = []
    interrupted = False
    for name, builder, agent_settings in selected:
        try:
            result = evaluate_agent(name, builder, agent_settings, cases)
        except KeyboardInterrupt:
            interrupted = True
            print(f"\n[{name}] Interrumpido antes de completar el caso actual.", flush=True)
            break
        results.append(result)
        if result["interrupted"]:
            interrupted = True
            break
    markdown_path, json_path = write_reports(results)
    print(f"Reporte Markdown: {markdown_path}")
    print(f"Resultados JSON: {json_path}")
    return 130 if interrupted else 0


if __name__ == "__main__":
    raise SystemExit(main())
