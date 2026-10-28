"""Endpoints HTTP de ``agents-service`` (agentes de solo lectura sobre el ERP).

- ``GET /v1/health``: estado mínimo ``{"estado": "ok"}`` (sondeo de salud de Render), sin versiones ni configuración.
- ``POST /v1/agent/queries`` (solo con el agente Gemini activado) y ``POST /v1/agent/groq/queries`` (solo con
  el agente Groq activado): cuerpo CT-B, **identidad verificada obligatoria** (P-9). Ver ``agents_service.gemini_sql``.
  Las rutas y los contratos son los mismos que tenían en ``ai-service``: el proxy del ERP solo cambia de URL.

Controles previos al agente, en orden (si fallan, el agente **no se invoca**):

1. ``X-Internal-Token`` válido (comparación en tiempo constante) → si no, ``401`` genérico.
2. ``Content-Type: application/json`` → si no, ``415``.
3. Tamaño del cuerpo ≤ ``max_body_bytes`` (cabecera y lectura incremental) → si no, ``413``.
4. Cuerpo en UTF-8 → si no, ``400``.
5. Aserción ``X-ERP-Identity`` (P-9) válida y coincidente con usuario, rol y traza → si no, ``401`` genérico.
6. Con ``AGENTS_SERVICE_ALLOWED_USER_IDS``: el usuario de la identidad verificada debe estar en la lista → si no, ``403``.

Nunca se registran cuerpos, tokens ni valores sensibles. Los errores siguen ``{ error, errores? }``.
"""

from __future__ import annotations

import json
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from agents_service.auth.identity import IDENTITY_HEADER, IdentityError, verify_identity_assertion
from agents_service.config.settings import AgentsServiceSettings
from agents_service.gemini_sql.agent import AgentRefusal, AgentUnavailable, GeminiSqlAgent, RateLimited
from agents_service.http.schemas import QueryRequest
from agents_service.orchestrator.ports import AuthorizationContext

TOKEN_HEADER = "X-Internal-Token"
SECURITY_HEADERS = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}

ERROR_INVALID_REQUEST = "La solicitud no es válida."
ERROR_UNAUTHORIZED = "No autorizado."
ERROR_FORBIDDEN = "Acceso no permitido."
ERROR_TOO_LARGE = "La solicitud es demasiado grande."
ERROR_UNSUPPORTED_MEDIA = "El contenido debe ser application/json."
ERROR_RATE_LIMITED = "Demasiadas consultas; inténtalo de nuevo en unos minutos."
ERROR_AGENT_UNAVAILABLE = "El asistente no está disponible por el momento."


def error_response(status_code: int, message: str, errores: list[str] | None = None) -> JSONResponse:
    """Respuesta de error con el formato del ERP y las cabeceras de seguridad."""
    return JSONResponse({"error": message, "errores": errores or []}, status_code=status_code, headers=SECURITY_HEADERS)


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


async def _guarded_request(
    request: Request, settings: AgentsServiceSettings
) -> tuple[str, AuthorizationContext] | JSONResponse:
    """Controles previos (token, tipo, tamaño, UTF-8, identidad P-9, cuentas autorizadas).

    Devuelve el cuerpo de texto y la autorización verificada, o la respuesta de error.
    """
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
    if settings.eval_allowed_user_ids is not None and identity.user_id not in settings.eval_allowed_user_ids:
        return error_response(403, ERROR_FORBIDDEN)
    authorization = AuthorizationContext(rol=identity.rol, origen="erp-session", autenticado=True, modulos=identity.modulos)
    return text, authorization


def _register_agent_route(router: APIRouter, settings: AgentsServiceSettings, path: str, agent: GeminiSqlAgent) -> None:
    @router.post(path)
    async def agent_queries(request: Request) -> JSONResponse:
        guarded = await _guarded_request(request, settings)
        if isinstance(guarded, JSONResponse):
            return guarded
        text, authorization = guarded
        try:
            query = QueryRequest.model_validate_json(text)
        except ValidationError:
            return error_response(400, ERROR_INVALID_REQUEST)
        try:
            answer = await run_in_threadpool(agent.answer, query, authorization)
        except AgentRefusal as refusal:
            body = {"id_traza": query.id_traza, "estado": refusal.estado, "texto": refusal.texto, "tabla": None, "sql": None}
            return JSONResponse(body, status_code=200, headers=SECURITY_HEADERS)
        except RateLimited:
            return error_response(429, ERROR_RATE_LIMITED)
        except AgentUnavailable as unavailable:
            return error_response(unavailable.status, ERROR_AGENT_UNAVAILABLE)
        body = {
            "id_traza": answer.id_traza,
            "estado": answer.estado,
            "texto": answer.texto,
            "tabla": {"columnas": answer.columnas, "filas": answer.filas} if answer.columnas else None,
            "sql": answer.sql,
        }
        return JSONResponse(body, status_code=200, headers=SECURITY_HEADERS)


def build_router(
    settings: AgentsServiceSettings,
    agent: GeminiSqlAgent | None = None,
    groq_agent: GeminiSqlAgent | None = None,
) -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.get("/health")
    async def health() -> JSONResponse:
        return JSONResponse({"estado": "ok"}, headers=SECURITY_HEADERS)

    if agent is not None:
        _register_agent_route(router, settings, "/agent/queries", agent)
    if groq_agent is not None:
        _register_agent_route(router, settings, "/agent/groq/queries", groq_agent)

    return router
