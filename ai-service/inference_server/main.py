"""Arranque **manual** del servicio de inferencia dentro de WSL2 (no se ejecuta en pruebas).

Requisitos (aún no autorizados en la Fase 1): ``fastapi`` y ``uvicorn`` instalados en el entorno de
inferencia; ningún entrenamiento en curso (la GPU de 8 GiB no admite ambos). Desde ``ai-service/``::

    XIYAN_SERVER_ENV=development XIYAN_SERVER_TOKEN=<hex> \\
    XIYAN_ADAPTER_DIR=<ruta absoluta del adaptador> HF_HUB_CACHE=<ruta absoluta de la caché> \\
    PYTHONPATH=src:. python -m inference_server.main

Las rutas y la credencial se pasan en tiempo de ejecución; nunca se escriben en el repositorio.
"""

from __future__ import annotations

import os
import sys

from inference_server.config import ServerConfigError, load_server_settings


def main() -> int:
    try:
        settings = load_server_settings(os.environ)
    except ServerConfigError as exc:
        print(f"Configuración inválida: {exc}", file=sys.stderr)
        return 2

    import uvicorn

    from inference_server.app import create_app
    from inference_server.engine import TransformersEngine

    app = create_app(settings, TransformersEngine(settings))
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        access_log=False,
        proxy_headers=False,
        server_header=False,
        date_header=False,
        workers=1,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
