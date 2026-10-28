"""Arranque de ``agents-service``.

Local (desde ``agents-service/``)::

    set PYTHONPATH=src
    set AGENTS_SERVICE_HOST=127.0.0.1
    python -m agents_service.main

En Render lo arranca el ``Dockerfile`` (``python -m agents_service.main``) con las variables del panel.

La configuración se valida antes de arrancar (``config.settings``): sin credenciales, sin identidad
firmada o sin ningún agente activo, el proceso termina sin escuchar. Sin registro de accesos ni cabecera
``server``; no se registran cuerpos ni credenciales.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from agents_service.config.settings import ServiceConfigError, load_service_settings
from agents_service.gemini_sql.config import GeminiSqlConfigError

# agents-service/.env (ignorado por Git): solo para desarrollo local; en Render se usan variables de entorno.
DOTENV_PATH = Path(__file__).resolve().parents[2] / ".env"


def main() -> int:
    try:
        settings = load_service_settings(os.environ, dotenv_path=DOTENV_PATH)
    except (ServiceConfigError, GeminiSqlConfigError) as exc:
        print(f"Configuración inválida: {exc}", file=sys.stderr)
        return 2

    import uvicorn

    from agents_service.gemini_sql.assembly import build_gemini_sql_agent, build_groq_sql_agent
    from agents_service.http.app import create_app

    agent = build_gemini_sql_agent(settings.gemini) if settings.gemini is not None else None
    groq_agent = build_groq_sql_agent(settings.groq) if settings.groq is not None else None
    active = [name for name, on in (("Gemini", agent), ("Groq", groq_agent)) if on is not None]
    print(f"agents-service: agentes activos: {', '.join(active)}; escuchando en {settings.host}:{settings.port}", file=sys.stderr)
    uvicorn.run(
        create_app(settings, agent, groq_agent),
        host=settings.host,
        port=settings.port,
        access_log=False,
        log_level="warning",
        server_header=False,
        date_header=False,
        proxy_headers=True,  # detrás del proxy de Render
        forwarded_allow_ips="*",
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
