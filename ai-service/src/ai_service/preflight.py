"""Verificación previa del pipeline de evaluación, **solo lectura** y sin llamadas facturables.

Uso (con las mismas variables de entorno con las que se arranca ``ai_service.main``)::

    python -m ai_service.preflight [--public-url https://<dominio-ngrok>]

Comprueba, en orden:

1. Servicio de inferencia XiYanSQL (``AI_SQLGEN_URL``/``v1/health`` con ``AI_SQLGEN_TOKEN``): ``ready``
   y el adaptador esperado (``AI_SQLGEN_ADAPTER``).
2. ``ai-service`` local (``http://127.0.0.1:<AI_SERVICE_PORT>/v1/health``).
3. Túnel público (opcional): ``<public-url>/v1/health``. Un ``400`` indica que el túnel no reescribe la
   cabecera ``Host`` (``TrustedHostMiddleware`` solo acepta ``127.0.0.1``): usar
   ``ngrok http 127.0.0.1:<puerto> --host-header=rewrite``.
4. Conexión de solo lectura (solo con ``AI_SQL_EXECUTOR=postgres_readonly``): ``SELECT 1`` en una
   transacción ``READ ONLY`` y privilegios de la allowlist (``execution.check_connection``).

No llama a OpenAI (cuesta dinero) ni genera SQL. Nunca imprime tokens, claves ni la cadena de conexión.
"""

from __future__ import annotations

import argparse
import os
import re
import sys

import httpx

from ai_service.config.settings import POSTGRES_EXECUTOR, ServiceConfigError, load_service_settings
from ai_service.main import DOTENV_PATH
from ai_service.sqlgen.wire import TOKEN_HEADER

_PUBLIC_URL_RE = re.compile(r"^https://[A-Za-z0-9.-]+$")


def _get(url: str, headers: dict[str, str] | None = None) -> tuple[int | None, dict | None, str]:
    try:
        response = httpx.get(url, headers=headers, timeout=10, trust_env=False, follow_redirects=False)
    except httpx.HTTPError as exc:
        return None, None, type(exc).__name__
    try:
        data = response.json()
    except ValueError:
        data = None
    return response.status_code, data if isinstance(data, dict) else None, ""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--public-url", help="URL pública del túnel (https://…), sin ruta")
    args = parser.parse_args(argv)
    try:
        settings = load_service_settings(os.environ, dotenv_path=DOTENV_PATH)
    except ServiceConfigError as exc:
        print(f"[FALLO] Configuración de ai-service: {exc}")
        return 2
    print(f"Perfil: generador={settings.sql_generator} executor={settings.sql_executor} llm={settings.llm_provider} "
          f"rag={settings.rag.mode} evaluación={settings.eval_mode} diagnóstico={settings.diagnostics}")
    ok = True

    if settings.sqlgen is not None:
        status, data, err = _get(f"{settings.sqlgen.url}/v1/health", {TOKEN_HEADER: settings.sqlgen.token})
        ready = status == 200 and data is not None and data.get("status") == "ready"
        same = data is not None and data.get("adapter") == settings.sqlgen.adapter
        detail = err or f"HTTP {status}, estado={data and data.get('status')}, adaptador={data and data.get('adapter')}"
        print(f"[{'OK' if ready and same else 'FALLO'}] XiYanSQL {settings.sqlgen.url}: {detail}")
        if ready and not same:
            print(f"        el servicio cargó otro adaptador; se esperaba {settings.sqlgen.adapter}")
        ok &= ready and same
    else:
        print("[AVISO] Generador SQL simulado: XiYanSQL no se usa con esta configuración.")

    status, data, err = _get(f"http://{settings.host}:{settings.port}/v1/health")
    alive = status == 200 and data == {"estado": "ok"}
    print(f"[{'OK' if alive else 'FALLO'}] ai-service {settings.host}:{settings.port}: {err or f'HTTP {status}'}")
    ok &= alive

    if args.public_url:
        url = args.public_url.rstrip("/")
        if not _PUBLIC_URL_RE.match(url):
            print("[FALLO] --public-url debe ser https://<dominio> sin ruta.")
            return 2
        status, data, err = _get(f"{url}/v1/health", {"ngrok-skip-browser-warning": "1"})
        public = status == 200 and data == {"estado": "ok"}
        hint = " (el túnel no reescribe Host: use --host-header=rewrite)" if status == 400 else ""
        print(f"[{'OK' if public else 'FALLO'}] Túnel {url}: {err or f'HTTP {status}'}{hint}")
        ok &= public

    if settings.sql_executor == POSTGRES_EXECUTOR:
        from ai_service.execution.check_connection import main as check_connection

        print("Conexión de solo lectura:")
        ok &= check_connection() == 0
    else:
        print("[AVISO] Executor ficticio: no se consulta PostgreSQL.")

    print("Resultado:", "todo listo" if ok else "hay componentes con fallo")
    return 0 if ok else 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
