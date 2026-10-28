"""Aplicación FastAPI del servicio de IA de **desarrollo** (T028).

Controles de exposición:

- Sin documentación: ``/docs``, ``/redoc`` y ``/openapi.json`` desactivados (``404``).
- ``TrustedHostMiddleware`` solo acepta ``Host: 127.0.0.1``. Es una capa adicional: la garantía de
  escuchar solo en ``127.0.0.1`` la da la configuración validada (``config.settings``) que usa el
  arranque (``ai_service.main``).
- Sin CORS: el navegador nunca llama a este servicio, solo el proxy del ERP.
- Cabeceras ``Cache-Control: no-store`` y ``X-Content-Type-Options: nosniff`` en todas las
  respuestas, incluidas las de error.
- Errores genéricos con el formato ``{ error, errores? }``: ``404``/``405`` y ``500`` sin trazas,
  rutas internas ni detalles de la excepción.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from ai_service.config.settings import ALLOWED_HOST, ServiceSettings
from ai_service.http.routes import SECURITY_HEADERS, build_router, error_response
from ai_service.orchestrator.pipeline import Orchestrator

ERROR_NOT_FOUND = "Recurso no encontrado."
ERROR_METHOD = "Método no permitido."
ERROR_INTERNAL = "Error interno del servicio."


class SecurityHeadersMiddleware:
    """Añade las cabeceras de seguridad a toda respuesta que atraviese la aplicación."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = [(k, v) for k, v in message.get("headers", []) if k.lower() not in {b"cache-control", b"x-content-type-options"}]
                headers += [(k.lower().encode("latin-1"), v.encode("latin-1")) for k, v in SECURITY_HEADERS.items()]
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)


def create_app(settings: ServiceSettings, orchestrator: Orchestrator) -> FastAPI:
    app = FastAPI(
        title="ai-service (desarrollo)",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.include_router(build_router(settings, orchestrator))
    # El último middleware añadido es el más externo: las cabeceras de seguridad deben cubrir
    # también el 400 que genera TrustedHostMiddleware.
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=[ALLOWED_HOST])
    app.add_middleware(SecurityHeadersMiddleware)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_request: Request, exc: StarletteHTTPException):
        if exc.status_code == 404:
            return error_response(404, ERROR_NOT_FOUND)
        if exc.status_code == 405:
            return error_response(405, ERROR_METHOD)
        return error_response(exc.status_code, ERROR_INTERNAL if exc.status_code >= 500 else "Solicitud no válida.")

    @app.exception_handler(Exception)
    async def unexpected_error(_request: Request, _exc: Exception):
        # Sin detalles: ni mensaje, ni tipo, ni traza de la excepción.
        return error_response(500, ERROR_INTERNAL)

    return app
