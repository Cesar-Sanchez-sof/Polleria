"""Composición de los agentes de SQL (Gemini y Groq) con la allowlist financiera y el Executor de solo lectura."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

import httpx

from ai_service.execution.postgres_readonly import PostgresReadOnlyExecutor, psycopg_connection_factory
from ai_service.gemini_sql.agent import ACCEPTED_ORIGIN, GeminiSqlAgent, SqlTextClient
from ai_service.gemini_sql.client import GeminiHttpClient, GroqHttpClient
from ai_service.gemini_sql.config import GeminiSqlSettings, GroqSqlSettings
from ai_service.validation.allowlist import load_allowlist
from ai_service.validation.validator import SqlValidator

SERVICE_ROOT = Path(__file__).resolve().parents[3]  # ai-service/
ALLOWLIST_FILE = "allowlist.readonly_erp.json"  # misma allowlist financiera que el Modelo R con datos reales


def _assemble(
    client: SqlTextClient, readonly_dsn: str, provider: str, root: Path, connection_factory: Callable[[], object] | None
) -> GeminiSqlAgent:
    allowlist = load_allowlist(root / "knowledge" / ALLOWLIST_FILE)
    validator = SqlValidator(allowlist)
    executor = PostgresReadOnlyExecutor(
        connection_factory or psycopg_connection_factory(readonly_dsn),
        validator,
        accepted_origins=frozenset({ACCEPTED_ORIGIN}),
    )
    return GeminiSqlAgent(client, allowlist, validator, executor, provider=provider)


def build_gemini_sql_agent(
    settings: GeminiSqlSettings,
    *,
    root: Path = SERVICE_ROOT,
    transport: httpx.BaseTransport | None = None,
    connection_factory: Callable[[], object] | None = None,
) -> GeminiSqlAgent:
    """``transport`` y ``connection_factory`` solo se usan en pruebas (sin red ni base de datos)."""
    return _assemble(GeminiHttpClient(settings, transport=transport), settings.readonly_dsn, "gemini", root, connection_factory)


def build_groq_sql_agent(
    settings: GroqSqlSettings,
    *,
    root: Path = SERVICE_ROOT,
    transport: httpx.BaseTransport | None = None,
    connection_factory: Callable[[], object] | None = None,
) -> GeminiSqlAgent:
    """Mismo agente y mismas barreras que Gemini; solo cambia el proveedor que propone el SELECT."""
    return _assemble(GroqHttpClient(settings, transport=transport), settings.readonly_dsn, "groq", root, connection_factory)
