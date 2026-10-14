"""Endpoints HTTP del servicio de IA (T028, CT-B).

- ``GET /v1/health``: estado mínimo ``{"estado": "ok"}``, sin versiones ni configuración.
- ``POST /v1/queries``: recibe el cuerpo CT-B y delega en ``Orchestrator.handle``, que ya valida el
  contrato (``400``), revalida el rol (``403``), aplica presupuesto e incidentes (``503``) y audita.

Controles previos al orquestador, en orden (si fallan, el orquestador **no se invoca**):

1. ``X-Internal-Token`` válido (comparación en tiempo constante) → si no, ``401`` genérico.
2. ``Content-Type: application/json`` → si no, ``415``.
3. Tamaño del cuerpo ≤ ``max_body_bytes`` (cabecera y lectura incremental) → si no, ``413``.
4. Cuerpo en UTF-8 → si no, ``400``.
5. Con ``AI_ASSISTANT_IDENTITY_KEY`` configurada (P-9): aserción ``X-ERP-Identity`` válida y
   coincidente con usuario, rol y traza → si no, ``401`` genérico. Solo entonces se crea un
   ``AuthorizationContext`` autenticado (``erp-session``).

Nunca se registran cuerpos, tokens ni valores sensibles. Los errores siguen ``{ error, errores? }``.
"""

from __future__ import annotations

import json
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from ai_service.auth.identity import IDENTITY_HEADER, IdentityError, verify_identity_assertion
from ai_service.config.settings import ServiceSettings
from ai_service.orchestrator.pipeline import ERROR_INVALID_REQUEST, ErrorBody, Orchestrator
from ai_service.orchestrator.ports import AuthorizationContext

TOKEN_HEADER = "X-Internal-Token"
SECURITY_HEADERS = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}

ERROR_UNAUTHORIZED = "No autorizado."
ERROR_TOO_LARGE = "La solicitud es demasiado grande."
ERROR_UNSUPPORTED_MEDIA = "El contenido debe ser application/json."


def error_response(status_code: int, message: str, errores: list[str] | None = None) -> JSONResponse:
    """Respuesta de error con el formato del ERP y las cabeceras de seguridad."""
    body = ErrorBody(error=message, errores=errores or [])
    return JSONResponse(body.model_dump(mode="json"), status_code=status_code, headers=SECURITY_HEADERS)


async def _read_limited_body(request: Request, limit: int) -> bytes | None:
    """Lee el cuerpo sin superar ``limit`` bytes; ``None`` si lo excede."""
    declared = request.headers.get("content-length")
    if declared is not None and (not declared.isdigit() or int(declared) > limit):
        return None
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > limit:
            return None
        chunks.append(chunk)
    return b"".join(chunks)


def _identity_subject(text: str) -> tuple[str, int, str] | None:
    """``(id_traza, usuario.id, usuario.rol)`` del cuerpo CT-B, o ``None`` si no tienen el tipo esperado."""
    try:
        data = json.loads(text)
        trace_id, user = data["id_traza"], data["usuario"]
        user_id, rol = user["id"], user["rol"]
    except (ValueError, TypeError, KeyError):
        return None
    if not isinstance(trace_id, str) or not isinstance(rol, str) or not isinstance(user_id, int) or isinstance(user_id, bool):
        return None
    return trace_id, user_id, rol


def build_router(settings: ServiceSettings, orchestrator: Orchestrator) -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.get("/health")
    async def health() -> JSONResponse:
        return JSONResponse({"estado": "ok"}, headers=SECURITY_HEADERS)

    @router.post("/queries")
    async def queries(request: Request) -> JSONResponse:
        if not settings.token_matches(request.headers.get(TOKEN_HEADER)):
            return error_response(401, ERROR_UNAUTHORIZED)

        content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
        if content_type != "application/json":
            return error_response(415, ERROR_UNSUPPORTED_MEDIA)

        raw = await _read_limited_body(request, settings.max_body_bytes)
        if raw is None:
            return error_response(413, ERROR_TOO_LARGE)
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            return error_response(400, ERROR_INVALID_REQUEST)

        authorization = None
        if settings.identity_key is not None:  # P-9: aserción obligatoria, sin excepciones
            subject = _identity_subject(text)
            if subject is None:
                return error_response(400, ERROR_INVALID_REQUEST)
            trace_id, user_id, rol = subject
            try:
                identity = verify_identity_assertion(
                    request.headers.get(IDENTITY_HEADER),
                    key=settings.identity_key,
                    trace_id=trace_id,
                    user_id=user_id,
                    rol=rol,
                    now=time.time(),
                )
            except IdentityError:
                return error_response(401, ERROR_UNAUTHORIZED)  # sin detallar el motivo
            authorization = AuthorizationContext(rol=identity.rol, origen="erp-session", autenticado=True)

        if authorization is None:
            outcome = await run_in_threadpool(orchestrator.handle, text)
        else:
            outcome = await run_in_threadpool(lambda: orchestrator.handle(text, authorization=authorization))
        return JSONResponse(
            outcome.body.model_dump(mode="json"), status_code=outcome.status_code, headers=SECURITY_HEADERS
        )

    return router
