"""API HTTP del servicio de inferencia XiYanSQL (contrato ``ai_service.sqlgen.wire``).

Controles:

- Credencial obligatoria en todas las rutas (comparación en tiempo constante); sin ella, ``401`` sin
  leer el cuerpo ni tocar el modelo.
- Solo ``Host: 127.0.0.1``; sin documentación ni CORS; ``Cache-Control: no-store`` y ``nosniff``.
- Cuerpo JSON acotado; el mensaje debe tener la estructura del prompt XiYan del entrenamiento (no
  es un punto de completado genérico) y caber en 1024 tokens con ``max_new_tokens``.
- Una sola generación a la vez: si el modelo está ocupado → ``503 BUSY`` (sin cola).
- El modelo se carga en un hilo al arrancar (``lifespan``), nunca al importar. Mientras carga →
  ``503 MODEL_LOADING``; si la carga falla → ``503 MODEL_ERROR``.
- Sin registros de prompts, SQL, rutas ni credenciales; errores con código fijo.
"""

from __future__ import annotations

import threading
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from ai_service.sqlgen.profile import TRAINING_MAX_LENGTH
from ai_service.sqlgen.prompt import is_xiyan_user_content
from ai_service.sqlgen.wire import TOKEN_HEADER, ErrorResponse, GenerateRequest, GenerateResponse, HealthResponse

from inference_server.config import ALLOWED_HOST, ServerSettings
from inference_server.engine import InferenceEngine

SECURITY_HEADERS = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}


def error(status: int, code: str) -> JSONResponse:
    return JSONResponse(ErrorResponse(error=code).model_dump(), status_code=status, headers=SECURITY_HEADERS)  # type: ignore[arg-type]


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                names = {name.lower().encode("latin-1") for name in SECURITY_HEADERS}
                headers = [(k, v) for k, v in message.get("headers", []) if k.lower() not in names]
                headers += [(k.lower().encode("latin-1"), v.encode("latin-1")) for k, v in SECURITY_HEADERS.items()]
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)


class ModelState:
    """Estado de carga del modelo y exclusión mutua de la generación."""

    def __init__(self) -> None:
        self.status = "loading"
        self.generation_lock = threading.Lock()
        self.loader: threading.Thread | None = None

    def load(self, engine: InferenceEngine) -> None:
        try:
            engine.load()
        except Exception:  # sin detalles: ni rutas ni trazas en la respuesta
            self.status = "error"
        else:
            self.status = "ready"


def create_app(settings: ServerSettings, engine: InferenceEngine, *, background_load: bool = True) -> FastAPI:
    state = ModelState()

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        if background_load:
            state.loader = threading.Thread(target=state.load, args=(engine,), name="xiyan-loader", daemon=True)
            state.loader.start()
        else:
            state.load(engine)
        yield

    app = FastAPI(title="xiyan-inference (desarrollo)", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    app.state.model = state

    @app.get("/v1/health")
    async def health(request: Request):
        if not settings.token_matches(request.headers.get(TOKEN_HEADER)):
            return error(401, "UNAUTHORIZED")
        body = HealthResponse(status=state.status, adapter=engine.adapter)  # type: ignore[arg-type]
        return JSONResponse(body.model_dump(), headers=SECURITY_HEADERS)

    @app.post("/v1/generate")
    async def generate(request: Request):
        if not settings.token_matches(request.headers.get(TOKEN_HEADER)):
            return error(401, "UNAUTHORIZED")
        if request.headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
            return error(415, "UNSUPPORTED_MEDIA_TYPE")
        declared = request.headers.get("content-length")
        if declared is not None and (not declared.isdigit() or int(declared) > settings.max_body_bytes):
            return error(413, "PAYLOAD_TOO_LARGE")
        raw = await request.body()
        if len(raw) > settings.max_body_bytes:
            return error(413, "PAYLOAD_TOO_LARGE")
        try:
            payload = GenerateRequest.model_validate_json(raw)
        except ValidationError:
            return error(400, "INVALID_REQUEST")
        if payload.adapter != engine.adapter:
            return error(409, "ADAPTER_MISMATCH")
        if not is_xiyan_user_content(payload.user_content):
            return error(400, "INVALID_REQUEST")
        if state.status != "ready":
            return error(503, "MODEL_LOADING" if state.status == "loading" else "MODEL_ERROR")
        if not state.generation_lock.acquire(blocking=False):
            return error(503, "BUSY")
        try:
            return await run_in_threadpool(_generate, payload)
        finally:
            state.generation_lock.release()

    def _generate(payload: GenerateRequest) -> JSONResponse:
        try:
            rendered = engine.render(payload.user_content)
            prompt_tokens = engine.count_tokens(rendered)
            if prompt_tokens + payload.max_new_tokens > TRAINING_MAX_LENGTH:
                return error(422, "PROMPT_TOO_LONG")
            started = time.perf_counter()
            result = engine.generate(rendered, payload.max_new_tokens)
            latency_ms = int((time.perf_counter() - started) * 1000)
            body = GenerateResponse(
                request_id=payload.request_id,
                adapter=engine.adapter,
                text=result.text,
                finish_reason=result.finish_reason,  # type: ignore[arg-type]
                prompt_tokens=prompt_tokens,
                output_tokens=result.output_tokens,
                latency_ms=latency_ms,
            )
        except Exception:
            return error(503, "MODEL_ERROR")
        return JSONResponse(body.model_dump(), headers=SECURITY_HEADERS)

    app.add_middleware(TrustedHostMiddleware, allowed_hosts=[ALLOWED_HOST])
    app.add_middleware(SecurityHeadersMiddleware)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_request: Request, exc: StarletteHTTPException):
        return error(exc.status_code if exc.status_code in (404, 405) else 500, "NOT_FOUND" if exc.status_code in (404, 405) else "INTERNAL")

    @app.exception_handler(Exception)
    async def unexpected(_request: Request, _exc: Exception):
        return error(500, "INTERNAL")

    return app
