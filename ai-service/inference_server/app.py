"""API HTTP del servicio de inferencia XiYanSQL (contrato ``ai_service.sqlgen.wire``).

Controles:

- Credencial obligatoria en todas las rutas (comparación en tiempo constante); sin ella, ``401`` sin
  leer el cuerpo ni tocar el modelo.
- Solo ``Host: 127.0.0.1``; sin documentación ni CORS; ``Cache-Control: no-store`` y ``nosniff``.
- Cuerpo JSON acotado; el mensaje debe tener la estructura del prompt XiYan del entrenamiento (no
  es un punto de completado genérico) y caber en 1024 tokens con ``max_new_tokens``.
- Una sola generación a la vez: si el modelo está ocupado → ``503 BUSY`` (sin cola; con
  ``XIYAN_QUEUE_WAIT_S`` espera como máximo esos segundos).
- El modelo se carga en un hilo al arrancar (``lifespan``), nunca al importar. Mientras carga →
  ``503 MODEL_LOADING``; si la carga falla → ``503 MODEL_ERROR``.
- Sin registros de prompts, SQL, rutas ni credenciales; errores con código fijo.
- Consola ``[MODEL]``: tiempo de carga, memoria de la GPU y, por generación, tokens del prompt y de salida,
  latencia, tokens por segundo, motivo de fin y pico de VRAM (solo números y el id aleatorio de la petición).
"""

from __future__ import annotations

import sys
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

from ai_service.sqlgen.profile import BASE_MODEL_ID, TRAINING_MAX_LENGTH
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


def model_log(line: str) -> None:
    """Línea ``[MODEL]`` en la terminal del servicio (sin prompts, SQL, rutas ni credenciales)."""
    print(f"[MODEL] {line}", file=sys.stderr, flush=True)


def _gib(mib: int | None) -> str:
    return f"{mib / 1024:.2f} GiB" if isinstance(mib, int) else "n/d"


class ModelState:
    """Estado de carga del modelo y exclusión mutua de la generación."""

    def __init__(self, *, warmup: bool = False) -> None:
        self.status = "loading"
        self.generation_lock = threading.Lock()
        self.loader: threading.Thread | None = None
        self._warmup = warmup

    def load(self, engine: InferenceEngine) -> None:
        started = time.perf_counter()
        try:
            engine.load()
        except Exception as exc:  # sin detalles: ni rutas ni trazas en la respuesta
            self.status = "error"
            model_log(f"error de carga: {getattr(exc, 'code', type(exc).__name__)}")
            return
        seconds = time.perf_counter() - started
        resources = _resources(engine)
        model_log(
            f"cargado {BASE_MODEL_ID} + {engine.adapter} en {seconds:.1f} s · VRAM asignada "
            f"{_gib(resources.get('allocated'))} · reservada {_gib(resources.get('reserved'))} · "
            f"libre {_gib(resources.get('free'))} de {_gib(resources.get('total'))}"
        )
        lookup = getattr(engine, "prompt_lookup", 0)
        model_log(f"prompt_lookup={'on (' + str(lookup) + ' tokens)' if lookup else 'off'} · warmup={'on' if self._warmup else 'off'}")
        if self._warmup and hasattr(engine, "warm_up"):
            started = time.perf_counter()
            try:
                result = engine.warm_up()
            except Exception as exc:
                model_log(f"WARMUP fallo: {getattr(exc, 'code', type(exc).__name__)}")
            else:
                model_log(f"WARMUP {int((time.perf_counter() - started) * 1000)} ms · {result.output_tokens} tok salida")
        self.status = "ready"


def _resources(engine: InferenceEngine) -> dict[str, int]:
    resources = getattr(engine, "resources", None)
    if not callable(resources):
        return {}
    try:
        return dict(resources())
    except Exception:
        return {}


def create_app(settings: ServerSettings, engine: InferenceEngine, *, background_load: bool = True) -> FastAPI:
    state = ModelState(warmup=settings.warmup)

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
        if settings.queue_wait_s > 0:
            acquired = await run_in_threadpool(state.generation_lock.acquire, True, settings.queue_wait_s)
        else:
            acquired = state.generation_lock.acquire(blocking=False)
        if not acquired:
            model_log("BUSY: generación en curso; petición rechazada")
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
            rate = result.output_tokens / (latency_ms / 1000) if latency_ms > 0 else 0.0
            model_log(
                f"generate id={payload.request_id[:8]} prompt={prompt_tokens} tok · salida={result.output_tokens} tok · "
                f"{latency_ms} ms · {rate:.1f} tok/s (incluye prefill) · fin={result.finish_reason} · "
                f"VRAM pico {_gib(getattr(result, 'peak_vram_mib', None))} · "
                f"prompt_lookup={'on' if getattr(engine, 'prompt_lookup', 0) else 'off'}"
            )
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
