"""Arranque local del servicio de IA de **desarrollo** (T028).

Uso (solo en la máquina de desarrollo; nunca en producción)::

    set AI_SERVICE_ENV=development
    set AI_SERVICE_INTERNAL_TOKEN=<secrets.token_hex(32)>
    set AI_ASSISTANT_AUDIT_HMAC_KEY=<otro secrets.token_hex(32), distinto del token>
    python -m ai_service.main

La configuración se valida antes de arrancar (``config.settings``): fuera de ``development``, sin
credenciales o con un host distinto de ``127.0.0.1``, el proceso termina sin escuchar. ``uvicorn``
recibe siempre el host de esa configuración validada. Sin registro de accesos ni cabecera
``server``; no se registran cuerpos ni credenciales.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from ai_service.config.settings import ServiceConfigError, load_service_settings, read_dotenv_keys
from ai_service.gemini_sql.config import GeminiSqlConfigError, load_gemini_sql_settings, load_groq_sql_settings

# ai-service/.env (ignorado por Git): solo se leen OPENAI_API_KEY y OPENAI_MODEL, y solo con
# AI_LLM_PROVIDER=openai.
DOTENV_PATH = Path(__file__).resolve().parents[2] / ".env"


def main() -> int:
    try:
        settings = load_service_settings(os.environ, dotenv_path=DOTENV_PATH)
    except ServiceConfigError as exc:
        print(f"Configuración inválida: {exc}", file=sys.stderr)
        return 2

    try:
        dotenv_keys = read_dotenv_keys(DOTENV_PATH)
        identity_configured = settings.identity_key is not None
        gemini_settings = load_gemini_sql_settings(os.environ, dotenv_keys, identity_key_configured=identity_configured)
        groq_settings = load_groq_sql_settings(os.environ, dotenv_keys, identity_key_configured=identity_configured)
    except GeminiSqlConfigError as exc:
        print(f"Configuración inválida: {exc}", file=sys.stderr)
        return 2

    import uvicorn  # solo necesario para levantar el servidor local

    from ai_service.assembly import build_dev_orchestrator
    from ai_service.http.app import create_app

    orchestrator, _audit = build_dev_orchestrator(settings)
    agent = None
    groq_agent = None
    if gemini_settings is not None:  # agente Gemini: solo con AI_GEMINI_SQL=1 y su configuración completa
        from ai_service.gemini_sql.assembly import build_gemini_sql_agent

        agent = build_gemini_sql_agent(gemini_settings)
    if groq_settings is not None:  # agente Groq: solo con AI_GROQ_SQL=1 y su configuración completa
        from ai_service.gemini_sql.assembly import build_groq_sql_agent

        groq_agent = build_groq_sql_agent(groq_settings)
    uvicorn.run(
        create_app(settings, orchestrator, agent, groq_agent),
        host=settings.host,  # validado: solo 127.0.0.1
        port=settings.port,
        access_log=False,
        log_level="warning",
        server_header=False,
        date_header=False,
        proxy_headers=False,
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
